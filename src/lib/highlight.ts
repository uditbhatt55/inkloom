export type Span = { id: string; start: number | null; end: number | null };
export type Segment = { text: string; ids: string[] };

/**
 * Splits text into segments for highlighting. Each segment lists every finding whose span covers it, so overlapping
 * findings stay visible. Spans outside the text, empty, reversed or null (image/document-level findings) are ignored.
 */
export function segmentText(text: string, spans: Span[]): Segment[] {
  const valid = spans.filter((s): s is { id: string; start: number; end: number } =>
    s.start !== null && s.end !== null && s.start >= 0 && s.end <= text.length && s.start < s.end);
  if (!valid.length) return text ? [{ text, ids: [] }] : [];
  const cuts = [...new Set([0, text.length, ...valid.flatMap((s) => [s.start, s.end])])].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const [a, b] = [cuts[i], cuts[i + 1]];
    const ids = valid.filter((s) => s.start <= a && s.end >= b).map((s) => s.id);
    const prev = out[out.length - 1];
    if (prev && prev.ids.join() === ids.join()) prev.text += text.slice(a, b);
    else out.push({ text: text.slice(a, b), ids });
  }
  return out;
}

const RANK: Record<string, number> = { critical: 0, major: 1, minor: 2, info: 3 };
/** Most severe first, then by position in the text; document-level findings (no span) last within a severity. */
export function bySeverity<T extends { severity: string; start_offset: number | null }>(a: T, b: T): number {
  return (RANK[a.severity] ?? 9) - (RANK[b.severity] ?? 9) || (a.start_offset ?? Infinity) - (b.start_offset ?? Infinity);
}
