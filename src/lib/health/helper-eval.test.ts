import { describe, expect, it } from "vitest";
import { emptyConflictTally, emptyRewriteTally, ratio, scoreConflicts, scoreRewrite } from "./helper-eval";

const pair = (a: string, b: string) => ({ a, b, category: "tone", why: "x" });

describe("helper eval scoring", () => {
  it("conflicts: pairs match in any order; extra pairs are false positives; a flagged clean set is counted", () => {
    let t = scoreConflicts(emptyConflictTally(), [["A", "B"]], [pair("B", "A"), pair("A", "C")]);
    t = scoreConflicts(t, [], [pair("A", "B")]);
    t = scoreConflicts(t, [], []);
    t = scoreConflicts(t, [["X", "Y"]], null);
    expect(t).toEqual({ tp: 1, fp: 2, fn: 1, cleanSets: 2, cleanSetsFlagged: 1, failed: 1 });
  });

  it("rewrites: accepted, kept the must-keep words, and gave an example", () => {
    let t = scoreRewrite(emptyRewriteTally(), ["guarantee"], { text: "Use Guaranteed only for contractual SLAs.", example_do: "guaranteed within one business day" });
    t = scoreRewrite(t, ["guarantee"], { text: "Avoid absolute promises.", example_do: null });
    t = scoreRewrite(t, ["guarantee"], null);
    expect(t).toEqual({ runs: 3, accepted: 2, keptIntent: 1, gaveExample: 1 });
  });

  it("ratio rounds to three places and is null with nothing to divide", () => {
    expect([ratio(2, 3), ratio(0, 0)]).toEqual([0.667, null]);
  });
});
