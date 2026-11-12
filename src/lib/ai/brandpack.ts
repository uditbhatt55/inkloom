import type { KnownCodes } from "@/lib/validator/validator";
import type { Term } from "@/lib/rules/terms";

export type Knowledge = {
  clauses: { code: string; category: string; text: string; status: string }[];
  facts: { code: string; statement: string; validFrom: string | null; validUntil: string | null; visibility: "public" | "internal" }[];
  terms: Term[];
  /** brand_assets rows: palette colours and approved fonts feed the visual checks (never sent to the model) */
  assets?: { type: "color" | "font" | "logo"; name: string; hex: string | null; fontName: string | null }[];
  /** rule-pack codes (PACK-*) this organisation has switched off */
  disabledPackRules?: string[];
};

/**
 * The brand pack is the ONLY organisation knowledge the model sees (proposal §7.2, §10.1):
 * active clauses, public facts valid today, preferred/banned terms. Internal facts and internal terms never go in.
 * Sorted by code so the text is a stable, cacheable prefix. Returns the set of codes the model may cite.
 */
export function buildBrandPack(k: Knowledge, today: string): { text: string; known: KnownCodes } {
  const byCode = <T extends { code: string }>(a: T, b: T) => a.code.localeCompare(b.code);
  const clauses = k.clauses.filter((c) => c.status === "active").sort(byCode);
  const facts = k.facts
    .filter((f) => f.visibility === "public" && (!f.validFrom || f.validFrom <= today) && (!f.validUntil || f.validUntil >= today))
    .sort(byCode);
  const terms = k.terms.filter((t) => t.kind !== "internal").sort(byCode);

  const text = [
    "CLAUSES",
    ...clauses.map((c) => `[${c.code}] (${c.category}) ${c.text}`),
    "",
    "APPROVED FACTS",
    ...facts.map((f) => `[${f.code}] ${f.statement}${f.validUntil ? ` (valid until ${f.validUntil})` : ""}`),
    "",
    "TERMS",
    ...terms.map((t) => `[${t.code}] ${t.kind}: "${t.term}"${t.replacement ? ` -> use "${t.replacement}"` : ""}`),
  ].join("\n");

  return {
    text,
    known: { clauses: new Set(clauses.map((c) => c.code)), facts: new Set(facts.map((f) => f.code)), terms: new Set(terms.map((t) => t.code)) },
  };
}
