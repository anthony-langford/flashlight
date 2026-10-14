import { useId, useMemo, useState } from "react";
import { fmtMoney, fmtValue } from "../format";
import {
  INSURED_PRICE_CAP,
  RULES_VERIFIED_ON,
  calculate,
  minDownPayment,
  paymentGrid,
  scenarioFromBuyer,
  type Compounding,
  type Inputs,
} from "../mortgage";
import type { AppData } from "../types";

const GRID_RATE_STEPS = [-1, 0, 1, 2];

function round25k(v: number): number {
  return Math.round(v / 25_000) * 25_000;
}

function NumberField({
  label,
  value,
  onChange,
  step,
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step: number;
  suffix?: string;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field-input">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
        />
        {suffix && <span className="muted small">{suffix}</span>}
      </div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  );
}

export function AffordabilityPanel({ data, params }: { data: AppData; params?: URLSearchParams }) {
  const { budget } = data.buyer;
  const plan = scenarioFromBuyer(data.buyer);
  const num = (key: string, fallback: number) => {
    const v = Number(params?.get(key));
    return params?.get(key) && Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  const startPrice = num("price", plan.price);
  const [price, setPrice] = useState(startPrice);
  const [down, setDown] = useState(num("down", Math.round(startPrice * plan.downPct)));
  const [ratePct, setRatePct] = useState(num("rate", 5));
  const [amortYears, setAmortYears] = useState(
    params?.get("amort") ? (num("amort", 25) === 30 ? 30 : 25) : plan.amortYears,
  );
  const [firstTimeBuyer, setFirstTimeBuyer] = useState(
    params?.get("ftb") ? params.get("ftb") === "1" : plan.firstTimeBuyer,
  );
  const [compounding, setCompounding] = useState<Compounding>("semiannual");
  const [otherClosing, setOtherClosing] = useState(0);

  const inputs: Inputs = useMemo(() => {
    const clean = (n: number) => (Number.isFinite(n) ? n : 0);
    return {
      price: clean(price),
      down: clean(down),
      ratePct: clean(ratePct),
      amortYears: clean(amortYears),
      firstTimeBuyer,
      compounding,
      otherClosing: clean(otherClosing),
    };
  }, [price, down, ratePct, amortYears, firstTimeBuyer, compounding, otherClosing]);
  const r = useMemo(() => calculate(inputs), [inputs]);

  const gridPrices = useMemo(
    () =>
      Array.from({ length: 4 }, (_, i) => round25k(budget.min + ((budget.max - budget.min) * i) / 3)),
    [budget],
  );
  const gridRates = GRID_RATE_STEPS.map((s) => Math.max(inputs.ratePct + s, 0));
  // Include the exact price entered so the "(yours)" column reconciles with the headline payment.
  const rowPrices = useMemo(
    () =>
      [...new Set([...gridPrices, ...(inputs.price > 0 ? [inputs.price] : [])])].sort((a, b) => a - b),
    [gridPrices, inputs.price],
  );
  const grid = useMemo(
    () => paymentGrid(inputs, rowPrices, GRID_RATE_STEPS.map((s) => Math.max(inputs.ratePct + s, 0))),
    [inputs, rowPrices],
  );

  const latest = (id: string) => data.catalogue.find((s) => s.id === id);
  const refs = [
    latest("boc.gov_5y_yield"),
    latest("boc.mortgage_5y_posted"),
    latest("boc.mortgage_5y_variable_est"),
  ].filter((s): s is NonNullable<typeof s> => !!s);

  const setDownPct = (pct: number) => setDown(Math.round(inputs.price * pct));
  const downPct = inputs.price > 0 ? (inputs.down / inputs.price) * 100 : 0;
  const ok = r.blockers.length === 0;

  return (
    <section className="panel" aria-labelledby="afford-h">
      <h2 id="afford-h">Affordability</h2>
      <p className="muted">
        A payment and closing cost estimate for a purchase in the City of Toronto. Rules were read from
        official pages on {RULES_VERIFIED_ON} (see docs/MORTGAGE_RULES.md). Estimate only, not advice.
      </p>

      <div className="afford">
        <div className="afford-inputs">
          <NumberField label="Purchase price" value={price} onChange={setPrice} step={25_000} suffix="$"
            hint={`Your budget: ${fmtMoney(budget.min)} to ${fmtMoney(budget.max)}`} />
          <NumberField label="Down payment" value={down} onChange={setDown} step={5_000} suffix="$"
            hint={`${downPct.toFixed(1)}% of price. Minimum ${fmtMoney(minDownPayment(inputs.price))}`} />
          <div className="chips" role="group" aria-label="Down payment presets">
            {[
              ["Minimum", minDownPayment(inputs.price) / Math.max(inputs.price, 1)],
              ["10%", 0.1],
              ["15%", 0.15],
              ["20%", 0.2],
              [`${Math.round(plan.downPct * 100)}% (your plan)`, plan.downPct],
            ].map(([label, pct]) => (
              <button key={String(label)} type="button" className="chip" onClick={() => setDownPct(Number(pct))}>
                {label}
              </button>
            ))}
          </div>
          <NumberField label="Contract interest rate" value={ratePct} onChange={setRatePct} step={0.05} suffix="%"
            hint="An assumption, edit it. No official series exists for typical discounted rates." />
          <div className="field">
            <label htmlFor="amort">Amortization</label>
            <select id="amort" value={amortYears} onChange={(e) => setAmortYears(Number(e.target.value))}>
              <option value={25}>25 years</option>
              <option value={30}>30 years</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="comp">Interest compounding</label>
            <select id="comp" value={compounding} onChange={(e) => setCompounding(e.target.value as Compounding)}>
              <option value="semiannual">Semi-annual (typical for fixed)</option>
              <option value="monthly">Monthly (typical for variable)</option>
            </select>
          </div>
          <label className="check">
            <input type="checkbox" checked={firstTimeBuyer} onChange={(e) => setFirstTimeBuyer(e.target.checked)} />
            I am a first-time buyer (unlocks 30-year insured amortization and land transfer tax rebates)
          </label>
          <NumberField label="Other closing costs" value={otherClosing} onChange={setOtherClosing} step={500} suffix="$"
            hint="Legal fees, title insurance, adjustments. Not estimated here." />
          <p className="muted small">
            For reference, Bank of Canada:{" "}
            {refs.map((s, i) => (
              <span key={s.id}>
                {i > 0 ? "; " : ""}
                {s.id === "boc.gov_5y_yield" ? "5-year GoC yield" : s.id === "boc.mortgage_5y_posted" ? "posted 5-year" : "estimated variable"}{" "}
                {fmtValue(s.latest.value, s.unit)}
              </span>
            ))}
            .
          </p>
        </div>

        <div className="afford-results">
          {!ok && (
            <div className="notice blocker" role="alert">
              <strong>This purchase is not possible as entered.</strong>
              <ul>{r.blockers.map((b) => <li key={b}>{b}</li>)}</ul>
            </div>
          )}
          <div className="results-grid">
            <div className="tile">
              <div className="tile-label">Monthly payment</div>
              <div className="tile-value">{ok ? fmtMoney(r.monthly) : "n/a"}</div>
              <div className="tile-asof">
                {ok
                  ? `On a ${fmtMoney(r.loan)} mortgage${r.premium > 0 ? ` (includes ${fmtMoney(r.premium)} insurance premium)` : ""}`
                  : "Fix the issue above to see an estimate"}
              </div>
            </div>
            <div className="tile">
              <div className="tile-label">Payment at the stress-test rate</div>
              <div className="tile-value">{ok ? fmtMoney(r.qualifyingMonthly) : "n/a"}</div>
              <div className="tile-asof">
                {ok ? `At ${r.qualifyingRatePct.toFixed(2)}%, the greater of rate + 2% or 5.25%` : "\u00A0"}
              </div>
            </div>
            <div className="tile">
              <div className="tile-label">Cash needed at closing</div>
              <div className="tile-value">{ok ? fmtMoney(r.cashToClose) : "n/a"}</div>
              <div className="tile-asof">
                {ok ? `Down payment plus taxes${inputs.otherClosing > 0 ? " and other costs" : ""}` : "\u00A0"}
              </div>
            </div>
          </div>

          {ok && (
          <div className="table-scroll">
            <table>
              <caption>Cash needed at closing</caption>
              <tbody>
                <tr><th scope="row">Down payment</th><td className="num">{fmtMoney(inputs.down)}</td></tr>
                <tr><th scope="row">Ontario land transfer tax</th><td className="num">{fmtMoney(r.ontarioTax)}</td></tr>
                {r.ontarioRefund > 0 && (
                  <tr><th scope="row">First-time buyer refund (Ontario)</th><td className="num">&minus;{fmtMoney(r.ontarioRefund)}</td></tr>
                )}
                <tr><th scope="row">Toronto municipal land transfer tax</th><td className="num">{fmtMoney(r.torontoTax)}</td></tr>
                {r.torontoRebate > 0 && (
                  <tr><th scope="row">First-time buyer rebate (Toronto)</th><td className="num">&minus;{fmtMoney(r.torontoRebate)}</td></tr>
                )}
                {r.premiumTax > 0 && (
                  <tr><th scope="row">Sales tax on insurance premium (8%, paid in cash)</th><td className="num">{fmtMoney(r.premiumTax)}</td></tr>
                )}
                {inputs.otherClosing > 0 && (
                  <tr><th scope="row">Other closing costs</th><td className="num">{fmtMoney(inputs.otherClosing)}</td></tr>
                )}
                <tr><th scope="row">Total</th><td className="num"><strong>{fmtMoney(r.cashToClose)}</strong></td></tr>
              </tbody>
            </table>
          </div>
          )}

          {r.warnings.length > 0 && (
            <div className="notice">
              <strong>Check before relying on this</strong>
              <ul>{r.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
            </div>
          )}
        </div>
      </div>

      <h3>Monthly payment across your budget and rates</h3>
      <p className="muted small">
        Each row keeps your down payment share ({downPct.toFixed(0)}%), or the minimum for that price if
        higher. Insurance applies below 20% down. Dashes mean not possible under the rules.
      </p>
      <div className="table-scroll">
        <table>
          <caption>Estimated monthly payment by price and contract rate, {amortYears}-year amortization</caption>
          <thead>
            <tr>
              <th scope="col">Price</th>
              {gridRates.map((g, i) => (
                <th key={i} scope="col" className="num">
                  {g.toFixed(2)}%{GRID_RATE_STEPS[i] === 0 ? " (yours)" : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row) => (
              <tr key={row.price} className={row.price === inputs.price ? "row-yours" : undefined}>
                <th scope="row">
                  {fmtMoney(row.price)}
                  {row.price === inputs.price ? " (yours)" : ""}
                </th>
                {row.payments.map((p, i) => (
                  <td key={i} className="num">{p === null ? "–" : fmtMoney(p)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <details className="table-view">
        <summary>Assumptions and what is not included</summary>
        <ul className="small muted">
          <li>Insured price cap used: {fmtMoney(INSURED_PRICE_CAP)} (Finance Canada, effective Dec 15, 2024). An FCAC page still mentions $1 million, so confirm with a lender.</li>
          <li>Insurance premium uses CMHC's table, added to the mortgage, plus 0.20% when amortization is over 25 years. Other insurers may price differently.</li>
          <li>Compounding is a convention, not a verified rule. Lenders may calculate differently.</li>
          <li>Toronto's first-time buyer rebate of $4,475 was last confirmed on a page dated Dec 2025 and may have changed.</li>
          <li>Not included: legal fees, title insurance, property tax adjustments, inspection, moving, and any affordability test against income.</li>
          <li>Assumes the property is inside the City of Toronto, which is what the Toronto land transfer tax covers.</li>
        </ul>
      </details>
    </section>
  );
}
