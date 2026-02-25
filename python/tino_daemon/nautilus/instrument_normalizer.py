from __future__ import annotations


def normalize_instrument(
    symbol: str,
    venue: str,
    instrument_type: str = "spot",
) -> str:
    """Normalize a symbol into NautilusTrader instrument ID format.

    For perpetual instruments, appends a '-PERP' suffix before the venue
    to produce IDs like 'BTCUSDT-PERP.BINANCE'.
    """
    symbol = symbol.upper()
    venue = venue.upper()

    if "." in symbol:
        parts = symbol.split(".", 1)
        if parts[1] == venue:
            return symbol

    raw = symbol.replace("/", "")

    if instrument_type.lower() == "perpetual" and "-PERP" not in raw:
        raw = f"{raw}-PERP"

    return f"{raw}.{venue}"
