"""Data cache status API routes."""

from fastapi import APIRouter

from ...core.data_manager import MarketDataManager

router = APIRouter(prefix="/data", tags=["data"])

_data_manager = MarketDataManager()


@router.get("/cache/status")
async def get_cache_status():
    """Get status of locally cached market data."""
    cached_pairs = _data_manager.get_cache_status()
    total_size_mb = 0  # TODO: Calculate actual file sizes

    return {
        "cached_pairs": cached_pairs,
        "total_size_mb": total_size_mb,
    }
