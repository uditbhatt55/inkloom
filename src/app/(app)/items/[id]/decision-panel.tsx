"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/lib/database.types";
import { canUserDecideItem, isApproveBlocked } from "@/lib/review/approval";
import type { Role } from "@/lib/session";
import { createClient } from "@/lib/supabase/browser";

type FindingRow = Database["public"]["Tables"]["findings"]["Row"];
type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];
type ItemRow = Database["public"]["Tables"]["content_items"]["Row"];

export function DecisionPanel({
  item,
  versionId,
  findings,
  role,
  currentUserId,
  decisions,
}: {
  item: Pick<ItemRow, "id" | "org_id" | "title" | "status" | "owner_id">;
  versionId: string;
  findings: FindingRow[];
  role: Role | undefined;
  currentUserId: string;
  decisions: DecisionRow[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [activeForm, setActiveForm] = useState<"request_changes" | "reject" | "waive" | null>(null);
  const [reason, setReason] = useState("");
  const [selectedFindingId, setSelectedFindingId] = useState<string>(
    findings.find((f) => f.severity === "critical" && f.status === "open")?.id ?? findings[0]?.id ?? ""
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isItemAuthor = item.owner_id === currentUserId;
  const decidePerm = canUserDecideItem({ role, isItemAuthor });
  const approveCheck = isApproveBlocked(
    findings.map((f) => ({
      severity: f.severity,
      confidence: f.confidence,
      status: f.status,
    }))
  );

  async function handleApprove() {
    if (!decidePerm.allowed || approveCheck.blocked) return;
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setErrorMsg(null);

    const { error } = await supabase.from("decisions").insert({
      org_id: item.org_id,
      item_id: item.id,
      version_id: versionId,
      decision: "approve",
      author_id: currentUserId,
      reason: null,
    });

    setBusy(false);
    if (error) {
      setErrorMsg(error.message);
    } else {
      router.refresh();
    }
  }

  async function handleConfirmDecision() {
    if (!reason.trim()) return;
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    setErrorMsg(null);

    if (activeForm === "waive") {
      if (!selectedFindingId) {
        setErrorMsg("Please select a finding to waive.");
        setBusy(false);
        return;
      }
      const { error } = await supabase.from("decisions").insert({
        org_id: item.org_id,
        item_id: item.id,
        version_id: versionId,
        finding_id: selectedFindingId,
        decision: "waive",
        reason: reason.trim(),
        author_id: currentUserId,
      });
      setBusy(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setActiveForm(null);
        setReason("");
        router.refresh();
      }
      return;
    }

    if (activeForm === "request_changes" || activeForm === "reject") {
      const { error } = await supabase.from("decisions").insert({
        org_id: item.org_id,
        item_id: item.id,
        version_id: versionId,
        decision: activeForm,
        reason: reason.trim(),
        author_id: currentUserId,
      });
      setBusy(false);
      if (error) {
        setErrorMsg(error.message);
      } else {
        setActiveForm(null);
        setReason("");
        router.refresh();
      }
    }
  }

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Review decision</h2>
          <Badge variant={item.status === "approved" ? "default" : "secondary"}>
            {item.status.replace("_", " ")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4 text-sm">
        {errorMsg && (
          <Alert variant="destructive">
            <AlertDescription>{errorMsg}</AlertDescription>
          </Alert>
        )}

        {/* Permission feedback */}
        {!decidePerm.allowed ? (
          <p className="text-xs text-muted-foreground">{decidePerm.reason}</p>
        ) : (
          <div className="space-y-3">
            {/* Block reason if approval is blocked */}
            {approveCheck.blocked && (
              <p className="text-xs text-red-600 dark:text-red-400 font-medium">
                {approveCheck.message}
              </p>
            )}

            {!activeForm ? (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  disabled={busy || approveCheck.blocked}
                  onClick={handleApprove}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setActiveForm("request_changes");
                    setReason("");
                  }}
                >
                  Request changes
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    setActiveForm("waive");
                    setReason("");
                    const firstCrit = findings.find((f) => f.severity === "critical" && f.status === "open");
                    if (firstCrit) setSelectedFindingId(firstCrit.id);
                  }}
                >
                  Waive finding
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => {
                    setActiveForm("reject");
                    setReason("");
                  }}
                  className="text-red-600 hover:text-red-700"
                >
                  Reject
                </Button>
              </div>
            ) : (
              <div className="space-y-3 rounded-md border p-3">
                <div className="text-xs font-semibold">
                  {activeForm === "request_changes"
                    ? "Request changes"
                    : activeForm === "waive"
                    ? "Waive finding"
                    : "Reject item"}
                </div>

                {activeForm === "waive" && (
                  <div className="space-y-1">
                    <label htmlFor="waive-finding-select" className="text-xs text-muted-foreground">
                      Select finding to waive:
                    </label>
                    <select
                      id="waive-finding-select"
                      className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-xs shadow-xs focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                      value={selectedFindingId}
                      onChange={(e) => setSelectedFindingId(e.target.value)}
                    >
                      {findings.map((f, i) => (
                        <option key={f.id} value={f.id}>
                          #{i + 1} [{f.severity.toUpperCase()}] &ldquo;
                          {f.quote.slice(0, 40)}
                          {f.quote.length > 40 ? "..." : ""}&rdquo; ({f.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-1">
                  <label htmlFor="decision-reason" className="text-xs text-muted-foreground">
                    {activeForm === "request_changes"
                      ? "Explanation of required changes (required):"
                      : activeForm === "waive"
                      ? "Governance waiver rationale (required):"
                      : "Reason for rejection (required):"}
                  </label>
                  <Textarea
                    id="decision-reason"
                    placeholder={
                      activeForm === "request_changes"
                        ? "Describe the necessary changes..."
                        : activeForm === "waive"
                        ? "Explain why this governance exception is approved..."
                        : "Describe the reason for rejection..."
                    }
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={busy}
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant={activeForm === "reject" ? "destructive" : "default"}
                    disabled={busy || !reason.trim() || (activeForm === "waive" && !selectedFindingId)}
                    onClick={handleConfirmDecision}
                  >
                    Confirm {activeForm.replace("_", " ")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      setActiveForm(null);
                      setReason("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Decision history */}
        {decisions.length > 0 && (
          <div className="space-y-2 border-t pt-3">
            <h3 className="text-xs font-medium text-muted-foreground">Decision history</h3>
            <ul className="space-y-1 text-xs">
              {decisions.map((d) => (
                <li key={d.id} className="flex flex-col gap-0.5 rounded bg-muted/30 p-2">
                  <div className="flex items-center justify-between font-medium">
                    <span className="capitalize">{d.decision.replace("_", " ")}</span>
                    <time className="text-[10px] text-muted-foreground" dateTime={d.created_at}>
                      {new Date(d.created_at).toLocaleDateString()}
                    </time>
                  </div>
                  {d.reason && <p className="text-muted-foreground">{d.reason}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

