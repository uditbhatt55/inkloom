import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AiReviewer } from "@/lib/ai/reviewer";
import { AI_BUDGET_MS, runAudit, type AuditInput } from "./pipeline";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const base = (ai: AiReviewer, timeoutMs: number): AuditInput => ({
  content: "Northbeam Sync keeps files in step.", channel: "linkedin", audience: "public", today: "2026-11-14",
  knowledge: { clauses: [], facts: [], terms: [] }, ai, timeoutMs,
});
/** reviewer whose n-th call waits steps[n].ms then returns steps[n].out */
const scripted = (steps: { ms: number; out: unknown }[]) => {
  let calls = 0;
  const reviewer: AiReviewer = {
    mode: "real", model: "test",
    async review() {
      const s = steps[Math.min(calls++, steps.length - 1)];
      await sleep(s.ms);
      return s.out;
    },
  };
  return { reviewer, calls: () => calls };
};
const VALID = { findings: [] };
const INVALID = { nope: true };

describe("AI time budget (retry included)", () => {
  it("a model slower than the budget ends in rule-only results within the budget, not an error", async () => {
    const { reviewer } = scripted([{ ms: 2000, out: VALID }]);
    const t0 = Date.now();
    const r = await runAudit(base(reviewer, 150));
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(r.aiMode).toBe("failed");
    expect(r.warnings.join(" ")).toMatch(/timed out/);
  });

  it("invalid output is retried when there is time, and the retry can succeed", async () => {
    const s = scripted([{ ms: 0, out: INVALID }, { ms: 0, out: VALID }]);
    const r = await runAudit(base(s.reviewer, 1000));
    expect(s.calls()).toBe(2);
    expect(r.aiMode).toBe("real");
  });

  it("no retry when too little of the budget is left: one call, rule-only, and a clear note", async () => {
    const s = scripted([{ ms: 250, out: INVALID }, { ms: 0, out: VALID }]);
    const t0 = Date.now();
    const r = await runAudit(base(s.reviewer, 300));
    expect(s.calls()).toBe(1);
    expect(Date.now() - t0).toBeLessThan(800);
    expect(r.aiMode).toBe("failed");
    expect(r.warnings.join(" ")).toMatch(/no time to retry/);
  });

  it("the retry only gets what is left of the budget", async () => {
    const s = scripted([{ ms: 100, out: INVALID }, { ms: 2000, out: VALID }]);
    const t0 = Date.now();
    const r = await runAudit(base(s.reviewer, 400));
    expect(s.calls()).toBe(2);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(r.aiMode).toBe("failed");
  });

  it("the default budget leaves at least 10 s of each route's maxDuration for parsing and saving", () => {
    for (const f of ["src/app/api/audit/route.ts", "src/app/api/items/[id]/apply-fixes/route.ts"]) {
      const m = /export const maxDuration = (\d+);/.exec(readFileSync(f, "utf8"));
      expect(m, f).not.toBeNull();
      expect(AI_BUDGET_MS / 1000 + 10, f).toBeLessThanOrEqual(Number(m![1]));
    }
  });
});
