"use client";
import Link from "next/link";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type Call<T> = { state: "idle" } | { state: "busy" } | { state: "error"; text: string } | { state: "done"; data: T };

/** POST helper: fixed server messages are shown as they are, anything else becomes a generic sentence. */
async function post<T>(url: string, body: object): Promise<Call<T>> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { state: "error", text: typeof json.error === "string" ? json.error : "Something went wrong. Please try again." };
    return { state: "done", data: json as T };
  } catch {
    return { state: "error", text: "Could not reach the server. Please try again." };
  }
}

const ModeBadge = ({ mode }: { mode: string }) => (
  <Badge variant="outline">{mode === "simulated" ? "Simulated" : "AI draft"}</Badge>
);

type RewriteData = { mode: string; suggestion: { text: string; example_do: string | null; why: string } | null; message?: string };

export function SuggestRewrite({ orgId, code }: { orgId: string; code: string }) {
  const [c, setC] = useState<Call<RewriteData>>({ state: "idle" });
  return (
    <div className="mt-2 space-y-2">
      <Button size="sm" variant="outline" disabled={c.state === "busy"} onClick={async () => { setC({ state: "busy" }); setC(await post("/api/health/rewrite", { orgId, code })); }}>
        {c.state === "busy" ? "Drafting…" : "Suggest a rewrite"}
      </Button>
      <div aria-live="polite">
        {c.state === "error" && <Alert variant="destructive" role="alert"><AlertDescription>{c.text}</AlertDescription></Alert>}
        {c.state === "done" && !c.data.suggestion && <p className="text-muted-foreground">{c.data.message ?? "No suggestion available."}</p>}
        {c.state === "done" && c.data.suggestion && (
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="flex items-center gap-2 font-medium">Suggested rewrite <ModeBadge mode={c.data.mode} /></p>
            <p className="mt-1">{c.data.suggestion.text}</p>
            {c.data.suggestion.example_do && <p className="mt-1 text-muted-foreground">Allowed example: “{c.data.suggestion.example_do}”</p>}
            <p className="mt-1 text-muted-foreground">{c.data.suggestion.why}</p>
            <p className="mt-2 text-xs text-muted-foreground">A draft only. Nothing changes until an owner saves it as a new version in the <Link href="/knowledge" className="underline underline-offset-4">Knowledge Centre</Link>.</p>
          </div>
        )}
      </div>
    </div>
  );
}

type ConflictData = { mode: string; checked: number; conflicts: { a: string; b: string; category: string; why: string }[] | null; message?: string };

export function CheckClauseConflicts({ orgId }: { orgId: string }) {
  const [c, setC] = useState<Call<ConflictData>>({ state: "idle" });
  return (
    <div className="mt-4 space-y-2 text-sm">
      <Button size="sm" variant="outline" disabled={c.state === "busy"} onClick={async () => { setC({ state: "busy" }); setC(await post("/api/health/conflicts", { orgId })); }}>
        {c.state === "busy" ? "Comparing rules…" : "Compare rules with AI"}
      </Button>
      <div aria-live="polite">
        {c.state === "error" && <Alert variant="destructive" role="alert"><AlertDescription>{c.text}</AlertDescription></Alert>}
        {c.state === "done" && c.data.conflicts === null && <p className="text-muted-foreground">{c.data.message}</p>}
        {c.state === "done" && c.data.conflicts && !c.data.conflicts.length && (
          <p className="text-muted-foreground">{c.data.message ?? `The AI found no contradictions among ${c.data.checked} rules.`}</p>
        )}
        {c.state === "done" && c.data.conflicts && c.data.conflicts.length > 0 && (
          <ul className="space-y-2">
            {c.data.conflicts.map((x) => (
              <li key={`${x.a}-${x.b}`} className="rounded-md border p-3">
                <p className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs">{x.a}</span> and <span className="font-mono text-xs">{x.b}</span> <ModeBadge mode={c.data.mode} /></p>
                <p className="mt-1">{x.why}</p>
                <p className="mt-1 text-xs text-muted-foreground">Needs a human check. Reword or retire one of them in the <Link href="/knowledge" className="underline underline-offset-4">Knowledge Centre</Link>.</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
