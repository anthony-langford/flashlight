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


def _word(x, y, text):
    return f'<word xMin="{x}" yMin="{y}" xMax="{x + 40}" yMax="{y + 8}">{text}</word>'


def _hpi_page():
    """Synthetic bbox page: composite, detached, attached, townhouse, apartment at fixed x."""
    starts = [190, 485, 785, 1075, 1355]
    w = [
        _word(263, 60, "MLS"),
        _word(300, 60, "Home"),
        _word(330, 60, "Price"),
        _word(360, 60, "Index"),
    ]
    w += [_word(500, 60, "City"), _word(530, 60, "of"), _word(550, 60, "Toronto,")]
    w += [_word(600, 60, "September"), _word(650, 60, "2026")]
    for s in starts:  # header row
        w += [
            _word(s, 157, "Index"),
            _word(s + 70, 157, "Benchmark"),
            _word(s + 180, 157, "Yr./Yr"),
        ]

    def row(y, area, groups):
        out = [_word(31, y, "Toronto"), _word(87, y, area)]
        for g, (idx, bench, yoy) in groups.items():
            s = starts[g]
            out += [_word(s + 4, y, idx), _word(s + 75, y, bench), _word(s + 200, y, yoy)]
        return out

    w += row(
        300,
        "E01",
        {
            0: ("327.9", "$1,032,000", "-4.26%"),
            1: ("374.7", "$1,382,900", "-7.39%"),
            2: ("367.4", "$1,185,200", "-5.60%"),
            3: ("415.8", "$769,700", "-8.43%"),
            4: ("267.2", "$595,300", "-4.47%"),
        },
    )
    # W07 has no townhouse group: apartment must still land in the apartment column
    w += row(
        330,
        "W07",
        {
            0: ("258.9", "$1,257,900", "2.45%"),
            1: ("298.9", "$1,485,300", "2.54%"),
            2: ("297.7", "$1,215,700", "6.32%"),
            4: ("108.1", "$530,000", "-3.40%"),
        },
    )
    return '<page width="1700" height="900">' + "".join(w) + "</page>"


def test_parse_hpi_assigns_columns_by_position():
    rows = trreb.parse_hpi("<doc>" + _hpi_page() + "</doc>")
    got = {(r.area, r.home_type): r for r in rows}
    assert got[("Toronto E01", "sf_detached")].benchmark == 1_382_900
    assert got[("Toronto E01", "townhouse")].yoy_pct == -8.43
    assert ("Toronto W07", "townhouse") not in got
    assert got[("Toronto W07", "apartment")].benchmark == 530_000
    assert got[("Toronto W07", "sf_attached")].yoy_pct == 6.32
    assert all(r.period == date(2026, 9, 1) for r in rows)


def test_parse_hpi_ignores_pages_without_hpi_title():
    page = '<page width="100" height="100">' + _word(10, 10, "Hello") + "</page>"
    assert trreb.parse_hpi("<doc>" + page + "</doc>") == []


def test_hpi_upsert_is_idempotent():
    conn = db.connect(":memory:")
    rows = trreb.parse_hpi("<doc>" + _hpi_page() + "</doc>")
    db.upsert_hpi(conn, rows)
    db.upsert_hpi(conn, rows)
    assert conn.execute("SELECT count(*) FROM trreb_hpi").fetchone()[0] == len(rows)
