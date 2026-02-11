"""Tests for NodeRegistry — shared TradingNode lifecycle manager."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from tino_daemon.node_registry import NodeRegistry


class FakeNode:
    """Minimal fake TradingNodeWrapper for testing."""

    def __init__(self) -> None:
        self.stopped = False

    async def stop_trading(self, *, flatten_positions: bool = True) -> None:
        self.stopped = True


def _make_fake_node() -> FakeNode:
    return FakeNode()


class TestNodeRegistryGetNode:
    """get_node() returns a shared instance, creating lazily on first call."""

    def test_get_node_creates_instance_on_first_call(self) -> None:
        registry = NodeRegistry(factory=_make_fake_node)
        node = registry.get_node()
        assert node is not None
        assert isinstance(node, FakeNode)

    def test_get_node_returns_same_instance_on_subsequent_calls(self) -> None:
        registry = NodeRegistry(factory=_make_fake_node)
        node1 = registry.get_node()
        node2 = registry.get_node()
        assert node1 is node2

    def test_has_node_false_before_first_get(self) -> None:
        registry = NodeRegistry(factory=_make_fake_node)
        assert registry.has_node is False

    def test_has_node_true_after_get(self) -> None:
        registry = NodeRegistry(factory=_make_fake_node)
        registry.get_node()
        assert registry.has_node is True


class TestNodeRegistryStop:
    """stop() clears the instance so next get_node() creates a new one."""

    def test_stop_clears_instance(self) -> None:
        registry = NodeRegistry(factory=_make_fake_node)
        registry.get_node()
        assert registry.has_node is True
        registry.stop()
        assert registry.has_node is False

    def test_get_node_after_stop_creates_new_instance(self) -> None:
        registry = NodeRegistry(factory=_make_fake_node)
        node1 = registry.get_node()
        registry.stop()
        node2 = registry.get_node()
        assert node2 is not node1

    def test_stop_when_no_node_is_noop(self) -> None:
        registry = NodeRegistry(factory=_make_fake_node)
        registry.stop()

        assert registry.has_node is False


class TestNodeRegistryDefaultFactory:
    """Without a factory, NodeRegistry uses TradingNodeWrapper as default."""

    def test_default_factory_creates_trading_node_wrapper(self) -> None:
        with patch("tino_daemon.node_registry.TradingNodeWrapper") as mock_cls:
            mock_instance = MagicMock()
            mock_cls.return_value = mock_instance

            registry = NodeRegistry()
            node = registry.get_node()
            assert node is mock_instance
            mock_cls.assert_called_once()


class TestNodeRegistryInjectionIntoTradingService:
    """NodeRegistry can be injected into TradingServiceServicer."""

    def test_trading_service_uses_registry_node(self) -> None:
        from tino_daemon.services.trading import TradingServiceServicer

        registry = NodeRegistry(factory=_make_fake_node)
        servicer = TradingServiceServicer(registry=registry)
        node = servicer._get_node()
        assert isinstance(node, FakeNode)
        assert node is registry.get_node()

    def test_trading_service_backward_compat_without_registry(self) -> None:
        from tino_daemon.services.trading import TradingServiceServicer

        fake = FakeNode()
        servicer = TradingServiceServicer(node=fake)
        assert servicer._get_node() is fake
