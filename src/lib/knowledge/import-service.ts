import { chooseAiJson, type AiJson } from "@/lib/ai/json";
import { sha256 } from "@/lib/ai/reviewer";
import brandbookImport from "@/lib/ai/recordings/brandbook-import.json";
import { AI_BUDGET_MS } from "@/lib/audit/pipeline";
import type { AiEnv } from "@/lib/ai/select";
import { buildDraft, buildImportMessages, IMPORT_JSON_SCHEMA, IMPORT_PROMPT_VERSION, type Draft, type Existing } from "@/lib/knowledge/import";
import type { ParsedContent } from "@/lib/parsers/types";

/** Recorded model answers for demo mode (§7.6), keyed by the sha256 of the document text the parser produced. */
const RECORDINGS: Record<string, unknown> = { [sha256(brandbookImport.content)]: brandbookImport.response };

export type Importer = { mode: "real" | "simulated"; model: string; draft(documentText: string): Promise<unknown | null> };

/** Real model when demo mode is off and Azure is configured (same rule as audits); otherwise the recordings. */
export function chooseImporter(env: AiEnv = process.env as AiEnv, ai: AiJson | null = chooseAiJson(env)): Importer {
  if (ai) {
    return {
      mode: "real", model: ai.model,
      draft: (text) => ai.call({ messages: buildImportMessages(text), name: "brand_book_draft", schema: IMPORT_JSON_SCHEMA }),
    };
  }
  return { mode: "simulated", model: "simulated", draft: async (text) => RECORDINGS[sha256(text)] ?? null };
}

export type ImportResult = {
  mode: "real" | "simulated" | "skipped" | "failed"; model: string | null; promptVersion: string;
  pages: number | null; draft: Draft; dropped: string[]; warnings: string[];
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error("timeout")), ms); });
  return Promise.race([p, timeout]).finally(() => clearTimeout(t));
}

/**
 * One brand book → a draft for the owner to review. Never throws for AI problems: a timeout or a bad answer gives an
 * empty draft with a note, so the owner can still add rules by hand. Nothing is saved here.
 */
export async function draftBrandBook(parsed: ParsedContent, existing: Existing, importer: Importer, budgetMs = AI_BUDGET_MS): Promise<ImportResult> {
  const base = { model: null, promptVersion: IMPORT_PROMPT_VERSION, pages: parsed.meta.pages ?? null, warnings: [...parsed.warnings] };
  const empty: Draft = { clauses: [], terms: [], colours: [] };
  if (!parsed.text.trim()) return { ...base, mode: "skipped", draft: empty, dropped: [], warnings: [...base.warnings, "The document has no text to read."] };
  let raw: unknown;
  try {
    raw = await withTimeout(importer.draft(parsed.text), budgetMs);
  } catch {
    return { ...base, mode: "failed", draft: empty, dropped: [], warnings: [...base.warnings, "The AI did not answer in time. Try again, or add the rules by hand."] };
  }
  if (raw === null) {
    return { ...base, mode: "skipped", draft: empty, dropped: [], warnings: [...base.warnings, "AI is off on this server (demo mode) and there is no recorded draft for this file. Try the sample brand book, or add the rules by hand."] };
  }
  const { draft, dropped } = buildDraft(raw, parsed.text, parsed.meta.pageStarts, existing);
  return { ...base, mode: importer.mode, model: importer.model, draft, dropped };
}
