"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { Database } from "@/lib/database.types";
import { CATEGORY_LABEL, CONFIDENCE_LABEL, SEVERITY_LABEL, ruleSourceLabel } from "@/lib/labels";
import { createClient } from "@/lib/supabase/browser";

type Row = Database["public"]["Tables"]["findings"]["Row"];
export type CitedSource = { code: string; kind: "Clause" | "Fact" | "Term"; text: string | null; note?: string };

const SEVERITY_STYLE: Record<Row["severity"], string> = {
  critical: "border-l-red-700",
  major: "border-l-orange-600",
  minor: "border-l-amber-500",
  info: "border-l-slate-400",
};

export function FindingCard({
  f,
  n,
  source,
  canAcceptOrReject = false,
  canDismissOrWaive = false,
  itemId,
  versionId,
  orgId,
}: {
  f: Row;
  n: number;
  source: CitedSource | null;
  canAcceptOrReject?: boolean;
  canDismissOrWaive?: boolean;
  itemId?: string;
  versionId?: string;
  orgId?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Row["status"]>(f.status);
  const [reason, setReason] = useState<string>(f.reason ?? "");
  const [busy, setBusy] = useState(false);
  const [activeAction, setActiveAction] = useState<"reject" | "dismiss" | "waive" | null>(null);
  const [actionReason, setActionReason] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const systemSource = !source ? ruleSourceLabel(f.rule_code) : null;

  async function handleAccept() {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setErrorMsg(null);
    const { error } = await supabase
      .from("findings")
      .update({ status: "accepted", reason: null })
      .eq("id", f.id);
    setBusy(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setStatus("accepted");
      setReason("");
      setActiveAction(null);
      router.refresh();
    }
  }

  async function handleConfirmAction() {
    if (!actionReason.trim()) return;
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setErrorMsg(null);

    if (activeAction === "waive") {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setErrorMsg("Please sign in to waive findings.");
        setBusy(false);
        return;
      }
      if (!itemId || !versionId) {
        setErrorMsg("Item context is missing for waiver.");
        setBusy(false);
        return;
      }
      const { error } = await supabase.from("decisions").insert({
        org_id: orgId ?? f.org_id,
        item_id: itemId,
        version_id: versionId,
        finding_id: f.id,
        decision: "waive",
        reason: actionReason.trim(),
        author_id: authData.user.id,
      });
      setBusy(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setStatus("waived");
        setReason(actionReason.trim());
        setActiveAction(null);
        setActionReason("");
        router.refresh();
      }
      return;
    }

    const nextStatus: Row["status"] = activeAction === "dismiss" ? "dismissed" : "rejected";
    const { error } = await supabase
      .from("findings")
      .update({ status: nextStatus, reason: actionReason.trim() })
      .eq("id", f.id);
    setBusy(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setStatus(nextStatus);
      setReason(actionReason.trim());
      setActiveAction(null);
      setActionReason("");
      router.refresh();
    }
  }

  async function handleReopen() {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setErrorMsg(null);
    const { error } = await supabase
      .from("findings")
      .update({ status: "open", reason: null })
      .eq("id", f.id);
    setBusy(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      setStatus("open");
      setReason("");
      setActiveAction(null);
      router.refresh();
    }
  }

  return (
    <Card id={`finding-${f.id}`} className={`scroll-mt-20 border-l-4 ${SEVERITY_STYLE[f.severity]} gap-3 py-4`}>
      <CardHeader className="px-4">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold tabular-nums text-muted-foreground">#{n}</span>
          <Badge variant={f.severity === "critical" ? "destructive" : "secondary"}>{SEVERITY_LABEL[f.severity]}</Badge>
          <Badge variant="outline">{CATEGORY_LABEL[f.category]}</Badge>
          <span className="text-muted-foreground">Confidence: {CONFIDENCE_LABEL[f.confidence]}</span>
          <Badge variant="outline">{f.source === "ai" ? "AI finding" : "Rule check"}</Badge>
          {f.label === "needs_human_check" && <Badge variant="outline">Needs human check</Badge>}
          {f.label === "unverified_claim" && <Badge variant="outline">Unverified claim</Badge>}
          <Badge
            variant={
              status === "open"
                ? "outline"
                : status === "accepted"
                ? "default"
                : status === "rejected"
                ? "destructive"
                : "secondary"
            }
            className={status === "accepted" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 text-sm">
        <blockquote className="border-l-2 pl-3 italic">&ldquo;{f.quote}&rdquo;</blockquote>
        <p>{f.explanation}</p>
        {(source || systemSource) && (
          <div className="rounded-md bg-muted px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Approved source</p>
            {source ? (
              <p>
                <span className="font-mono text-xs">{source.code}</span> · {source.kind}
                {source.text ? <>: {source.text}</> : <em> (restricted: visible to owners and reviewers)</em>}
                {source.note ? ` · ${source.note}` : ""}
              </p>
            ) : (
              <p>{systemSource}</p>
            )}
          </div>
        )}
        {f.suggestion && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Before</p>
              <p className="rounded bg-red-50 px-2 py-1 text-red-950 line-through decoration-red-700/60 dark:bg-red-950/40 dark:text-red-100">
                {f.quote}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Suggested fix</p>
              <p className="rounded bg-green-50 px-2 py-1 text-green-950 dark:bg-green-950/40 dark:text-green-100">
                {f.suggestion}
              </p>
            </div>
          </div>
        )}
        {reason && <p className="text-xs text-muted-foreground">Reason: {reason}</p>}

        {errorMsg && (
          <Alert variant="destructive">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {/* Action controls */}
        {status === "open" ? (
          <div className="pt-2">
            {!activeAction ? (
              <div className="flex flex-wrap items-center gap-2">
                {canAcceptOrReject && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={handleAccept}
                      className="border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        setActiveAction("reject");
                        setActionReason("");
                      }}
                      className="border-red-600 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                    >
                      Reject
                    </Button>
                  </>
                )}
                {canDismissOrWaive && (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setActiveAction("dismiss");
                        setActionReason("");
                      }}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => {
                        setActiveAction("waive");
                        setActionReason("");
                      }}
                    >
                      Waive
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-2 rounded-md border p-3">
                <label className="text-xs font-medium text-muted-foreground" htmlFor={`reason-${f.id}`}>
                  {activeAction === "reject"
                    ? "Reason for rejecting this finding (required):"
                    : activeAction === "dismiss"
                    ? "Reason for dismissing this finding (required):"
                    : "Reason for governance waiver (required):"}
                </label>
                <Input
                  id={`reason-${f.id}`}
                  placeholder={
                    activeAction === "reject"
                      ? "e.g. Deliberate phrasing / approved marketing exception"
                      : activeAction === "dismiss"
                      ? "e.g. False positive or not applicable"
                      : "e.g. Approved temporary exemption by Brand Lead"
                  }
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  disabled={busy}
                />
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={activeAction === "reject" ? "destructive" : "default"}
                    disabled={busy || !actionReason.trim()}
                    onClick={handleConfirmAction}
                  >
                    Confirm {activeAction}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setActiveAction(null);
                      setActionReason("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          (canAcceptOrReject || canDismissOrWaive) && (
            <div className="pt-1">
              <Button size="sm" variant="ghost" disabled={busy} onClick={handleReopen} className="text-xs">
                Reopen finding
              </Button>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
