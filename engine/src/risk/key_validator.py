"""Binance API key permission validator.

SAFETY CRITICAL: Validates that API keys do NOT have withdrawal permissions.
The engine MUST refuse to start if withdrawal permissions are detected.
"""

import logging

logger = logging.getLogger(__name__)


class KeyValidationError(Exception):
    """Raised when API key validation fails."""
    pass


class WithdrawalPermissionError(KeyValidationError):
    """Raised when API key has withdrawal permissions."""
    pass


async def validate_binance_key(api_key: str, api_secret: str) -> dict:
    """Validate Binance API key permissions.

    Checks:
    1. Key is valid and can authenticate
    2. Key does NOT have withdrawal permissions
    3. Key has trading permissions (required for live trading)

    Returns dict with permission details on success.
    Raises KeyValidationError or WithdrawalPermissionError on failure.
    """
    try:
        # Use ccxt or direct Binance API to check permissions
        # For now, use httpx to call Binance API directly
        import hashlib
        import hmac
        import time

        import httpx

        timestamp = int(time.time() * 1000)
        query_string = f"timestamp={timestamp}"
        signature = hmac.new(
            api_secret.encode("utf-8"),
            query_string.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.binance.com/sapi/v1/account/apiRestrictions",
                params={"timestamp": timestamp, "signature": signature},
                headers={"X-MBX-APIKEY": api_key},
                timeout=10.0,
            )

            if response.status_code == 401:
                raise KeyValidationError("Invalid API key or secret")

            if response.status_code != 200:
                raise KeyValidationError(
                    f"Binance API error: {response.status_code} - {response.text}"
                )

            permissions = response.json()

            # CRITICAL: Refuse if withdrawal is enabled
            if permissions.get("enableWithdrawals", False):
                raise WithdrawalPermissionError(
                    "API key has withdrawal permissions enabled. "
                    "Tino2 REFUSES to operate with withdrawal-capable keys. "
                    "Please create a new API key with ONLY trading permissions."
                )

            result = {
                "trading_enabled": permissions.get("enableSpotAndMarginTrading", False),
                "withdrawal_enabled": False,  # Verified above
                "ip_restricted": permissions.get("ipRestrict", False),
                "create_time": permissions.get("createTime"),
            }

            if not result["trading_enabled"]:
                logger.warning(
                    "API key does not have trading permissions. "
                    "Live trading will not be available."
                )

            logger.info("API key validation passed: no withdrawal permissions")
            return result

    except (KeyValidationError, WithdrawalPermissionError):
        raise
    except Exception as e:
        raise KeyValidationError(f"Failed to validate API key: {e}") from e


async def validate_key_or_skip(api_key: str | None, api_secret: str | None) -> dict | None:
    """Validate API key if provided, skip if not.

    Returns permission dict if valid, None if no key provided.
    Raises on invalid key.
    """
    if not api_key or not api_secret:
        logger.info("No Binance API key configured. Live trading disabled.")
        return None
    return await validate_binance_key(api_key, api_secret)
