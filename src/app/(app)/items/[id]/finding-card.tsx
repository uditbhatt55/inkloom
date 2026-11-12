import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CATEGORY_LABEL, CONFIDENCE_LABEL, SEVERITY_LABEL, ruleSourceLabel } from "@/lib/labels";
import type { Database } from "@/lib/database.types";

type Row = Database["public"]["Tables"]["findings"]["Row"];
export type CitedSource = { code: string; kind: "Clause" | "Fact" | "Term"; text: string | null; note?: string };

const SEVERITY_STYLE: Record<Row["severity"], string> = {
  critical: "border-l-red-700",
  major: "border-l-orange-600",
  minor: "border-l-amber-500",
  info: "border-l-slate-400",
};

export function FindingCard({ f, n, source }: { f: Row; n: number; source: CitedSource | null }) {
  const systemSource = !source ? ruleSourceLabel(f.rule_code) : null;
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
          {f.status !== "open" && <Badge>{f.status}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-3 px-4 text-sm">
        <blockquote className="border-l-2 pl-3 italic">&ldquo;{f.quote}&rdquo;</blockquote>
        <p>{f.explanation}</p>
        {(source || systemSource) && (
          <div className="rounded-md bg-muted px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Approved source</p>
            {source ? (
              <p><span className="font-mono text-xs">{source.code}</span> · {source.kind}{source.text ? <>: {source.text}</> : <em> (restricted: visible to owners and reviewers)</em>}{source.note ? ` · ${source.note}` : ""}</p>
            ) : (
              <p>{systemSource}</p>
            )}
          </div>
        )}
        {f.suggestion && (
          <div className="grid gap-2 sm:grid-cols-2">
            <div><p className="text-xs font-medium text-muted-foreground">Before</p><p className="rounded bg-red-50 px-2 py-1 text-red-950 line-through decoration-red-700/60 dark:bg-red-950/40 dark:text-red-100">{f.quote}</p></div>
            <div><p className="text-xs font-medium text-muted-foreground">Suggested fix</p><p className="rounded bg-green-50 px-2 py-1 text-green-950 dark:bg-green-950/40 dark:text-green-100">{f.suggestion}</p></div>
          </div>
        )}
        {f.reason && <p className="text-xs text-muted-foreground">Reason given: {f.reason}</p>}
      </CardContent>
    </Card>
  );
}
