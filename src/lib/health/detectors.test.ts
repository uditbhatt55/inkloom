import { describe, expect, it } from "vitest";
import { addDays, conflictingTerms, expiringFacts, factImpact, isSmallSample, recurringMistakes, ruleChangeImpact, unclearRules, weeklyTrend, type HealthFinding } from "./detectors";

const TODAY = "2026-11-14";
let post = 0; // every finding is a different post unless a test says otherwise
const f = (o: Partial<HealthFinding>): HealthFinding => ({
  itemId: `item-${post++}`, ruleCode: "TERM-02", status: "open", quote: "NB Sync", channel: "linkedin", creatorRole: "creator", at: "2026-11-10T10:00:00Z", ...o,
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

  it("counts a post once per rule, however many versions or findings repeat the mistake", () => {
    const r = recurringMistakes([
      f({ itemId: "p1", quote: "NB Sync" }), f({ itemId: "p1", quote: "NB Sync" }),            // version 1 and version 2 of one post
      f({ itemId: "p1", ruleCode: "CLAIM-01", quote: "thousands" }), f({ itemId: "p1", ruleCode: "CLAIM-01", quote: "100%" }), // two findings, one rule, one post
      f({ itemId: "p2", quote: "NB Sync", channel: "email" }),
    ], TODAY);
    expect(r.map((x) => [x.ruleCode, x.count])).toEqual([["TERM-02", 2], ["CLAIM-01", 1]]);
    expect(r[0].byChannel).toEqual([["email", 1], ["linkedin", 1]]);
  });

  it("a post that was dismissed in one version but still breaks the rule in another still counts once", () => {
    const r = recurringMistakes([f({ itemId: "p1", status: "dismissed" }), f({ itemId: "p1", status: "open" })], TODAY);
    expect(r).toEqual([expect.objectContaining({ ruleCode: "TERM-02", count: 1 })]);
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

describe("Round 3 detectors", () => {
  const fact = (code: string, validUntil: string | null) => ({ id: code, code, statement: `${code} statement`, validUntil, updatedAt: "2026-11-01T00:00:00Z" });

  it("expiringFacts lists expired and soon-expiring facts, soonest first, with days left", () => {
    const out = expiringFacts([fact("F1", "2026-12-20"), fact("F2", "2026-11-10"), fact("F3", "2026-11-20"), fact("F4", null)], "2026-11-17");
    expect(out.map((f) => [f.code, f.daysLeft])).toEqual([["F2", -7], ["F3", 3]]);
  });

  it("weeklyTrend counts audited posts and mistakes (once per post and rule) per Monday week, empty weeks included", () => {
    const run = (itemId: string, at: string) => ({ itemId, itemTitle: itemId, at, ruleCodes: [] });
    const f = (itemId: string, ruleCode: string, at: string, status = "open") => ({ itemId, ruleCode, status, quote: "q", channel: null, creatorRole: null, at });
    const out = weeklyTrend(
      [run("a", "2026-11-17T10:00:00Z"), run("b", "2026-11-16T10:00:00Z"), run("c", "2026-11-03T10:00:00Z")],
      [f("a", "R1", "2026-11-17T10:00:00Z"), f("a", "R1", "2026-11-17T11:00:00Z"), f("b", "R2", "2026-11-16T10:00:00Z", "dismissed")],
      "2026-11-17", 3,
    );
    // 17 Nov 2026 is a Tuesday: its week starts Monday 16 Nov; 3 Nov (Tuesday) belongs to the week of 2 Nov
    expect(out).toEqual([
      { weekStart: "2026-11-02", posts: 1, mistakes: 0 },
      { weekStart: "2026-11-09", posts: 0, mistakes: 0 },
      { weekStart: "2026-11-16", posts: 2, mistakes: 1 },
    ]);
  });

  it("ruleChangeImpact compares the last run before a change with the first run after it, per post", () => {
    const r = (itemId: string, at: string, ruleCodes: string[]) => ({ itemId, itemTitle: `Post ${itemId}`, at, ruleCodes });
    const out = ruleChangeImpact([{ code: "CLAIM-02", changedAt: "2026-11-15T00:00:00Z", version: 2 }], [
      r("a", "2026-11-10T00:00:00Z", []), r("a", "2026-11-16T00:00:00Z", ["CLAIM-02"]),           // newly flagged
      r("b", "2026-11-10T00:00:00Z", ["CLAIM-02"]), r("b", "2026-11-16T00:00:00Z", []),           // no longer raised
      r("c", "2026-11-10T00:00:00Z", ["CLAIM-02"]), r("c", "2026-11-16T00:00:00Z", ["CLAIM-02"]), // unchanged
      r("d", "2026-11-10T00:00:00Z", ["CLAIM-02"]),                                                 // never re-audited: not compared
    ]);
    expect(out).toEqual([{ code: "CLAIM-02", changedAt: "2026-11-15T00:00:00Z", version: 2, compared: 3,
      newlyFlagged: [{ id: "a", title: "Post a" }], noLongerRaised: [{ id: "b", title: "Post b" }] }]);
  });

  it("a signal on fewer than 10 cases is a small sample", () => {
    expect([isSmallSample(5), isSmallSample(9), isSmallSample(10)]).toEqual([true, true, false]);
  });
});
