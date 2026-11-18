/**
 * Coverage signal (Round 3, improvement 1): what an audit run actually checked, and what it skipped, read from what the
 * run already records (its mode and warnings) and the version it audited. A run that skipped something is "partial", and
 * the page never shows a partial run with no findings as a clean pass.
 */
export type CheckStatus = "done" | "skipped" | "not_needed";
export type Coverage = {
  checks: { name: string; status: CheckStatus; note?: string }[];
  blocks: number; chars: number; truncated: boolean;
  partial: boolean;
};

export function coverageOf(run: { mode: string; warnings: string[] }, version: { text: string | null; file_type?: string | null }, audience: string): Coverage {
  const text = version.text ?? "";
  const w = run.warnings.join(" ");
  const truncated = /Only the first [\d,]+ characters were audited/.test(w);
  const aiDone = run.mode === "real" || run.mode === "simulated";
  const aiWhy = /daily AI limit/.test(w) ? "the daily AI limit was reached"
    : /time|timed out|budget/i.test(w) && /AI/.test(w) ? "the AI ran out of time"
    : /AI review failed|refus|filter/i.test(w) ? "the AI service failed or refused the request"
    : "AI review is switched off";
  const fromFile = !!version.file_type || run.warnings.some((x) => /page|hidden from readers/.test(x));
  const skippedContrast = /Skipped contrast check/.test(w);

  const checks: Coverage["checks"] = [
    audience === "public"
      ? { name: "Confidential Guard: internal terms and facts, secrets, hidden text", status: "done" }
      : { name: "Confidential Guard", status: "not_needed", note: "internal audience" },
    { name: "Terminology, expired facts, wording rules, readability", status: "done" },
    fromFile
      ? { name: "Images, fonts and colours", status: skippedContrast ? "skipped" : "done", note: skippedContrast ? "a contrast pair had an invalid colour" : undefined }
      : { name: "Images, fonts and colours", status: "not_needed", note: "pasted text has none" },
    aiDone
      ? { name: "AI judgement: claims, tone, messaging", status: "done", note: run.mode === "simulated" ? "simulated" : undefined }
      : { name: "AI judgement: claims, tone, messaging", status: "skipped", note: aiWhy },
  ];
  return {
    checks,
    blocks: text.split(/\n+/).filter((l) => l.trim()).length,
    chars: text.length,
    truncated,
    partial: truncated || checks.some((c) => c.status === "skipped"),
  };
}
