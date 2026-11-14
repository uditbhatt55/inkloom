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
 * Returns the ISO date string for today (YYYY-MM-DD).
 * Pure; caller may inject a fixed date for testing.
 */
export function todayISO(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

