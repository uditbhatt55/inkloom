/**
 * `npm run eval`: runs the labelled cases in eval/cases against the audit pipeline and prints precision and recall.
 *   npm run eval            rule checks only (no AI, free, repeatable): the numbers CI can reproduce
 *   npm run eval -- --ai    also calls the real model from .env.local (about 48 calls); needs DEMO_MODE=false and the Azure settings
 * Writes eval/results/<mode>.json. Exits 1 only if a seeded internal codename is missed (the proposal's 100% target).
 *
 * Matching (decision: match on category and quote, not on rule id, because the model and the engine may cite a different
 * but equivalent clause): an expected finding is FOUND when some finding has the same category and its text overlaps the
 * expected quote. Image cases label the image file name, so there the category alone decides.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Knowledge } from "@/lib/ai/brandpack";
import { azureReviewer, type AiReviewer } from "@/lib/ai/reviewer";
import { effort } from "@/lib/ai/select";
import { runAudit, type AuditResult } from "@/lib/audit/pipeline";
import type { Finding } from "@/lib/audit/types";

type Expected = { category: string; severity: string; quote: string; rule_id: string; why: string };
type Case = {
  id: string; channel: string; audience: "public" | "internal"; content: string; labelled_by: string[]; expected: Expected[];
  image?: { file: string; alt: string; text_colour: string; background: string; fonts: string[] };
};

const TODAY = "2026-11-15"; // fixed, so facts that expire later do not change the numbers
const useAi = process.argv.includes("--ai");

const raw = JSON.parse(readFileSync("seed/northbeam/knowledge.json", "utf8"));
const knowledge: Knowledge = {
  clauses: raw.clauses.map((c: { code: string; category: string; text: string }) => ({ code: c.code, category: c.category, text: c.text, status: "active" })),
  // structured fields (Round 3) are passed through when the seed has them
  facts: raw.facts.map((f: { code: string; statement: string; valid_from: string | null; valid_until: string | null; visibility: "public" | "internal" } & Record<string, unknown>) =>
    ({ code: f.code, statement: f.statement, validFrom: f.valid_from, validUntil: f.valid_until, visibility: f.visibility,
      metric: f.metric ?? null, value: f.value ?? null, unit: f.unit ?? null, period: f.period ?? null, currency: f.currency ?? null,
      region: f.region ?? null, product: f.product ?? null, condition: f.condition ?? null })),
  terms: raw.terms.map((t: { code: string; term: string; kind: "preferred" | "banned" | "internal"; replacement: string | null }) =>
    ({ code: t.code, term: t.term, kind: t.kind, replacement: t.replacement })),
  assets: [
    ...raw.assets.colors.map((c: { name: string; hex: string }) => ({ type: "color" as const, name: c.name, hex: c.hex, fontName: null })),
    ...raw.assets.fonts.map((f: { name: string }) => ({ type: "font" as const, name: f.name, hex: null, fontName: f.name })),
  ],
};

function reviewer(): AiReviewer | null {
  if (!useAi) return null;
  try { process.loadEnvFile(".env.local"); } catch { /* variables may already be set */ }
  const { AZURE_OPENAI_ENDPOINT: endpoint, AZURE_OPENAI_API_KEY: apiKey, AZURE_DEPLOYMENT_DEFAULT: deployment } = process.env;
  if (!endpoint || !apiKey || !deployment) { console.error("--ai needs AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY and AZURE_DEPLOYMENT_DEFAULT in .env.local"); process.exit(2); }
  return azureReviewer({ endpoint, apiKey, deployment, reasoningEffort: effort(process.env.AZURE_REASONING_EFFORT) });
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const isImageLabel = (q: string) => /\.(png|jpe?g|webp)$/i.test(q);

/** Does this finding match this expected finding? */
export function matches(f: Finding, e: Expected, content: string): boolean {
  if (f.category !== e.category) return false;
  if (isImageLabel(e.quote)) return true;
  const at = content.indexOf(e.quote);
  if (at >= 0 && f.start >= 0 && f.start < at + e.quote.length && f.end > at) return true; // spans overlap
  const a = norm(f.quote), b = norm(e.quote);
  return a.includes(b) || b.includes(a);
}

async function audit(c: Case, ai: AiReviewer | null): Promise<AuditResult> {
  const img = c.image;
  return runAudit({
    content: c.content, channel: c.channel, audience: c.audience, today: TODAY, knowledge, ai,
    ...(img ? {
      // what a person would type on the upload form: the colours of the text and its background
      colours: [{ fg: img.text_colour, bg: img.background, label: img.file, confidence: "high" as const }],
      parsed: { fonts: img.fonts, images: [{ label: img.file, alt: img.alt }], colours: [{ hex: img.background, share: 0.7 }, { hex: img.text_colour, share: 0.1 }] },
    } : {}),
  });
}

type Row = { id: string; found: number; expected: number; hit: number; truePos: number; extra: string[]; missed: string[]; aiMode: string; aiNote?: string };

