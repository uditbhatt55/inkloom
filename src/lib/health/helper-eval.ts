/**
 * Scoring for the Brand Health AI helpers (Round 3, improvement 3: "AI suggestions measured first"). Pure: the runner
 * (eval/health.ts) calls the model and passes what the helpers returned after their own validation.
 */
import type { ClauseConflict } from "./clause-conflicts";

const key = (a: string, b: string) => [a, b].sort().join("|");

export type ConflictTally = { tp: number; fp: number; fn: number; cleanSets: number; cleanSetsFlagged: number; failed: number };
export const emptyConflictTally = (): ConflictTally => ({ tp: 0, fp: 0, fn: 0, cleanSets: 0, cleanSetsFlagged: 0, failed: 0 });

/** Adds one run of one case: pairs are compared order-free; a null result (model or validation failure) counts as failed. */
export function scoreConflicts(t: ConflictTally, expected: [string, string][], got: ClauseConflict[] | null): ConflictTally {
  if (!got) return { ...t, failed: t.failed + 1, fn: t.fn + expected.length };
  const want = new Set(expected.map(([a, b]) => key(a, b)));
  const have = new Set(got.map((c) => key(c.a, c.b)));
  const tp = [...have].filter((k) => want.has(k)).length;
  return {
    tp: t.tp + tp, fp: t.fp + have.size - tp, fn: t.fn + want.size - tp, failed: t.failed,
    cleanSets: t.cleanSets + (want.size === 0 ? 1 : 0),
    cleanSetsFlagged: t.cleanSetsFlagged + (want.size === 0 && have.size > 0 ? 1 : 0),
  };
}

export type RewriteTally = { runs: number; accepted: number; keptIntent: number; gaveExample: number };
export const emptyRewriteTally = (): RewriteTally => ({ runs: 0, accepted: 0, keptIntent: 0, gaveExample: 0 });

/**
 * Adds one run of one rewrite case. `draft` is the validated draft or null when validation refused it. Kept intent =
 * every labelled must-keep word stem is still in the new rule (a narrower rule, not a deleted one).
 */
export function scoreRewrite(t: RewriteTally, mustKeep: string[], draft: { text: string; example_do: string | null } | null): RewriteTally {
  const text = draft?.text.toLowerCase() ?? "";
  return {
    runs: t.runs + 1,
    accepted: t.accepted + (draft ? 1 : 0),
    keptIntent: t.keptIntent + (draft && mustKeep.every((w) => text.includes(w.toLowerCase())) ? 1 : 0),
    gaveExample: t.gaveExample + (draft?.example_do ? 1 : 0),
  };
}

export const ratio = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 1000 : null);
