from __future__ import annotations

import os

_VALID_ACCOUNT_TYPES = frozenset({"SPOT", "USDT_FUTURE"})


def build_binance_config(
    account_type: str,
    testnet: bool = True,
) -> dict[str, object]:
    if account_type not in _VALID_ACCOUNT_TYPES:
        msg = (
            f"Invalid account_type '{account_type}'. "
            f"Supported: {sorted(_VALID_ACCOUNT_TYPES)}"
        )
        raise ValueError(msg)

    api_key = os.environ.get("BINANCE_API_KEY")
    if not api_key:
        raise ValueError(
            "BINANCE_API_KEY environment variable is required. Set it before connecting to Binance."
        )

    api_secret = os.environ.get("BINANCE_API_SECRET")
    if not api_secret:
        raise ValueError(
            "BINANCE_API_SECRET environment variable is required. Set it before connecting to Binance."
        )

    return {
        "venue": "BINANCE",
        "account_type": account_type,
        "testnet": testnet,
        "api_key": api_key,
        "api_secret": api_secret,
    }
