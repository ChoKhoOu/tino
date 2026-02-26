"""Pydantic models for Backtest Run entity."""

from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class BacktestStatus(StrEnum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


class BacktestMetrics(BaseModel):
    """Performance metrics for a backtest run."""
    total_pnl: str
    sharpe_ratio: float
    sortino_ratio: float
    win_rate: float = Field(ge=0, le=1)
    max_drawdown: float = Field(ge=0, le=1)
    total_trades: int = Field(ge=0)
    avg_trade_pnl: str | None = None
    profit_factor: float = Field(ge=0)
    max_consecutive_wins: int | None = None
    max_consecutive_losses: int | None = None


class TradeLogEntry(BaseModel):
    """Individual trade record."""
    id: str
    side: str  # BUY or SELL
    quantity: str
    entry_price: str
    exit_price: str
    pnl: str
    entry_time: datetime
    exit_time: datetime


class EquityCurvePoint(BaseModel):
    """Single point on the equity curve."""
    timestamp: datetime
    equity: str


class BacktestCreate(BaseModel):
    """Request body for submitting a backtest."""
    strategy_version_hash: str
    trading_pair: str = Field(min_length=1)
    start_date: str
    end_date: str
    bar_type: str = "1-HOUR"
    parameters: dict[str, Any] | None = None


class BacktestRun(BaseModel):
    """Full backtest run entity."""
    id: UUID
    strategy_version_hash: str
    trading_pair: str
    exchange: str = "BINANCE"
    start_date: str
    end_date: str
    bar_type: str
    status: BacktestStatus
    progress_pct: float | None = None
    metrics: BacktestMetrics | None = None
    trade_log: list[TradeLogEntry] | None = None
    equity_curve: list[EquityCurvePoint] | None = None
    parameters: dict[str, Any] | None = None
    dataset_identifier: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    error_message: str | None = None


class BacktestCreateResponse(BaseModel):
    """Response after submitting a backtest."""
    id: UUID
    status: BacktestStatus
    ws_url: str
