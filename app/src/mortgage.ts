/**
 * Mortgage and closing cost rules. Every number here comes from an official page read on
 * 2026-10-14 and is documented with its source in docs/MORTGAGE_RULES.md. Change that file and
 * the tests in the same commit as any number below. Not financial advice.
 */

export const RULES_VERIFIED_ON = "2026-10-14";

export type Bracket = { upTo: number; rate: number };

/** Ontario land transfer tax, marginal. 2.5% above $2M applies to one or two single family residences. */
export const ONTARIO_LTT: Bracket[] = [
  { upTo: 55_000, rate: 0.005 },
  { upTo: 250_000, rate: 0.01 },
  { upTo: 400_000, rate: 0.015 },
  { upTo: 2_000_000, rate: 0.02 },
  { upTo: Infinity, rate: 0.025 },
];

/** Toronto municipal land transfer tax, marginal, effective April 1, 2026. Tiers above $3M are unchecked. */
export const TORONTO_MLTT: Bracket[] = [
  { upTo: 55_000, rate: 0.005 },
  { upTo: 250_000, rate: 0.01 },
  { upTo: 400_000, rate: 0.015 },
  { upTo: 2_000_000, rate: 0.02 },
  { upTo: 3_000_000, rate: 0.025 },
  { upTo: 4_000_000, rate: 0.044 },
  { upTo: 5_000_000, rate: 0.0545 },
  { upTo: 10_000_000, rate: 0.065 },
  { upTo: 20_000_000, rate: 0.0755 },
  { upTo: Infinity, rate: 0.086 },
];

export const ONTARIO_FTB_REFUND_MAX = 4_000;
/** Page last modified 2025-12-18. May have changed since, see docs/MORTGAGE_RULES.md. */
export const TORONTO_FTB_REBATE_MAX = 4_475;

export const INSURED_PRICE_CAP = 1_500_000;
/** Premium paid in cash at closing: Ontario retail sales tax on the premium. */
export const PREMIUM_SALES_TAX = 0.08;
export const QUALIFYING_BUFFER = 0.02;
export const QUALIFYING_FLOOR = 0.0525;
export const LONG_AMORTIZATION_SURCHARGE = 0.002;

/** Marginal tax: each rate applies only to the slice of the price inside its bracket. */
export function transferTax(price: number, brackets: Bracket[]): number {
  let tax = 0;
  let lower = 0;
  for (const { upTo, rate } of brackets) {
    if (price > lower) tax += (Math.min(price, upTo) - lower) * rate;
    lower = upTo;
  }
  return tax;
}

/** Minimum down payment: 5% of the first $500,000, 10% above it, 20% at the price cap or more. */
export function minDownPayment(price: number): number {
  if (price >= INSURED_PRICE_CAP) return price * 0.2;
  if (price <= 500_000) return price * 0.05;
  return 25_000 + 0.1 * (price - 500_000);
}

/** CMHC premium on the loan by loan-to-value (standard purchase). Null when above 95%. */
export function premiumRate(ltv: number): number | null {
  if (ltv <= 0.65) return 0.006;
  if (ltv <= 0.75) return 0.017;
  if (ltv <= 0.8) return 0.024;
  if (ltv <= 0.85) return 0.028;
  if (ltv <= 0.9) return 0.031;
  if (ltv <= 0.95) return 0.04;
  return null;
}

export type Compounding = "semiannual" | "monthly";

/** Level monthly payment. `ratePct` is the annual rate in percent, e.g. 5 for 5%. */
export function monthlyPayment(
  loan: number,
  ratePct: number,
  years: number,
  compounding: Compounding = "semiannual",
): number {
  const n = years * 12;
  const r = ratePct / 100;
  if (loan <= 0 || n <= 0) return 0;
  const i = compounding === "semiannual" ? Math.pow(1 + r / 2, 1 / 6) - 1 : r / 12;
  if (i === 0) return loan / n;
  return (loan * i) / (1 - Math.pow(1 + i, -n));
}

/** Stress-test rate in percent: the greater of contract + 2%, or 5.25%. */
export function qualifyingRate(contractPct: number): number {
  return Math.max(contractPct + QUALIFYING_BUFFER * 100, QUALIFYING_FLOOR * 100);
}

export type Inputs = {
  price: number;
  down: number;
  ratePct: number;
  amortYears: number;
  firstTimeBuyer: boolean;
  compounding: Compounding;
  otherClosing: number;
};

export type Result = {
  minDown: number;
  insured: boolean;
  ltv: number;
  baseLoan: number;
  premiumRate: number | null;
  premium: number;
  loan: number;
  monthly: number;
  qualifyingRatePct: number;
  qualifyingMonthly: number;
  ontarioTax: number;
  ontarioRefund: number;
  torontoTax: number;
  torontoRebate: number;
  premiumTax: number;
  closingTaxes: number;
  cashToClose: number;
  /** Reasons this purchase is not possible as entered. */
  blockers: string[];
  /** Things to confirm. */
  warnings: string[];
};

