"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isValidHex } from "@/lib/knowledge/helpers";
import { friendlyDbError } from "@/lib/review/errors";
import { createClient } from "@/lib/supabase/browser";
import type { AssetRow } from "./knowledge-tabs";

type Kind = "color" | "font" | "logo";
const SECTIONS: { kind: Kind; title: string; help: string }[] = [
  { kind: "color", title: "Palette", help: "Image colours more than ΔE 10 from every palette colour are flagged (neutrals are ignored)." },
  { kind: "font", title: "Fonts", help: "Fonts used in PDF and Word files are compared with these families." },
  { kind: "logo", title: "Logos", help: "Usage rules for each logo variant. Logo images are checked by the AI in a later release." },
];
const selectClass = "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";
const empty = { type: "color" as Kind, name: "", hex: "#1B2A4A", font: "", rules: "" };

/** Brand assets (§5.1): palette, fonts and logo rules used by the visual checks (decision D6: BRAND-PALETTE, BRAND-FONTS). */
export function AssetsTab({ assets, orgId, isOwner }: { assets: AssetRow[]; orgId: string; isOwner: boolean }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<AssetRow | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const refresh = () => startTransition(() => router.refresh());

  function openAdd(type: Kind) {
    setForm({ ...empty, type });
    setEditing(null);
    setError(null);
    setShowForm(true);
  }

  function openEdit(a: AssetRow) {
    setForm({ type: a.type as Kind, name: a.name, hex: a.hex ?? "#000000", font: a.font_name ?? "", rules: a.rules ?? "" });
    setEditing(a);
    setError(null);
    setShowForm(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const hex = form.hex.trim().toUpperCase();
    if (form.type === "color" && !isValidHex(hex)) return setError("Colours must be hex, like #1B2A4A.");
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const fields = {
      type: form.type, name: form.name.trim(),
      hex: form.type === "color" ? hex : null,
      font_name: form.type === "font" ? form.font.trim() || form.name.trim() : null,
      rules: form.rules.trim() || null,
    };
    const { error: err } = editing
      ? await supabase.from("brand_assets").update(fields).eq("id", editing.id)
      : await supabase.from("brand_assets").insert({ ...fields, org_id: orgId });
    setBusy(false);
    if (err) return setError(friendlyDbError(err));
    setShowForm(false);
    refresh();
  }

  async function handleDelete(a: AssetRow) {
    if (!window.confirm(`Remove "${a.name}" from the brand assets?`)) return;
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("brand_assets").delete().eq("id", a.id);
    setBusy(false);
    if (err) return setError(friendlyDbError(err));
    refresh();
  }

  return (
    <div className="space-y-6">
      {error && !showForm && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}

      {showForm && (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2"><h2 className="font-semibold">{editing ? `Edit ${editing.name}` : "Add brand asset"}</h2></CardHeader>
          <CardContent className="px-4 pb-4">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="asset-type">Type</Label>
                  <select id="asset-type" className={selectClass} value={form.type} onChange={set("type")} disabled={!!editing}>
                    <option value="color">Colour</option>
                    <option value="font">Font</option>
                    <option value="logo">Logo</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="asset-name">Name</Label>
                  <Input id="asset-name" value={form.name} onChange={set("name")} required maxLength={120} placeholder={form.type === "color" ? "Northbeam Navy" : form.type === "font" ? "Inter" : "Primary logo"} />
                </div>
                {form.type === "color" && (
                  <div className="space-y-1">
                    <Label htmlFor="asset-hex">Hex</Label>
                    <div className="flex gap-2">
                      <Input id="asset-hex" value={form.hex} onChange={set("hex")} required maxLength={7} placeholder="#1B2A4A" className="font-mono" />
                      <input type="color" aria-label="Pick colour" value={isValidHex(form.hex) ? form.hex : "#000000"} onChange={set("hex")} className="h-9 w-10 rounded border" />
                    </div>
                  </div>
                )}
                {form.type === "font" && (
                  <div className="space-y-1">
                    <Label htmlFor="asset-font">Font family (as it appears in files)</Label>
                    <Input id="asset-font" value={form.font} onChange={set("font")} maxLength={120} placeholder="Inter" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="asset-rules">Usage rules (optional)</Label>
                <Textarea id="asset-rules" value={form.rules} onChange={set("rules")} rows={2} maxLength={1000} placeholder="Use on dark backgrounds only; minimum width 120 px." />
              </div>
              {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy}>{editing ? "Save changes" : "Add asset"}</Button>
                <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { setShowForm(false); setError(null); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {SECTIONS.map(({ kind, title, help }) => {
        const list = assets.filter((a) => a.type === kind);
        return (
          <section key={kind} aria-labelledby={`assets-${kind}`} className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id={`assets-${kind}`} className="text-base font-medium">{title}</h2>
              {isOwner && !showForm && <Button size="sm" variant="outline" onClick={() => openAdd(kind)}>Add</Button>}
            </div>
            <p className="text-xs text-muted-foreground">{help}</p>
            {list.length === 0 ? <p className="text-sm text-muted-foreground">None yet.</p> : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {list.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg border bg-background p-3 text-sm">
                    {kind === "color" && <span aria-hidden className="h-8 w-8 shrink-0 rounded border" style={{ backgroundColor: a.hex ?? undefined }} />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{a.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {kind === "color" ? a.hex : kind === "font" ? a.font_name ?? a.name : null}{a.rules ? `${kind === "logo" ? "" : " · "}${a.rules}` : ""}
                      </p>
                    </div>
                    {isOwner && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openEdit(a)} disabled={busy}>Edit</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => handleDelete(a)} disabled={busy} aria-label={`Remove ${a.name}`}>Remove</Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
