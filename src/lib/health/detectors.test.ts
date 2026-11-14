import { describe, expect, it } from "vitest";
import { addDays, conflictingTerms, factImpact, recurringMistakes, unclearRules, type HealthFinding } from "./detectors";

const TODAY = "2026-11-14";
const f = (o: Partial<HealthFinding>): HealthFinding => ({
  ruleCode: "TERM-02", status: "open", quote: "NB Sync", channel: "linkedin", creatorRole: "creator", at: "2026-11-10T10:00:00Z", ...o,
});

describe("addDays", () => {
  it("crosses month ends", () => {
    expect(addDays("2026-11-14", -30)).toBe("2026-10-15");
    expect(addDays("2026-12-20", 15)).toBe("2027-01-04");
  });
});

describe("recurringMistakes", () => {
  it("counts per rule in the window, most frequent first, with channel and role breakdown", () => {
    const r = recurringMistakes([
      f({}), f({ channel: "email" }), f({ creatorRole: "agency" }),
      f({ ruleCode: "CLAIM-02", quote: "guaranteed" }),
    ], TODAY);
    expect(r.map((x) => [x.ruleCode, x.count])).toEqual([["TERM-02", 3], ["CLAIM-02", 1]]);
    expect(r[0].byChannel).toEqual([["linkedin", 2], ["email", 1]]);
    expect(r[0].byRole).toEqual([["creator", 2], ["agency", 1]]);
  });

  it("leaves out old, dismissed, waived and rule-less findings but keeps a creator rejection (D1)", () => {
    const r = recurringMistakes([
      f({ at: "2026-10-01T00:00:00Z" }), f({ status: "dismissed" }), f({ status: "waived" }), f({ ruleCode: null }),
      f({ status: "rejected" }),
    ], TODAY);
    expect(r).toEqual([expect.objectContaining({ ruleCode: "TERM-02", count: 1 })]);
  });
});

describe("unclearRules", () => {
  const decided = (n: number, overruled: number) => [
    ...Array.from({ length: overruled }, (_, i) => f({ ruleCode: "CLAIM-02", status: i % 2 ? "waived" : "dismissed", quote: `q${i % 2}` })),
    ...Array.from({ length: n - overruled }, () => f({ ruleCode: "CLAIM-02", status: "accepted" })),
  ];

  it("flags a rule overruled at or above the threshold, with example quotes", () => {
    const [u] = unclearRules(decided(5, 2), { threshold: 0.4 });
    expect(u).toMatchObject({ ruleCode: "CLAIM-02", decided: 5, overruled: 2, rate: 0.4, examples: ["q0", "q1"] });
  });

  it("ignores rules below the threshold, with too few decisions, or still open", () => {
    expect(unclearRules(decided(5, 1))).toEqual([]);
    expect(unclearRules(decided(4, 4))).toEqual([]);
    expect(unclearRules([...decided(5, 3).map((x) => ({ ...x, status: "open" }))])).toEqual([]);
  });
});

describe("conflictingTerms", () => {
  it("finds preferred+banned (spacing and case insensitive), internal+preferred, and banned replacements that are banned", () => {
    const c = conflictingTerms([
      { code: "TERM-01", term: "Northbeam Sync", kind: "preferred", replacement: null },
      { code: "TERM-09", term: "northbeam-sync", kind: "banned", replacement: "Sync" },
      { code: "TERM-31", term: "Project Atlas", kind: "internal", replacement: null },
      { code: "TERM-40", term: "project atlas", kind: "preferred", replacement: null },
      { code: "TERM-02", term: "NB Sync", kind: "banned", replacement: "cloud drive" },
      { code: "TERM-04", term: "cloud drive", kind: "banned", replacement: "Northbeam Vault" },
    ]);
    expect(c).toEqual([
      { term: "northbeam sync", codes: ["TERM-01", "TERM-09"], reason: "listed as both preferred and banned" },
      { term: "project atlas", codes: ["TERM-31", "TERM-40"], reason: "an internal codename is also listed as preferred" },
      { term: "nb sync", codes: ["TERM-02", "TERM-04"], reason: 'its replacement "cloud drive" is itself banned' },
    ]);
  });

  it("is quiet for a clean term list", () => {
    expect(conflictingTerms([
      { code: "TERM-01", term: "Northbeam Sync", kind: "preferred", replacement: null },
      { code: "TERM-02", term: "NB Sync", kind: "banned", replacement: "Northbeam Sync" },
    ])).toEqual([]);
  });
});

describe("factImpact", () => {
  const fact = (o: Record<string, unknown> = {}) => ({ id: "f7", code: "FACT-07", statement: "SLA 99.9%", validUntil: null, updatedAt: "2026-11-01T00:00:00Z", ...o });
  const link = (o: Record<string, unknown> = {}) => ({ factId: "f7", itemId: "i1", itemTitle: "Launch post", approvedAt: "2026-11-05T00:00:00Z", ...o });

  it("flags a fact edited after the content that relies on it was approved", () => {
    const [a] = factImpact([fact({ updatedAt: "2026-11-10T00:00:00Z" })], [link(), link({ itemId: "i2", approvedAt: "2026-11-12T00:00:00Z" })], TODAY);
    expect(a.reason).toBe("changed");
    expect(a.items.map((i) => [i.id, i.changedAfterApproval])).toEqual([["i1", true], ["i2", false]]);
  });

  it("flags expired and soon-expiring facts, expired first, one entry per item", () => {
    const r = factImpact(
      [fact({ id: "f5", code: "FACT-05", validUntil: "2026-06-30" }), fact({ validUntil: "2026-12-01" })],
      [link(), link(), link({ factId: "f5" })], TODAY,
    );
    expect(r.map((a) => [a.code, a.reason, a.items.length])).toEqual([["FACT-05", "expired", 1], ["FACT-07", "expiring", 1]]);
  });

  it("stays quiet when nothing relies on the fact or the fact is current and unchanged", () => {
    expect(factImpact([fact({ validUntil: "2026-01-01" })], [], TODAY)).toEqual([]);
    expect(factImpact([fact()], [link()], TODAY)).toEqual([]);
  });
});
