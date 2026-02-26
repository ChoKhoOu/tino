"""Pydantic models for WebSocket event types."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from .backtest import BacktestMetrics
from .live_session import LifecycleState, Order, Position


# Base envelope
class EventEnvelope(BaseModel):
    """Base WebSocket event envelope."""
    type: str
    timestamp: datetime
    payload: dict


# Backtest events
class BacktestProgressPayload(BaseModel):
    backtest_id: UUID
    progress_pct: float = Field(ge=0, le=100)
    current_date: str
    trades_so_far: int = Field(ge=0)
    current_pnl: str


class BacktestProgressEvent(BaseModel):
    type: Literal["backtest.progress"] = "backtest.progress"
    timestamp: datetime
    payload: BacktestProgressPayload


class BacktestCompletedPayload(BaseModel):
    backtest_id: UUID
    metrics: BacktestMetrics


class BacktestCompletedEvent(BaseModel):
    type: Literal["backtest.completed"] = "backtest.completed"
    timestamp: datetime
    payload: BacktestCompletedPayload


class BacktestFailedPayload(BaseModel):
    backtest_id: UUID
    error: str
    message: str


class BacktestFailedEvent(BaseModel):
    type: Literal["backtest.failed"] = "backtest.failed"
    timestamp: datetime
    payload: BacktestFailedPayload


class BacktestCancelPayload(BaseModel):
    backtest_id: UUID


class BacktestCancelEvent(BaseModel):
    type: Literal["backtest.cancel"] = "backtest.cancel"
    payload: BacktestCancelPayload


# Live trading events
class LiveStateChangePayload(BaseModel):
    session_id: UUID
    previous_state: LifecycleState
    current_state: LifecycleState


class LiveStateChangeEvent(BaseModel):
    type: Literal["live.state_change"] = "live.state_change"
    timestamp: datetime
    payload: LiveStateChangePayload


class LivePositionUpdatePayload(BaseModel):
    session_id: UUID
    positions: list[Position]
    total_unrealized_pnl: str
    total_realized_pnl: str


class LivePositionUpdateEvent(BaseModel):
    type: Literal["live.position_update"] = "live.position_update"
    timestamp: datetime
    payload: LivePositionUpdatePayload


class LiveOrderEventPayload(BaseModel):
    session_id: UUID
    event: str  # SUBMITTED, FILLED, PARTIALLY_FILLED, CANCELLED, REJECTED
    order: Order


class LiveOrderEvent(BaseModel):
    type: Literal["live.order_event"] = "live.order_event"
    timestamp: datetime
    payload: LiveOrderEventPayload


class LiveTradeDetail(BaseModel):
    id: str
    side: str  # BUY, SELL
    quantity: str
    price: str
    pnl: str | None = None
    is_entry: bool


class LiveTradeExecutedPayload(BaseModel):
    session_id: UUID
    trade: LiveTradeDetail


class LiveTradeExecutedEvent(BaseModel):
    type: Literal["live.trade_executed"] = "live.trade_executed"
    timestamp: datetime
    payload: LiveTradeExecutedPayload


class LiveRiskAlertPayload(BaseModel):
    session_id: UUID
    alert_level: str  # WARNING, CRITICAL
    rule: str
    message: str
    action_taken: str


class LiveRiskAlertEvent(BaseModel):
    type: Literal["live.risk_alert"] = "live.risk_alert"
    timestamp: datetime
    payload: LiveRiskAlertPayload


class LiveRiskCircuitBreakerPayload(BaseModel):
    session_id: UUID
    rule: str
    threshold: float
    actual: float
    action: Literal["KILL_SWITCH_TRIGGERED"] = "KILL_SWITCH_TRIGGERED"
    cancelled_orders: int = Field(ge=0)
    flattened_positions: int = Field(ge=0)


class LiveRiskCircuitBreakerEvent(BaseModel):
    type: Literal["live.risk_circuit_breaker"] = "live.risk_circuit_breaker"
    timestamp: datetime
    payload: LiveRiskCircuitBreakerPayload


class LiveErrorPayload(BaseModel):
    session_id: UUID
    error: str
    message: str
    severity: str  # WARNING, ERROR, CRITICAL


class LiveErrorEvent(BaseModel):
    type: Literal["live.error"] = "live.error"
    timestamp: datetime
    payload: LiveErrorPayload


# Dashboard events
class ActiveBacktestSummary(BaseModel):
    id: UUID
    strategy_name: str
    status: str
    progress_pct: float | None = None


class ActiveLiveSessionSummary(BaseModel):
    id: UUID
    strategy_name: str
    state: str
    pnl: str


class DashboardSessionListPayload(BaseModel):
    active_backtests: list[ActiveBacktestSummary]
    active_live_sessions: list[ActiveLiveSessionSummary]


class DashboardSessionListEvent(BaseModel):
    type: Literal["dashboard.session_list"] = "dashboard.session_list"
    timestamp: datetime
    payload: DashboardSessionListPayload


# Heartbeat
class PingEvent(BaseModel):
    type: Literal["ping"] = "ping"


class PongEvent(BaseModel):
    type: Literal["pong"] = "pong"
