from __future__ import annotations


def normalize_instrument(symbol: str, venue: str) -> str:
    symbol = symbol.upper()
    venue = venue.upper()

    if "." in symbol:
        parts = symbol.split(".", 1)
        if parts[1] == venue:
            return symbol

    raw = symbol.replace("/", "")

    return f"{raw}.{venue}"
