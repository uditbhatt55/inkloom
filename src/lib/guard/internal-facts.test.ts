import { describe, expect, it } from "vitest";
import { findInternalFactLeaks, maskSpans } from "./internal-facts";

const FACTS = [
  { code: "FACT-90", statement: "Internal target: 12000 customers by Q3" },
  { code: "FACT-91", statement: "Northbeam Mobile launches in March 2027" },
];
const PUBLIC = "Northbeam Sync SLA: 99.9% monthly uptime. Northbeam Vault starts at INR 499 per month. Used by teams in 14 countries.";

describe("findInternalFactLeaks", () => {
  it("catches a fact restated with its figures and words, quoting the span in the original text", () => {
    const text = "We are also working toward an internal target: 12000 customers by Q3.\n\nThanks for reading.";
    const [f] = findInternalFactLeaks(text, FACTS, PUBLIC);
    expect(f).toMatchObject({ category: "confidentiality", severity: "critical", confidence: "high", ruleCode: "FACT-90", source: "rule" });
    expect(text.slice(f.start, f.end)).toBe(f.quote);
    expect(f.quote).toContain("12000 customers");
  });

  it("catches an unannounced product name, and one finding covers the whole sentence when the date is there too", () => {
    const text = "One roadmap item: Northbeam Mobile launches in March 2027. Details soon.";
    const found = findInternalFactLeaks(text, FACTS, PUBLIC);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ ruleCode: "FACT-91", quote: "Northbeam Mobile launches in March 2027" });
    const nameOnly = findInternalFactLeaks("Northbeam Mobile is available today.", FACTS, PUBLIC);
    expect(nameOnly.map((f) => f.quote)).toEqual(["Northbeam Mobile"]);
  });

  it("is quiet about public figures, other numbers, and a name that public knowledge already uses", () => {
    expect(findInternalFactLeaks("Northbeam Sync runs at 99.9% monthly uptime. We have 12 customers and 3 offices; Q3 was busy.", FACTS, PUBLIC)).toEqual([]);
    expect(findInternalFactLeaks("12000 people read our blog in March 2027.", FACTS, PUBLIC)).toEqual([]);
    expect(findInternalFactLeaks("Northbeam Mobile is here.", FACTS, `${PUBLIC} Northbeam Mobile is on sale.`)).toEqual([]);
  });

  it("does not match a figure inside a longer number", () => {
    expect(findInternalFactLeaks("About 120000 customers by Q3", FACTS, PUBLIC)).toEqual([]);
  });
});

describe("maskSpans", () => {
  it("replaces spans with stars of the same length", () => {
    expect(maskSpans("abc secret def", [{ start: 4, end: 10 }])).toBe("abc ****** def");
    expect(maskSpans("abc", [{ start: -1, end: -1 }])).toBe("abc");
  });
});
