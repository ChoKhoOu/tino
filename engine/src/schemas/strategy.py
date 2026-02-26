"""Pydantic models for Strategy entity."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class StrategyCreate(BaseModel):
    """Request body for creating a new strategy."""
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    source_code: str = Field(min_length=1)
    parameters: dict[str, Any] = Field(default_factory=dict)


class StrategyResponse(BaseModel):
    """Full strategy entity response."""
    id: UUID
    version_hash: str = Field(pattern=r"^sha256:[a-f0-9]{64}$")
    name: str
    description: str | None = None
    source_code: str
    parameters: dict[str, Any]
    created_at: datetime
    created_by_session: str | None = None
    parent_version_hash: str | None = None


class StrategyListItem(BaseModel):
    """Strategy summary for list endpoints."""
    id: UUID
    version_hash: str
    name: str
    created_at: datetime
    backtest_count: int = 0
    live_session_count: int = 0


class StrategyListResponse(BaseModel):
    """Paginated strategy list response."""
    items: list[StrategyListItem]
    total: int


class StrategyCreateResponse(BaseModel):
    """Response after creating a strategy."""
    id: UUID
    version_hash: str
    name: str
    created_at: datetime
