from datetime import date

import httpx
import openpyxl
import pytest
import respx

from ingest.models import SeriesDef
from ingest.sources import cmhc


def _workbook(path, header=("Centre", "Oct-24", "Oct-25"), toronto=None):
    wb = openpyxl.Workbook()
    wb.active.title = "Table of Contents"
    ws = wb.create_sheet("Table 1.0")
    ws.append(["1.0 Rental Market Indicators"])
    ws.append(list(header))
    ws.append(["Halifax CMA", "1.0", "a", "2.0", "a", "-"])
    # numbers, quality letters and arrows are interleaved like the real sheet
    row = toronto or [
        "Toronto CMA", "2.5", "a", "3.0", "a", "↑", "6.4", "a", "8.7", "a", "↑",
        "1,974", "a", "2,046", "a", "2.7", "b", "3.4", "b",
    ]  # fmt: skip
    ws.append(row)
    wb.save(path)
    return path


def test_parse_reads_toronto_row(tmp_path):
    out = cmhc.parse_workbook(_workbook(tmp_path / "a.xlsx"))
    vac = {o.obs_date: o.value for o in out["vacancy_rate"]}
    assert vac == {date(2024, 10, 1): 2.5, date(2025, 10, 1): 3.0}
    rent = {o.obs_date: o.value for o in out["avg_rent_2br"]}
    assert rent == {date(2024, 10, 1): 1974.0, date(2025, 10, 1): 2046.0}
    assert {o.value for o in out["rent_change_2br"]} == {2.7, 3.4}


def test_parse_rejects_suppressed_values(tmp_path):
    row = [
        "Toronto CMA",
        "2.5",
        "a",
        "**",
        "-",
        "6.4",
        "a",
        "8.7",
        "a",
        "1,974",
        "2,046",
        "2.7",
        "3.4",
    ]
    with pytest.raises(ValueError, match="expected 8 numbers"):
        cmhc.parse_workbook(_workbook(tmp_path / "b.xlsx", toronto=row))


def test_parse_rejects_unexpected_header(tmp_path):
    with pytest.raises(ValueError, match="survey year"):
        cmhc.parse_workbook(_workbook(tmp_path / "c.xlsx", header=("Centre", "Oct-24", "Oct-27")))


def _series(metric="vacancy_rate"):
    return SeriesDef.model_validate(
        {
            "id": "cmhc.toronto.vacancy_rate", "title": "v", "source": "cmhc_rental",
            "source_id": metric, "frequency": "annual", "unit": "percent",
            "geography": "Toronto CMA", "layer": "rental",
        }
    )  # fmt: skip


def test_fetch_merges_editions_newest_wins(tmp_path):
    older = [
        "Toronto CMA",
        "1.0",
        "a",
        "2.5",
        "a",
        "1",
        "a",
        "1",
        "a",
        "1",
        "a",
        "1",
        "a",
        "1",
        "a",
        "1",
        "a",
    ]
    _workbook(tmp_path / "rmr-2024.xlsx", header=("Centre", "Oct-23", "Oct-24"), toronto=older)
    _workbook(tmp_path / "rmr-canada-2025-en.xlsx")  # revises Oct-24 to 2.5 -> still 2.5 here
    # Pretend only these two editions exist: use cached files and no network
    with respx.mock:
        respx.route().mock(return_value=httpx.Response(404))
        with httpx.Client() as client:
            obs = cmhc.fetch(_series(), client, directory=tmp_path)
    assert [(o.obs_date.year, o.value) for o in obs] == [(2023, 1.0), (2024, 2.5), (2025, 3.0)]


def test_fetch_without_any_edition_raises(tmp_path):
    with respx.mock:
        respx.route().mock(return_value=httpx.Response(404))
        with httpx.Client() as client, pytest.raises(RuntimeError, match="no CMHC rental editions"):
            cmhc.fetch(_series(), client, directory=tmp_path)


def test_parse_header_with_merged_cell_gaps(tmp_path):
    # Real sheets leave empty cells between header labels because of merged cells
    path = _workbook(tmp_path / "d.xlsx", header=("Centre", None, "Oct-24", None, "Oct-25"))
    assert cmhc.parse_workbook(path)["vacancy_rate"][-1].obs_date == date(2025, 10, 1)
