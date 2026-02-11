from __future__ import annotations

import os
from unittest.mock import patch

import pytest


class TestInstrumentNormalizer:
    def test_slash_pair_to_binance_format(self) -> None:
        from tino_daemon.nautilus.instrument_normalizer import normalize_instrument

        result = normalize_instrument("BTC/USDT", "BINANCE")
        assert result == "BTCUSDT.BINANCE"

    def test_already_concatenated_symbol(self) -> None:
        from tino_daemon.nautilus.instrument_normalizer import normalize_instrument

        result = normalize_instrument("BTCUSDT", "BINANCE")
        assert result == "BTCUSDT.BINANCE"

    def test_already_normalized_passthrough(self) -> None:
        from tino_daemon.nautilus.instrument_normalizer import normalize_instrument

        result = normalize_instrument("BTCUSDT.BINANCE", "BINANCE")
        assert result == "BTCUSDT.BINANCE"

    def test_sim_venue_passthrough(self) -> None:
        from tino_daemon.nautilus.instrument_normalizer import normalize_instrument

        result = normalize_instrument("AAPL", "SIM")
        assert result == "AAPL.SIM"

    def test_lowercase_input_uppercased(self) -> None:
        from tino_daemon.nautilus.instrument_normalizer import normalize_instrument

        result = normalize_instrument("btc/usdt", "binance")
        assert result == "BTCUSDT.BINANCE"

    def test_eth_usdt_pair(self) -> None:
        from tino_daemon.nautilus.instrument_normalizer import normalize_instrument

        result = normalize_instrument("ETH/USDT", "BINANCE")
        assert result == "ETHUSDT.BINANCE"


class TestBinanceConfigBuilder:
    @patch.dict(
        os.environ, {"BINANCE_API_KEY": "test-key", "BINANCE_API_SECRET": "test-secret"}
    )
    def test_spot_testnet_config(self) -> None:
        from tino_daemon.nautilus.binance_config import build_binance_config

        config = build_binance_config(account_type="SPOT", testnet=True)
        assert config["account_type"] == "SPOT"
        assert config["testnet"] is True
        assert config["api_key"] == "test-key"
        assert config["api_secret"] == "test-secret"

    @patch.dict(
        os.environ, {"BINANCE_API_KEY": "test-key", "BINANCE_API_SECRET": "test-secret"}
    )
    def test_futures_testnet_config(self) -> None:
        from tino_daemon.nautilus.binance_config import build_binance_config

        config = build_binance_config(account_type="USDT_FUTURE", testnet=True)
        assert config["account_type"] == "USDT_FUTURE"
        assert config["testnet"] is True

    @patch.dict(
        os.environ, {"BINANCE_API_KEY": "test-key", "BINANCE_API_SECRET": "test-secret"}
    )
    def test_testnet_is_default(self) -> None:
        from tino_daemon.nautilus.binance_config import build_binance_config

        config = build_binance_config(account_type="SPOT")
        assert config["testnet"] is True

    def test_missing_api_key_raises_valueerror(self) -> None:
        from tino_daemon.nautilus.binance_config import build_binance_config

        with patch.dict(os.environ, {}, clear=True):
            env = {
                k: v
                for k, v in os.environ.items()
                if k not in ("BINANCE_API_KEY", "BINANCE_API_SECRET")
            }
            with patch.dict(os.environ, env, clear=True):
                with pytest.raises(ValueError, match="BINANCE_API_KEY"):
                    build_binance_config(account_type="SPOT")

    @patch.dict(os.environ, {"BINANCE_API_KEY": "test-key"})
    def test_missing_api_secret_raises_valueerror(self) -> None:
        from tino_daemon.nautilus.binance_config import build_binance_config

        env = {k: v for k, v in os.environ.items() if k != "BINANCE_API_SECRET"}
        with patch.dict(os.environ, env, clear=True):
            with pytest.raises(ValueError, match="BINANCE_API_SECRET"):
                build_binance_config(account_type="SPOT")

    @patch.dict(
        os.environ, {"BINANCE_API_KEY": "test-key", "BINANCE_API_SECRET": "test-secret"}
    )
    def test_invalid_account_type_raises_valueerror(self) -> None:
        from tino_daemon.nautilus.binance_config import build_binance_config

        with pytest.raises(ValueError, match="account_type"):
            build_binance_config(account_type="COIN_FUTURE")

    @patch.dict(
        os.environ, {"BINANCE_API_KEY": "test-key", "BINANCE_API_SECRET": "test-secret"}
    )
    def test_live_config(self) -> None:
        from tino_daemon.nautilus.binance_config import build_binance_config

        config = build_binance_config(account_type="SPOT", testnet=False)
        assert config["testnet"] is False

    @patch.dict(os.environ, {"BINANCE_API_KEY": "key", "BINANCE_API_SECRET": "secret"})
    def test_config_has_venue_binance(self) -> None:
        from tino_daemon.nautilus.binance_config import build_binance_config

        config = build_binance_config(account_type="SPOT")
        assert config["venue"] == "BINANCE"
