"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { bannedTermWarning, nextCode, planTermImport, valePrefix } from "@/lib/knowledge/helpers";
import { friendlyDbError } from "@/lib/review/errors";
import { createClient } from "@/lib/supabase/browser";
import type { TermRow } from "./knowledge-tabs";

type Kind = "preferred" | "banned" | "internal";
const KIND_HELP: Record<Kind, string> = {
  preferred: "The approved spelling. Other spellings or casings are flagged.",
  banned: "Never use. Give the word to use instead.",
  internal: "A codename or client name that must never appear in public content (Confidential Guard).",
};
const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const empty = { code: "", term: "", kind: "banned" as Kind, replacement: "", owner: "" };
type Plan = ReturnType<typeof planTermImport> & { file: string; warnings: string[] };

export function TermsTab({ terms, orgId, isOwner }: { terms: TermRow[]; orgId: string; isOwner: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<TermRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const refresh = () => startTransition(() => router.refresh());

  function openAdd() {
    setForm({ ...empty, code: nextCode("TERM", terms.map((t) => t.code)) });
    setEditing(null);
    setError(null);
    setShowForm(true);
  }

  function openEdit(t: TermRow) {
    setForm({ code: t.code, term: t.term, kind: t.kind, replacement: t.replacement ?? "", owner: t.owner_name ?? "" });
    setEditing(t);
    setError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const fields = {
      term: form.term.trim(), kind: form.kind,
      replacement: form.kind === "banned" ? form.replacement.trim() || null : null, owner_name: form.owner.trim() || null,
    };
    const { error: err } = editing
      ? await supabase.from("terminology").update(fields).eq("id", editing.id)
      : await supabase.from("terminology").insert({ ...fields, org_id: orgId, code: form.code.trim().toUpperCase() });
    setBusy(false);
    if (err) return setError(err.code === "23505" ? `Code "${form.code.trim().toUpperCase()}" already exists for this organisation.` : friendlyDbError(err));
    setShowForm(false);
    refresh();
  }

  async function onValeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    setError(null);
    setPlan(null);
    if (!file) return;
    if (file.size > 256 * 1024) return setError("Vale files over 256 KB are not supported.");
    // loaded on demand: the YAML parser is only needed when an owner imports a file
    const { importVale } = await import("@/lib/rules/vale");
    const { terms: imported, warnings } = importVale(await file.text(), { prefix: valePrefix(file.name) });
    setPlan({ ...planTermImport(imported, terms), file: file.name, warnings });
  }

  async function confirmImport() {
    if (!plan?.toAdd.length) return;
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    const rows = plan.toAdd.map((t) => ({ org_id: orgId, code: t.code, term: t.term, kind: t.kind as Kind, replacement: t.replacement, owner_name: "Vale import" }));
    const { error: err } = await supabase.from("terminology").upsert(rows, { onConflict: "org_id,code", ignoreDuplicates: true });
    setBusy(false);
    if (err) return setError(friendlyDbError(err));
    setPlan(null);
    refresh();
  }

  const q = search.trim().toLowerCase();
  const filtered = terms.filter((t) => !q || t.code.toLowerCase().includes(q) || t.term.toLowerCase().includes(q) || (t.replacement ?? "").toLowerCase().includes(q));
  const warning = bannedTermWarning(form.kind, form.replacement);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search terms…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" aria-label="Search terms" />
        {isOwner && !showForm && (
          <>
            <Button size="sm" onClick={openAdd}>Add term</Button>
            <Label htmlFor="vale-file" className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-sm font-medium hover:bg-accent">
              Import Vale rules (.yml)
            </Label>
            <input id="vale-file" type="file" accept=".yml,.yaml" className="sr-only" onChange={onValeFile} />
          </>
        )}
      </div>

      {error && !showForm && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}

      {plan && (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2"><h2 className="font-semibold">Import from {plan.file}</h2></CardHeader>
          <CardContent className="space-y-3 px-4 pb-4 text-sm">
            {plan.toAdd.length ? (
              <ul className="space-y-1">
                {plan.toAdd.map((t) => (
                  <li key={t.code}><span className="font-mono text-xs text-muted-foreground">{t.code}</span> · {t.kind}: &ldquo;{t.term}&rdquo;{t.replacement ? <> → use &ldquo;{t.replacement}&rdquo;</> : null}</li>
                ))}
              </ul>
            ) : <p>Nothing new to import.</p>}
            {plan.skipped.length > 0 && <p className="text-xs text-muted-foreground">Skipped {plan.skipped.length}: {plan.skipped.map((s) => `“${s.term}” (${s.reason})`).join(", ")}</p>}
            {plan.warnings.length > 0 && <ul className="list-disc pl-4 text-xs text-muted-foreground">{plan.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
            <div className="flex gap-2">
              <Button size="sm" onClick={confirmImport} disabled={busy || !plan.toAdd.length}>Import {plan.toAdd.length} term{plan.toAdd.length === 1 ? "" : "s"}</Button>
              <Button size="sm" variant="ghost" onClick={() => setPlan(null)} disabled={busy}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2"><h2 className="font-semibold">{editing ? `Edit ${editing.code}` : "Add term"}</h2></CardHeader>
          <CardContent className="px-4 pb-4">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="term-code">Code</Label>
                  <Input id="term-code" value={form.code} onChange={set("code")} required disabled={!!editing} maxLength={40} />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="term-term">Term</Label>
                  <Input id="term-term" value={form.term} onChange={set("term")} required maxLength={200} placeholder="NB Sync" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="term-kind">Kind</Label>
                  <select id="term-kind" className={selectClass} value={form.kind} onChange={set("kind")}>
                    <option value="preferred">Preferred</option>
                    <option value="banned">Banned</option>
                    <option value="internal">Internal (confidential)</option>
                  </select>
                </div>
                {form.kind === "banned" && (
                  <div className="space-y-1">
                    <Label htmlFor="term-replacement">Use instead</Label>
                    <Input id="term-replacement" value={form.replacement} onChange={set("replacement")} maxLength={200} placeholder="Northbeam Sync" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label htmlFor="term-owner">Owner</Label>
                  <Input id="term-owner" value={form.owner} onChange={set("owner")} maxLength={120} placeholder="Marketing" />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{KIND_HELP[form.kind]}</p>
              {warning && <p className="text-xs text-amber-700 dark:text-amber-400">{warning}</p>}
              {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>{editing ? "Save changes" : "Add term"}</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setShowForm(false); setError(null); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{search ? "No terms match your search." : "No terms yet."}</p>}
        {filtered.map((t) => (
          <Card key={t.id} className="gap-0 py-3">
            <CardContent className="flex flex-wrap items-center gap-2 px-4 text-sm">
              <span className="font-mono text-xs text-muted-foreground">{t.code}</span>
              <Badge variant={t.kind === "internal" ? "destructive" : t.kind === "banned" ? "secondary" : "outline"} className="text-[10px]">
                {t.kind === "internal" ? "Internal" : t.kind === "banned" ? "Banned" : "Preferred"}
              </Badge>
              <span className="font-medium">{t.term}</span>
              {t.replacement && <span className="text-muted-foreground">→ use {t.replacement}</span>}
              {t.owner_name && <span className="text-xs text-muted-foreground">· {t.owner_name}</span>}
              {isOwner && <Button size="sm" variant="ghost" className="ml-auto h-7 text-xs" onClick={() => openEdit(t)} disabled={busy}>Edit</Button>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
