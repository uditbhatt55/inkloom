import type { Metadata } from "next";
import Link from "next/link";
import { NotReady } from "@/components/not-ready";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { STATUS_LABEL } from "@/lib/labels";
import { canSubmit, getViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Content · INKLOOM AI" };

export default async function Dashboard() {
  const viewer = await getViewer();
  if (viewer.state !== "signed_in") return null;
  if (!viewer.memberships.length) return <NotReady kind="no_org" />;
  const { db } = viewer;

  const { data: items } = await db.from("content_items").select("id, org_id, title, channel, status, created_at").order("created_at", { ascending: false }).limit(50);
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
  const scoreOf = new Map<string, number | null>();
  for (const r of runs ?? []) if (!scoreOf.has(r.version_id)) scoreOf.set(r.version_id, r.score);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Content</h1>
          <p className="text-sm text-muted-foreground">{viewer.memberships.map((m) => `${m.orgName} (${m.role})`).join(" · ")}</p>
        </div>
        {viewer.memberships.some((m) => canSubmit(m.role)) && (
          <Button asChild><Link href="/audit/new">New audit</Link></Button>
        )}
      </div>

      {!items?.length ? (
        <Card>
          <CardHeader><h2 className="font-medium">Nothing audited yet</h2></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Upload a post, PDF, Word file, image or web page to check it against your brand.</CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-background">
          <table className="w-full text-sm">
            <caption className="sr-only">Content items, newest first</caption>
            <thead className="border-b text-left text-muted-foreground">
              <tr><th scope="col" className="px-4 py-3 font-medium">Title</th><th scope="col" className="px-4 py-3 font-medium">Channel</th><th scope="col" className="px-4 py-3 font-medium">Version</th><th scope="col" className="px-4 py-3 font-medium">Score</th><th scope="col" className="px-4 py-3 font-medium">Status</th></tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const v = latestVersion.get(i.id);
                const score = v ? scoreOf.get(v.id) : undefined;
                return (
                  <tr key={i.id} className="border-b last:border-0">
                    <td className="px-4 py-3"><Link href={`/items/${i.id}`} className="font-medium underline-offset-4 hover:underline">{i.title}</Link></td>
                    <td className="px-4 py-3 text-muted-foreground">{i.channel ?? "—"}</td>
                    <td className="px-4 py-3">{v ? `v${v.n}` : "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{score ?? "—"}</td>
                    <td className="px-4 py-3"><Badge variant={i.status === "approved" ? "default" : "secondary"}>{STATUS_LABEL[i.status]}</Badge></td>
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
