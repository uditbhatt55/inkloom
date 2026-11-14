"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isFactExpired, nextCode, todayISO, validateDateRange } from "@/lib/knowledge/helpers";
import { friendlyDbError } from "@/lib/review/errors";
import { createClient } from "@/lib/supabase/browser";
import type { FactRow } from "./knowledge-tabs";

const empty = { code: "", statement: "", evidence: "", owner: "", validFrom: "", validUntil: "", visibility: "public" as "public" | "internal" };

/**
 * Approved facts (§5.1): every number or claim in public copy should match one. A fact past its "valid until" date is
 * flagged in audits (expired-fact rule). Internal facts feed the Confidential Guard and are never sent to the AI.
 * Facts are edited, not deleted: findings and claim links point at them.
 */
export function FactsTab({ facts, orgId, isOwner }: { facts: FactRow[]; orgId: string; isOwner: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<FactRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const today = todayISO();
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });

  function openAdd() {
    setForm({ ...empty, code: nextCode("FACT", facts.map((f) => f.code)) });
    setEditing(null);
    setError(null);
    setShowForm(true);
  }

  function openEdit(f: FactRow) {
    setForm({
      code: f.code, statement: f.statement, evidence: f.evidence_ref ?? "", owner: f.owner_name ?? "",
      validFrom: f.valid_from ?? "", validUntil: f.valid_until ?? "", visibility: f.visibility,
    });
    setEditing(f);
    setError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const range = validateDateRange(form.validFrom || null, form.validUntil || null);
    if (!range.valid) return setError(range.message ?? "Check the dates.");
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const fields = {
      statement: form.statement.trim(), evidence_ref: form.evidence.trim() || null, owner_name: form.owner.trim() || null,
      valid_from: form.validFrom || null, valid_until: form.validUntil || null, visibility: form.visibility,
    };
    const { error: err } = editing
      ? await supabase.from("approved_facts").update(fields).eq("id", editing.id)
      : await supabase.from("approved_facts").insert({ ...fields, org_id: orgId, code: form.code.trim().toUpperCase() });
    setBusy(false);
    if (err) return setError(err.code === "23505" ? `Code "${form.code.trim().toUpperCase()}" already exists for this organisation.` : friendlyDbError(err));
    setShowForm(false);
    startTransition(() => router.refresh());
  }

  const q = search.trim().toLowerCase();
  const filtered = facts.filter((f) => !q || f.code.toLowerCase().includes(q) || f.statement.toLowerCase().includes(q));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search facts…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" aria-label="Search facts" />
        {isOwner && !showForm && <Button size="sm" onClick={openAdd}>Add fact</Button>}
      </div>

      {showForm && (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2"><h2 className="font-semibold">{editing ? `Edit ${editing.code}` : "Add approved fact"}</h2></CardHeader>
          <CardContent className="px-4 pb-4">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
                <div className="space-y-1">
                  <Label htmlFor="fact-code">Code</Label>
                  <Input id="fact-code" value={form.code} onChange={set("code")} required disabled={!!editing} maxLength={40} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fact-statement">Statement</Label>
                  <Textarea id="fact-statement" value={form.statement} onChange={set("statement")} required rows={2} maxLength={1000} placeholder="Northbeam Sync SLA: 99.9% monthly uptime" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="fact-evidence">Evidence (document, link or reference)</Label>
                  <Input id="fact-evidence" value={form.evidence} onChange={set("evidence")} maxLength={500} placeholder="SLA v2, clause 4.1" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fact-owner">Owner</Label>
                  <Input id="fact-owner" value={form.owner} onChange={set("owner")} maxLength={120} placeholder="Legal" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fact-from">Valid from</Label>
                  <Input id="fact-from" type="date" value={form.validFrom} onChange={set("validFrom")} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="fact-until">Valid until</Label>
                  <Input id="fact-until" type="date" value={form.validUntil} onChange={set("validUntil")} />
                </div>
              </div>
              <fieldset className="space-y-1">
                <legend className="text-sm font-medium">Visibility</legend>
                <div className="flex flex-wrap gap-6 text-sm">
                  <label className="flex items-center gap-2"><input type="radio" name="fact-visibility" value="public" checked={form.visibility === "public"} onChange={set("visibility")} /> Public: may be published</label>
                  <label className="flex items-center gap-2"><input type="radio" name="fact-visibility" value="internal" checked={form.visibility === "internal"} onChange={set("visibility")} /> Internal: must never be published</label>
                </div>
                <p className="text-xs text-muted-foreground">Internal facts are checked by the Confidential Guard, hidden from creators and agencies, and never sent to the AI.</p>
              </fieldset>
              {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>{editing ? "Save changes" : "Add fact"}</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setShowForm(false); setError(null); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">{search ? "No facts match your search." : "No approved facts yet."}</p>}
        {filtered.map((f) => {
          const expired = isFactExpired(f.valid_until, today);
          const notYet = !!f.valid_from && f.valid_from > today;
          return (
            <Card key={f.id} className="gap-0 py-3">
              <CardContent className="space-y-1.5 px-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{f.code}</span>
                  <Badge variant={f.visibility === "internal" ? "destructive" : "outline"} className="text-[10px]">{f.visibility === "internal" ? "Internal" : "Public"}</Badge>
                  {expired && <Badge variant="secondary" className="text-[10px]">Expired {f.valid_until}</Badge>}
                  {notYet && <Badge variant="secondary" className="text-[10px]">Valid from {f.valid_from}</Badge>}
                  {!expired && !notYet && f.valid_until && <span className="text-[10px] text-muted-foreground">valid until {f.valid_until}</span>}
                </div>
                <p className="text-sm">{f.statement}</p>
                {(f.evidence_ref || f.owner_name) && (
                  <p className="text-xs text-muted-foreground">{[f.owner_name && `Owner: ${f.owner_name}`, f.evidence_ref && `Evidence: ${f.evidence_ref}`].filter(Boolean).join(" · ")}</p>
                )}
                {isOwner && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(f)} disabled={busy}>Edit</Button>}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
