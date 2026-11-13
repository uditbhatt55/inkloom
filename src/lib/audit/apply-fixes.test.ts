import { describe, expect, it } from "vitest";
import { applyAcceptedFixes, type FixCandidate } from "./apply-fixes";

const f = (o: Partial<FixCandidate> & { id: string }): FixCandidate => ({
  status: "accepted", suggestion: null, quote: "", start_offset: null, end_offset: null, ...o,
});

/** offsets of the first occurrence of `quote`, so tests never hand-count characters */
const span = (text: string, quote: string) => {
  const start = text.indexOf(quote);
  if (start < 0) throw new Error(`"${quote}" not in test text`);
  return { quote, start_offset: start, end_offset: start + quote.length };
};

describe("applyAcceptedFixes", () => {
  it("with no findings, the text is unchanged", () => {
    expect(applyAcceptedFixes("Hello world", [])).toEqual({ text: "Hello world", applied: [], skipped: [] });
  });

  it("applies one accepted fix at the quoted span", () => {
    const text = "Northbeam Sync delivers 99.99% uptime, guaranteed.";
    const r = applyAcceptedFixes(text, [
      f({ id: "a", ...span(text, "99.99% uptime, guaranteed"), suggestion: "99.9% monthly uptime, backed by our SLA" }),
    ]);
    expect(r.text).toBe("Northbeam Sync delivers 99.9% monthly uptime, backed by our SLA.");
    expect(r.applied).toEqual(["a"]);
    expect(r.skipped).toEqual([]);
  });

  it("applies several non-overlapping fixes in one pass, in any input order", () => {
    const text = "NB Sync is the bomb and it's guaranteed.";
    const r = applyAcceptedFixes(text, [
      f({ id: "late", ...span(text, "guaranteed"), suggestion: "backed by our SLA" }),
      f({ id: "early", ...span(text, "NB Sync"), suggestion: "Northbeam Sync" }),
    ]);
    expect(r.text).toBe("Northbeam Sync is the bomb and it's backed by our SLA.");
    expect(r.applied).toEqual(["early", "late"]);
  });

  it("skips findings that are not accepted", () => {
    const text = "Hello world";
    for (const status of ["open", "rejected", "dismissed", "waived", "resolved"]) {
      const r = applyAcceptedFixes(text, [f({ id: "x", status, quote: "world", start_offset: 6, end_offset: 11, suggestion: "there" })]);
      expect(r.text).toBe(text);
      expect(r.applied).toEqual([]);
    }
  });

  it("skips a finding with no suggestion, or a blank one", () => {
    const text = "Hello world";
    for (const suggestion of [null, "", "   "]) {
      const r = applyAcceptedFixes(text, [f({ id: "x", quote: "world", start_offset: 6, end_offset: 11, suggestion })]);
      expect(r.skipped).toEqual([{ id: "x", reason: "No suggested fix on this finding." }]);
    }
  });

  it("skips a document-level finding (null offsets)", () => {
    const r = applyAcceptedFixes("Hello world", [f({ id: "x", suggestion: "fix it", quote: "Font: ComicSansMS" })]);
    expect(r.skipped).toEqual([{ id: "x", reason: "This finding is about the whole file, not a span of text." }]);
  });

  it("skips invalid or reversed offsets without throwing", () => {
    const text = "Hello world";
    for (const [start, end] of [[-1, 5], [0, 999], [6, 3], [5, 5]] as const) {
      const r = applyAcceptedFixes(text, [f({ id: "x", quote: "x", suggestion: "y", start_offset: start, end_offset: end })]);
      expect(r.text).toBe(text);
      expect(r.skipped[0].reason).toMatch(/position no longer matches/);
    }
  });

  it("skips when the quote no longer matches the text at that span (content changed underneath it)", () => {
    const r = applyAcceptedFixes("Hello world", [f({ id: "x", quote: "WORLD", start_offset: 6, end_offset: 11, suggestion: "there" })]);
    expect(r.skipped).toEqual([{ id: "x", reason: "The quoted text has changed since this fix was accepted." }]);
    expect(r.text).toBe("Hello world");
  });

  it("keeps the earlier (by position) of two overlapping accepted fixes and skips the other, without corrupting text", () => {
    const text = "99.99% uptime, guaranteed.";
    const r = applyAcceptedFixes(text, [
      f({ id: "whole", ...span(text, "99.99% uptime, guaranteed"), suggestion: "99.9% monthly uptime" }),
      f({ id: "word", ...span(text, "guaranteed"), suggestion: "backed by our SLA" }),
    ]);
    expect(r.applied).toEqual(["whole"]);
    expect(r.skipped).toEqual([{ id: "word", reason: "Overlaps another accepted fix; apply it after a re-audit." }]);
    expect(r.text).toBe("99.9% monthly uptime.");
  });

  it("adjacent (touching, non-overlapping) fixes both apply", () => {
    const r = applyAcceptedFixes("abcdef", [
      f({ id: "a", quote: "abc", start_offset: 0, end_offset: 3, suggestion: "X" }),
      f({ id: "b", quote: "def", start_offset: 3, end_offset: 6, suggestion: "Y" }),
    ]);
    expect(r.text).toBe("XY");
    expect(r.applied).toEqual(["a", "b"]);
  });

  it("trims the suggestion before inserting it", () => {
    const r = applyAcceptedFixes("Hello world", [f({ id: "x", quote: "world", start_offset: 6, end_offset: 11, suggestion: "  there  " })]);
    expect(r.text).toBe("Hello there");
  });
});
