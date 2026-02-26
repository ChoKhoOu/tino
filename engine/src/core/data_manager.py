"""Market data manager: fetch, cache, and serve OHLCV data."""

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DATA_DIR = Path("data")


class DataGapError(Exception):
    """Raised when requested data range has gaps."""
    pass


class MarketDataManager:
    """Manages historical market data fetching and caching.

    Fetches OHLCV data from Binance API, caches to local files,
    and checks cache before fetching. Supports offline mode after
    first fetch.
    """

    def __init__(self, data_dir: Path = DATA_DIR):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._cache_index: dict[str, dict] = {}
        self._load_cache_index()

    def _load_cache_index(self) -> None:
        """Load cache index from disk."""
        index_path = self.data_dir / "cache_index.json"
        if index_path.exists():
            try:
                self._cache_index = json.loads(index_path.read_text())
            except (json.JSONDecodeError, OSError):
                self._cache_index = {}

    def _save_cache_index(self) -> None:
        """Save cache index to disk."""
        index_path = self.data_dir / "cache_index.json"
        index_path.write_text(json.dumps(self._cache_index, indent=2))

    def _cache_key(self, trading_pair: str, bar_type: str) -> str:
        """Generate cache key for a trading pair + bar type combination."""
        return f"{trading_pair}_{bar_type}"

    def get_cache_status(self) -> list[dict]:
        """Get status of all cached market data."""
        result = []
        for key, info in self._cache_index.items():
            result.append({
                "trading_pair": info["trading_pair"],
                "bar_type": info["bar_type"],
                "start_date": info["start_date"],
                "end_date": info["end_date"],
                "record_count": info["record_count"],
            })
        return result

    def check_cache(
        self, trading_pair: str, bar_type: str, start_date: str, end_date: str
    ) -> dict | None:
        """Check if requested data is available in cache.

        Returns cache info if available, None if not cached.
        """
        key = self._cache_key(trading_pair, bar_type)
        if key not in self._cache_index:
            return None

        cached = self._cache_index[key]
        if cached["start_date"] <= start_date and cached["end_date"] >= end_date:
            return cached
        return None

    def detect_gaps(
        self, trading_pair: str, bar_type: str, start_date: str, end_date: str
    ) -> list[dict]:
        """Detect data gaps for the requested range.

        Returns list of gap ranges [{start, end}].
        """
        key = self._cache_key(trading_pair, bar_type)
        if key not in self._cache_index:
            return [{"start": start_date, "end": end_date}]

        cached = self._cache_index[key]
        gaps = []
        if start_date < cached["start_date"]:
            gaps.append({"start": start_date, "end": cached["start_date"]})
        if end_date > cached["end_date"]:
            gaps.append({"start": cached["end_date"], "end": end_date})
        return gaps

    async def fetch_and_cache(
        self,
        trading_pair: str,
        bar_type: str,
        start_date: str,
        end_date: str,
    ) -> dict[str, Any]:
        """Fetch OHLCV data from Binance and cache locally.

        Returns cache info dict.
        """
        # Check cache first
        cached = self.check_cache(trading_pair, bar_type, start_date, end_date)
        if cached:
            logger.info(f"Cache hit for {trading_pair} {bar_type}")
            return cached

        # Detect gaps
        gaps = self.detect_gaps(trading_pair, bar_type, start_date, end_date)
        if gaps:
            logger.info(
                f"Fetching {len(gaps)} data gaps for {trading_pair} {bar_type}"
            )

        # Fetch from Binance API
        try:
            data = await self._fetch_from_binance(
                trading_pair, bar_type, start_date, end_date
            )
        except Exception as e:
            # Check if we have partial cache
            if self.check_cache(trading_pair, bar_type, start_date, end_date):
                logger.warning(f"Fetch failed but cache available: {e}")
                return self._cache_index[self._cache_key(trading_pair, bar_type)]
            raise DataGapError(
                f"Cannot fetch data for {trading_pair} {bar_type} "
                f"({start_date} to {end_date}): {e}"
            )

        # Save to cache
        cache_info = self._save_to_cache(
            trading_pair, bar_type, start_date, end_date, data
        )
        return cache_info

    async def _fetch_from_binance(
        self,
        trading_pair: str,
        bar_type: str,
        start_date: str,
        end_date: str,
    ) -> list[list]:
        """Fetch OHLCV klines from Binance REST API."""
        import httpx

        interval_map = {
            "1-MINUTE": "1m",
            "5-MINUTE": "5m",
            "15-MINUTE": "15m",
            "1-HOUR": "1h",
            "4-HOUR": "4h",
            "1-DAY": "1d",
        }
        interval = interval_map.get(bar_type, "1h")

        start_ts = int(
            datetime.strptime(start_date, "%Y-%m-%d")
            .replace(tzinfo=timezone.utc)
            .timestamp()
            * 1000
        )
        end_ts = int(
            datetime.strptime(end_date, "%Y-%m-%d")
            .replace(tzinfo=timezone.utc)
            .timestamp()
            * 1000
        )

        all_klines = []
        current_start = start_ts

        async with httpx.AsyncClient() as client:
            while current_start < end_ts:
                response = await client.get(
                    "https://api.binance.com/api/v3/klines",
                    params={
                        "symbol": trading_pair,
                        "interval": interval,
                        "startTime": current_start,
                        "endTime": end_ts,
                        "limit": 1000,
                    },
                    timeout=30.0,
                )
                response.raise_for_status()
                klines = response.json()
                if not klines:
                    break
                all_klines.extend(klines)
                current_start = klines[-1][0] + 1

        logger.info(f"Fetched {len(all_klines)} klines for {trading_pair}")
        return all_klines

    def _save_to_cache(
        self,
        trading_pair: str,
        bar_type: str,
        start_date: str,
        end_date: str,
        data: list[list],
    ) -> dict:
        """Save fetched data to local cache."""
        key = self._cache_key(trading_pair, bar_type)
        file_name = f"{trading_pair}_{bar_type}.json"
        file_path = self.data_dir / file_name

        file_path.write_text(json.dumps(data))
        content_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()

        cache_info = {
            "trading_pair": trading_pair,
            "bar_type": bar_type,
            "start_date": start_date,
            "end_date": end_date,
            "record_count": len(data),
            "file_path": str(file_path),
            "content_hash": content_hash,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

        self._cache_index[key] = cache_info
        self._save_cache_index()

        logger.info(f"Cached {len(data)} records for {trading_pair} {bar_type}")
        return cache_info

    def get_data_path(self, trading_pair: str, bar_type: str) -> Path | None:
        """Get local file path for cached data."""
        key = self._cache_key(trading_pair, bar_type)
        if key in self._cache_index:
            return Path(self._cache_index[key]["file_path"])
        return None
