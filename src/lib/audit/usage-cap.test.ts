import { describe, expect, it, vi } from "vitest";
import type { AiReviewer } from "@/lib/ai/reviewer";
import { BURST_MESSAGE, DAILY_NOTE, DEFAULT_LIMITS, gateAudit, limitsFromEnv, type Counter } from "./usage-cap";

const real: AiReviewer = { mode: "real", model: "gpt-6-luna", review: async () => null };
const sim: AiReviewer = { mode: "simulated", model: "simulated", review: async () => null };
const limits = { burstMax: 3, burstMinutes: 10, dailyMax: 5 };
const NOW = new Date("2026-11-14T12:00:00Z");
const counter = (user: number, org: number): Counter & { calls: Date[] } => {
  const calls: Date[] = [];
  return { calls, userRuns: async (s) => { calls.push(s); return user; }, orgRealRuns: async (s) => { calls.push(s); return org; } };
};

describe("gateAudit", () => {
  it("lets an audit through on the chosen reviewer while both counts are under the limits", async () => {
    expect(await gateAudit(counter(2, 4), real, limits, NOW)).toEqual({ kind: "ok", ai: real, notes: [] });
  });

  it("refuses an account that started too many audits in the window, and counts from the right start time", async () => {
    const c = counter(3, 0);
    expect(await gateAudit(c, real, limits, NOW)).toEqual({ kind: "burst" });
    expect(c.calls[0]).toEqual(new Date("2026-11-14T11:50:00Z"));
    expect(BURST_MESSAGE).toMatch(/too fast/);
  });

  it("past the daily real-model limit the audit still runs, on the rules only, with a note", async () => {
    const c = counter(0, 5);
    expect(await gateAudit(c, real, limits, NOW)).toEqual({ kind: "ok", ai: null, notes: [DAILY_NOTE] });
    expect(c.calls[1]).toEqual(new Date("2026-11-13T12:00:00Z"));
  });

  it("the daily limit does not apply to the simulated reviewer, which costs nothing", async () => {
    const c = counter(0, 999);
    expect(await gateAudit(c, sim, limits, NOW)).toEqual({ kind: "ok", ai: sim, notes: [] });
    expect(c.calls).toHaveLength(1); // the org count is not even asked for
  });

  it("the burst limit applies to every mode, and is checked before the daily one", async () => {
    expect(await gateAudit(counter(9, 999), sim, limits, NOW)).toEqual({ kind: "burst" });
    expect(await gateAudit(counter(9, 999), real, limits, NOW)).toEqual({ kind: "burst" });
  });

  it("a counting error never blocks anyone: the audit runs on the chosen reviewer and the error is logged", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: Counter = { userRuns: async () => { throw new Error("db down"); }, orgRealRuns: async () => 0 };
    expect(await gateAudit(broken, real, limits, NOW)).toEqual({ kind: "ok", ai: real, notes: [] });
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });
});

describe("limitsFromEnv", () => {
  it("uses the defaults, and only whole positive numbers from the environment", () => {
    expect(limitsFromEnv({})).toEqual(DEFAULT_LIMITS);
    expect(limitsFromEnv({ AI_BURST_MAX: "5", AI_DAILY_CAP: "100" })).toEqual({ ...DEFAULT_LIMITS, burstMax: 5, dailyMax: 100 });
    expect(limitsFromEnv({ AI_BURST_MAX: "0", AI_DAILY_CAP: "abc" })).toEqual(DEFAULT_LIMITS);
    expect(limitsFromEnv({ AI_BURST_MAX: "2.5", AI_DAILY_CAP: "-3" })).toEqual(DEFAULT_LIMITS);
  });
});
