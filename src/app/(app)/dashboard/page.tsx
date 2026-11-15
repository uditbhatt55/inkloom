import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { NotReady } from "@/components/not-ready";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/database.types";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/labels";
import { canSubmit, getViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Content · INKLOOM AI" };

type Status = Database["public"]["Enums"]["item_status"];
const LIMIT = 50;
const STATUSES = Object.keys(STATUS_LABEL) as Status[];
const CHIPS: { label: string; value: Status | "" }[] = [
  { label: "All", value: "" },
  { label: "In review", value: "in_review" },
  { label: "Changes requested", value: "changes_requested" },
  { label: "Approved", value: "approved" },
  { label: "Draft", value: "draft" },
];

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });

/** Escape LIKE wildcards so a typed "%" or "_" is matched literally. */
const likeSafe = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; channel?: string }> }) {
  const viewer = await getViewer();
  if (viewer.state !== "signed_in") return null;
  if (!viewer.memberships.length) return <NotReady kind="no_org" />;
  const { db } = viewer;

  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 100);
  const status = STATUSES.includes(sp.status as Status) ? (sp.status as Status) : "";
  const channel = (sp.channel ?? "").slice(0, 60);
  const filtered = !!(q || status || channel);

  // Unfiltered summary for the tiles and the channel list; the table below is filtered.
  const { data: all } = await db.from("content_items").select("status, channel").order("created_at", { ascending: false }).limit(500);
  const summary = all ?? [];
  const channels = [...new Set(summary.map((i) => i.channel).filter((c): c is string => !!c))].sort();

  let query = db.from("content_items").select("id, org_id, title, channel, status, created_at").order("created_at", { ascending: false }).limit(LIMIT);
  if (q) query = query.ilike("title", `%${likeSafe(q)}%`);
  if (status) query = query.eq("status", status);
  if (channel) query = query.eq("channel", channel);
  const { data: items } = await query;

  const ids = (items ?? []).map((i) => i.id);
  const { data: versions } = ids.length
    ? await db.from("content_versions").select("id, item_id, n").in("item_id", ids)
    : { data: [] as { id: string; item_id: string; n: number }[] };
  const latestVersion = new Map<string, { id: string; n: number }>();
  for (const v of versions ?? []) if ((latestVersion.get(v.item_id)?.n ?? 0) < v.n) latestVersion.set(v.item_id, v);
  const vIds = [...latestVersion.values()].map((v) => v.id);
  const { data: runs } = vIds.length
    ? await db.from("audit_runs").select("version_id, score, created_at").in("version_id", vIds).order("created_at", { ascending: false })
    : { data: [] as { version_id: string; score: number | null; created_at: string }[] };
  const runOf = new Map<string, { score: number | null; at: string }>();
  for (const r of runs ?? []) if (!runOf.has(r.version_id)) runOf.set(r.version_id, { score: r.score, at: r.created_at });

  const list = items ?? [];
  const count = (s: Status) => summary.filter((i) => i.status === s).length;
  const tiles = [
    { label: "Items", value: summary.length },
    { label: "In review", value: count("in_review") + count("ai_audited") },
    { label: "Changes requested", value: count("changes_requested") },
    { label: "Approved", value: count("approved") },
  ];
  const mayAudit = viewer.memberships.some((m) => canSubmit(m.role));
  const href = (next: { status?: string }) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (channel) p.set("channel", channel);
    if (next.status) p.set("status", next.status);
    const s = p.toString();
    return s ? `/dashboard?${s}` : "/dashboard";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs text-muted-foreground">{viewer.memberships.map((m) => `${m.orgName} (${m.role})`).join(" · ")}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Content</h1>
        </div>
        {mayAudit && (
          <Button asChild><Link href="/audit/new"><Plus aria-hidden="true" />New audit</Link></Button>
        )}
      </div>

      {summary.length > 0 && (
        <section aria-label="Summary" className="space-y-2">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl border bg-card px-5 py-4">
                <p className="text-sm text-muted-foreground">{t.label}</p>
                <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{t.value}</p>
              </div>
            ))}
          </div>
          {summary.length === 500 && <p className="text-xs text-muted-foreground">Counts cover the 500 newest items.</p>}
        </section>
      )}

      {summary.length > 0 && (
        <div className="space-y-3">
          <form method="get" action="/dashboard" role="search" className="flex flex-wrap items-end gap-2">
            {status && <input type="hidden" name="status" value={status} />}
            <div className="relative min-w-0 flex-[1_1_260px]">
              <label htmlFor="q" className="sr-only">Search titles</label>
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input id="q" name="q" type="search" defaultValue={q} placeholder="Search titles…" className="h-10 w-full rounded-lg border border-input bg-card pr-3 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50" />
            </div>
            <div>
              <label htmlFor="channel" className="sr-only">Channel</label>
              <select id="channel" name="channel" defaultValue={channel} className="h-10 rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50">
                <option value="">All channels</option>
                {channels.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <Button type="submit" variant="outline" className="h-10">Apply</Button>
            {filtered && <Button asChild variant="ghost" className="h-10"><Link href="/dashboard">Clear</Link></Button>}
          </form>
          <nav aria-label="Filter by status" className="flex flex-wrap gap-1.5">
            {CHIPS.map((c) => {
              const on = c.value === status;
              return (
                <Link
                  key={c.label}
                  href={href({ status: c.value })}
                  aria-current={on ? "true" : undefined}
                  className={`inline-flex h-8 items-center rounded-full border px-3 text-[13px] font-medium transition-colors duration-150 ${on ? "border-foreground bg-foreground text-background" : "border-input bg-card text-zinc-700 hover:bg-muted"}`}
                >
                  {c.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {!summary.length ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed bg-card px-6 py-12 text-center">
          <h2 className="text-base font-semibold">Nothing audited yet</h2>
          <p className="max-w-md text-sm text-muted-foreground">Upload a post, PDF, Word file, image or web page to check it against your brand.</p>
          {mayAudit && <Button asChild className="mt-2"><Link href="/audit/new">Audit your first piece</Link></Button>}
        </div>
      ) : !list.length ? (
        <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground" role="status">
          No content matches these filters. <Link href="/dashboard" className="font-medium text-primary underline-offset-4 hover:underline">Clear filters</Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Content items, newest first{filtered ? ", filtered" : ""}</caption>
            <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Title</th>
                <th scope="col" className="px-4 py-3 font-medium">Channel</th>
                <th scope="col" className="px-4 py-3 font-medium">Version</th>
                <th scope="col" className="px-4 py-3 font-medium">Score</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Last audit</th>
              </tr>
            </thead>
            <tbody>
              {list.map((i) => {
                const v = latestVersion.get(i.id);
                const run = v ? runOf.get(v.id) : undefined;
                return (
                  <tr key={i.id} className="border-b transition-colors duration-150 last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3.5"><Link href={`/items/${i.id}`} className="font-medium underline-offset-4 hover:underline">{i.title}</Link></td>
                    <td className="px-4 py-3.5 text-muted-foreground">{i.channel ?? "—"}</td>
                    <td className="px-4 py-3.5 font-mono text-xs">{v ? `v${v.n}` : "—"}</td>
                    <td className="px-4 py-3.5 font-mono tabular-nums">{run?.score ?? "—"}</td>
                    <td className="px-4 py-3.5"><Badge className={STATUS_STYLE[i.status]}>{STATUS_LABEL[i.status]}</Badge></td>
                    <td className="px-4 py-3.5 text-muted-foreground">{run ? <time dateTime={run.at}>{when.format(new Date(run.at))}</time> : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
