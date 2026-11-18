import type { Metadata } from "next";
import Link from "next/link";
import { NotReady } from "@/components/not-ready";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { todayInIndia } from "@/lib/audit/service";
import { isSmallSample, SOLID_SAMPLE } from "@/lib/health/detectors";
import { loadBrandHealth } from "@/lib/health/load";
import { getViewer } from "@/lib/session";
import { CheckClauseConflicts, SuggestRewrite } from "./ai-actions";
import measured from "../../../../eval/results/health-helpers.json";
import { ReauditMany } from "./reaudit-many";

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

/** How many cases a signal rests on; under SOLID_SAMPLE it is marked as a small sample (improvement 3). */
function Sample({ n, of }: { n: number; of: string }) {
  return (
    <Badge variant="outline" title={`Signals on fewer than ${SOLID_SAMPLE} ${of} are shown but marked as a small sample`}>
      {n} {of}{isSmallSample(n) && " · small sample"}
    </Badge>
  );
}

/** What `npm run eval:health` measured for the AI helpers (eval/results/health-helpers.json), shown before anyone uses them. */
function Measured({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-2 text-xs text-muted-foreground">
      Measured before release on {day(measured.measured_at)} with {measured.model}, {measured.runs_per_case} runs per case: {children} Test cases were drafted with AI help and are awaiting a person&apos;s review.
    </p>
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
  // weeks before the first audit are left out, so a new organisation does not see a row of empty weeks
  const firstWeek = h.trend.findIndex((w) => w.posts > 0);
  const trend = firstWeek < 0 ? [] : h.trend.slice(firstWeek);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Brand Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Patterns across {h.findingCount} findings for <strong>{m.orgName}</strong>. Suggestions are drafts: a rule changes only when an owner saves it in the{" "}
          <Link href="/knowledge" className="underline underline-offset-4">Knowledge Centre</Link>.
        </p>
      </div>

      <Section title="Recurring mistakes" hint="Rules broken in the most posts in the last 30 days. A post counts once per rule, however many versions repeat the mistake. Dismissed and waived findings are not counted.">
        <div className="mb-2"><Sample n={h.postsAudited30} of="posts audited" /></div>
        {!h.recurring.length ? <Empty>No repeated mistakes in the last 30 days.</Empty> : (
          <table className="w-full text-sm">
            <caption className="sr-only">Posts that broke each rule in the last 30 days, most frequent first</caption>
            <thead className="text-left text-muted-foreground">
              <tr><th scope="col" className="w-28 py-2 font-medium">Rule</th><th scope="col" className="py-2 font-medium">Posts</th><th scope="col" className="hidden py-2 font-medium sm:table-cell">Where</th></tr>
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
                <p className="flex flex-wrap items-center gap-2"><span><span className="font-mono text-xs">{u.ruleCode}</span> is dismissed or waived in <strong>{pct(u.rate)}</strong> of reviews ({u.overruled} of {u.decided}).</span> <Sample n={u.decided} of="decisions" /></p>
                <p className="mt-1 text-muted-foreground">
                  Suggestion: reword the rule or add an allowed example
                  {u.examples.length > 0 && <> such as {u.examples.map((e, i) => <span key={e}>{i > 0 && ", "}“{e}”</span>)}</>}.
                </p>
                <SuggestRewrite orgId={m.orgId} code={u.ruleCode} />
              </li>
            ))}
          </ul>
        )}
        <Measured>
          on {measured.rewrites.cases} labelled unclear rules, {pct(measured.rewrites.accepted_rate ?? 0)} of drafts passed the safety checks (no invented numbers, no banned or internal terms)
          and {pct(measured.rewrites.kept_intent_rate ?? 0)} kept the rule&apos;s intent; drafts that fail are never shown.
        </Measured>
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
        <Measured>
          on {measured.conflicts.sets} labelled clause sets it found {measured.conflicts.tp} of {measured.conflicts.tp + measured.conflicts.fn} real contradictions,
          with {measured.conflicts.fp} wrong ones and {measured.conflicts.cleanSetsFlagged} false alarms on {measured.conflicts.cleanSets} conflict-free runs.
        </Measured>
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
                <ReauditMany itemIds={a.items.map((i) => i.id)} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Facts about to expire" hint="Facts that have expired or expire within 30 days, whether or not approved content uses them yet. Renew or retire them in the Knowledge Centre before writers rely on them.">
        {!h.expiring.length ? <Empty>No fact expires in the next 30 days.</Empty> : (
          <ul className="space-y-2 text-sm">
            {h.expiring.map((f) => (
              <li key={f.code} className="flex flex-wrap items-center gap-2 rounded-md border p-3">
                <span className="font-mono text-xs">{f.code}</span>
                <Badge variant={f.daysLeft < 0 ? "destructive" : "secondary"}>
                  {f.daysLeft < 0 ? `Expired ${-f.daysLeft} day${f.daysLeft === -1 ? "" : "s"} ago` : f.daysLeft === 0 ? "Expires today" : `${f.daysLeft} day${f.daysLeft === 1 ? "" : "s"} left`}
                </Badge>
                <span>{f.statement}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Trend" hint="Posts audited and rule mistakes per week (Monday to Sunday), over the last 8 weeks. A mistake is counted once per post and rule.">
        {!trend.length ? <Empty>No audits in the last 8 weeks.</Empty> : (
        <table className="w-full text-sm">
          <caption className="sr-only">Posts audited and rule mistakes per week</caption>
          <thead className="text-left text-muted-foreground">
            <tr><th scope="col" className="py-2 font-medium">Week of</th><th scope="col" className="py-2 font-medium">Posts</th><th scope="col" className="py-2 font-medium">Mistakes</th><th scope="col" className="py-2 font-medium">Per post</th></tr>
          </thead>
          <tbody>
            {trend.map((w) => (
              <tr key={w.weekStart} className="border-t">
                <td className="py-1.5">{day(`${w.weekStart}T12:00:00Z`)}</td>
                <td className="py-1.5 tabular-nums">{w.posts}</td>
                <td className="py-1.5 tabular-nums">{w.mistakes}</td>
                <td className="py-1.5 tabular-nums">{w.posts ? (w.mistakes / w.posts).toFixed(1) : "—"}{w.posts > 0 && isSmallSample(w.posts) && <span className="text-xs text-muted-foreground"> · small sample</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </Section>

      <Section title="Rule-change impact" hint="For each guideline changed in the last 30 days: posts audited both before and after the change, which ones the changed rule now flags, and which it no longer flags. Measured from real re-audits; a post not re-audited since is not counted.">
        {!h.ruleChanges.length ? <Empty>No guideline was changed in the last 30 days.</Empty> : (
          <ul className="space-y-3 text-sm">
            {h.ruleChanges.map((c) => (
              <li key={`${c.code}-${c.version}`} className="rounded-md border p-3">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs">{c.code}</span> version {c.version}, changed {day(c.changedAt)}
                  <Sample n={c.compared} of="posts compared" />
                </p>
                {c.compared === 0 ? <p className="mt-1 text-muted-foreground">No post has been re-audited since the change yet.</p> : (
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    <div><p className="font-medium">Newly flagged ({c.newlyFlagged.length})</p>{c.newlyFlagged.map((i) => <Link key={i.id} href={`/items/${i.id}`} className="block underline underline-offset-4">{i.title}</Link>)}</div>
                    <div><p className="font-medium">No longer flagged ({c.noLongerRaised.length})</p>{c.noLongerRaised.map((i) => <Link key={i.id} href={`/items/${i.id}`} className="block underline underline-offset-4">{i.title}</Link>)}</div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
