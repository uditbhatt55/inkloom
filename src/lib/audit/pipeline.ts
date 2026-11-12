import type { Finding } from "@/lib/audit/types";
import { AiOutputSchema } from "@/lib/ai/schema";
import { buildBrandPack, type Knowledge } from "@/lib/ai/brandpack";
import { buildMessages, PROMPT_VERSION } from "@/lib/ai/prompt";
import type { AiReviewer } from "@/lib/ai/reviewer";
import { findLeaks, maskForAi, type InternalTerm } from "@/lib/guard/guard";
import { contrastFinding } from "@/lib/rules/contrast";
import { checkExpiredFacts } from "@/lib/rules/facts";
import { checkTerms } from "@/lib/rules/terms";
import { computeScore, type ScoreResult } from "@/lib/score/score";
import { mergeFindings, validateAiFindings, type Rejected } from "@/lib/validator/validator";
import type { Confidence } from "@/lib/audit/types";

export type ContrastCheck = { fg: string; bg: string; label: string; large?: boolean; confidence: Confidence };
/** real/simulated = AI ran; skipped = no AI (rule-only mode, or demo without a recording); failed = AI error, rule-only results returned */
export type AiMode = "real" | "simulated" | "skipped" | "failed";

export type AuditInput = {
  content: string; channel: string; audience: "public" | "internal"; today: string; knowledge: Knowledge;
  colours?: ContrastCheck[]; ai: AiReviewer | null; timeoutMs?: number;
};
export type AuditResult = {
  findings: Finding[]; score: ScoreResult; aiMode: AiMode; model: string | null; promptVersion: string;
  rejected: Rejected[]; warnings: string[];
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
  ];
  for (const c of input.colours ?? []) {
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
      for (let attempt = 0; attempt < 2 && !output; attempt++) { // invalid output is retried once (§7.2)
        const raw = await withTimeout(ai.review({ messages, content }), input.timeoutMs ?? 30_000);
        if (raw === null) { noRecording = true; break; }
        const parsed = AiOutputSchema.safeParse(raw);
        if (parsed.success) output = parsed.data;
      }

      if (noRecording) {
        warnings.push("AI judgement checks were skipped.");
      } else if (!output) {
        aiMode = "failed";
        warnings.push("The AI returned invalid output twice; showing rule-based results only.");
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
    promptVersion: PROMPT_VERSION, rejected, warnings,
  };
}