export function calculate(i: Inputs): Result {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const minDown = minDownPayment(i.price);
  const baseLoan = Math.max(i.price - i.down, 0);
  const ltv = i.price > 0 ? baseLoan / i.price : 0;
  const insured = i.down < i.price * 0.2;

  if (i.down < minDown - 0.5) {
    blockers.push(`Down payment is below the minimum of $${Math.round(minDown).toLocaleString("en-CA")}.`);
  }
  if (insured && i.price >= INSURED_PRICE_CAP) {
    blockers.push("At $1.5 million or more, 20% down is required (no insured mortgage).");
  }

  let rate: number | null = null;
  if (insured) {
    if (ltv > 0.95) {
      blockers.push("Insured mortgages are limited to 95% of the price.");
    } else {
      rate = premiumRate(ltv);
      if (rate !== null && i.amortYears > 25) rate += LONG_AMORTIZATION_SURCHARGE;
    }
    if (i.amortYears > 25 && !i.firstTimeBuyer) {
      blockers.push(
        "30-year insured amortization is available to first-time buyers and buyers of new builds only.",
      );
    }
    warnings.push(
      "Official pages disagree on whether the insured price cap is $1.5 million or the old $1 million. " +
        "Confirm with a lender before planning on less than 20% down.",
    );
  } else if (i.amortYears > 25) {
    warnings.push("Maximum uninsured amortization is set by the lender and was not verified.");
  }

  const premium = rate !== null ? baseLoan * rate : 0;
  const loan = baseLoan + premium;
  const monthly = monthlyPayment(loan, i.ratePct, i.amortYears, i.compounding);
  const qRate = qualifyingRate(i.ratePct);
  const qualifyingMonthly = monthlyPayment(loan, qRate, i.amortYears, i.compounding);

  const ontarioTax = transferTax(i.price, ONTARIO_LTT);
  const torontoTax = transferTax(i.price, TORONTO_MLTT);
  const ontarioRefund = i.firstTimeBuyer ? Math.min(ontarioTax, ONTARIO_FTB_REFUND_MAX) : 0;
  const torontoRebate = i.firstTimeBuyer ? Math.min(torontoTax, TORONTO_FTB_REBATE_MAX) : 0;
  const premiumTax = premium * PREMIUM_SALES_TAX;
  if (i.firstTimeBuyer) {
    warnings.push(
      "First-time buyer rebates also require being a Canadian citizen or permanent resident, never " +
        "having owned a home anywhere in the world (nor your spouse), and living there within nine months.",
    );
  }
  const closingTaxes = ontarioTax - ontarioRefund + (torontoTax - torontoRebate) + premiumTax;
  const cashToClose = i.down + closingTaxes + i.otherClosing;

  return {
    minDown,
    insured,
    ltv,
    baseLoan,
    premiumRate: rate,
    premium,
    loan,
    monthly,
    qualifyingRatePct: qRate,
    qualifyingMonthly,
    ontarioTax,
    ontarioRefund,
    torontoTax,
    torontoRebate,
    premiumTax,
    closingTaxes,
    cashToClose,
    blockers,
    warnings,
  };
}

/**
 * Monthly payment for a grid of prices and rates. Each price uses the same down payment share as
 * `base` (or the minimum for that price if the share is below it).
 */
export function paymentGrid(
  base: Inputs,
  prices: number[],
  ratesPct: number[],
): { price: number; payments: (number | null)[] }[] {
  const share = base.price > 0 ? base.down / base.price : 0.2;
  return prices.map((price) => {
    const down = Math.max(price * share, minDownPayment(price));
    return {
      price,
      payments: ratesPct.map((ratePct) => {
        const r = calculate({ ...base, price, down, ratePct });
        return r.blockers.length > 0 ? null : r.monthly;
      }),
    };
  });
}

/** Starting point for the calculator from the buyer profile (price at the middle of the budget). */
export function scenarioFromBuyer(buyer: {
  budget: { min: number; max: number };
  down_payment_pct?: number;
  first_time_buyer?: boolean;
  amortization_years?: number;
}): { price: number; down: number; amortYears: number; firstTimeBuyer: boolean; downPct: number } {
  const price = Math.round((buyer.budget.min + buyer.budget.max) / 2 / 25_000) * 25_000;
  const downPct = buyer.down_payment_pct ?? 0.2;
  return {
    price,
    down: Math.round(price * downPct),
    amortYears: buyer.amortization_years === 30 ? 30 : 25,
    firstTimeBuyer: buyer.first_time_buyer === true,
    downPct,
  };
}
