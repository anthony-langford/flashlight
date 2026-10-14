# Data sources

Everything marked VERIFIED was fetched on 2026-10-14. "Latest" values are from that date and are only there to show the series is live. Anything not marked VERIFIED is a proposal and must be checked before use.

## Summary

| Source | Access | Auth | Format | Status |
|---|---|---|---|---|
| Bank of Canada Valet | REST API | none | JSON / CSV | VERIFIED |
| Statistics Canada | WDS API, full-table CSV | none | JSON / CSV zip | VERIFIED (metadata and 2 CSVs) |
| FRED | REST API | free API key | JSON / CSV | VERIFIED (IDs via public CSV graph endpoint) |
| CMHC | Excel downloads | none | xlsx | PARTIAL (page checked, file not downloaded) |
| TRREB | PDF reports | none | PDF | PARTIAL (no machine-readable data found) |

## Bank of Canada Valet

Base: `https://www.bankofcanada.ca/valet/observations/{SERIES}/json` (also `/csv`). Add `?recent=N` for the last N observations. Series lists: `/valet/lists/series/json` (3.6 MB). No key. Terms: https://www.bankofcanada.ca/terms/ (not read yet).

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

Developer hub: https://www.statcan.gc.ca/en/developers. Terms and open licence: not read yet, must be read before hosting.

Access paths:

- Table metadata: `POST https://www150.statcan.gc.ca/t1/wds/rest/getCubeMetadata` with body `[{"productId": 34100154}]`. VERIFIED, returns title, dimensions, members, `cubeEndDate`.
- Full table CSV: `https://www150.statcan.gc.ca/n1/tbl/csv/{productId}-eng.zip`. VERIFIED, but large (14100459 is about 4 MB zipped, 61 MB unzipped. 34100292 is over 100 MB zipped). Avoid for big tables.
- Vector-based fetch (`getDataFromVectorsAndLatestNPeriods` and coordinate lookup) is documented but NOT yet tested. This is the intended path for production ingest.

| Internal slug (proposed) | Table | Geography seen | Frequency | Range / latest |
|---|---|---|---|---|
| `statcan.toronto.labour` | 14-10-0459-01 Labour force characteristics by CMA, three-month moving average, seasonally adjusted | `Toronto, Ontario` | monthly | 2011-01 to 2026-09 |
| `statcan.toronto.housing_starts` | 34-10-0154-01 CMHC housing starts, under construction and completions, selected CMAs | `Toronto, Ontario` | monthly | 1972-01 to 2026-08 |
| `statcan.toronto.building_permits` | 34-10-0292-01 Building permits by type of structure and type of work | `Toronto, Ontario` | monthly | to 2026-08 |
| `statcan.toronto.cpi` | 18-10-0004-01 CPI, monthly, not seasonally adjusted (359 product groups) | `Toronto, Ontario` | monthly | to 2026-08 |
| `statcan.toronto.nhpi` | 18-10-0205-01 New housing price index, monthly (3 indexes) | `Toronto, Ontario` | monthly | to 2026-08 |
| `statcan.toronto.population` | 17-10-0148-01 Population estimates, July 1, by CMA, 2021 boundaries | `Toronto (CMA), Ontario` | annual | to 2025 |
| `statcan.canada.labour` | 14-10-0287-01 Labour force characteristics, monthly, SA | Canada, provinces only (no CMAs) | monthly | to 2026-09 |

Notes:

- Table 14-10-0380-01 (an earlier guess for Toronto labour data) is archived. Use 14-10-0459-01.
- Table 14-10-0459-01 dimensions: characteristic (Employment, Employment rate, Labour force, Participation rate, Population, Unemployment, Unemployment rate), statistics (estimate and standard errors), data type (seasonally adjusted, unadjusted).
- Table 34-10-0154-01 dimensions: housing estimate (starts, under construction, completions) by type of unit (single, semi, row, apartment, total).
- 18-10-0004-01 includes shelter components (rent, owned accommodation, mortgage interest cost are expected among the 359 product groups. Not individually checked). Rent index can proxy for rent growth.
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

- Rental Market Survey Data Tables (Excel), 2025 edition published 2025-12-11. Editions 2019 to 2025 listed. Includes vacancy rate and average rent. Geography includes "Greater Toronto Area". Annual (inferred from edition list, not stated).
- Page: https://www.cmhc-schl.gc.ca/professionals/housing-markets-data-and-research/housing-data/data-tables/rental-market/rental-market-report-data-tables
- The download button had no direct URL when fetched. Treat as a manual download into `data/manual/`. Whether a Toronto CMA breakdown exists inside the workbook is not yet checked.
- Housing starts, completions and under construction are available through StatCan 34-10-0154-01 instead, so the CMHC portal is not needed for them.
- CMHC Housing Market Information Portal was not examined.

## TRREB (Toronto Regional Real Estate Board)

- Market Watch is published monthly as PDF. Page: https://trreb.ca/index.php/market-news/market-watch. Historic annual statistics PDF (1979 onward): https://public.trreb.ca/wp-content/files/market-stats/market-watch/historic.pdf.
- Confirmed monthly measures: home sales, new listings, MLS Home Price Index composite benchmark, average selling price. Inventory and days on market not confirmed on the page, may be in the PDFs.
- No CSV or API found. Footer: "All information on this site is copyright Toronto Regional Real Estate Board. All rights reserved."
- Plan for personal use: a manual CSV (`data/manual/trreb_monthly.csv`, template tracked) or a PDF parser. Do not redistribute. For hosting, get permission (contact details are in the Market Watch PDFs) or link out.

## Known gaps and open items

1. **Toronto immigration and non-permanent resident split.** StatCan 17-10-0136-01 (components of change, CMAs) is inactive and ends in 2021. A current replacement was not found. Only total population (17-10-0148-01, annual) is confirmed. Fallback: Ontario or national quarterly components, or IRCC data. Not yet looked up.
2. **Typical discounted 5-year fixed mortgage rate.** No official series. Options: model as GoC 5-year yield plus an assumed spread, or a manually entered lender rate with a date.
3. **Mortgage stress test floor.** The "greater of contract rate plus 2% or 5.25%" rule was stated from memory. It was not verified. Verify against OSFI before using it in the calculator.
4. **Debt service ratio, household debt, wages, GDP, rents by unit type.** Not yet located. Candidates: StatCan household debt service ratio table, StatCan wage tables, CPI rent index.
5. **StatCan and BoC licence terms** have not been read.
6. **WDS vector endpoints** untested.
7. **CMHC workbook** not downloaded or inspected.
8. **TRREB** inventory / days-on-market availability and permission to reuse.
