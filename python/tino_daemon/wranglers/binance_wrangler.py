"""Binance wrangler — fetches historical kline data from Binance REST API
and converts to NautilusTrader Bar objects.

Supports:
- Multiple timeframes: 1m, 5m, 15m, 1h, 4h, 1d
- Incremental updates (only fetches missing time ranges)
- Local Parquet caching
- API rate limiting (1200 requests/minute)

Binance klines API: https://binance-docs.github.io/apidocs/spot/en/#kline-candlestick-data
"""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import pandas as pd
from nautilus_trader.model.currencies import USD
from nautilus_trader.model.data import Bar, BarType
from nautilus_trader.model.identifiers import InstrumentId, Symbol
from nautilus_trader.model.instruments import Equity
from nautilus_trader.model.objects import Price, Quantity
from nautilus_trader.persistence.wranglers import BarDataWrangler

from tino_daemon.wranglers.base import BaseWrangler

logger = logging.getLogger(__name__)

# NautilusTrader bar aggregation → Binance interval string
_NT_TO_BINANCE_INTERVAL: dict[str, str] = {
    "1-MINUTE": "1m",
    "5-MINUTE": "5m",
    "15-MINUTE": "15m",
    "1-HOUR": "1h",
    "4-HOUR": "4h",
    "1-DAY": "1d",
}

_BINANCE_API_BASE = "https://api.binance.com"
_KLINES_ENDPOINT = "/api/v3/klines"
_MAX_KLINES_LIMIT = 1000
_RATE_LIMIT_PER_MIN = 1200
_DEFAULT_CACHE_DIR = "~/.tino/cache/binance"
_REQUEST_TIMEOUT = 30


