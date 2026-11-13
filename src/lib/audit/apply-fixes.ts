/** The fields a fix needs from a stored finding (proposal §8.2: "creator revises → new immutable version → re-audit"). */
export type FixCandidate = {
  id: string;
  status: string;
  suggestion: string | null;
  quote: string;
  start_offset: number | null;
  end_offset: number | null;
};

export type ApplyFixesResult = {
  /** the new text; equal to the input when nothing could be applied */
  text: string;
  /** ids of findings whose suggestion was applied, in the order they appear in the text */
  applied: string[];
  /** ids skipped, with a short reason (shown to the creator before they confirm) */
  skipped: { id: string; reason: string }[];
};

/**
 * Builds the next version's text by applying every **accepted** finding's minimal fix (decision: only `accepted`
 * findings are applied; `open`, `rejected`, `dismissed` and `waived` findings are left for the creator to handle by
 * hand). Pure: no DB, no network. Mirrors the evidence validator's own rule that a fix changes only its quoted span
 * (§7.3) — applied here in reverse text order so earlier offsets stay valid while later ones are replaced.
 */
export function applyAcceptedFixes(text: string, findings: FixCandidate[]): ApplyFixesResult {
  const skipped: ApplyFixesResult["skipped"] = [];
  const candidates = findings.filter((f) => {
    if (f.status !== "accepted") return false;
    if (!f.suggestion || !f.suggestion.trim()) {
      skipped.push({ id: f.id, reason: "No suggested fix on this finding." });
      return false;
    }
    if (f.start_offset === null || f.end_offset === null) {
      skipped.push({ id: f.id, reason: "This finding is about the whole file, not a span of text." });
      return false;
    }
    if (f.start_offset < 0 || f.end_offset > text.length || f.start_offset >= f.end_offset) {
      skipped.push({ id: f.id, reason: "This finding's position no longer matches the content." });
      return false;
    }
    if (text.slice(f.start_offset, f.end_offset) !== f.quote) {
      skipped.push({ id: f.id, reason: "The quoted text has changed since this fix was accepted." });
      return false;
    }
    return true;
  }) as (FixCandidate & { start_offset: number; end_offset: number })[];

  candidates.sort((a, b) => a.start_offset - b.start_offset);

  // non-overlapping only: once a span is taken, a later fix that reaches back into it is skipped, not corrupted
  const kept: typeof candidates = [];
  let coveredTo = -1;
  for (const f of candidates) {
    if (f.start_offset < coveredTo) {
      skipped.push({ id: f.id, reason: "Overlaps another accepted fix; apply it after a re-audit." });
      continue;
    }
    kept.push(f);
    coveredTo = f.end_offset;
  }

  let out = text;
  for (let i = kept.length - 1; i >= 0; i--) {
    const f = kept[i];
    out = out.slice(0, f.start_offset) + f.suggestion!.trim() + out.slice(f.end_offset);
  }

  return { text: out, applied: kept.map((f) => f.id), skipped };
}