async function main() {
  const dir = "eval/cases";
  const cases: Case[] = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().flatMap((f) => JSON.parse(readFileSync(join(dir, f), "utf8")));
  const ai = reviewer();
  const rows: Row[] = [];
  const perCat: Record<string, { expected: number; hit: number; found: number; tp: number; foundHigh: number; tpHigh: number }> = {};
  const cat = (c: string) => (perCat[c] ??= { expected: 0, hit: 0, found: 0, tp: 0, foundHigh: 0, tpHigh: 0 });
  let cleanCases = 0, cleanWithFindings = 0, aiFailed = 0;
  const leak: Record<"codename" | "internalFact", [number, number]> = { codename: [0, 0], internalFact: [0, 0] }; // [found, expected] of the confidentiality labels, by what leaked

  for (const c of cases) {
    const r = await audit(c, ai);
    if (ai && r.aiMode !== "real") aiFailed++;
    const row: Row = { id: c.id, found: r.findings.length, expected: c.expected.length, hit: 0, truePos: 0, extra: [], missed: [], aiMode: r.aiMode };
    // why the AI did not run on this case, so a failed run can be told apart from a weak one
    if (r.aiMode !== "real") row.aiNote = r.warnings.find((w) => /AI/.test(w));
    for (const e of c.expected) {
      cat(e.category).expected++;
      const hit = r.findings.some((f) => matches(f, e, c.content));
      if (hit) { row.hit++; cat(e.category).hit++; } else row.missed.push(`${e.category}: ${e.quote}`);
      if (e.category === "confidentiality") { const l = e.rule_id.startsWith("TERM-") ? leak.codename : leak.internalFact; l[1]++; if (hit) l[0]++; }
    }
    for (const f of r.findings) {
      const ok = c.expected.some((e) => matches(f, e, c.content));
      const k = cat(f.category);
      k.found++; if (ok) k.tp++;
      if (f.confidence === "high") { k.foundHigh++; if (ok) k.tpHigh++; }
      if (ok) row.truePos++; else row.extra.push(`${f.category}/${f.confidence}: ${f.quote.slice(0, 60)}`);
    }
    if (!c.expected.length) { cleanCases++; if (r.findings.length) cleanWithFindings++; }
    rows.push(row);
  }

  const sum = (k: "expected" | "hit" | "found" | "tp" | "foundHigh" | "tpHigh") => Object.values(perCat).reduce((a, x) => a + x[k], 0);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
  const summary = {
    mode: ai ? "rules+ai" : "rules-only", ai_model: ai?.model ?? null, reasoning_effort: ai ? effort(process.env.AZURE_REASONING_EFFORT) ?? "default" : null, today: TODAY, cases: cases.length,
    expected: sum("expected"), found: sum("found"),
    recall_pct: pct(sum("hit"), sum("expected")),
    precision_pct: pct(sum("tp"), sum("found")),
    precision_high_confidence_pct: pct(sum("tpHigh"), sum("foundHigh")),
    codename_recall_pct: pct(...leak.codename),
    internal_fact_recall_pct: pct(...leak.internalFact),
    clean_cases: cleanCases, clean_cases_with_findings: cleanWithFindings, ai_not_real: aiFailed,
    by_category: Object.fromEntries(Object.entries(perCat).map(([k, v]) => [k, { expected: v.expected, recall_pct: pct(v.hit, v.expected), found: v.found, precision_pct: pct(v.tp, v.found) }])),
  };

  mkdirSync("eval/results", { recursive: true });
  // a run with a non-default reasoning effort is written beside the default one, never over it
  const file = `eval/results/${summary.mode}${summary.reasoning_effort && summary.reasoning_effort !== "default" ? `-effort-${summary.reasoning_effort}` : ""}.json`;
  writeFileSync(file, JSON.stringify({ summary, cases: rows }, null, 2) + "\n");

  console.log(`\nINKLOOM eval (${summary.mode}${ai ? `, ${ai.model}` : ""}), ${cases.length} cases, today = ${TODAY}\n`);
  console.table(Object.fromEntries(Object.entries(summary.by_category).map(([k, v]) => [k, { expected: v.expected, "recall %": v.recall_pct, found: v.found, "precision %": v.precision_pct }])));
  console.log(`Recall ${summary.recall_pct}%  |  Precision ${summary.precision_pct}% (high confidence only: ${summary.precision_high_confidence_pct}%)`);
  console.log(`Seeded internal codenames found: ${summary.codename_recall_pct}% (target 100%)  |  internal facts found: ${summary.internal_fact_recall_pct}%`);
  console.log(`Clean cases with a finding: ${cleanWithFindings} of ${cleanCases}${ai ? `  |  AI not real on ${aiFailed} cases` : ""}`);
  console.log(`Details: ${file}`);
  if ((summary.codename_recall_pct ?? 100) < 100) { console.error("FAIL: a seeded codename was missed"); process.exit(1); }
}

main().catch((e) => { console.error(e); process.exit(2); });
