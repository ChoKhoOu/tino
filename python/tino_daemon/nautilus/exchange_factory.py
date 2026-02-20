"""Exchange configuration factory — routes venue to config builder."""

from __future__ import annotations

from tino_daemon.nautilus.binance_config import build_binance_config
from tino_daemon.nautilus.bybit_config import build_bybit_config
from tino_daemon.nautilus.okx_config import build_okx_config

_SUPPORTED_VENUES = frozenset({"BINANCE", "OKX", "BYBIT"})


def create_exchange_config(
    venue: str,
    account_type: str = "SPOT",
    testnet: bool = True,
) -> dict[str, object]:
    """Create exchange configuration for the given venue.

    Routes to venue-specific config builders. Raises ValueError
    for unsupported venues.
    """
    venue_upper = venue.upper()

    if venue_upper not in _SUPPORTED_VENUES:
        msg = (
            f"Unsupported venue '{venue}'. "
            f"Supported: {sorted(_SUPPORTED_VENUES)}"
        )
        raise ValueError(msg)

    if venue_upper == "BINANCE":
        return build_binance_config(account_type=account_type, testnet=testnet)

    if venue_upper == "OKX":
        return build_okx_config(account_type=account_type, testnet=testnet)

    return build_bybit_config(account_type=account_type, testnet=testnet)
