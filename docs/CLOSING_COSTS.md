# Closing costs (other than land transfer tax)

The Affordability tab pre-fills "Other closing costs" with a typical estimate and shows the range. This page records where each number comes from and how much to trust it. Sources were read on 2026-10-14. Land transfer tax and the sales tax on the mortgage insurance premium are calculated separately (see MORTGAGE_RULES.md). **This is a budgeting guide, not a quote.** Ask your lawyer for an itemised estimate and, nearer closing, the statement of adjustments.

The code is `app/src/closingCosts.ts`. Change this page and its tests in the same commit as any number there.

Scope: a freehold purchase with a mortgage in Ontario.

## What is included

| Item | Low | Typical | High | Basis | Source and notes |
|---|---|---|---|---|---|
| Lawyer fees and disbursements, with 13% HST | $1,695 | $2,260 | $2,825 | Commercial, rough | A lawyerinfo.ca guide says to budget $1,500 to $2,500 for lawyer fees and disbursements together. A flat-fee firm (barbarianlaw.ca) publishes $1,650 + HST all-in for a purchase with one mortgage, and excludes registration fees and title insurance. CMHC says legal fees are "a minimum of $500". These are law firm marketing pages, not a regulated tariff. HST is applied to the whole amount, which slightly overstates it, because some disbursements are not taxed. |
| Land registration (transfer and mortgage charge) | $170 | $170 | $174 | **Official** | [Ontario Land Registry fee Bulletin 2025-07](https://www.ontario.ca/files/s3fs-public/2025-09/bulletin_2025_-07_fees_en_2025.pdf): $85.00 per electronic registration ($71.55 statutory, $11.90 ELRSA, $1.55 HST), effective Nov 3, 2025. A purchase with a mortgage registers two documents. Fees are adjusted each November by half the inflation rate (last year +0.929%), so expect about $1 more per document from Nov 2026, which is the $174 high. |
| Title insurance | $300 | $650 | $1,000 | **My allowance** | No official figure. FSRA says the premium varies with the property value and the insurer. Commercial pages quote anything from a few hundred dollars to about $1,000 at this price, and they disagree with each other, so this range is an allowance spanning them. Ask your lawyer for the real premium. |
| Home inspection | $350 | $500 | $600 | **Official** | Ontario government: inspections cost $350 to $600 and may be more. CMHC: around $500. |
| Appraisal | $0 | $300 | $350 | **Official** | CMHC: a lender may require an appraisal at your expense, $250 to $350. Some lenders pay for it or do not require one, hence the $0 low. |
| **Total** | **$2,515** | **$3,880** | **$4,949** | | |

## What is not included, and why

- **Property tax and utility adjustments.** They depend on your closing date and on what the seller has prepaid. No figure was found. Your lawyer produces a statement of adjustments. This can be a meaningful amount.
- **Survey or certificate of location.** Only if the lender asks. CMHC puts it at $1,000 to $2,000. Title insurance usually replaces it.
- **Home insurance premium.** Needed on closing day, but it is a running cost with no standard figure.
- **Moving costs and immediate repairs.**
- **Mortgage broker or lender fees.** None assumed. Check with your lender.
- Condo items (status certificate, estoppel) do not apply to freehold.

## What I checked and what I could not

Checked against the raw text of the pages (2026-10-14): CMHC "around $500" for a home inspection, "$250 and $350" for an appraisal, "a minimum of $500" for legal fees, "$1,000 to $2,000" for a survey or certificate of location; Ontario "$350 to $600" for inspections; the Ontario registration bulletin ($71.55 + $11.90 + $1.55 = $85.00 electronic, effective November 3, 2025, 0.929% increase); the CRA table showing Ontario HST at 13%; the lawyerinfo.ca "$1,500 and $2,500" statement; the flat-fee firm's $1,650 + HST all-in price and its exclusions.

Could not verify, so not used as a basis: the often-quoted "closing costs are 1.5% to 4% of the price" range (it was not on the CMHC pages I read), FSRA's wording on title insurance (the page would not load in raw form, so I rely on a search summary that it gives no dollar figure), and every title insurance figure, all of which come from commercial sites.

## Sanity check

The sum of the estimates and the taxes is a few per cent of the price. At $1.225M with the first-time-buyer rebates: land transfer taxes about $33,500, other costs about $3,900, together about 3.0% of the price. That is consistent with the commonly quoted range, but note that range itself was not verified here.
