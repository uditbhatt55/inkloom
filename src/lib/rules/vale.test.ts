import { describe, expect, it } from "vitest";
import { importVale } from "./vale";

describe("importVale", () => {
  it("keeps codes distinct across files when callers supply file prefixes", () => {
    const yaml = "extends: existence\ntokens: [first, last]";
    const first = importVale(yaml, { prefix: "VALE-Style.First" });
    const second = importVale(yaml, { prefix: "VALE-Style.Second" });
    const codes = [...first.terms, ...second.terms].map(({ code }) => code);
    expect(codes).toEqual(["VALE-Style.First-001", "VALE-Style.First-002", "VALE-Style.Second-001", "VALE-Style.Second-002"]);
    expect(new Set(codes).size).toBe(codes.length);
    expect(importVale(yaml, {}).terms[0].code).toBe("VALE-001");
  });

  it("skips an entire substitution with a regex key", () => {
    const result = importVale("name: Style.Terms\nextends: substitution\nswap:\n  '(?i)utilise': use\n  utilise: use");
    expect(result.terms.map(({ term }) => term)).toEqual(["utilise", "use"]);
    expect(result.warnings).toEqual(['Vale rule "Style.Terms": skipped regex pattern "(?i)utilise". Regex is not supported yet.']);
  });

  it.each([String.raw`\bword\b`, "[word]", "(word)", "a|b", "word*", "word+", "word?", "^word", "word$", "word{2}", String.raw`word\\end`, "word.end"])("skips regex existence pattern %s", (pattern) => {
    const result = importVale(`name: Style.Words\nextends: existence\ntokens:\n  - '${pattern}'\n  - plain word`);
    expect(result.terms).toEqual([{ code: "VALE-001", term: "plain word", kind: "banned", replacement: null }]);
    expect(result.warnings).toEqual([`Vale rule "Style.Words": skipped regex pattern "${pattern}". Regex is not supported yet.`]);
  });

  it("preserves plain words with spaces, hyphens and apostrophes", () => {
    expect(importVale(`extends: existence\ntokens:\n  - plain word\n  - well-known\n  - don't`).terms.map(({ term }) => term)).toEqual(["plain word", "well-known", "don't"]);
  });

  it("emits a shared preferred term once while retaining both banned terms", () => {
    expect(importVale("extends: substitution\nswap:\n  utilise: use\n  employ: use")).toEqual({
      terms: [
        { code: "VALE-001", term: "utilise", kind: "banned", replacement: "use" },
        { code: "VALE-002", term: "use", kind: "preferred", replacement: null },
        { code: "VALE-003", term: "employ", kind: "banned", replacement: "use" },
      ], warnings: [],
    });
  });

  it("imports substitutions in source order with unique codes", () => {
    expect(importVale(`
extends: substitution
swap:
  utilise: use
  NB Sync: Northbeam Sync
`)).toEqual({
      terms: [
        { code: "VALE-001", term: "utilise", kind: "banned", replacement: "use" },
        { code: "VALE-002", term: "use", kind: "preferred", replacement: null },
        { code: "VALE-003", term: "NB Sync", kind: "banned", replacement: "Northbeam Sync" },
        { code: "VALE-004", term: "Northbeam Sync", kind: "preferred", replacement: null },
      ], warnings: [],
    });
  });

  it("imports existence tokens as banned terms without replacements", () => {
    expect(importVale(`extends: existence\ntokens: [obviously, simply]`)).toEqual({
      terms: [
        { code: "VALE-001", term: "obviously", kind: "banned", replacement: null },
        { code: "VALE-002", term: "simply", kind: "banned", replacement: null },
      ], warnings: [],
    });
  });

  it.each(["spelling", "occurrence", "conditional"])("skips unsupported %s rules and names them", (type) => {
    const result = importVale(`name: Style.Check\nextends: ${type}\ntokens: [word]`);
    expect(result.terms).toEqual([]);
    expect(result.warnings[0]).toContain("Style.Check");
    expect(result.warnings[0]).toContain(type);
  });

  it("uses the rule type as its name when no name is supplied", () => {
    expect(importVale("extends: spelling").warnings[0]).toContain("spelling");
  });

  it("returns a warning for malformed YAML without throwing", () => {
    const result = importVale("extends: existence\ntokens: [unfinished");
    expect(result.terms).toEqual([]);
    expect(result.warnings[0]).toContain("Malformed");
  });

  it.each(["", "# comment only", "[]", "extends: existence\ntokens: []", "extends: substitution\nswap: {}", "extends: existence\ntokens: [null, 3, '  ']", "extends: substitution\nswap: {word: null}"])("warns when no usable tokens exist: %j", (yaml) => {
    const result = importVale(yaml);
    expect(result.terms).toEqual([]);
    expect(result.warnings.join(" ")).toContain("no usable tokens");
  });

  it("skips invalid tokens without leaving gaps in codes", () => {
    const result = importVale("extends: existence\ntokens: [first, null, last]");
    expect(result.terms.map(({ code }) => code)).toEqual(["VALE-001", "VALE-002"]);
    expect(result.warnings).toHaveLength(1);
  });
});
