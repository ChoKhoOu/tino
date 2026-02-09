"""Tests for data wranglers (CSV → NautilusTrader Bar objects)."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from tino_daemon.wranglers.csv_wrangler import CsvWrangler


@pytest.fixture
def csv_wrangler() -> CsvWrangler:
    return CsvWrangler()


@pytest.fixture
def sample_csv(tmp_path: Path) -> Path:
    csv_content = """date,open,high,low,close,volume
2024-01-02,100.0,105.0,99.0,104.0,1000000
2024-01-03,104.0,106.0,103.0,105.5,1200000
2024-01-04,105.5,108.0,104.0,107.0,1100000
2024-01-05,107.0,109.0,106.0,108.5,900000
2024-01-08,108.5,110.0,107.5,109.0,950000
"""
    csv_file = tmp_path / "test_data.csv"
    csv_file.write_text(csv_content)
    return csv_file


BAR_TYPE = "AAPL.XNAS-1-DAY-LAST-EXTERNAL"
INSTRUMENT = "AAPL.XNAS"


def test_csv_wrangler_source_type(csv_wrangler: CsvWrangler):
    assert csv_wrangler.source_type == "csv"


def test_csv_wrangler_basic(csv_wrangler: CsvWrangler, sample_csv: Path):
    bars = csv_wrangler.wrangle(
        data=str(sample_csv),
        instrument=INSTRUMENT,
        bar_type=BAR_TYPE,
    )
    assert len(bars) == 5
    assert bars[0].open.as_double() == pytest.approx(100.0)
    assert bars[0].high.as_double() == pytest.approx(105.0)
    assert bars[0].low.as_double() == pytest.approx(99.0)
    assert bars[0].close.as_double() == pytest.approx(104.0)


def test_csv_wrangler_accepts_path_object(csv_wrangler: CsvWrangler, sample_csv: Path):
    bars = csv_wrangler.wrangle(
        data=sample_csv,
        instrument=INSTRUMENT,
        bar_type=BAR_TYPE,
    )
    assert len(bars) == 5


def test_csv_wrangler_file_not_found(csv_wrangler: CsvWrangler):
    with pytest.raises(FileNotFoundError):
        csv_wrangler.wrangle(
            data="/nonexistent/file.csv",
            instrument=INSTRUMENT,
            bar_type=BAR_TYPE,
        )


def test_csv_wrangler_empty_csv(csv_wrangler: CsvWrangler, tmp_path: Path):
    empty_csv = tmp_path / "empty.csv"
    empty_csv.write_text("date,open,high,low,close,volume\n")
    with pytest.raises(ValueError, match="empty"):
        csv_wrangler.wrangle(
            data=str(empty_csv),
            instrument=INSTRUMENT,
            bar_type=BAR_TYPE,
        )


def test_csv_wrangler_missing_columns(csv_wrangler: CsvWrangler, tmp_path: Path):
    bad_csv = tmp_path / "bad.csv"
    bad_csv.write_text("date,price\n2024-01-02,100.0\n")
    with pytest.raises(ValueError, match="Missing required columns"):
        csv_wrangler.wrangle(
            data=str(bad_csv),
            instrument=INSTRUMENT,
            bar_type=BAR_TYPE,
        )


def test_csv_wrangler_timestamp_column(csv_wrangler: CsvWrangler, tmp_path: Path):
    csv_content = """timestamp,open,high,low,close,volume
2024-01-02,100.0,105.0,99.0,104.0,1000000
2024-01-03,104.0,106.0,103.0,105.5,1200000
"""
    csv_file = tmp_path / "ts_data.csv"
    csv_file.write_text(csv_content)
    bars = csv_wrangler.wrangle(
        data=str(csv_file),
        instrument=INSTRUMENT,
        bar_type=BAR_TYPE,
    )
    assert len(bars) == 2


def test_csv_wrangler_bars_sorted_chronologically(
    csv_wrangler: CsvWrangler, tmp_path: Path
):
    csv_content = """date,open,high,low,close,volume
2024-01-05,107.0,109.0,106.0,108.5,900000
2024-01-02,100.0,105.0,99.0,104.0,1000000
2024-01-03,104.0,106.0,103.0,105.5,1200000
"""
    csv_file = tmp_path / "unsorted.csv"
    csv_file.write_text(csv_content)
    bars = csv_wrangler.wrangle(
        data=str(csv_file),
        instrument=INSTRUMENT,
        bar_type=BAR_TYPE,
    )
    assert len(bars) == 3
    assert bars[0].ts_init < bars[1].ts_init < bars[2].ts_init
