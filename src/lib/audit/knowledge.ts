import type { Knowledge } from "@/lib/ai/brandpack";
import type { Database } from "@/lib/database.types";

type T = Database["public"]["Tables"];
export type KnowledgeRows = {
  clauses: Pick<T["guideline_clauses"]["Row"], "code" | "category" | "text" | "status">[];
  facts: Pick<T["approved_facts"]["Row"], "code" | "statement" | "valid_from" | "valid_until" | "visibility">[];
  terms: Pick<T["terminology"]["Row"], "code" | "term" | "kind" | "replacement">[];
  assets: Pick<T["brand_assets"]["Row"], "type" | "name" | "hex" | "font_name">[];
};

/** Database rows → the Knowledge the pipeline uses. Pure. Internal facts/terms are kept: the Confidential Guard needs them. */
export function rowsToKnowledge(r: KnowledgeRows): Knowledge {
  return {
    clauses: r.clauses.map((c) => ({ code: c.code, category: c.category, text: c.text, status: c.status })),
    facts: r.facts.map((f) => ({ code: f.code, statement: f.statement, validFrom: f.valid_from, validUntil: f.valid_until, visibility: f.visibility })),
    terms: r.terms.map((t) => ({ code: t.code, term: t.term, kind: t.kind, replacement: t.replacement })),
    assets: r.assets
      .filter((a): a is typeof a & { type: "color" | "font" | "logo" } => ["color", "font", "logo"].includes(a.type))
      .map((a) => ({ type: a.type, name: a.name, hex: a.hex, fontName: a.font_name })),
  };
}
