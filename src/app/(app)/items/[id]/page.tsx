import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { Finding } from "@/lib/audit/types";
import { bySeverity, segmentText } from "@/lib/highlight";
import { CATEGORY_LABEL, RUN_MODE_LABEL, STATUS_LABEL } from "@/lib/labels";
import {
  canAcceptOrRejectFinding,
  canDismissOrWaiveFinding,
  canUserComment,
} from "@/lib/review/approval";
import { computeScore } from "@/lib/score/score";
import { canSubmit, getViewer } from "@/lib/session";
import { CommentsBox } from "./comments-box";
import { DecisionPanel } from "./decision-panel";
import { FindingCard, type CitedSource } from "./finding-card";

export const metadata: Metadata = { title: "Audit · INKLOOM AI" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ v?: string }>;
}) {
  const [{ id }, { v }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const viewer = await getViewer();
  if (viewer.state !== "signed_in") return null;
  const { db } = viewer;

  const { data: item } = await db
    .from("content_items")
    .select("id, org_id, title, channel, audience, status, owner_id")
    .eq("id", id)
    .maybeSingle();
  if (!item) notFound();
  const { data: versions } = await db
    .from("content_versions")
    .select("id, n, text, created_at")
    .eq("item_id", id)
    .order("n", { ascending: false });
  const version = (v && versions?.find((x) => String(x.n) === v)) || versions?.[0];
  if (!version) notFound();

  const { data: run } = await db
    .from("audit_runs")
    .select("id, mode, model, prompt_ver, score, warnings, created_at")
    .eq("version_id", version.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: rows } = run
    ? await db.from("findings").select("*").eq("run_id", run.id)
    : { data: [] };
  const findings = [...(rows ?? [])].sort(bySeverity);

  // fetch comments and decisions in parallel under RLS
  const [{ data: comments }, { data: decisions }] = await Promise.all([
    db
      .from("comments")
      .select("*")
      .eq("item_id", id)
      .order("created_at", { ascending: true }),
    db
      .from("decisions")
      .select("*")
      .eq("item_id", id)
      .order("created_at", { ascending: false }),
  ]);

  // cited clauses / facts / terms, read under RLS: internal ones come back empty for creators and agencies
  const ids = (k: "clause_id" | "fact_id" | "term_id") => [
    ...new Set(findings.map((f) => f[k]).filter((x): x is string => !!x)),
  ];
  const [clauses, facts, terms] = await Promise.all([
    ids("clause_id").length
      ? db.from("guideline_clauses").select("id, code, text").in("id", ids("clause_id"))
      : null,
    ids("fact_id").length
      ? db
          .from("approved_facts")
          .select("id, code, statement, valid_until, owner_name")
          .in("id", ids("fact_id"))
      : null,
    ids("term_id").length
      ? db.from("terminology").select("id, code, term, kind, replacement").in("id", ids("term_id"))
      : null,
  ]);
  const sourceOf = (f: (typeof findings)[number]): CitedSource | null => {
    if (f.clause_id) {
      const c = clauses?.data?.find((x) => x.id === f.clause_id);
      return { code: c?.code ?? f.rule_code ?? "", kind: "Clause", text: c?.text ?? null };
    }
    if (f.fact_id) {
      const x = facts?.data?.find((y) => y.id === f.fact_id);
      return {
        code: x?.code ?? f.rule_code ?? "",
        kind: "Fact",
        text: x?.statement ?? null,
        note: x
          ? [x.owner_name && `owner: ${x.owner_name}`, x.valid_until && `valid until ${x.valid_until}`]
              .filter(Boolean)
              .join(", ")
          : undefined,
      };
    }
    if (f.term_id) {
      const t = terms?.data?.find((x) => x.id === f.term_id);
      return {
        code: t?.code ?? f.rule_code ?? "",
        kind: "Term",
        text: t ? `${t.kind}: "${t.term}"${t.replacement ? ` → use "${t.replacement}"` : ""}` : null,
      };
    }
    return null;
  };

  // live score: same formula as the audit (§7.5), but with today's decisions (dismissed/waived no longer count)
  const live = computeScore(
    findings.map(
      (f) =>
        ({
          quote: f.quote,
          start: f.start_offset ?? -1,
          end: f.end_offset ?? -1,
          category: f.category,
          severity: f.severity,
          confidence: f.confidence,
          source: f.source === "ai" ? "ai" : "rule",
          ruleCode: f.rule_code,
          explanation: f.explanation,
          suggestion: f.suggestion,
          status: f.status,
          label: null,
        } satisfies Finding)
    )
  );
  const number = new Map(findings.map((f, i) => [f.id, i + 1]));
  const segments = segmentText(
    version.text ?? "",
    findings.map((f) => ({ id: f.id, start: f.start_offset, end: f.end_offset }))
  );
  const docLevel = findings.filter((f) => f.start_offset === null);
  const role = viewer.memberships.find((m) => m.orgId === item.org_id)?.role;
  const isItemAuthor = item.owner_id === viewer.userId;
  const canActFinding = canAcceptOrRejectFinding({ role, isItemAuthor });
  const canWaiveFinding = canDismissOrWaiveFinding({ role, isItemAuthor });
  const canComment = canUserComment({ role });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">
            <Link href="/dashboard" className="underline-offset-4 hover:underline">
              Content
            </Link>{" "}
            / {item.channel ?? "content"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Badge variant="secondary">{STATUS_LABEL[item.status]}</Badge>
            <span className="text-muted-foreground">
              Version {version.n} of {versions!.length} · {item.audience === "public" ? "Public" : "Internal"}
            </span>
          </div>
        </div>
        {role && canSubmit(role) && (
          <Button asChild variant="outline">
            <Link href={`/audit/new?item=${item.id}`}>Upload new version</Link>
          </Button>
        )}
      </div>

      {!run ? (
        <Alert>
          <AlertTitle>Not audited yet</AlertTitle>
          <AlertDescription>This version has no audit run.</AlertDescription>
        </Alert>
      ) : (
        <>
          {live.blocked && (
            <Alert variant="destructive">
              <AlertTitle>Approval blocked</AlertTitle>
              <AlertDescription>
                {live.openCritical} critical finding{live.openCritical > 1 ? "s are" : " is"} still open.
                Fix {live.openCritical > 1 ? "them" : "it"} in a new version, or a reviewer can waive with a written reason.
              </AlertDescription>
            </Alert>
          )}
          {run.warnings.length > 0 && (
            <Alert>
              <AlertTitle>Notes about this run</AlertTitle>
              <AlertDescription>
                <ul className="list-disc pl-4">
                  {run.warnings.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
            <div className="space-y-6">
              <section aria-labelledby="content-heading" className="space-y-3">
                <h2 id="content-heading" className="text-lg font-medium">
                  Content
                </h2>
                <div className="whitespace-pre-wrap rounded-lg border bg-background p-4 leading-7">
                  {segments.length === 0 ? (
                    <span className="text-muted-foreground">
                      (no text: image or file-level checks only)
                    </span>
                  ) : (
                    segments.map((s, i) =>
                      s.ids.length ? (
                        <mark
                          key={i}
                          className="rounded-sm bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-500/30"
                        >
                          <a href={`#finding-${s.ids[0]}`} className="no-underline">
                            {s.text}
                            <sup className="ml-0.5 text-[10px] font-semibold">
                              {s.ids.map((x) => number.get(x)).join(",")}
                            </sup>
                          </a>
                        </mark>
                      ) : (
                        <span key={i}>{s.text}</span>
                      )
                    )
                  )}
                </div>
                {docLevel.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    {docLevel.length} finding{docLevel.length > 1 ? "s are" : " is"} about the whole file
                    (images, fonts, colours, readability) and listed on the right.
                  </p>
                )}
              </section>

              <CommentsBox
                itemId={item.id}
                orgId={item.org_id}
                versionId={version.id}
                comments={comments ?? []}
                canComment={canComment}
                currentUserId={viewer.userId}
                itemAuthorId={item.owner_id}
              />
            </div>

            <aside className="space-y-4" aria-labelledby="score-heading">
              <Card className="gap-3 py-4">
                <CardHeader className="px-4">
                  <h2 id="score-heading" className="text-sm font-medium text-muted-foreground">
                    Compliance score
                  </h2>
                  <p className="text-4xl font-semibold tabular-nums">
                    {live.score}
                    <span className="text-base text-muted-foreground"> / 100</span>
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{RUN_MODE_LABEL[run.mode] ?? run.mode}</Badge>
                    {run.model && run.mode !== "simulated" && (
                      <span className="text-muted-foreground">model {run.model}</span>
                    )}
                    <span className="text-muted-foreground">prompt {run.prompt_ver}</span>
                  </div>
                </CardHeader>
                <CardContent className="px-4 text-sm">
                  {Object.keys(live.byCategory).length === 0 ? (
                    <p className="text-muted-foreground">No deductions.</p>
                  ) : (
                    <ul className="space-y-1">
                      {Object.entries(live.byCategory).map(([c, d]) => (
                        <li key={c} className="flex justify-between">
                          <span>{CATEGORY_LABEL[c as keyof typeof CATEGORY_LABEL]}</span>
                          <span className="tabular-nums">−{Number(d.toFixed(1))}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-muted-foreground">
                    Severity × confidence (Critical 25, Major 10, Minor 3; High 1.0, Medium 0.6, Low 0), each
                    category capped at 40.
                  </p>
                </CardContent>
              </Card>

              <DecisionPanel
                item={item}
                versionId={version.id}
                findings={findings}
                role={role}
                currentUserId={viewer.userId}
                decisions={decisions ?? []}
              />

              <h2 className="text-lg font-medium">
                {findings.length} finding{findings.length === 1 ? "" : "s"}
              </h2>
              <div className="space-y-3">
                {findings.map((f) => (
                  <FindingCard
                    key={f.id}
                    f={f}
                    n={number.get(f.id)!}
                    source={sourceOf(f)}
                    canAcceptOrReject={canActFinding}
                    canDismissOrWaive={canWaiveFinding}
                    itemId={item.id}
                    versionId={version.id}
                    orgId={item.org_id}
                  />
                ))}
              </div>
            </aside>
          </div>
        </>
      )}

      {versions!.length > 1 && (
        <nav aria-label="Versions" className="text-sm">
          <h2 className="mb-2 font-medium">History</h2>
          <ul className="flex flex-wrap gap-2">
            {versions!.map((x) => (
              <li key={x.id}>
                <Link
                  href={`/items/${item.id}?v=${x.n}`}
                  aria-current={x.id === version.id ? "page" : undefined}
                  className={`rounded border px-2 py-1 ${
                    x.id === version.id ? "bg-foreground text-background" : ""
                  }`}
                >
                  v{x.n}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}
