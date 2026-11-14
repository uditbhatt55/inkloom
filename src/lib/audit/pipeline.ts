import type { Finding } from "@/lib/audit/types";
import { AiOutputSchema } from "@/lib/ai/schema";
import { buildBrandPack, type Knowledge } from "@/lib/ai/brandpack";
import { buildMessages, PROMPT_VERSION } from "@/lib/ai/prompt";
import type { AiReviewer } from "@/lib/ai/reviewer";
import { findLeaks, maskForAi, type InternalTerm } from "@/lib/guard/guard";
import { contrastFinding, contrastRatio } from "@/lib/rules/contrast";
import { checkExpiredFacts, linkFacts } from "@/lib/rules/facts";
import { checkRulePack } from "@/lib/rules/rulepack";
import { checkTerms } from "@/lib/rules/terms";
import { checkAltText, checkFonts, checkPalette, checkReadability, type ImageColour, type ImageRef } from "@/lib/rules/visual";
import { computeScore, type ScoreResult } from "@/lib/score/score";
import { mergeFindings, validateAiFindings, type Rejected } from "@/lib/validator/validator";
import type { Confidence } from "@/lib/audit/types";

export type ContrastCheck = { fg: string; bg: string; label: string; large?: boolean; confidence: Confidence };
/** real/simulated = AI ran; skipped = no AI (rule-only mode, or demo without a recording); failed = AI error, rule-only results returned */
export type AiMode = "real" | "simulated" | "skipped" | "failed";

export type AuditInput = {
  content: string; channel: string; audience: "public" | "internal"; today: string; knowledge: Knowledge;
  colours?: ContrastCheck[]; ai: AiReviewer | null;
  /** TOTAL time the AI may take, retry included; default AI_BUDGET_MS. Must fit inside the route's maxDuration. */
  timeoutMs?: number;
  /** what the parser found besides text (src/lib/parsers): fonts, images with alt text, dominant colours */
  parsed?: { fonts: string[]; images: ImageRef[]; colours: ImageColour[] };
  /** Flesch–Kincaid target for this channel; default 12 */
  maxReadingGrade?: number;
};

/**
 * Decision D4: with no colours typed on the upload form, check the lowest-contrast pair among the image's
 * three most common colours, at medium confidence (it may not be a text/background pair).
 */
function extractedContrast(colours: ImageColour[]): ContrastCheck | null {
  const top = colours.slice(0, 3);
  let worst: ContrastCheck | null = null, worstRatio = Infinity;
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const r = contrastRatio(top[i].hex, top[j].hex);
      if (r < worstRatio) { worstRatio = r; worst = { fg: top[j].hex, bg: top[i].hex, label: "Image (extracted colours)", confidence: "medium" }; }
    }
  }
  return worst;
}
/**
 * The AI gets one time budget for the whole audit, retry included. Routes run with maxDuration = 60 s on Vercel; 45 s
 * for the model leaves time to parse the upload and save the run, so a slow model ends in rule-only results, never a
 * 504 (§9.1). gpt-6-luna can need more than 25 s, so the budget is not split evenly: the first attempt may use all of it.
 */
export const AI_BUDGET_MS = 45_000;
/** A retry after invalid output only starts if at least this much of the budget is left. */
const MIN_RETRY_MS = 10_000;

export type AuditResult = {
  findings: Finding[]; score: ScoreResult; aiMode: AiMode; model: string | null; promptVersion: string;
  rejected: Rejected[]; warnings: string[];
  /** facts this content restates (fact-impact links, Brand Health) */
  factLinks: { code: string; quote: string }[];
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`AI review timed out after ${ms} ms`)), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

/**
 * Proposal §7: deterministic checks always run; AI is optional. Any AI problem (HTTP error, timeout, invalid JSON twice)
 * degrades to rule-only results with aiMode "failed", never to an error or an empty screen (§9.1).
 */
