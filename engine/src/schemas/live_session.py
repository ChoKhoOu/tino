"""Pydantic models for Live Session entity."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel


class LifecycleState(StrEnum):
    DEPLOYING = "DEPLOYING"
    RUNNING = "RUNNING"
    PAUSED = "PAUSED"
    STOPPING = "STOPPING"
    STOPPED = "STOPPED"


class Position(BaseModel):
    """Current position in a trading instrument."""
    instrument: str
    side: str  # LONG, SHORT, FLAT
    quantity: str
    avg_entry_price: str
    unrealized_pnl: str
    realized_pnl: str


class Order(BaseModel):
    """Order details."""
    id: str
    side: str  # BUY, SELL
    type: str  # MARKET, LIMIT, STOP_MARKET, STOP_LIMIT
    quantity: str
    price: str | None = None
    fill_price: str | None = None
    fill_quantity: str | None = None
    status: str | None = None


class PauseResumeEntry(BaseModel):
    """Record of a pause/resume action."""
    action: str  # PAUSE, RESUME
    timestamp: datetime
    reason: str | None = None


class LiveDeploy(BaseModel):
    """Request body for deploying a strategy to live trading."""
    strategy_version_hash: str
    trading_pair: str
    parameters: dict[str, Any] | None = None
    risk_profile_id: UUID
    confirmed_by_session: str


class LiveSession(BaseModel):
    """Full live session entity."""
    id: UUID
    strategy_version_hash: str
    trading_pair: str
    exchange: str = "BINANCE"
    lifecycle_state: LifecycleState
    positions: list[Position]
    open_orders: list[Order]
    realized_pnl: str
    unrealized_pnl: str
    risk_profile_id: UUID
    parameters: dict[str, Any] | None = None
    confirmed_by: str
    started_at: datetime
    paused_at: datetime | None = None
    stopped_at: datetime | None = None
    pause_resume_history: list[PauseResumeEntry] | None = None


class LiveDeployResponse(BaseModel):
    """Response after deploying a strategy."""
    id: UUID
    lifecycle_state: LifecycleState
    ws_url: str


class KillSwitchResponse(BaseModel):
    """Response after activating the kill switch."""
    killed_sessions: int
    cancelled_orders: int
    flattened_positions: int
    executed_at: datetime
