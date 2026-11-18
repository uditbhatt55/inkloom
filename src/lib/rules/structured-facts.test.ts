import { describe, expect, it } from "vitest";
import { checkStructuredFacts, type StructuredFact } from "./structured-facts";

const base = { validUntil: null, metric: null, value: null, unit: null, period: null, currency: null, region: null, product: null, condition: null };
const SLA: StructuredFact = { ...base, code: "FACT-07", statement: "Northbeam Sync SLA: 99.9% monthly uptime", metric: "uptime", value: 99.9, unit: "%", period: "month", product: "Northbeam Sync" };
const OLD_PRICE: StructuredFact = { ...base, code: "FACT-05", statement: "Northbeam Vault starts at INR 499 per month", validUntil: "2026-06-30", metric: "price", value: 499, currency: "INR", period: "month", product: "Northbeam Vault", region: "India" };
const PRICE: StructuredFact = { ...OLD_PRICE, code: "FACT-06", statement: "Northbeam Vault starts at INR 599 per month", validUntil: null, value: 599 };
const COUNTRIES: StructuredFact = { ...base, code: "FACT-03", statement: "Northbeam Sync is used by teams in 14 countries", value: 14, unit: "countries", product: "Northbeam Sync" };
const FACTS = [SLA, OLD_PRICE, PRICE, COUNTRIES];
const TODAY = "2026-11-17";
const check = (text: string) => checkStructuredFacts(text, FACTS, TODAY).map((f) => [f.ruleCode, text.slice(f.start, f.end), f.confidence, f.suggestion]);

describe("checkStructuredFacts", () => {
  it("accepts figures that match the approved fields", () => {
    expect(check("Northbeam Sync has 99.9% monthly uptime. Northbeam Vault starts at ₹599 per month. Northbeam Sync is used in 14 countries.")).toEqual([]);
  });

  it("flags a different value, and suggests the approved one", () => {
    expect(check("Northbeam Sync delivers 99.99% uptime.")).toEqual([["FACT-07", "99.99%", "high", "99.9%"]]);
    expect(check("Northbeam Sync is used in 15 countries.")).toEqual([["FACT-03", "15", "high", "14"]]);
  });

  it("an expired fact's old value is a mismatch against the current fact", () => {
    expect(check("Northbeam Vault starts at INR 499 per month.")).toEqual([["FACT-06", "INR 499", "high", null]]);
  });

  it("separates the same number in another currency, period or region", () => {
    expect(check("Northbeam Vault starts at $599 per month.")).toEqual([["FACT-06", "$599", "high", "INR 599"]]);
    expect(check("Northbeam Sync promises 99.9% annual uptime.")).toEqual([["FACT-07", "99.9%", "medium", null]]);
    expect(check("In Europe, Northbeam Vault starts at INR 599 per month.")).toEqual([["FACT-06", "INR 599", "medium", null]]);
  });

  it("leaves unrelated figures alone: other products, discounts, dates, and 'contact us'", () => {
    expect(check("Get 20% off Northbeam Sync this week. Contact us on 12 Dec. Acme Drive has 95% uptime.")).toEqual([]);
  });
});
