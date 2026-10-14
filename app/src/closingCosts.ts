/**
 * Estimated closing costs other than land transfer tax and mortgage insurance sales tax, for a
 * freehold purchase with a mortgage in Ontario. Each figure has a basis and a source, written up
 * in docs/CLOSING_COSTS.md (sources read 2026-10-14). Change that file and the tests in the same
 * commit as any number here. A rough guide to budget with, not a quote: ask your lawyer for the
 * statement of adjustments and an itemised estimate.
 */

export const CLOSING_COSTS_READ_ON = "2026-10-14";

/** Ontario HST on legal fees (CRA GST/HST rates table). */
export const HST_RATE = 0.13;

/** Where a figure comes from: an official page, a commercial source, or my own allowance. */
export type Basis = "official" | "commercial" | "assumption";

export type CostItem = {
  key: string;
  label: string;
  low: number;
  typical: number;
  high: number;
  basis: Basis;
  source: string;
  note?: string;
};

export type Excluded = { label: string; why: string };

/** Ontario's fee for one electronic land registration (Bulletin 2025-07, effective 2025-11-03). */
export const REGISTRATION_FEE = 85;
/** A purchase with a mortgage registers two documents: the transfer and the mortgage charge. */
export const REGISTRATIONS = 2;

const legal = (amount: number) => Math.round(amount * (1 + HST_RATE));

export const COST_ITEMS: CostItem[] = [
  {
    key: "legal",
    label: "Lawyer fees and disbursements, with HST",
    // $1,500 to $2,500 before HST, applied to the whole amount, which slightly overstates it.
    low: legal(1500),
    typical: legal(2000),
    high: legal(2500),
    basis: "commercial",
    source:
      "lawyerinfo.ca Markham guide: budget $1,500 to $2,500 for fees and disbursements. A flat-fee firm publishes $1,650 + HST all-in. CMHC says legal fees are at least $500. HST 13% from the CRA.",
    note: "Law firm marketing pages, not a regulated tariff. Get quotes.",
  },
  {
    key: "registration",
    label: "Land registration (transfer and mortgage)",
    low: REGISTRATIONS * REGISTRATION_FEE,
    typical: REGISTRATIONS * REGISTRATION_FEE,
    high: REGISTRATIONS * (REGISTRATION_FEE + 2),
    basis: "official",
    source:
      "Ontario Land Registry fee Bulletin 2025-07: $85.00 per electronic registration, effective Nov 3, 2025, adjusted each November for inflation.",
  },
  {
    key: "title",
    label: "Title insurance",
    low: 300,
    typical: 650,
    high: 1000,
    basis: "assumption",
    source:
      "No official figure. FSRA says the premium depends on the property value and the insurer. Published estimates range from a few hundred dollars to about $1,000 at this price, so this range is an allowance spanning them.",
    note: "Ask your lawyer for the actual premium.",
  },
  {
    key: "inspection",
    label: "Home inspection",
    low: 350,
    typical: 500,
    high: 600,
    basis: "official",
    source: "Ontario government: inspections cost $350 to $600 and may be more. CMHC: around $500.",
  },
  {
    key: "appraisal",
    label: "Appraisal (if your lender requires one)",
    low: 0,
    typical: 300,
    high: 350,
    basis: "official",
    source: "CMHC: a lender may require an appraisal at your expense, $250 to $350.",
    note: "Some lenders pay for it or do not ask for one.",
  },
];

export const EXCLUDED: Excluded[] = [
  {
    label: "Property tax and utility adjustments",
    why: "Depends on your closing date and what the seller has prepaid. Your lawyer produces a statement of adjustments. No figure was found.",
  },
  {
    label: "Land survey or certificate of location",
    why: "Only if your lender asks (CMHC: $1,000 to $2,000). Title insurance usually replaces it.",
  },
  { label: "Home insurance premium", why: "Needed on closing day, but it is a running cost with no standard figure." },
  { label: "Moving costs and immediate repairs", why: "Personal, with no standard figure." },
  { label: "Mortgage broker or lender fees", why: "None assumed. Check with your lender." },
];

export type ClosingEstimate = {
  items: CostItem[];
  low: number;
  typical: number;
  high: number;
  excluded: Excluded[];
};

export function estimateClosingCosts(): ClosingEstimate {
  const sum = (f: (i: CostItem) => number) => COST_ITEMS.reduce((a, i) => a + f(i), 0);
  return {
    items: COST_ITEMS,
    low: sum((i) => i.low),
    typical: sum((i) => i.typical),
    high: sum((i) => i.high),
    excluded: EXCLUDED,
  };
}
