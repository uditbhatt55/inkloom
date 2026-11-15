import { describe, expect, it } from "vitest";
import { findInternalFactLeaks, maskSpans, numbersIn, wordKey } from "./internal-facts";

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

describe("reworded leaks", () => {
  it("reads numbers written in other ways", () => {
    expect(numbersIn("12,000 clients, 12k users, 12 thousand fans, 1.2 lakh, 99.9% uptime, in 2027").map((n) => [n.value, n.percent]))
      .toEqual([[12000, false], [12000, false], [12000, false], [120000, false], [99.9, true], [2027, false]]);
    expect(numbersIn("room 4b and v12.5.3")).toEqual([]);
  });

  it("matches word families and a few synonyms", () => {
    expect(wordKey("customers")).toBe(wordKey("client"));
    expect(wordKey("launches")).toBe(wordKey("released"));
    expect(wordKey("target")).toBe(wordKey("goal"));
    expect(wordKey("mobile")).not.toBe(wordKey("desktop"));
  });

  it("flags the same figure with related words as a medium-confidence hint to check", () => {
    const text = "Our goal for the third quarter: reach 12,000 clients. More soon.";
    const [f] = findInternalFactLeaks(text, FACTS, PUBLIC);
    expect(f).toMatchObject({ ruleCode: "FACT-90", confidence: "medium", label: "needs_human_check", severity: "critical" });
    expect(text.slice(f.start, f.end)).toBe(f.quote);
    expect(f.quote).toContain("12,000");
    expect(findInternalFactLeaks("We hope to hit 12k accounts, our internal aim.", FACTS, PUBLIC)).toHaveLength(1);
  });

  it("is quiet when the number alone matches, or the words match without the number", () => {
    expect(findInternalFactLeaks("12,000 people visited the fair.", FACTS, PUBLIC)).toEqual([]);
    expect(findInternalFactLeaks("Our goal is happy customers.", FACTS, PUBLIC)).toEqual([]);
  });

  it("does not double-report what the exact check already found", () => {
    expect(findInternalFactLeaks("An internal target: 12000 customers by Q3.", FACTS, PUBLIC)).toHaveLength(1);
  });
});

describe("maskSpans", () => {
  it("replaces spans with stars of the same length", () => {
    expect(maskSpans("abc secret def", [{ start: 4, end: 10 }])).toBe("abc ****** def");
    expect(maskSpans("abc", [{ start: -1, end: -1 }])).toBe("abc");
  });
});
