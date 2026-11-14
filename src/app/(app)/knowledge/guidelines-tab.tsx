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
import type { Database } from "@/lib/database.types";
import { CATEGORY_PREFIX, nextCode } from "@/lib/knowledge/helpers";
import { friendlyDbError } from "@/lib/review/errors";
import { createClient } from "@/lib/supabase/browser";
import type { ClauseHistoryRow, ClauseRow } from "./knowledge-tabs";

type E = Database["public"]["Enums"];

const CATEGORIES: E["finding_category"][] = [
  "claim", "tone", "messaging", "accessibility", "visual", "terminology", "factual", "confidentiality",
];
const CATEGORY_LABEL: Record<E["finding_category"], string> = {
  claim: "Claim", tone: "Tone", messaging: "Messaging", accessibility: "Accessibility",
  visual: "Visual", terminology: "Terminology", factual: "Factual", confidentiality: "Confidentiality",
};

const STATUS_STYLE: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  retired: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function GuidelinesTab({
  clauses,
  history,
  orgId,
  isOwner,
}: {
  clauses: ClauseRow[];
  history: ClauseHistoryRow[];
  orgId: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ClauseRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [category, setCategory] = useState<E["finding_category"]>("claim");
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"draft" | "active" | "retired">("active");
  const [examplesDo, setExamplesDo] = useState("");
  const [examplesDont, setExamplesDont] = useState("");
  const [sourcePage, setSourcePage] = useState("");

  function openAdd() {
    const prefix = CATEGORY_PREFIX[category];
    setCode(nextCode(prefix, clauses.map((c) => c.code)));
    setText("");
    setStatus("active");
    setExamplesDo("");
    setExamplesDont("");
    setSourcePage("");
    setEditing(null);
    setError(null);
    setShowForm(true);
  }

  function openEdit(c: ClauseRow) {
    setCategory(c.category as E["finding_category"]);
    setCode(c.code);
    setText(c.text);
    setStatus(c.status as "draft" | "active" | "retired");
    setExamplesDo((c.examples_do ?? []).join("\n"));
    setExamplesDont((c.examples_dont ?? []).join("\n"));
    setSourcePage(c.source_page ? String(c.source_page) : "");
    setEditing(c);
    setError(null);
    setShowForm(true);
  }

  function handleCategoryChange(cat: E["finding_category"]) {
    setCategory(cat);
    if (!editing) {
      const prefix = CATEGORY_PREFIX[cat];
      setCode(nextCode(prefix, clauses.map((c) => c.code)));
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError(null);

    const payload = {
      org_id: orgId,
      code: code.trim().toUpperCase(),
      category,
      text: text.trim(),
      status,
      examples_do: examplesDo.split("\n").map((s) => s.trim()).filter(Boolean),
      examples_dont: examplesDont.split("\n").map((s) => s.trim()).filter(Boolean),
      source_page: sourcePage ? parseInt(sourcePage) : null,
    };

    let err;
    if (editing) {
      // the database bumps the version and keeps the old text when the rule text changes (migration 20261114000000)
      const changes = { text: payload.text, status: payload.status, examples_do: payload.examples_do, examples_dont: payload.examples_dont, source_page: payload.source_page };
      ({ error: err } = await supabase.from("guideline_clauses").update(changes).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("guideline_clauses").insert(payload));
    }
    setBusy(false);
    if (err) {
      setError(err.code === "23505" ? `Code "${payload.code}" already exists for this organisation.` : friendlyDbError(err));
    } else {
      setShowForm(false);
      startTransition(() => router.refresh());
    }
  }

  async function handleRetire(c: ClauseRow) {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("guideline_clauses").update({ status: "retired" }).eq("id", c.id);
    setBusy(false);
    if (err) return setError(friendlyDbError(err));
    startTransition(() => router.refresh());
  }

  const filtered = clauses.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.code.toLowerCase().includes(q) ||
      c.text.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search guidelines…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
          aria-label="Search guidelines"
        />
        {isOwner && !showForm && (
          <Button size="sm" onClick={openAdd}>Add guideline</Button>
        )}
      </div>

      {showForm && (
        <Card>
          <CardHeader className="px-4 pt-4 pb-2">
            <h2 className="font-semibold">{editing ? "Edit guideline" : "Add guideline"}</h2>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="clause-category">Category</Label>
                  <select
                    id="clause-category"
                    className={selectClass}
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as E["finding_category"])}
                    disabled={!!editing}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clause-code">Code</Label>
                  <Input
                    id="clause-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="CLAIM-05"
                    required
                    disabled={!!editing}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="clause-text">Rule text</Label>
                <Textarea
                  id="clause-text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Describe the guideline…"
                  required
                  rows={3}
                />
                {editing && text.trim() !== editing.text && (
                  <p className="text-xs text-muted-foreground">
                    Saving will increment the version from {editing.version} to {editing.version + 1}.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="clause-do">Examples (do), one per line</Label>
                  <Textarea
                    id="clause-do"
                    value={examplesDo}
                    onChange={(e) => setExamplesDo(e.target.value)}
                    rows={2}
                    placeholder="backed by our SLA"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clause-dont">Examples (don&apos;t), one per line</Label>
                  <Textarea
                    id="clause-dont"
                    value={examplesDont}
                    onChange={(e) => setExamplesDont(e.target.value)}
                    rows={2}
                    placeholder="guaranteed uptime"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label htmlFor="clause-status">Status</Label>
                  <select
                    id="clause-status"
                    className={selectClass}
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "draft" | "active" | "retired")}
                  >
                    <option value="draft">Draft (not used in audits)</option>
                    <option value="active">Active</option>
                    <option value="retired">Retired</option>
                  </select>
                  {status === "draft" && (
                    <p className="text-xs text-muted-foreground">
                      Draft clauses are not sent to the AI or used in rule checks.
                    </p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clause-page">Source page (optional)</Label>
                  <Input
                    id="clause-page"
                    type="number"
                    min="1"
                    value={sourcePage}
                    onChange={(e) => setSourcePage(e.target.value)}
                    placeholder="e.g. 12"
                  />
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-2">
                <Button type="submit" size="sm" disabled={busy}>
                  {editing ? "Save changes" : "Add guideline"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => { setShowForm(false); setError(null); }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {error && !showForm && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            {search ? "No guidelines match your search." : "No guidelines yet."}
          </p>
        )}
        {filtered.map((c) => (
          <Card key={c.id} className="gap-0 py-3">
            <CardContent className="px-4 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                <Badge variant="outline" className="text-[10px]">{CATEGORY_LABEL[c.category as E["finding_category"]]}</Badge>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[c.status] ?? ""}`}>
                  {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                </span>
                <span className="text-[10px] text-muted-foreground">v{c.version ?? 1}</span>
                {c.status === "draft" && (
                  <span className="text-[10px] text-amber-600 font-medium">Not used in audits</span>
                )}
              </div>
              <p className="text-sm">{c.text}</p>
              {history.some((h) => h.clause_id === c.id) && (
                <details className="text-xs text-muted-foreground">
                  <summary className="cursor-pointer">Previous versions</summary>
                  <ul className="mt-1 space-y-1 border-l pl-3">
                    {history.filter((h) => h.clause_id === c.id).map((h) => (
                      <li key={h.id}>
                        <span className="font-medium">v{h.version}</span> (until {h.changed_at.slice(0, 10)}): {h.text}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {(c.examples_do?.length > 0 || c.examples_dont?.length > 0) && (
                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground mt-1">
                  {c.examples_do?.length > 0 && (
                    <span>✓ {c.examples_do.join(" · ")}</span>
                  )}
                  {c.examples_dont?.length > 0 && (
                    <span>✗ {c.examples_dont.join(" · ")}</span>
                  )}
                </div>
              )}
              {isOwner && (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => openEdit(c)}
                    disabled={busy}
                  >
                    Edit
                  </Button>
                  {c.status !== "retired" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-muted-foreground"
                      onClick={() => handleRetire(c)}
                      disabled={busy}
                    >
                      Retire
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

