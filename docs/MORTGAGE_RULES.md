# Mortgage and tax rules

Everything here was read from an official page on 2026-10-14, then **re-checked against the raw page text** (downloaded HTML stripped to text and searched for each exact figure, because the first pass went through a page-summarising tool that can paraphrase). canada.ca blocks plain `curl`, so those pages were fetched with headless Chrome (`--dump-dom`). Each row says what the page said, when the page was last dated (where it shows a date) and how sure we are. This is a plain reading of public pages, not legal, tax or mortgage advice, and rules change. The calculator uses exactly these numbers. If a number here changes, change `app/src/mortgage.ts` and its tests in the same commit.

Confidence: **Confirmed** means a primary official page states it. **Conflict** means official pages disagree. **Assumption** means it is a modelling choice, not a rule.

## Qualifying (stress test)

| Rule | Value | Source | Confidence |
|---|---|---|---|
| Minimum qualifying rate for uninsured mortgages | The greater of the mortgage contract rate plus 2%, or 5.25%. | [OSFI](https://www.osfi-bsif.gc.ca/en/supervision/financial-institutions/banks/minimum-qualifying-rate-uninsured-mortgages), page modified 2026-01-29. OSFI says it reviews at least annually. | Confirmed |
| Same test for insured mortgages | OSFI material says the Minister of Finance applies the same test to insured mortgages. | OSFI pages, seen only as a search excerpt, not read in full. | Likely, re-check |
| Re-test at renewal | Not expected for straight switches or renewals. | OSFI pages (search excerpt). Not relevant to a first purchase. | Reported |

## Down payment and insured mortgages

| Rule | Value | Source | Confidence |
|---|---|---|---|
| Minimum down payment | 5% of the first $500,000, plus 10% of the portion from $500,000 to $1.5 million. 20% at $1.5 million or more. Up to $500,000: 5%. | [FCAC down payment page](https://www.canada.ca/en/financial-consumer-agency/services/mortgages/down-payment.html), dated 2025-10-15 | Confirmed |
| Insured mortgage price cap | $1.5 million, raised from $1 million effective December 15, 2024. | [Finance Canada, 2024-12-15](https://www.canada.ca/en/department-finance/news/2024/12/boldest-mortgage-reforms-in-decades-come-into-force-today.html). Repeated in a September 2025 [government question-period note](https://search.open.canada.ca/qpnotes/record/infc,HICC-012026-00009). | **Conflict, see below** |
| 30-year amortization on insured mortgages | Available to all first-time buyers and buyers of new builds. Other insured buyers: not stated on the pages read, and 25 years is the usual limit. | Finance Canada 2024-12-15 page | Confirmed for first-time and new-build buyers. 25 years for others is an assumption |
| Maximum amortization for uninsured mortgages (20% or more down) | Not found on an official page. Set by the lender. | n/a | Not verified |

### The $1 million versus $1.5 million conflict

Confirmed in the raw page text of the FCAC page (dated 2025-10-15): it lists the $1.5 million down payment tiers, and a few paragraphs later says: "Mortgage loan insurance isn't available if: the purchase price of the home is $1 million or more". Finance Canada's December 2024 release (raw text: "the federal government has increased the $1 million price cap for insured mortgages to $1.5 million"), and a September 2025 government note, say the cap is $1.5 million. I treat the $1.5 million cap as correct, since the Finance Canada release is the source of the change and the FCAC line looks like stale text. This matters a lot at a $1.10M to $1.35M budget: if the old $1 million cap applied, insured (under 20% down) purchase would be impossible. **Confirm the current cap with a lender or broker before relying on a down payment under 20%.** The calculator shows this warning.

## Mortgage insurance premium (CMHC)

| Rule | Value | Source | Confidence |
|---|---|---|---|
| Premium on the loan, by loan-to-value | Up to 65%: 0.60%. 65.01-75%: 1.70%. 75.01-80%: 2.40%. 80.01-85%: 2.80%. 85.01-90%: 3.10%. 90.01-95%: 4.00% (4.50% with a non-traditional down payment). | [CMHC cost page](https://www.cmhc-schl.gc.ca/consumers/home-buying/mortgage-loan-insurance-for-consumers/cmhc-mortgage-loan-insurance-cost) and the [CMHC premium information page](https://www.cmhc-schl.gc.ca/professionals/project-funding-and-mortgage-financing/mortgage-loan-insurance/mortgage-loan-insurance-homeownership-programs/premium-information-for-homeowner-and-small-rental-loans). Both show "Date Published: March 31, 2018", so the table may have been updated without a new date. | Confirmed (two CMHC pages agree) |
| Amortization surcharge | 0.20% added when amortization is beyond 25 years. | CMHC premium information page ("An amortization period beyond 25 years is subject to a 0.20% surcharge", in the portability and refinance part of the page). A [June 2024 CMHC notice](https://www.cmhc-schl.gc.ca/media-newsroom/notices/2024/cmhc-revises-homeowner-mortgage-loan-insurance-premiums) introduced a 20 basis point surcharge for the 30-year option, written when that option was only for first-time buyers of new builds. Applying it to every 30-year insured purchase is an extension of those two statements. | Confirmed as written. Scope for resale first-time buyers inferred |
| Premium is added to the mortgage | The premium is added to the loan amount. | CMHC (general practice). Not separately quoted on the pages read. | Assumption |
| Other insurers | Sagen and Canada Guaranty also insure mortgages and may price differently. | FCAC page | Not modelled |
| Provincial sales tax on the premium | Ontario applies provincial sales tax to the premium. It cannot be added to the mortgage and is paid in cash at closing. Rate: Ontario's retail sales tax page sets 8% on premiums under taxable insurance contracts. | [FCAC](https://www.canada.ca/en/financial-consumer-agency/services/mortgages/down-payment.html), [CMHC cost page](https://www.cmhc-schl.gc.ca/consumers/home-buying/mortgage-loan-insurance-for-consumers/cmhc-mortgage-loan-insurance-cost), [Ontario retail sales tax: insurance](https://www.ontario.ca/document/retail-sales-tax/insurance-and-benefits-plans) | CMHC's cost page states "Premiums in Quebec, Ontario and Saskatchewan are subject to provincial sales tax" and that it cannot be added to the loan. Ontario's page gives 8% on taxable insurance premiums and calls mortgage insurance initiation and underwriting fees non-taxable, but does not name the premium itself. Combined, the 8% on the premium is a strong inference |

## Land transfer tax

| Rule | Value | Source | Confidence |
|---|---|---|---|
| Ontario land transfer tax (marginal brackets) | The page also gives closed forms that the tests use as an independent check: `VOC x 0.02 - $3,525` from $400,000 to $2,000,000, and `VOC x 0.025 - $13,525` above $2,000,000. 0.5% up to $55,000. 1.0% from $55,000 to $250,000. 1.5% from $250,000 to $400,000. 2.0% above $400,000. 2.5% on the part above $2,000,000 for land with one or two single family residences. | [Ontario: calculating land transfer tax](https://www.ontario.ca/document/land-transfer-tax/calculating-land-transfer-tax) | Confirmed |
| Ontario first-time buyer refund | Up to $4,000, which covers all tax on a price up to $368,000. Conditions: age 18 or older, never owned a home anywhere in the world (spouse too), Canadian citizen or permanent resident, occupy as principal residence within nine months, apply within 18 months. | [Ontario first-time homebuyer refunds](https://www.ontario.ca/document/land-transfer-tax/land-transfer-tax-refunds-first-time-homebuyers) | Confirmed |
| Toronto municipal land transfer tax (marginal brackets), effective April 1, 2026 | 0.5% up to $55,000. 1.0% to $250,000. 1.5% to $400,000. 2.0% from $400,000 to $2,000,000. 2.5% from $2,000,000 to $3,000,000. Higher tiers above $3,000,000 (4.40%, 5.45%, 6.50%, 7.55%, 8.60%), not relevant at this budget. | [Toronto MLTT rates and fees](https://www.toronto.ca/services-payments/property-taxes-utilities/municipal-land-transfer-tax-mltt/municipal-land-transfer-tax-mltt-rates-and-fees/), page modified 2026-04-07. The older schedule (Jan 2024 to Mar 2026) had the same brackets up to $2,000,000. | Confirmed up to $2M. Higher tiers read from the page, unchecked |
| Toronto first-time buyer rebate | Up to $4,475, which covers all municipal tax on a price up to $400,000. Same kind of conditions as Ontario. | [Toronto rebate page](https://www.toronto.ca/services-payments/property-taxes-utilities/municipal-land-transfer-tax-mltt/municipal-land-transfer-tax-mltt-rebate-opportunities/), page modified 2025-12-18. The April 2026 rates page does not mention it. A 2026 submission says Council asked staff in December 2025 to look at raising it. | Confirmed as of Dec 2025. Re-check, it may have changed |

Both taxes are marginal: each rate applies only to the slice of the price inside that bracket. At a $1.2 million price the Ontario tax is $20,475 (275 + 1,950 + 2,250 + 16,000) and the Toronto tax is the same $20,475 before any rebate, because the brackets are identical up to $2 million. The Toronto tax applies only to property inside the City of Toronto.

## Not covered, and why

- Other closing costs (lawyer, title insurance, registration, inspection, appraisal) are estimated separately, with sources and confidence, in CLOSING_COSTS.md. Property tax and utility adjustments, surveys, insurance and moving are not estimated.
- Maximum debt service ratios (GDS and TDS). Not verified, so the calculator shows the stress-test payment but does not judge affordability against income.
- Mortgage compounding. Canadian fixed-rate mortgages are commonly compounded semi-annually, variable rates monthly. This is a convention, not verified here, so it is a labelled assumption with a switch.
- First-time buyer programs such as the FHSA and Home Buyers' Plan. Not researched.
- Whether you personally qualify as a first-time buyer. Ask yourself the conditions above. The calculator takes a checkbox and defaults it to off (the more conservative choice for amortization and rebates).
