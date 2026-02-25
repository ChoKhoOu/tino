"""Paper Trading Engine — simulated trading with real-time market data.

Provides a self-contained paper trading engine that uses real exchange
price feeds to simulate order execution, position management, PnL
calculation, and funding rate settlement for 7x24 stable operation.
"""

from tino_daemon.paper.engine import PaperTradingEngine
from tino_daemon.paper.position_manager import PaperBalance, PaperPosition, PositionManager
from tino_daemon.paper.orderbook_sim import OrderbookSimulator, PaperOrder, OrderSide, OrderStatus, OrderType

__all__ = [
    "PaperTradingEngine",
    "PositionManager",
    "PaperBalance",
    "PaperPosition",
    "OrderbookSimulator",
    "PaperOrder",
    "OrderSide",
    "OrderStatus",
    "OrderType",
]
