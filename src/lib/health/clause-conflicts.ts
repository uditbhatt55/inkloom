import { z } from "zod";
import type { Message } from "@/lib/ai/prompt";

/**
 * On-demand AI comparison of clause pairs in the same category (proposal §8.3, "conflicting rules"). The deterministic
 * term check (detectors.ts) is always on; this finds contradictions between sentences. Every pair goes through the same
 * kind of citation check as audit findings: both codes must be real, active clauses of one category.
 */
export type ClauseRow = { code: string; category: string; text: string; status: string };

export const CONFLICT_SYSTEM = `You compare the guideline clauses of ONE organisation and report pairs that contradict each other, where following one clause means breaking the other.

Rules:
- Only report real contradictions. Do not report overlaps, repetition, or clauses about different topics.
- Both clauses of a pair must be in the same category and must come from the list. Use only the codes in the list.
- "why" is one sentence naming what clashes.
- Return {"conflicts": []} when nothing contradicts.`;

/** Only categories with at least two active clauses can contain a conflicting pair. */
export function comparableClauses(clauses: ClauseRow[]): ClauseRow[] {
  const active = clauses.filter((c) => c.status === "active");
  const per = new Map<string, number>();
  for (const c of active) per.set(c.category, (per.get(c.category) ?? 0) + 1);
  return active.filter((c) => (per.get(c.category) ?? 0) >= 2).sort((a, b) => a.category.localeCompare(b.category) || a.code.localeCompare(b.code));
}

export function conflictMessages(clauses: ClauseRow[]): Message[] {
  const list = clauses.map((c) => `${c.code} [${c.category}]: ${c.text.replace(/\s+/g, " ")}`).join("\n");
  return [
    { role: "system", content: CONFLICT_SYSTEM },
    { role: "user", content: `Clauses:\n${list}` },
  ];
}

export const CONFLICT_JSON_SCHEMA = {
  type: "object", additionalProperties: false, required: ["conflicts"],
  properties: {
    conflicts: {
      type: "array",
      items: { type: "object", additionalProperties: false, required: ["a", "b", "why"], properties: { a: { type: "string" }, b: { type: "string" }, why: { type: "string" } } },
    },
  },
} as const;

const OutputSchema = z.object({ conflicts: z.array(z.object({ a: z.string(), b: z.string(), why: z.string().min(1).max(400) })) });
export type ClauseConflict = { a: string; b: string; category: string; why: string };

/** Keeps only pairs of two different, comparable clauses in one category; the same pair is reported once. */
export function validateConflicts(raw: unknown, clauses: ClauseRow[]): { conflicts: ClauseConflict[]; dropped: number } | null {
  const parsed = OutputSchema.safeParse(raw);
  if (!parsed.success) return null;
  const byCode = new Map(clauses.map((c) => [c.code, c]));
  const seen = new Set<string>();
  const conflicts: ClauseConflict[] = [];
  let dropped = 0;
  for (const p of parsed.data.conflicts) {
    const a = byCode.get(p.a), b = byCode.get(p.b);
    const key = [p.a, p.b].sort().join("|");
    if (!a || !b || p.a === p.b || a.category !== b.category || seen.has(key)) { dropped++; continue; }
    seen.add(key);
    const [x, y] = [p.a, p.b].sort();
    conflicts.push({ a: x, b: y, category: a.category, why: p.why.trim() });
  }
  return { conflicts, dropped };
}
