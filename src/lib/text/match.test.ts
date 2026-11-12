import { describe, expect, it } from "vitest";
import { findFigure, findTerm, maskTerms } from "./match";

describe("findTerm edge cases", () => {
  it("handles regex special characters in terms", () => {
    expect(findTerm("We love C++ and AT&T (really).", "C++")).toHaveLength(1);
    expect(findTerm("AT&T rocks", "AT&T")).toHaveLength(1);
    expect(findTerm("price $5.00 only", "$5.00")).toHaveLength(1);
  });
  it("a term of only separators or blanks matches nothing", () => {
    expect(findTerm("a - b", "--")).toEqual([]);
    expect(findTerm("a b", "   ")).toEqual([]);
  });
  it("does not hang on long repeated separators", () => {
    const text = "project" + " ".repeat(50_000) + "atlas";
    const t0 = Date.now();
    expect(findTerm(text, "Project Atlas")).toHaveLength(1);
    expect(Date.now() - t0).toBeLessThan(500);
  });
  it("matches non-English words by whole word", () => {
    expect(findTerm("Der Müller sagt", "Müller")).toHaveLength(1);
    expect(findTerm("Müllers Haus", "Müller")).toEqual([]);
  });
});

describe("findFigure edge cases", () => {
  it("does not match inside a longer or decimal number", () => {
    expect(findFigure("99.99% uptime", "99.9%")).toEqual([]);
    expect(findFigure("199.9% growth", "99.9%")).toEqual([]);
    expect(findFigure("version 10.2", "10")).toEqual([]);
    expect(findFigure("section 1.99.9% x", "99.9%")).toEqual([]);
  });
  it("matches at a sentence end and in brackets", () => {
    expect(findFigure("We promise 99.9%.", "99.9%")).toHaveLength(1);
    expect(findFigure("uptime (99.9%)", "99.9%")).toHaveLength(1);
    expect(findFigure("Plans: 10, 20", "10")).toHaveLength(1);
  });
});

describe("maskTerms", () => {
  it("keeps length, masks every occurrence and variant", () => {
    const text = "Project Atlas and PROJECT-ATLAS";
    const out = maskTerms(text, ["Project Atlas"]);
    expect(out).toBe("*".repeat(13) + " and " + "*".repeat(13));
    expect(out).toHaveLength(text.length);
  });
});