export async function runAudit(input: AuditInput): Promise<AuditResult> {
  const { content, knowledge, today } = input;
  const warnings: string[] = [];
  const internalTerms: InternalTerm[] = knowledge.terms.filter((t) => t.kind === "internal").map((t) => ({ code: t.code, term: t.term }));

  // 1. deterministic checks (Confidential Guard only for public content)
  const ruleFindings: Finding[] = [
    ...(input.audience === "public" ? findLeaks(content, internalTerms) : []),
    ...checkTerms(content, knowledge.terms),
    ...checkExpiredFacts(content, knowledge.facts.map((f) => ({ code: f.code, statement: f.statement, validUntil: f.validUntil })), today),
    ...checkRulePack(content, undefined, new Set(knowledge.disabledPackRules ?? [])),
    ...checkReadability(content, input.maxReadingGrade),
  ];
  const assets = knowledge.assets ?? [];
  const parsed = input.parsed;
  if (parsed) {
    ruleFindings.push(...checkAltText(parsed.images));
    ruleFindings.push(...checkFonts(parsed.fonts, assets.filter((a) => a.type === "font").map((a) => ({ name: a.fontName || a.name }))));
    ruleFindings.push(...checkPalette(parsed.colours, assets.filter((a) => a.type === "color" && a.hex).map((a) => ({ name: a.name, hex: a.hex! }))));
  }
  const contrastChecks = input.colours?.length ? input.colours : parsed?.colours.length ? [extractedContrast(parsed.colours)].filter((c): c is ContrastCheck => !!c) : [];
  for (const c of contrastChecks) {
    try {
      const f = contrastFinding(c);
      if (f) ruleFindings.push(f);
    } catch {
      warnings.push(`Skipped contrast check "${c.label}": invalid colour value.`);
    }
  }

  // 2. AI review, with internal terms and personal data masked first
  let aiMode: AiMode = "skipped";
  let aiFindings: Finding[] = [];
  let rejected: Rejected[] = [];
  const ai = input.ai;
  if (ai) {
    try {
      const masked = maskForAi(content, internalTerms);
      const pack = buildBrandPack(knowledge, today);
      const messages = buildMessages({ brandPack: pack.text, channel: input.channel, audience: input.audience, content: masked });

      let output: ReturnType<typeof AiOutputSchema.parse> | null = null;
      let noRecording = false;
      let outOfTime = false;
      const budget = input.timeoutMs ?? AI_BUDGET_MS;
      const deadline = Date.now() + budget;
      for (let attempt = 0; attempt < 2 && !output; attempt++) { // invalid output is retried once (§7.2), if time allows
        const left = deadline - Date.now();
        if (attempt > 0 && left < Math.min(MIN_RETRY_MS, budget / 3)) { outOfTime = true; break; }
        const raw = await withTimeout(ai.review({ messages, content }), left);
        if (raw === null) { noRecording = true; break; }
        const parsed = AiOutputSchema.safeParse(raw);
        if (parsed.success) output = parsed.data;
      }

      if (noRecording) {
        warnings.push("AI judgement checks were skipped.");
      } else if (!output) {
        aiMode = "failed";
        warnings.push(outOfTime
          ? "The AI returned invalid output and there was no time to retry; showing rule-based results only."
          : "The AI returned invalid output twice; showing rule-based results only.");
      } else {
        const usable = output.findings.filter((f) => !/^\*+$/.test(f.quote.trim())); // a quote that is only masked text is unverifiable
        rejected = output.findings.filter((f) => !usable.includes(f)).map((raw) => ({ raw, reason: "quote is masked text" }));
        const v = validateAiFindings(usable, masked, pack.known);
        rejected = [...rejected, ...v.rejected];
        // masked text has the same length, so offsets map straight back to the original quote
        aiFindings = v.accepted.map((f) => ({ ...f, quote: content.slice(f.start, f.end) }));
        aiMode = ai.mode;
      }
    } catch (e) {
      aiMode = "failed";
      warnings.push(`AI review failed (${e instanceof Error ? e.message : "unknown error"}); showing rule-based results only.`);
    }
  } else {
    warnings.push("AI judgement checks were skipped.");
  }

  const findings = mergeFindings(ruleFindings, aiFindings);
  return {
    findings, score: computeScore(findings), aiMode, model: aiMode === "real" || aiMode === "simulated" ? ai!.model : null,
    promptVersion: PROMPT_VERSION, rejected, warnings, factLinks: linkFacts(content, knowledge.facts),
  };
}
