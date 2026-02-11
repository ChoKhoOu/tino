from __future__ import annotations

from typing import Any, Callable

from tino_daemon.nautilus.node import TradingNodeWrapper


class NodeRegistry:
    def __init__(self, factory: Callable[[], Any] | None = None) -> None:
        self._factory = factory or TradingNodeWrapper
        self._node: Any | None = None

    @property
    def has_node(self) -> bool:
        return self._node is not None

    def get_node(self) -> Any:
        if self._node is None:
            self._node = self._factory()
        return self._node

    def stop(self) -> None:
        self._node = None
