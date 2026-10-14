from datetime import date

from ingest import db
from ingest.sources import trreb

# Synthetic text in the layout produced by `pdftotext -layout` for the Sept 2026 format.
# Numbers are made up. Only the structure matches the real report.
SAMPLE = """\
Toronto Regional Real Estate Board

City of Toronto Municipal Breakdown                                      Detached, September 2026
    All TRREB Areas                  Sales      Dollar Volume    Average Price   Median Price   New Listings   Active Listings       Avg. SP/LP      Avg. LDOM
     AreaDerived                     Sales      Dollar Volume    Average Price   Median Price   New Listings   Active Listings       Avg. SP/LP      Avg. LDOM
 All TRREB Areas                     2,000      $2,400,000,000     $1,200,000      $1,000,000      7,000          11,000                97%                31
      MunicipalityDerived            Sales      Dollar Volume    Average Price   Median Price   New Listings   Active Listings       Avg. SP/LP      Avg. LDOM
 Toronto E01                              10         $15,000,000     $1,500,000      $1,400,000        30               20                110%                 9
 Toronto C08                               0                                                             3                3
 Toronto E03                              40         $48,000,000     $1,200,000      $1,100,000        90               95                 99%                25


Copyright 2026 Toronto Regional Real Estate Board
                                                       Market Watch September 2026             7

City of Toronto Municipal Breakdown                                      All Home types, Year-to-Date 2026
    All TRREB Areas                  Sales      Dollar Volume    Average Price   Median Price   New Listings    Avg. SP/LP    Avg. LDOM    Avg. PDOM
 Toronto E01                             999         $1,500,000,000   $1,500,000      $1,400,000        3,000         110%          9          12

ALL TRREB AREAS                                                          All Home types, September 2026
    All TRREB Areas        Sales      Dollar Volume     Average Price   Median Price   New Listings   SNLR Trend   Active Listings   Mos Inv (Trend)     Avg. SP/LP   Avg. LDOM   Avg. PDOM
 Toronto E01                  64         $78,306,805      $1,223,544      $1,221,500        166          48.2%           160                2.4            109%          18           25
"""


def _by_key(rows):
    return {(r.area, r.home_type): r for r in rows}


def test_parses_district_rows_and_types():
    rows = trreb.parse_text(SAMPLE)
    got = _by_key(rows)
    e01 = got[("Toronto E01", "detached")]
    assert e01.period == date(2026, 9, 1)
    assert e01.values["sales"] == 10
    assert e01.values["avg_price"] == 1_500_000
    assert e01.values["sp_lp"] == 110
    assert e01.values["ldom"] == 9
    assert "snlr_trend" not in e01.values  # not a column in the detached table


def test_all_home_types_has_extra_columns():
    got = _by_key(trreb.parse_text(SAMPLE))
    e01 = got[("Toronto E01", "all")]
    assert e01.values["snlr_trend"] == 48.2
    assert e01.values["months_inventory"] == 2.4
    assert e01.values["active_listings"] == 160
    assert e01.values["pdom"] == 25


def test_zero_sales_row_has_none_for_price_fields():
    got = _by_key(trreb.parse_text(SAMPLE))
    c08 = got[("Toronto C08", "detached")]
    assert c08.values["sales"] == 0
    assert c08.values["avg_price"] is None
    assert c08.values["new_listings"] == 3
    assert c08.values["active_listings"] == 3


def test_year_to_date_tables_are_skipped():
    rows = trreb.parse_text(SAMPLE)
    # the YTD sample row has 999 sales and must never appear
    assert all(r.values["sales"] != 999 for r in rows)


def test_header_and_footer_lines_are_ignored():
    rows = trreb.parse_text(SAMPLE)
    areas = {r.area for r in rows}
    assert areas == {"All TRREB Areas", "Toronto E01", "Toronto C08", "Toronto E03"}


def test_unsupported_layout_yields_no_rows():
    assert (
        trreb.parse_text("SUMMARY OF EXISTING HOME TRANSACTIONS  All Home Types, August 2026") == []
    )


def test_upsert_is_idempotent():
    conn = db.connect(":memory:")
    rows = trreb.parse_text(SAMPLE)
    db.upsert_trreb(conn, rows)
    db.upsert_trreb(conn, rows)
    count = conn.execute("SELECT count(*) FROM trreb_monthly").fetchone()[0]
    assert count == len(_by_key(rows))
    sales = conn.execute(
        "SELECT sales FROM trreb_monthly WHERE area='Toronto E01' AND home_type='detached'"
    ).fetchone()[0]
    assert sales == 10


def test_pdf_path_naming(tmp_path):
    assert trreb.pdf_path(2026, 9, tmp_path).name == "mw2609.pdf"
    assert trreb.pdf_path(2025, 12, tmp_path).name == "mw2512.pdf"
