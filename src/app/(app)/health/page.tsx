import type { Metadata } from "next";
import Link from "next/link";
import { NotReady } from "@/components/not-ready";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { todayInIndia } from "@/lib/audit/service";
import { loadBrandHealth } from "@/lib/health/load";
import { getViewer } from "@/lib/session";
import { CheckClauseConflicts, SuggestRewrite } from "./ai-actions";

export const metadata: Metadata = { title: "Brand Health · INKLOOM AI" };

const pct = (r: number) => `${Math.round(r * 100)}%`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }) : "—");
const breakdown = (rows: [string, number][]) => rows.map(([k, n]) => `${k} ${n}`).join(" · ");

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{hint}</p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="text-sm text-muted-foreground">{children}</p>;

export default async function BrandHealthPage() {
  const viewer = await getViewer();
  if (viewer.state !== "signed_in") return null;
  const m = viewer.memberships[0];
  if (!m) return <NotReady kind="no_org" />;
  if (m.role !== "owner" && m.role !== "reviewer") {
    return (
      <Card>
        <CardHeader><h1 className="font-semibold">Brand Health</h1></CardHeader>
        <CardContent className="text-sm text-muted-foreground">Brand Health is for brand owners and reviewers. Ask your owner if you need it.</CardContent>
      </Card>
    );
  }

  const h = await loadBrandHealth(viewer.db, m.orgId, todayInIndia());
  const max = Math.max(1, ...h.recurring.map((r) => r.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brand Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Patterns across {h.findingCount} findings for <strong>{m.orgName}</strong>. Suggestions are drafts: a rule changes only when an owner saves it in the{" "}
          <Link href="/knowledge" className="underline underline-offset-4">Knowledge Centre</Link>.
        </p>
      </div>

      <Section title="Recurring mistakes" hint="Rules broken most often in the last 30 days. Dismissed and waived findings are not counted.">
        {!h.recurring.length ? <Empty>No repeated mistakes in the last 30 days.</Empty> : (
          <table className="w-full text-sm">
            <caption className="sr-only">Findings per rule in the last 30 days, most frequent first</caption>
            <thead className="text-left text-muted-foreground">
              <tr><th scope="col" className="w-28 py-2 font-medium">Rule</th><th scope="col" className="py-2 font-medium">Findings</th><th scope="col" className="hidden py-2 font-medium sm:table-cell">Where</th></tr>
            </thead>
            <tbody>
              {h.recurring.map((r) => (
                <tr key={r.ruleCode} className="border-t align-top">
                  <th scope="row" className="py-2 pr-3 text-left font-mono text-xs font-normal">{r.ruleCode}</th>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="h-3 rounded-sm bg-primary" style={{ width: `${(r.count / max) * 100}%`, minWidth: "0.5rem" }} aria-hidden="true" />
                      <span className="tabular-nums">{r.count}</span>
                    </div>
                  </td>
                  <td className="hidden py-2 text-muted-foreground sm:table-cell">{breakdown(r.byChannel)}<br />{breakdown(r.byRole)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Unclear rules" hint="Rules whose findings reviewers dismiss or waive in 40% or more of at least 5 decisions. The rule may be too broad or badly worded.">
        {!h.unclear.length ? <Empty>No rule is overruled that often yet.</Empty> : (
          <ul className="space-y-3">
            {h.unclear.map((u) => (
              <li key={u.ruleCode} className="rounded-md border p-3 text-sm">
                <p><span className="font-mono text-xs">{u.ruleCode}</span> is dismissed or waived in <strong>{pct(u.rate)}</strong> of reviews ({u.overruled} of {u.decided}).</p>
                <p className="mt-1 text-muted-foreground">
                  Suggestion: reword the rule or add an allowed example
                  {u.examples.length > 0 && <> such as {u.examples.map((e, i) => <span key={e}>{i > 0 && ", "}“{e}”</span>)}</>}.
                </p>
                <SuggestRewrite orgId={m.orgId} code={u.ruleCode} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Conflicting rules" hint="Terms that contradict each other in the terminology list, and (on request) guideline clauses that contradict each other.">
        {!h.conflicts.length ? <Empty>No conflicting terms.</Empty> : (
          <ul className="space-y-2 text-sm">
            {h.conflicts.map((c) => (
              <li key={`${c.term}-${c.reason}`} className="rounded-md border p-3">
                “{c.term}” is {c.reason} ({c.codes.join(", ")}). Suggestion: keep one entry and remove or change the other.
              </li>
            ))}
          </ul>
        )}
        <CheckClauseConflicts orgId={m.orgId} />
      </Section>

      <Section title="Fact impact" hint="Approved content that relies on a fact that has expired, expires within 30 days, or changed after the content was approved.">
        {!h.factAlerts.length ? <Empty>No approved content relies on an expired or changed fact.</Empty> : (
          <ul className="space-y-3">
            {h.factAlerts.map((a) => (
              <li key={a.code} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{a.code}</span>
                  <Badge variant={a.reason === "expired" ? "destructive" : "secondary"}>
                    {a.reason === "expired" ? "Expired" : a.reason === "expiring" ? "Expires soon" : "Changed"}
                  </Badge>
                  <span>{a.statement}</span>
                </div>
                <p className="mt-2 text-muted-foreground">Re-audit {a.items.length === 1 ? "this approved item" : `these ${a.items.length} approved items`}:</p>
                <ul className="mt-1 list-disc pl-5">
                  {a.items.map((i) => (
                    <li key={i.id}>
                      <Link href={`/items/${i.id}`} className="underline underline-offset-4">{i.title}</Link>
                      <span className="text-muted-foreground"> · approved {day(i.approvedAt)}{i.changedAfterApproval && " · fact changed since"}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
