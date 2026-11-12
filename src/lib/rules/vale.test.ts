import { describe, expect, it } from "vitest";
import { importVale } from "./vale";

describe("importVale", () => {
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
