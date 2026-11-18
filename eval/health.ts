/**
 * `npm run eval:health`: measures the two Brand Health AI helpers on the labelled cases in eval/health with the REAL
 * model (.env.local), each case `RUNS` times so the spread shows. Same prompts, schemas and validators as the live
 * routes (src/app/api/health/*). About 110 model calls. Writes eval/results/health-helpers.json, which the Brand Health
 * page shows next to each helper. Tests never call this.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { azureJson } from "@/lib/ai/json";
import { CONFLICT_JSON_SCHEMA, comparableClauses, conflictMessages, validateConflicts, type ClauseRow } from "@/lib/health/clause-conflicts";
import { emptyConflictTally, emptyRewriteTally, ratio, scoreConflicts, scoreRewrite } from "@/lib/health/helper-eval";
import { REWRITE_JSON_SCHEMA, rewriteMessages, validateRewrite } from "@/lib/health/rewrite";

const RUNS = 3;
type ConflictCase = { id: string; category: string; clauses: Record<string, string>; expected: [string, string][] };
type RewriteCase = { id: string; code: string; text: string; notes: { quote: string; reason: string | null }[]; must_keep: string[] };

try { process.loadEnvFile(".env.local"); } catch { /* variables may already be set */ }
const { AZURE_OPENAI_ENDPOINT: endpoint, AZURE_OPENAI_API_KEY: apiKey, AZURE_DEPLOYMENT_DEFAULT: deployment } = process.env;
if (!endpoint || !apiKey || !deployment) { console.error("needs AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_DEPLOYMENT_DEFAULT in .env.local"); process.exit(2); }
const ai = azureJson({ endpoint, apiKey, deployment });
const seed = JSON.parse(readFileSync("seed/northbeam/knowledge.json", "utf8"));
const terms: { term: string; kind: string }[] = seed.terms.map((t: { term: string; kind: string }) => ({ term: t.term, kind: t.kind }));

const conflicts = JSON.parse(readFileSync("eval/health/conflicts.json", "utf8")) as { labelled_by: string[]; cases: ConflictCase[] };
const rewrites = JSON.parse(readFileSync("eval/health/rewrites.json", "utf8")) as { labelled_by: string[]; cases: RewriteCase[] };

let ct = emptyConflictTally();
// easy controls (CF, NC, MX) and hard cases (HC, HN, SEED) are also reported apart, so an easy 100% cannot hide the rest
const hard = (id: string) => /^(HC|HN|SEED)/.test(id);
const ctBy = { easy: emptyConflictTally(), hard: emptyConflictTally() };
const conflictRuns: { id: string; run: number; got: string[] | null }[] = [];
for (const c of conflicts.cases) {
  const rows: ClauseRow[] = Object.entries(c.clauses).map(([code, text]) => ({ code, text, category: c.category, status: "active" }));
  const sent = comparableClauses(rows);
  for (let run = 1; run <= RUNS; run++) {
    let got = null;
    try {
      got = validateConflicts(await ai.call({ messages: conflictMessages(sent), name: "clause_conflicts", schema: CONFLICT_JSON_SCHEMA }), rows)?.conflicts ?? null;
    } catch (e) {
      console.error(`${c.id} run ${run}:`, e instanceof Error ? e.message : e);
    }
    ct = scoreConflicts(ct, c.expected, got);
    const g = hard(c.id) ? "hard" : "easy";
    ctBy[g] = scoreConflicts(ctBy[g], c.expected, got);
    conflictRuns.push({ id: c.id, run, got: got ? got.map((p) => `${p.a}|${p.b}`) : null });
    process.stdout.write(".");
  }
}

let rt = emptyRewriteTally();
const rtBy = { easy: emptyRewriteTally(), hard: emptyRewriteTally() };
const hardRewrite = (id: string) => Number(id.slice(3)) >= 9;
const rewriteRuns: { id: string; run: number; text: string | null; refused: string | null }[] = [];
for (const c of rewrites.cases) {
  for (let run = 1; run <= RUNS; run++) {
    let draft = null, refused: string | null = null;
    try {
      const v = validateRewrite(await ai.call({ messages: rewriteMessages({ code: c.code, text: c.text }, c.notes), name: "clause_rewrite", schema: REWRITE_JSON_SCHEMA }), c.text, c.notes, terms);
      if (v.ok) draft = v.value; else refused = v.reason;
    } catch (e) {
      refused = e instanceof Error ? e.message : "call failed";
    }
    rt = scoreRewrite(rt, c.must_keep, draft);
    const g = hardRewrite(c.id) ? "hard" : "easy";
    rtBy[g] = scoreRewrite(rtBy[g], c.must_keep, draft);
    rewriteRuns.push({ id: c.id, run, text: draft?.text ?? null, refused });
    process.stdout.write(".");
  }
}

const result = {
  measured_at: new Date().toISOString(), model: deployment, runs_per_case: RUNS,
  conflicts: {
    sets: conflicts.cases.length, labelled_by: conflicts.labelled_by, ...ct,
    precision: ratio(ct.tp, ct.tp + ct.fp), recall: ratio(ct.tp, ct.tp + ct.fn),
    false_alarm_rate: ratio(ct.cleanSetsFlagged, ct.cleanSets),
    by_group: Object.fromEntries(Object.entries(ctBy).map(([k, t]) => [k, { ...t, precision: ratio(t.tp, t.tp + t.fp), recall: ratio(t.tp, t.tp + t.fn), false_alarm_rate: ratio(t.cleanSetsFlagged, t.cleanSets) }])),
  },
  rewrites: {
    cases: rewrites.cases.length, labelled_by: rewrites.labelled_by, ...rt,
    accepted_rate: ratio(rt.accepted, rt.runs), kept_intent_rate: ratio(rt.keptIntent, rt.runs), example_rate: ratio(rt.gaveExample, rt.runs),
    by_group: Object.fromEntries(Object.entries(rtBy).map(([k, t]) => [k, { ...t, accepted_rate: ratio(t.accepted, t.runs), kept_intent_rate: ratio(t.keptIntent, t.runs) }])),
  },
  details: { conflictRuns, rewriteRuns },
};
mkdirSync("eval/results", { recursive: true });
writeFileSync("eval/results/health-helpers.json", `${JSON.stringify(result, null, 2)}\n`);
console.log("\n", JSON.stringify({ conflicts: result.conflicts, rewrites: result.rewrites }, null, 2));
