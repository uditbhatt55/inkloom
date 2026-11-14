import type { Database } from "@/lib/database.types";

type E = Database["public"]["Enums"];

/**
 * Suggests the next free code for a given prefix by finding the highest existing
 * numeric suffix and incrementing it. E.g. prefix "CLAIM", existing ["CLAIM-01","CLAIM-02"] => "CLAIM-03".
 * Pure: no DB calls. Caller passes the existing codes for that prefix.
 */
export function nextCode(prefix: string, existingCodes: string[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const code of existingCodes) {
    const m = code.match(pattern);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > max) max = n;
    }
  }
  return `${prefix}-${String(max + 1).padStart(2, "0")}`;
}

/**
 * Maps a finding_category to the guideline code prefix (e.g. "claim" => "CLAIM").
 */
export const CATEGORY_PREFIX: Record<E["finding_category"], string> = {
  claim: "CLAIM",
  tone: "TONE",
  messaging: "MSG",
  accessibility: "ACC",
  visual: "VIS",
  terminology: "TERM",
  factual: "FACT",
  confidentiality: "CONF",
};

/**
 * Checks whether a date range is valid: validFrom and validUntil must both be
 * present if either is, and validUntil must not be before validFrom.
 */
export function validateDateRange(
  validFrom: string | null | undefined,
  validUntil: string | null | undefined
): { valid: boolean; message?: string } {
  if (!validFrom && !validUntil) return { valid: true };
  if (validFrom && validUntil && validUntil < validFrom) {
    return { valid: false, message: '"Valid until" must not be before "Valid from".' };
  }
  return { valid: true };
}

/**
 * Checks that a hex colour is a valid #RRGGBB string (the DB enforces the same pattern).
 */
export function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

/**
 * Returns a warning message when a banned term has no replacement set.
 * Returns null when no warning is needed.
 */
export function bannedTermWarning(kind: string, replacement: string | null | undefined): string | null {
  if (kind === "banned" && (!replacement || replacement.trim() === "")) {
    return 'Banned terms should have a replacement so reviewers know what to use instead.';
  }
  return null;
}

/**
 * Returns true when a fact is currently expired (valid_until is in the past relative to today).
 */
export function isFactExpired(validUntil: string | null | undefined, today: string): boolean {
  if (!validUntil) return false;
  return validUntil < today;
}

/**
 * Today as YYYY-MM-DD in India time, the same day the audit uses for fact expiry (decision D10), so the
 * "Expired" badge here and the expired-fact finding agree. Pure; inject `now` in tests.
 */
export function todayISO(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
}


/** Code prefix for terms imported from a Vale file: "Brand.Terms.yml" => "VALE-BRAND-TERMS" (codes stay unique per file). */
export function valePrefix(fileName: string): string {
  const stem = fileName.replace(/\.[^.]*$/, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
  return stem ? `VALE-${stem}` : "VALE";
}

type ImportTerm = { code: string; term: string; kind: string; replacement: string | null };

/**
 * Which imported terms are new. A term already in the knowledge base (same words, any case or spacing) or a code that
 * already exists is skipped, so importing the same file twice adds nothing.
 */
export function planTermImport(imported: ImportTerm[], existing: { code: string; term: string }[]) {
  const norm = (t: string) => t.trim().toLowerCase().replace(/[\s\-_]+/g, " ");
  const terms = new Set(existing.map((e) => norm(e.term)));
  const codes = new Set(existing.map((e) => e.code));
  const toAdd: ImportTerm[] = [];
  const skipped: { term: string; reason: string }[] = [];
  for (const t of imported) {
    if (terms.has(norm(t.term))) skipped.push({ term: t.term, reason: "already in the knowledge base" });
    else if (codes.has(t.code)) skipped.push({ term: t.term, reason: `code ${t.code} already used` });
    else {
      toAdd.push(t);
      terms.add(norm(t.term));
      codes.add(t.code);
    }
  }
  return { toAdd, skipped };
}
