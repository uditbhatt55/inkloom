"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORIES, type Category } from "@/lib/audit/types";
import { assignCodes, type DraftClause, type DraftColour, type DraftTerm, type TermKind } from "@/lib/knowledge/import";
import type { ImportResult } from "@/lib/knowledge/import-service";
import { isValidHex } from "@/lib/knowledge/helpers";
import { friendlyDbError } from "@/lib/review/errors";
import { attachFile } from "@/lib/storage/stage-upload";
import { createClient } from "@/lib/supabase/browser";

type Kept<T> = T & { keep: boolean };
const selectClass = "h-8 rounded-md border border-input bg-transparent px-2 text-sm";
const MODE_LABEL: Record<ImportResult["mode"], string> = { real: "AI draft", simulated: "Simulated draft (demo mode)", skipped: "No draft", failed: "No draft" };

/**
 * P2b: import a brand book. The AI only drafts; the owner edits, keeps or discards each item, and only kept items are
 * saved (under RLS, with codes from nextCode). Items already in the knowledge base start unticked.
 */
export function ImportTab({ orgId, existingCodes }: { orgId: string; existingCodes: string[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [clauses, setClauses] = useState<Kept<DraftClause>[]>([]);
  const [terms, setTerms] = useState<Kept<DraftTerm>[]>([]);
  const [colours, setColours] = useState<Kept<DraftColour>[]>([]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    setResult(null);
    const fd = new FormData();
    fd.set("orgId", orgId);
    try {
      await attachFile(fd, file);
      const res = await fetch("/api/knowledge/import", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof body.error === "string" ? body.error : "The brand book could not be read.");
      const r = body as ImportResult;
      setResult(r);
      setClauses(r.draft.clauses.map((c) => ({ ...c, keep: !c.duplicate })));
      setTerms(r.draft.terms.map((t) => ({ ...t, keep: !t.duplicate })));
      setColours(r.draft.colours.map((c) => ({ ...c, keep: !c.duplicate })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "The brand book could not be read.");
    } finally {
      setBusy(false);
    }
  }

  const kept = { clauses: clauses.filter((c) => c.keep && c.text.trim()), terms: terms.filter((t) => t.keep && t.term.trim()), colours: colours.filter((c) => c.keep && isValidHex(c.hex.trim()) && c.name.trim()) };
  const total = kept.clauses.length + kept.terms.length + kept.colours.length;

  async function save() {
    const supabase = createClient();
    if (!supabase || !total) return;
    setBusy(true);
    setError(null);
    const { clauseCodes, termCodes } = assignCodes(kept.clauses, kept.terms, existingCodes);
    const steps = [
      kept.clauses.length && supabase.from("guideline_clauses").insert(kept.clauses.map((c, i) => ({ org_id: orgId, code: clauseCodes[i], category: c.category, text: c.text.trim(), status: "active", source_page: c.page }))),
      kept.terms.length && supabase.from("terminology").insert(kept.terms.map((t, i) => ({ org_id: orgId, code: termCodes[i], term: t.term.trim(), kind: t.kind, replacement: t.kind === "banned" ? t.replacement?.trim() || null : null, owner_name: "Brand book import" }))),
      kept.colours.length && supabase.from("brand_assets").insert(kept.colours.map((c) => ({ org_id: orgId, type: "color", name: c.name.trim(), hex: c.hex.trim().toUpperCase(), rules: c.page ? `From the brand book, page ${c.page}` : null }))),
    ];
    for (const step of steps) {
      if (!step) continue;
      const { error: err } = await step;
      if (err) {
        setBusy(false);
        return setError(err.code === "23505" ? "Some codes were taken while you were reviewing. Reload the page and import again." : friendlyDbError(err));
      }
    }
    setBusy(false);
    setSaved(`Saved ${kept.clauses.length} guideline${kept.clauses.length === 1 ? "" : "s"}, ${kept.terms.length} term${kept.terms.length === 1 ? "" : "s"} and ${kept.colours.length} colour${kept.colours.length === 1 ? "" : "s"}.`);
    setResult(null);
    startTransition(() => router.refresh());
  }

  const source = (x: { quote: string; page: number | null; duplicate: boolean }) => (
    <p className="text-xs text-muted-foreground">
      {x.page ? `Page ${x.page}: ` : ""}&ldquo;{x.quote}&rdquo;{x.duplicate && <Badge variant="secondary" className="ml-2 text-[10px]">Already in your knowledge base</Badge>}
    </p>
  );
  const keepBox = (label: string, checked: boolean, onChange: (v: boolean) => void) => (
    <input type="checkbox" aria-label={label} className="mt-1.5 h-4 w-4" checked={checked} onChange={(e) => onChange(e.target.checked)} />
  );

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-lg border bg-background p-4">
        <Label htmlFor="brandbook-file" className="text-base font-medium">Import a brand book</Label>
        <p className="text-sm text-muted-foreground">
          Upload your brand book (PDF or Word). The AI drafts guidelines, terms and colours, each with the passage and page it came from.
          Nothing is saved until you choose what to keep.
        </p>
        <Input id="brandbook-file" type="file" accept=".pdf,.docx,.txt" onChange={onFile} disabled={busy} className="max-w-sm" />
        <p className="text-xs text-muted-foreground">
          When AI is on, the document text is sent to our Azure AI Foundry deployment to draft the rules. Try the sample: <code>seed/northbeam/brandbook.pdf</code>.
        </p>
      </div>

      {busy && <p role="status" className="text-sm text-muted-foreground">Reading the brand book…</p>}
      {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
      {saved && <Alert role="status"><AlertDescription>{saved}</AlertDescription></Alert>}

      {result && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="outline">{MODE_LABEL[result.mode]}</Badge>
            {result.model && result.mode === "real" && <span className="text-muted-foreground">model {result.model}</span>}
            {result.pages && <span className="text-muted-foreground">{result.pages} pages read</span>}
          </div>
          {[...result.warnings, ...result.dropped.map((d) => `Not drafted: ${d}.`)].length > 0 && (
            <Alert><AlertDescription><ul className="list-disc pl-4">{[...result.warnings, ...result.dropped.map((d) => `Not drafted: ${d}.`)].map((w) => <li key={w}>{w}</li>)}</ul></AlertDescription></Alert>
          )}

          {clauses.length > 0 && (
            <section aria-labelledby="draft-clauses" className="space-y-2">
              <h2 id="draft-clauses" className="font-medium">Guidelines ({clauses.filter((c) => c.keep).length} of {clauses.length} kept)</h2>
              {clauses.map((c, i) => (
                <div key={c.id} className="flex gap-3 rounded-md border bg-background p-3">
                  {keepBox(`Keep guideline ${i + 1}`, c.keep, (keep) => setClauses(clauses.map((x) => (x.id === c.id ? { ...x, keep } : x))))}
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap gap-2">
                      <select aria-label={`Category of guideline ${i + 1}`} className={selectClass} value={c.category} onChange={(e) => setClauses(clauses.map((x) => (x.id === c.id ? { ...x, category: e.target.value as Category } : x)))}>
                        {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                      </select>
                      <Input aria-label={`Text of guideline ${i + 1}`} value={c.text} maxLength={1000} className="h-8 flex-1" onChange={(e) => setClauses(clauses.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))} />
                    </div>
                    {source(c)}
                  </div>
                </div>
              ))}
            </section>
          )}

          {terms.length > 0 && (
            <section aria-labelledby="draft-terms" className="space-y-2">
              <h2 id="draft-terms" className="font-medium">Terms ({terms.filter((t) => t.keep).length} of {terms.length} kept)</h2>
              {terms.map((t, i) => (
                <div key={t.id} className="flex gap-3 rounded-md border bg-background p-3">
                  {keepBox(`Keep term ${i + 1}`, t.keep, (keep) => setTerms(terms.map((x) => (x.id === t.id ? { ...x, keep } : x))))}
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap gap-2">
                      <Input aria-label={`Term ${i + 1}`} value={t.term} maxLength={200} className="h-8 w-48" onChange={(e) => setTerms(terms.map((x) => (x.id === t.id ? { ...x, term: e.target.value } : x)))} />
                      <select aria-label={`Kind of term ${i + 1}`} className={selectClass} value={t.kind} onChange={(e) => setTerms(terms.map((x) => (x.id === t.id ? { ...x, kind: e.target.value as TermKind } : x)))}>
                        <option value="preferred">Preferred</option>
                        <option value="banned">Banned</option>
                        <option value="internal">Internal (confidential)</option>
                      </select>
                      {t.kind === "banned" && (
                        <Input aria-label={`Use instead of term ${i + 1}`} placeholder="Use instead" value={t.replacement ?? ""} maxLength={200} className="h-8 w-48" onChange={(e) => setTerms(terms.map((x) => (x.id === t.id ? { ...x, replacement: e.target.value } : x)))} />
                      )}
                    </div>
                    {source(t)}
                  </div>
                </div>
              ))}
            </section>
          )}

          {colours.length > 0 && (
            <section aria-labelledby="draft-colours" className="space-y-2">
              <h2 id="draft-colours" className="font-medium">Colours ({colours.filter((c) => c.keep).length} of {colours.length} kept)</h2>
              {colours.map((c, i) => (
                <div key={c.id} className="flex gap-3 rounded-md border bg-background p-3">
                  {keepBox(`Keep colour ${i + 1}`, c.keep, (keep) => setColours(colours.map((x) => (x.id === c.id ? { ...x, keep } : x))))}
                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span aria-hidden className="h-6 w-6 rounded border" style={{ backgroundColor: isValidHex(c.hex) ? c.hex : undefined }} />
                      <Input aria-label={`Name of colour ${i + 1}`} value={c.name} maxLength={120} className="h-8 w-48" onChange={(e) => setColours(colours.map((x) => (x.id === c.id ? { ...x, name: e.target.value } : x)))} />
                      <Input aria-label={`Hex of colour ${i + 1}`} value={c.hex} maxLength={7} className="h-8 w-28 font-mono" onChange={(e) => setColours(colours.map((x) => (x.id === c.id ? { ...x, hex: e.target.value } : x)))} />
                    </div>
                    {source(c)}
                  </div>
                </div>
              ))}
            </section>
          )}

          {result.draft.clauses.length + result.draft.terms.length + result.draft.colours.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button onClick={save} disabled={busy || !total}>Save {total} kept item{total === 1 ? "" : "s"}</Button>
              <Button variant="ghost" onClick={() => setResult(null)} disabled={busy}>Discard draft</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
