from __future__ import annotations

import os

_VALID_ACCOUNT_TYPES = frozenset({"SPOT", "LINEAR", "INVERSE"})


def build_bybit_config(
    account_type: str = "SPOT",
    testnet: bool = True,
) -> dict[str, object]:
    if account_type not in _VALID_ACCOUNT_TYPES:
        msg = (
            f"Invalid account_type '{account_type}'. "
            f"Supported: {sorted(_VALID_ACCOUNT_TYPES)}"
        )
        raise ValueError(msg)

    api_key = os.environ.get("BYBIT_API_KEY")
    if not api_key:
        raise ValueError(
            "BYBIT_API_KEY environment variable is required. Set it before connecting to Bybit."
        )

    api_secret = os.environ.get("BYBIT_API_SECRET")
    if not api_secret:
        raise ValueError(
            "BYBIT_API_SECRET environment variable is required. Set it before connecting to Bybit."
        )

    return {
        "venue": "BYBIT",
        "account_type": account_type,
        "testnet": testnet,
        "api_key": api_key,
        "api_secret": api_secret,
    }
