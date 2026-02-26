"""Pydantic models for Risk Profile entity."""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class RiskModificationLogEntry(BaseModel):
    """Audit log entry for risk profile changes."""
    timestamp: datetime
    field: str
    previous_value: Any
    new_value: Any
    confirmed_by_session: str


class RiskProfile(BaseModel):
    """Risk profile with non-bypassable enforcement."""
    id: UUID
    name: str
    max_drawdown_pct: float = Field(ge=0.01, le=1.0)
    single_order_size_cap: float = Field(gt=0)
    daily_loss_limit: float = Field(gt=0)
    max_concurrent_strategies: int = Field(ge=1)
    kill_switch_active: bool = False
    created_at: datetime
    updated_at: datetime
    modification_log: list[RiskModificationLogEntry] | None = None


class RiskProfileUpdate(BaseModel):
    """Request body for updating risk profile."""
    max_drawdown_pct: float | None = Field(default=None, ge=0.01, le=1.0)
    single_order_size_cap: float | None = Field(default=None, gt=0)
    daily_loss_limit: float | None = Field(default=None, gt=0)
    max_concurrent_strategies: int | None = Field(default=None, ge=1)
    confirmed_by_session: str
