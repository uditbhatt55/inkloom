import { chooseReviewer } from "@/lib/ai/select";
import type { AiReviewer } from "@/lib/ai/reviewer";
import type { Db } from "@/lib/supabase/server";

/**
 * Cost control for the public demo (Round 2: judges use shared demo accounts, the real model is on). An audit costs about
 * Rs 0.07 (docs/research/azure-models.md), so the limits are generous and guard against a script, not against judges:
 *  - burst: one account may start at most `burstMax` audits in `burstMinutes`; over that the request is refused (429).
 *  - daily: the whole organisation may run at most `dailyMax` REAL-model audits per 24 hours; over that, audits still work
 *    but run on the rules only, with a note, so the site never goes dark.
 * Counted from audit_runs, so no new table. shortcut: a few simultaneous requests can slip past the count, and the
 * Brand Health AI buttons (owner and reviewer only) are not counted; move to a usage table if either starts to matter.
 */
export type Limits = { burstMax: number; burstMinutes: number; dailyMax: number };
export const DEFAULT_LIMITS: Limits = { burstMax: 20, burstMinutes: 10, dailyMax: 3000 };

const positive = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};
export function limitsFromEnv(env: Record<string, string | undefined> = process.env): Limits {
  return { ...DEFAULT_LIMITS, burstMax: positive(env.AI_BURST_MAX, DEFAULT_LIMITS.burstMax), dailyMax: positive(env.AI_DAILY_CAP, DEFAULT_LIMITS.dailyMax) };
}

export type Counter = {
  /** audits this account started since the given time, any mode */
  userRuns(since: Date): Promise<number>;
  /** audits that used the real model, whole organisation, since the given time */
  orgRealRuns(since: Date): Promise<number>;
};

export type Gate =
  | { kind: "ok"; ai: AiReviewer | null; notes: string[] }
  | { kind: "burst" };

export const BURST_MESSAGE = "You are auditing too fast. Please wait a few minutes and try again.";
export const DAILY_NOTE = "The demo's daily AI limit was reached, so this audit used the rule checks only. AI review is back tomorrow.";

/**
 * Decides which reviewer an audit may use. `chosen` is what chooseReviewer() picked; the real model is swapped for no AI
 * once the day's limit is used up. A counting error never blocks anyone: the audit runs as normal and the error is logged.
 */
export async function gateAudit(counter: Counter, chosen: AiReviewer, limits: Limits = limitsFromEnv(), now = new Date()): Promise<Gate> {
  try {
    if ((await counter.userRuns(new Date(now.getTime() - limits.burstMinutes * 60_000))) >= limits.burstMax) return { kind: "burst" };
    if (chosen.mode === "real" && (await counter.orgRealRuns(new Date(now.getTime() - 24 * 3_600_000))) >= limits.dailyMax) {
      return { kind: "ok", ai: null, notes: [DAILY_NOTE] };
    }
  } catch (e) {
    console.error("usage cap could not count audits:", e instanceof Error ? e.message : e);
  }
  return { kind: "ok", ai: chosen, notes: [] };
}

/** Counts from audit_runs with the service role (RLS would hide other people's runs from the daily count). */
export function supabaseCounter(db: Db, orgId: string, userId: string): Counter {
  const count = async (q: PromiseLike<{ count: number | null; error: { message: string } | null }>) => {
    const { count: n, error } = await q;
    if (error) throw new Error(error.message);
    return n ?? 0;
  };
  return {
    userRuns: (since) => count(db.from("audit_runs").select("id", { count: "exact", head: true }).eq("requested_by", userId).gte("created_at", since.toISOString())),
    orgRealRuns: (since) => count(db.from("audit_runs").select("id", { count: "exact", head: true }).eq("org_id", orgId).eq("mode", "real").gte("created_at", since.toISOString())),
  };
}

/** The reviewer for one request: what the environment chooses, within the limits. */
export const gateForRequest = (db: Db, orgId: string, userId: string) => gateAudit(supabaseCounter(db, orgId, userId), chooseReviewer());