class BinanceWrangler(BaseWrangler):
    """Fetches historical kline data from Binance and converts to NT Bar objects.

    Features:
    - Paginated fetching (max 1000 klines per request)
    - Rate limiting (1200 requests/minute)
    - Local Parquet caching with incremental updates
    """

    def __init__(
        self,
        cache_dir: str = _DEFAULT_CACHE_DIR,
        api_base: str = _BINANCE_API_BASE,
    ) -> None:
        self._cache_dir = Path(cache_dir).expanduser()
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._api_base = api_base
        self._request_timestamps: list[float] = []

    @property
    def source_type(self) -> str:
        return "binance"

    def wrangle(
        self,
        data: Any,
        instrument: str,
        bar_type: str,
    ) -> list[Bar]:
        """Fetch kline data from Binance and convert to Bar objects.

        Args:
            data: Dict with ``start_date`` and ``end_date`` (YYYY-MM-DD strings).
            instrument: Instrument identifier (e.g. "BTCUSDT.BINANCE").
            bar_type: Bar type string (e.g. "BTCUSDT.BINANCE-1-HOUR-LAST-EXTERNAL").

        Returns:
            List of Bar objects ready for catalog storage.

        Raises:
            ValueError: If parameters are invalid or no data is available.
        """
        if not isinstance(data, dict):
            raise ValueError(
                "BinanceWrangler expects data as dict with 'start_date' and 'end_date'"
            )

        start_date = data.get("start_date")
        end_date = data.get("end_date")

        if not start_date or not end_date:
            raise ValueError("Both 'start_date' and 'end_date' are required")

        # Parse bar type to extract interval
        bt = BarType.from_str(bar_type)
        # spec string is e.g. "1-HOUR-LAST" — take "{step}-{aggregation}"
        spec_parts = str(bt.spec).split("-")
        interval_key = f"{spec_parts[0]}-{spec_parts[1]}"
        binance_interval = _NT_TO_BINANCE_INTERVAL.get(interval_key)
        if binance_interval is None:
            raise ValueError(
                f"Unsupported interval: {interval_key}. "
                f"Supported: {list(_NT_TO_BINANCE_INTERVAL.keys())}"
            )

        # Extract Binance symbol from instrument (strip venue suffix)
        symbol = bt.instrument_id.symbol.value  # e.g. "BTCUSDT"

        # Parse date range to UTC timestamps in milliseconds.
        # end_date is treated as inclusive: "2024-01-01" means through end-of-day.
        start_dt = datetime.strptime(start_date, "%Y-%m-%d").replace(
            tzinfo=timezone.utc
        )
        end_dt = datetime.strptime(end_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        end_dt_exclusive = end_dt + timedelta(days=1)

        start_ms = int(start_dt.timestamp() * 1000)
        end_ms = int(end_dt_exclusive.timestamp() * 1000) - 1

        # Check cache for existing data
        cache_path = self._get_cache_path(symbol, binance_interval)
        cached_df = self._load_cache(cache_path)

        # Determine what ranges to fetch
        fetch_start_ms = start_ms
        fetch_end_ms = end_ms

        if cached_df is not None and not cached_df.empty:
            cached_start_ms = int(cached_df.index.min().timestamp() * 1000)
            cached_end_ms = int(cached_df.index.max().timestamp() * 1000)

            # Cache coverage check: kline timestamps are open_time, so a kline
            # at 23:00 actually covers through 23:59:59.  Compare the last
            # cached open_time against end_dt (start-of-last-requested-day)
            # rather than the ms-precise end_ms.
            end_dt_ms = int(end_dt.timestamp() * 1000)
            if cached_start_ms <= start_ms and cached_end_ms >= end_dt_ms:
                logger.info(
                    "Using fully cached data for %s %s", symbol, binance_interval
                )
                df_range = cached_df.loc[start_dt:end_dt_exclusive]
                if df_range.empty:
                    raise ValueError(
                        f"No data in range {start_date} to {end_date}"
                    )
                return self._dataframe_to_bars(df_range, bar_type)

            # Incremental: only fetch what's missing after cached data
            if cached_end_ms >= start_ms:
                fetch_start_ms = cached_end_ms + 1

        # Fetch from Binance API
        new_df = self._fetch_klines(
            symbol, binance_interval, fetch_start_ms, fetch_end_ms
        )

        # Merge with cache
        if cached_df is not None and not cached_df.empty:
            if new_df is not None and not new_df.empty:
                df = pd.concat([cached_df, new_df])
                df = df[~df.index.duplicated(keep="last")]
                df = df.sort_index()
            else:
                df = cached_df
        elif new_df is not None and not new_df.empty:
            df = new_df
        else:
            raise ValueError(
                f"No data available for {symbol} {binance_interval} "
                f"in range {start_date} to {end_date}"
            )

        # Save merged data to cache
        self._save_cache(df, cache_path)

        # Filter to requested range and convert
        df_range = df.loc[start_dt:end_dt_exclusive]
        if df_range.empty:
            raise ValueError(f"No data in range {start_date} to {end_date}")

        return self._dataframe_to_bars(df_range, bar_type)

    # ------------------------------------------------------------------
    # API fetching
    # ------------------------------------------------------------------

    def _fetch_klines(
        self,
        symbol: str,
        interval: str,
        start_ms: int,
        end_ms: int,
    ) -> pd.DataFrame | None:
        """Fetch klines from Binance with pagination and rate limiting.

        Args:
            symbol: Binance symbol (e.g. "BTCUSDT").
            interval: Binance interval string (e.g. "1h").
            start_ms: Start time in epoch milliseconds.
            end_ms: End time in epoch milliseconds.

        Returns:
            DataFrame with OHLCV data, or None if no data returned.
        """
        all_rows: list[list] = []
        current_start = start_ms

        while current_start < end_ms:
            self._throttle()

            url = (
                f"{self._api_base}{_KLINES_ENDPOINT}"
                f"?symbol={symbol}&interval={interval}"
                f"&startTime={current_start}&endTime={end_ms}"
                f"&limit={_MAX_KLINES_LIMIT}"
            )

            logger.debug("Fetching klines: %s", url)

            klines = self._http_get_json(url)

            if not klines:
                break

            all_rows.extend(klines)

            # Move to next page: last kline's close_time + 1
            last_close_time = klines[-1][6]
            current_start = last_close_time + 1

            if len(klines) < _MAX_KLINES_LIMIT:
                break

            logger.info(
                "Fetched %d klines so far for %s %s",
                len(all_rows),
                symbol,
                interval,
            )

        if not all_rows:
            return None

        logger.info(
            "Fetched %d total klines for %s %s", len(all_rows), symbol, interval
        )
        return self._klines_to_dataframe(all_rows)

    def _http_get_json(self, url: str) -> list:
        """Execute an HTTP GET and parse JSON response.

        Raises:
            ValueError: On HTTP or network errors with a descriptive message.
        """
        req = Request(url, headers={"User-Agent": "tino-daemon/0.1"})
        try:
            with urlopen(req, timeout=_REQUEST_TIMEOUT) as resp:
                body = resp.read()
                return json.loads(body)
        except HTTPError as exc:
            try:
                err_body = json.loads(exc.read())
                msg = err_body.get("msg", str(exc))
            except Exception:
                msg = str(exc)
            raise ValueError(f"Binance API error: {msg}") from exc
        except URLError as exc:
            raise ValueError(f"Network error fetching Binance data: {exc}") from exc

    # ------------------------------------------------------------------
    # Data conversion
    # ------------------------------------------------------------------

    @staticmethod
    def _klines_to_dataframe(klines: list[list]) -> pd.DataFrame:
        """Convert Binance klines response to an OHLCV DataFrame.

        Binance kline format: [open_time, open, high, low, close, volume,
        close_time, quote_volume, trades, taker_buy_volume,
        taker_buy_quote_volume, ignore]
        """
        df = pd.DataFrame(
            klines,
            columns=[
                "open_time",
                "open",
                "high",
                "low",
                "close",
                "volume",
                "close_time",
                "quote_volume",
                "trades",
                "taker_buy_volume",
                "taker_buy_quote_volume",
                "ignore",
            ],
        )

        df["timestamp"] = pd.to_datetime(df["open_time"], unit="ms", utc=True)
        df = df.set_index("timestamp")

        for col in ("open", "high", "low", "close", "volume"):
            df[col] = pd.to_numeric(df[col], errors="coerce").astype("float64")

        return df[["open", "high", "low", "close", "volume"]]

    @staticmethod
    def _dataframe_to_bars(df: pd.DataFrame, bar_type: str) -> list[Bar]:
        """Convert an OHLCV DataFrame to NautilusTrader Bar objects."""
        bt = BarType.from_str(bar_type)
        instrument = _make_synthetic_crypto_equity(bt.instrument_id)
        wrangler = BarDataWrangler(bt, instrument)
        bars: list[Bar] = wrangler.process(df)
        logger.info("Converted %d bars for %s", len(bars), bar_type)
        return bars

    # ------------------------------------------------------------------
    # Caching
    # ------------------------------------------------------------------

    def _get_cache_path(self, symbol: str, interval: str) -> Path:
        """Get the cache file path for a symbol + interval combination."""
        symbol_dir = self._cache_dir / symbol
        symbol_dir.mkdir(parents=True, exist_ok=True)
        return symbol_dir / f"{interval}.parquet"

    @staticmethod
    def _load_cache(cache_path: Path) -> pd.DataFrame | None:
        """Load cached OHLCV data from a Parquet file."""
        if not cache_path.exists():
            return None
        try:
            df = pd.read_parquet(cache_path)
            if not isinstance(df.index, pd.DatetimeIndex):
                df.index = pd.to_datetime(df.index, utc=True)
            return df
        except Exception as exc:
            logger.warning("Failed to load cache %s: %s", cache_path, exc)
            return None

    @staticmethod
    def _save_cache(df: pd.DataFrame, cache_path: Path) -> None:
        """Persist OHLCV DataFrame to Parquet for future incremental use."""
        try:
            df.to_parquet(cache_path)
            logger.info("Cached %d rows to %s", len(df), cache_path)
        except Exception as exc:
            logger.warning("Failed to save cache %s: %s", cache_path, exc)

    # ------------------------------------------------------------------
    # Rate limiting
    # ------------------------------------------------------------------

    def _throttle(self) -> None:
        """Enforce Binance rate limit of 1200 requests per minute."""
        now = time.monotonic()
        # Drop timestamps outside the 60-second window
        self._request_timestamps = [
            ts for ts in self._request_timestamps if now - ts < 60.0
        ]

        if len(self._request_timestamps) >= _RATE_LIMIT_PER_MIN:
            sleep_time = 60.0 - (now - self._request_timestamps[0])
            if sleep_time > 0:
                logger.info("Rate limit reached, sleeping %.1fs", sleep_time)
                time.sleep(sleep_time)

        self._request_timestamps.append(time.monotonic())


def _make_synthetic_crypto_equity(instrument_id: InstrumentId) -> Equity:
    """Create a minimal Equity for BarDataWrangler with crypto-appropriate precision.

    BarDataWrangler needs an Instrument to derive price/size precision.
    We use Equity as a lightweight proxy — the instrument type does not affect
    bar wrangling, only precision matters.  Crypto prices use up to 8 decimals.
    """
    return Equity(
        instrument_id=instrument_id,
        raw_symbol=Symbol(instrument_id.symbol.value),
        currency=USD,
        price_precision=8,
        price_increment=Price.from_str("0.00000001"),
        lot_size=Quantity.from_int(1),
        ts_event=0,
        ts_init=0,
    )
