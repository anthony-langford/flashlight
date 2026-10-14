# Data sources

Everything marked VERIFIED was fetched on 2026-10-14. "Latest" values are from that date and are only there to show the series is live. Anything not marked VERIFIED is a proposal and must be checked before use.

## Summary

| Source | Access | Auth | Format | Status |
|---|---|---|---|---|
| Bank of Canada Valet | REST API | none | JSON / CSV | VERIFIED |
| Statistics Canada | WDS API, full-table CSV | none | JSON / CSV zip | VERIFIED (metadata and 2 CSVs) |
| FRED | REST API | free API key | JSON / CSV | VERIFIED (IDs via public CSV graph endpoint) |
| CMHC | Excel downloads, parsed locally | none | xlsx | VERIFIED (editions 2021 to 2025) |
| TRREB | PDF reports, parsed locally | none | PDF | VERIFIED for Sept 2026 layout onward. Older layout unsupported |

## Licensing and hosting readiness

Terms were read on 2026-10-14 and the key phrases (CMHC personal use and prior written consent, StatCan attribution and sale rights, BoC attribution and LSEG-sourced indicative exchange rates) were re-checked against the raw page text the same day. This is a plain-language summary, not legal advice. Everything below is fine for local personal use. The right-hand column is what changes if the app is ever hosted.

