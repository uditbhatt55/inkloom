import { describe, expect, it } from "vitest";
import {
  bannedTermWarning,
  CATEGORY_PREFIX,
  isFactExpired,
  isValidHex,
  nextCode,
  todayISO,
  planTermImport,
  valePrefix,
  validateDateRange,
} from "./helpers";

describe("nextCode", () => {
  it("returns 01 when no codes exist", () => {
    expect(nextCode("CLAIM", [])).toBe("CLAIM-01");
  });

  it("returns the next sequential code", () => {
    expect(nextCode("CLAIM", ["CLAIM-01", "CLAIM-02", "CLAIM-03"])).toBe("CLAIM-04");
  });

  it("pads to two digits", () => {
    expect(nextCode("FACT", ["FACT-09"])).toBe("FACT-10");
  });

  it("ignores codes from other prefixes", () => {
    expect(nextCode("TONE", ["CLAIM-01", "TONE-02"])).toBe("TONE-03");
  });

  it("handles gaps in numbering gracefully (picks highest+1)", () => {
    expect(nextCode("MSG", ["MSG-01", "MSG-05"])).toBe("MSG-06");
  });

  it("works for TERM prefix", () => {
    expect(nextCode("TERM", ["TERM-01", "TERM-02", "TERM-31", "TERM-32"])).toBe("TERM-33");
  });
});

describe("CATEGORY_PREFIX", () => {
  it("maps all finding_category enum values", () => {
    const expected = ["CLAIM", "TONE", "MSG", "ACC", "VIS", "TERM", "FACT", "CONF"];
    expect(Object.values(CATEGORY_PREFIX)).toEqual(expect.arrayContaining(expected));
  });
});

describe("validateDateRange", () => {
  it("passes when both are null", () => {
    expect(validateDateRange(null, null)).toEqual({ valid: true });
  });

  it("passes when validFrom is set but validUntil is not", () => {
    expect(validateDateRange("2026-01-01", null)).toEqual({ valid: true });
  });

  it("passes when validUntil is after validFrom", () => {
    expect(validateDateRange("2026-01-01", "2026-12-31")).toEqual({ valid: true });
  });

  it("passes when both are the same date", () => {
    expect(validateDateRange("2026-06-01", "2026-06-01")).toEqual({ valid: true });
  });

  it("fails when validUntil is before validFrom", () => {
    const result = validateDateRange("2026-12-31", "2026-01-01");
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/must not be before/);
  });
});

describe("isValidHex", () => {
  it("accepts valid #RRGGBB", () => {
    expect(isValidHex("#FF0000")).toBe(true);
    expect(isValidHex("#000000")).toBe(true);
    expect(isValidHex("#1a2b3c")).toBe(true);
  });

  it("rejects short hex", () => {
    expect(isValidHex("#FFF")).toBe(false);
  });

  it("rejects without hash", () => {
    expect(isValidHex("FF0000")).toBe(false);
  });

  it("rejects invalid characters", () => {
    expect(isValidHex("#GG0000")).toBe(false);
  });
});

describe("bannedTermWarning", () => {
  it("warns when banned term has no replacement", () => {
    const w = bannedTermWarning("banned", null);
    expect(w).not.toBeNull();
    expect(w).toMatch(/replacement/);
  });

  it("warns when banned term has empty replacement", () => {
    expect(bannedTermWarning("banned", "  ")).not.toBeNull();
  });

  it("does not warn when banned term has a replacement", () => {
    expect(bannedTermWarning("banned", "Northbeam Sync")).toBeNull();
  });

  it("does not warn for preferred or internal terms", () => {
    expect(bannedTermWarning("preferred", null)).toBeNull();
    expect(bannedTermWarning("internal", null)).toBeNull();
  });
});

describe("isFactExpired", () => {
  it("returns false when validUntil is null", () => {
    expect(isFactExpired(null, "2026-11-13")).toBe(false);
  });

  it("returns true when validUntil is in the past", () => {
    expect(isFactExpired("2026-06-30", "2026-11-13")).toBe(true);
  });

  it("returns false when validUntil is today (not yet expired)", () => {
    expect(isFactExpired("2026-11-13", "2026-11-13")).toBe(false);
  });

  it("returns false when validUntil is in the future", () => {
    expect(isFactExpired("2027-01-01", "2026-11-13")).toBe(false);
  });
});

describe("todayISO", () => {
  it("returns a date string in YYYY-MM-DD format", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("accepts an injected date for testing", () => {
    expect(todayISO(new Date("2026-07-04T12:00:00Z"))).toBe("2026-07-04");
  });

  it("uses India time: 20:00 UTC is already the next day in India", () => {
    expect(todayISO(new Date("2027-03-31T20:00:00Z"))).toBe("2027-04-01");
  });
});


describe("valePrefix", () => {
  it("builds a code prefix from the file name", () => {
    expect(valePrefix("Brand.Terms.yml")).toBe("VALE-BRAND-TERMS");
    expect(valePrefix("north beam_terms.yaml")).toBe("VALE-NORTH-BEAM-TERMS");
    expect(valePrefix(".yml")).toBe("VALE");
  });
});

describe("planTermImport", () => {
  const existing = [{ code: "TERM-02", term: "NB Sync" }, { code: "VALE-X-001", term: "old" }];
  it("skips terms already present (any case/spacing) and used codes; adds the rest once", () => {
    const r = planTermImport([
      { code: "VALE-X-002", term: "nb  sync", kind: "banned", replacement: "Northbeam Sync" },
      { code: "VALE-X-001", term: "brand new", kind: "banned", replacement: null },
      { code: "VALE-X-003", term: "cloud drive", kind: "banned", replacement: "Northbeam Vault" },
      { code: "VALE-X-004", term: "Cloud-Drive", kind: "banned", replacement: null },
    ], existing);
    expect(r.toAdd.map((t) => t.term)).toEqual(["cloud drive"]);
    expect(r.skipped.map((s) => s.reason)).toEqual(["already in the knowledge base", "code VALE-X-001 already used", "already in the knowledge base"]);
  });
});
