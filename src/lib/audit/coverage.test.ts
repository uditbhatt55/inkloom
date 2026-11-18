import { describe, expect, it } from "vitest";
import { coverageOf } from "./coverage";

const status = (c: ReturnType<typeof coverageOf>) => Object.fromEntries(c.checks.map((x) => [x.name.split(":")[0].split(",")[0], [x.status, x.note ?? null]]));

describe("coverageOf", () => {
  it("a full AI audit of pasted public text is complete", () => {
    const c = coverageOf({ mode: "real", warnings: [] }, { text: "Line one.\n\nLine two." }, "public");
    expect(c.partial).toBe(false);
    expect([c.blocks, c.chars, c.truncated]).toEqual([2, 20, false]);
    expect(status(c)["Images"]).toEqual(["not_needed", "pasted text has none"]);
  });

  it("a rule-only run is partial and says why the AI did not run", () => {
    const limit = coverageOf({ mode: "rule_only", warnings: ["The demo's daily AI limit was reached, so this audit used the rule checks only."] }, { text: "x" }, "public");
    expect(limit.partial).toBe(true);
    expect(status(limit)["AI judgement"]).toEqual(["skipped", "the daily AI limit was reached"]);
    const failed = coverageOf({ mode: "rule_only", warnings: ["AI review failed (HTTP 400); showing rule-based results only."] }, { text: "x" }, "public");
    expect(status(failed)["AI judgement"]).toEqual(["skipped", "the AI service failed or refused the request"]);
  });

  it("truncated text or a skipped contrast check makes a run partial even when the AI ran", () => {
    expect(coverageOf({ mode: "real", warnings: ["Only the first 200,000 characters were audited."] }, { text: "x" }, "public")).toMatchObject({ partial: true, truncated: true });
    const c = coverageOf({ mode: "real", warnings: ['Skipped contrast check "Banner": invalid colour value.'] }, { text: "x", file_type: "image/png" }, "public");
    expect([c.partial, status(c)["Images"][0]]).toEqual([true, "skipped"]);
  });

  it("internal content does not need the Confidential Guard", () => {
    expect(status(coverageOf({ mode: "real", warnings: [] }, { text: "x" }, "internal"))["Confidential Guard"]).toEqual(["not_needed", "internal audience"]);
  });
});