| Source | Terms read | If hosted |
|---|---|---|
| Statistics Canada | [Open Licence](https://www.statcan.gc.ca/en/reference/licence) | Allowed, including commercial use, with the required attribution ("Source: Statistics Canada, product, reference date", or "Adapted from..." for derived figures) and no implied endorsement. |
| Bank of Canada | [Terms](https://www.bankofcanada.ca/terms/) | Allowed with attribution to the Bank and a note of changes. Exchange rates are indicative and sourced from LSEG, so confirm before showing USD/CAD. Respect request limits. No logo use. |
| FRED | [API terms](https://fred.stlouisfed.org/docs/api/terms_of_use.html) | Allowed with the required "not endorsed" notice. Must not replicate the FRED site. `MORTGAGE30US` is third-party (Freddie Mac) and needs permission. |
| CMHC | [Terms](https://www.cmhc-schl.gc.ca/about-us/terms-conditions) | Not allowed without prior written consent (personal use only). A separate CMHC data licence agreement is referenced but was not found. Drop the four CMHC series or get consent. |
| TRREB | Copyright notice on site | Not allowed. Personal use only. The export has `--no-trreb` to keep it out of anything hosted. |

`npm run build` copies `app/public/data/` into `dist/`. Never host a `dist/` built from an export that included TRREB or CMHC data.

## Bank of Canada Valet

Base: `https://www.bankofcanada.ca/valet/observations/{SERIES}/json` (also `/csv`). Add `?recent=N` for the last N observations. Series lists: `/valet/lists/series/json` (3.6 MB). No key. Terms: https://www.bankofcanada.ca/terms/ (read 2026-10-14, see the licensing table).

| Internal slug (proposed) | Valet ID | Meaning | Frequency | Latest seen |
|---|---|---|---|---|
| `boc.policy_rate` | `V39079` | Target for the overnight rate | daily | 2.25 (2026-10-13) |
| `boc.prime_rate` | `V80691311` | Prime rate | weekly | 4.45 (2026-10-07) |
| `boc.gov_2y_yield` | `BD.CDN.2YR.DQ.YLD` | GoC benchmark bond yield, 2-year | daily | listed in series list |
| `boc.gov_5y_yield` | `BD.CDN.5YR.DQ.YLD` | GoC benchmark bond yield, 5-year | daily | listed in series list |
| `boc.gov_10y_yield` | `BD.CDN.10YR.DQ.YLD` | GoC benchmark bond yield, 10-year | daily | listed in series list |
| `boc.mortgage_5y_posted` | `V80691335` | Conventional mortgage, 5-year (chartered banks, posted) | weekly | 6.19 (2026-10-14) |
| `boc.mortgage_1y_posted` | `V80691333` | Conventional mortgage, 1-year | weekly | listed only |
| `boc.mortgage_3y_posted` | `V80691334` | Conventional mortgage, 3-year | weekly | listed only |
| `boc.mortgage_5y_variable_est` | `BROKER_AVERAGE_5YR_VRM` | Estimated variable mortgage rate | weekly | 3.57 (2026-10-08) |
| `boc.cpi_trim` | `CPI_TRIM` | CPI-trim | monthly | 1.9 (2026-08) |
| `boc.cpi_median` | `CPI_MEDIAN` | CPI-median | monthly | 2.0 (2026-08) |
| `boc.cpi_common` | `CPI_COMMON` | CPI-common | monthly | 2.6 (2026-08) |

Notes:

- Earlier guess `B114039` for the policy rate is only a static label. Use `V39079`.
- `V80691335` is the posted rate (highest, used as the basis of the stress test per secondary sources). It is not what buyers typically pay. No official series for the typical discounted 5-year fixed rate was found.
- `V122497` (average residential mortgage lending rate, 5-year) was terminated in December 2017. Do not use.
- Series with prefixes like `FSR_`, `MPR_`, `SPEECH_`, `WM_SAN_` are chart data from publications, not maintained feeds. Do not use them.

## Statistics Canada

Developer hub: https://www.statcan.gc.ca/en/developers. Terms: the Open Licence was read 2026-10-14, see the licensing table.

Access paths:

- Table metadata: `POST https://www150.statcan.gc.ca/t1/wds/rest/getCubeMetadata` with body `[{"productId": 34100154}]`. VERIFIED, returns title, dimensions, members, `cubeEndDate`.
- Full table CSV: `https://www150.statcan.gc.ca/n1/tbl/csv/{productId}-eng.zip`. VERIFIED, but large (14100459 is about 4 MB zipped, 61 MB unzipped. 34100292 is over 100 MB zipped). Avoid for big tables.
- Vector lookup: `POST getSeriesInfoFromCubePidCoord` with `[{"productId": ..., "coordinate": "26.5.1.1.0.0.0.0.0.0"}]`. VERIFIED 2026-10-14. A coordinate is the member ids of each dimension in position order, zero-padded to 10 places.
- Data fetch: `POST getDataFromVectorsAndLatestNPeriods` with `[{"vectorId": N, "latestN": N}]`. VERIFIED. `latestN` of 5000 returns the full history. This is what the ingest client uses.
- **Pitfall: results are NOT returned in request order.** Both endpoints can reorder a batch. Match results on the returned `productId` and `coordinate` (lookup) or `vectorId` (data), never by position. The client does this and a test covers it.
- A coordinate for a series that does not exist returns `responseStatusCode` 2 and `vectorId` 0, not an HTTP error.
- Documented limits: 25 requests per second per IP. Data updates at 8:30 ET on business days. HTTP 409 means the table is locked for update.

Vector IDs below were resolved and checked live on 2026-10-14. The catalogue (`catalogue/statcan/`) is the source of truth. Each entry records the table and coordinate in `source_ref`.

| Catalogue id (`statcan.toronto.` + ...) | Table | Vector | Frequency | History loaded |
|---|---|---|---|---|
| `unemployment_rate`, `employment_rate`, `participation_rate`, `employment` | 14-10-0459-01 (three-month moving average, seasonally adjusted) | 1643279334, 1643279350, 1643279342, 1643279318 | monthly | 2011-01 to 2026-09 |
| `housing_starts_total`, `_single`, `_semi` | 34-10-0154-01 | 42127475, 42127476, 42127477 | monthly | 1972-01 to 2026-08 |
| `housing_under_construction_total` | 34-10-0154-01 | 42127480 | monthly | 1972-01 to 2026-08 |
| `housing_completions_total` | 34-10-0154-01 | 42127485 | monthly | 1972-01 to 2026-08 |
| `cpi_all_items`, `cpi_shelter`, `cpi_rented_accommodation`, `cpi_owned_accommodation` | 18-10-0004-01 | 41692888, 41692889, 41692890, 41692891 | monthly | 1971/1978 to 2026-08 |
| `nhpi_total`, `nhpi_house_only`, `nhpi_land_only` | 18-10-0205-01 | 111955499, 111955500, 111955501 | monthly | 1981-01 to 2026-08 |
| `population` | 17-10-0148-01 (CMA, 2021 boundaries) | 1589887692 | annual | 2001 to 2025 |
| `permits_residential_units_created` (SA) | 34-10-0292-01 | 1675217379 | monthly | 2018-01 to 2026-08 |
| `permits_residential_value` (SA, thousands of dollars) | 34-10-0292-01 | 1675119950 | monthly | 2018-01 to 2026-08 |

Not used: `statcan.canada.labour` (14-10-0287-01, national and provincial only).

Notes:

- Table 14-10-0380-01 (an earlier guess for Toronto labour data) is archived. Use 14-10-0459-01.
- Table 14-10-0459-01 dimensions: characteristic (Employment, Employment rate, Labour force, Participation rate, Population, Unemployment, Unemployment rate), statistics (estimate and standard errors), data type (seasonally adjusted, unadjusted).
- Table 34-10-0154-01 dimensions: housing estimate (starts, under construction, completions) by type of unit (single, semi, row, apartment, total).
- 18-10-0004-01: the finer "Rent" and "Mortgage interest cost" series do NOT exist for Toronto (checked, status 2). The parents "Rented accommodation" and "Owned accommodation" do, and are used.
- Table 14-10-0459-01 is a three-month moving average, so it lags turning points. Its 2026-09 value covers roughly July to September.
- Employment is in thousands of persons. Population is in persons. Building permit value is in thousands of dollars.
- Land-only new housing price index values carry a StatCan quality flag (code 7, grade E) in recent months.
- Annual population values are tagged with the January date of the reference year (the estimate is for July 1).
- Table 34-10-0135-01 (quarterly starts, Canada and provinces only) is not needed.

## FRED

API: `https://api.stlouisfed.org/fred/series/observations?series_id=...&api_key=...&file_type=json`. Requires a free key (`FRED_API_KEY`). The IDs below were checked through FRED's public CSV graph endpoint, not the keyed API.

| Internal slug (proposed) | FRED ID | Meaning | Frequency | Latest seen |
|---|---|---|---|---|
| `fred.fed_funds_daily` | `DFF` | Effective federal funds rate | daily | 3.88 (2026-10-12) |
| `fred.fed_funds_monthly` | `FEDFUNDS` | Effective federal funds rate | monthly | 3.75 (2026-09) |
| `fred.ust_2y` | `DGS2` | 2-year Treasury yield | daily | 4.80 (2026-10-09) |
| `fred.ust_10y` | `DGS10` | 10-year Treasury yield | daily | 5.24 (2026-10-09) |
| `fred.ust_2s10s` | `T10Y2Y` | 10-year minus 2-year spread | daily | 0.42 (2026-10-13) |
| `fred.us_cpi` | `CPIAUCSL` | US CPI, all urban consumers, SA | monthly | 336.298 (2026-09) |
| `fred.us_unemployment` | `UNRATE` | US unemployment rate | monthly | 4.2 (2026-09) |
| `fred.us_mortgage_30y` | `MORTGAGE30US` | 30-year fixed mortgage rate | weekly | 7.40 (2026-10-08). FRED notes carry a third-party copyright flag. |
| `fred.wti_oil` | `DCOILWTICO` | WTI crude oil, dollars per barrel | daily | data to 2026-10-06 (lags about a week) |

Not yet checked: US GDP, economic policy uncertainty indices.

USD/CAD is taken from the Bank of Canada instead (`boc.usdcad`, Valet `FXUSDCAD`, daily, history only from 2017-01-03, verified 2026-10-14). The FRED series `DEXCAUS` carries a copyright notice and is not used.

Terms (https://fred.stlouisfed.org/docs/api/terms_of_use.html, read 2026-10-14):

- Must show: "This product uses the FRED(R) API but is not endorsed or certified by the Federal Reserve Bank of St. Louis." If the app is for other users, also link to the terms.
- Must not replicate the essential user experience of the FRED site, or use FRED / Federal Reserve names in the hostname or logos.
- Series with "Copyright" in their notes are third-party. Beyond personal use they need the owner's permission. Of the series in use, `MORTGAGE30US` has such a note (checked via the series metadata API on 2026-10-14). Drop it or get permission before hosting.

## CMHC

Rental Market Survey data tables (Excel), annual, October survey, published in December. Scope: purpose-built rental apartment structures of three units and over. Excludes rented condos, houses and basement apartments, so it is a context series for rent versus buy, not a freehold measure.

- Page: https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/rental-market/rental-market-report-data-tables
- Direct file URLs (found in the page source, verified 2026-10-14): `https://assets.cmhc-schl.gc.ca/sites/cmhc/professional/housing-markets-data-and-research/housing-data-tables/rental-market/rental-market-report-data-tables/{year}/rmr-canada-{year}-en.xlsx`. Editions 2021 to 2025 exist (the 2025-style file name also serves older years). 2019 and 2020 returned 404. The 2026 edition is expected around December 2026.
- Parsed (ingest/sources/cmhc.py): Table 1.0, row `Toronto CMA`. Each edition has two October readings, editions overlap, newest wins. Series: `cmhc.toronto.vacancy_rate`, `turnover_rate`, `avg_rent_2br` (new and existing structures), `rent_change_2br` (fixed sample, existing structures only). Loaded 2020 to 2025: vacancy 3.4, 4.6, 1.6, 1.4, 2.5, 3.0 percent. Average two-bedroom rent $1,635, $1,679, $1,779, $1,961, $1,974, $2,046.
- Other tables in the workbook, not loaded: 4.1 and 4.2 (rental condo apartments, Toronto two-bedroom average $2,891 in Oct 2025), 5.0 (arrears), 6.0 to 6.2 (turnover versus non-turnover rents). Table 6.0 and 6.2 would show the gap between sitting-tenant and market rents.
- Housing starts, completions and under construction come from StatCan 34-10-0154-01 instead. The CMHC Housing Market Information Portal was not examined.

## TRREB (Toronto Regional Real Estate Board)

Personal use only. All TRREB content is copyrighted ("All rights reserved"). PDFs are cached in `data/trreb/` and parsed rows live in the gitignored DuckDB file. Do not redistribute. For hosting, get permission (contact details are in the Market Watch PDFs) or link out.

- Market Watch is published monthly as a PDF, usually in the first week of the following month. URL pattern (checked 2026-10-14): `https://trreb.ca/wp-content/files/market-stats/market-watch/mwYYMM.pdf`, for example `mw2609.pdf`. Page: https://trreb.ca/index.php/market-news/market-watch. No CSV or API exists.
- **Parsed (ingest/sources/trreb.py):** the monthly district tables, for each home type (all, detached, semi-detached, att/row/townhouse, condo townhouse, condo apartment, link, co-op, detached condo, co-ownership). One row per area or district (`Toronto E01`, `Toronto W08`, municipalities, regions). Columns: sales, dollar volume, average price, median price, new listings, active listings, average sale-to-list ratio (SP/LP), average days on market (LDOM). The "all home types" table also has SNLR trend, months of inventory and PDOM. Year-to-date tables are skipped. Command: `uv run python -m ingest trreb --from 2026-09`. Requires `pdftotext` (`brew install poppler`).
- Verified 2026-10-14 on the September 2026 PDF: 760 rows (76 areas x 10 types). Spot checks against the PDF text matched (for example E01 detached: 13 sales, $1,506,231 average, 114% SP/LP).
- **Layout change:** TRREB changed the report layout with the September 2026 issue. The older layout (checked on July and August 2026) has overlapping duplicate text layers, so plain text extraction gives scrambled columns. Those PDFs are NOT supported. History before September 2026 is therefore missing. Options: parse word coordinates with column matching, try another PDF library, or build history forward month by month.
- **MLS Home Price Index (HPI) benchmarks, also parsed:** benchmark price, index and year-over-year change by district for composite, single family detached, single family attached, townhouse and apartment. Stored in `trreb_hpi`. Some districts lack whole home-type groups, so numbers are assigned to columns by word position (`pdftotext -bbox`), not text order. Verified 2026-09: 343 rows, City of Toronto and district values match the PDF (for example E01 detached benchmark $1,382,900, W07 has no townhouse group). HPI is the best price series because it adjusts for the mix of homes sold. Semi-detached homes fall under "single family attached".
- Historic annual statistics PDF (1979 onward, annual sales and average price): https://public.trreb.ca/wp-content/files/market-stats/market-watch/historic.pdf. Not parsed.

### Target areas and TRREB districts

TRREB districts are the finest geography in the monthly report. Neighbourhood-level (community) numbers appear only in separate quarterly community reports. The 2019 community reports (https://trreb.ca/wp-content/files/market-stats/community-reports/2019/Q1/Toronto/TorontoEastQ12019.pdf and `TorontoWestQ12019.pdf`) were the newest I could fetch. URLs for 2025 and 2026 reports returned 404, so the current location is unknown. Boundaries may have changed since 2019.

| Area you named | TRREB district(s) | Evidence |
|---|---|---|
| Riverdale | E01 (communities North Riverdale, South Riverdale, Blake-Jones, Greenwood-Coxwell) | 2019 community report. Confident. |
| Monarch Park | Not a TRREB community. Near Coxwell and Danforth, so the likely candidates are E01, E02 (The Beaches, East End-Danforth, Woodbine Corridor) and E03 (East York, Danforth, Playter Estates-Danforth, Woodbine-Lumsden) | Not verified. Needs the TDSB school catchment boundary compared with TRREB communities. |
| Sunnylea | Not a TRREB community. Candidates: W07 (Stonegate-Queensway) or W08 (includes Kingsway South, Edenbridge-Humber Valley, Princess-Rosethorn, Islington-City Centre West) | Not verified. |

Treat the district-to-neighbourhood mapping as a working assumption until checked against current TRREB maps and school catchments.

## Known gaps and open items

1. **Toronto immigration and non-permanent resident split.** StatCan 17-10-0136-01 (components of change, CMAs) is inactive and ends in 2021. A current replacement was not found. Only total population (17-10-0148-01, annual) is confirmed. Fallback: Ontario or national quarterly components, or IRCC data. Not yet looked up.
2. **Typical discounted 5-year fixed mortgage rate.** No official series. Options: model as GoC 5-year yield plus an assumed spread, or a manually entered lender rate with a date.
3. **Mortgage stress test floor.** The "greater of contract rate plus 2% or 5.25%" rule was stated from memory. It was not verified. Verify against OSFI before using it in the calculator.
4. **Debt service ratio, household debt, wages, GDP, rents by unit type.** Not yet located. Candidates: StatCan household debt service ratio table, StatCan wage tables, CPI rent index.
5. ~~StatCan and BoC licence terms not read.~~ Read 2026-10-14. The CMHC data licence agreement page referenced by CMHC was not found.
6. ~~WDS vector endpoints untested.~~ Done 2026-10-14, see above.
7. ~~CMHC workbook not downloaded or inspected.~~ Done 2026-10-14. Remaining: rent for houses and condos is not covered by the survey tables loaded here.
8. **TRREB** history before Sept 2026 (old PDF layout), current community report URL, and permission to reuse if hosting.
9. **Neighbourhood to district mapping** for Monarch Park and Sunnylea (see above).
