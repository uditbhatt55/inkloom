import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ROLE_LABEL } from "@/lib/labels";
import { getViewer } from "@/lib/session";

export const metadata: Metadata = { title: "Activity · INKLOOM AI" };

const when = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

/** activity_log rows in words; unknown combinations fall back to "<action> <table>". */
const TABLE_LABEL: Record<string, string> = {
  content_items: "content item", content_versions: "version", audit_runs: "audit", decisions: "decision",
  approved_facts: "fact", guideline_clauses: "guideline", terminology: "term", brand_assets: "brand asset",
};
type Detail = { from?: string | null; to?: string | null } | null;
function describe(action: string, table: string, detail: Detail): string {
  if (action === "sign_in") return "Signed in";
  if (action === "member_added") return `Member added as ${detail?.to ?? "?"}`;
  if (action === "member_removed") return `Member removed (was ${detail?.from ?? "?"})`;
  if (action === "role_changed") return `Role changed from ${detail?.from ?? "?"} to ${detail?.to ?? "?"}`;
  const what = TABLE_LABEL[table] ?? table;
  return action === "insert" ? `Created ${what}` : action === "update" ? `Changed ${what}` : `${action} ${what}`;
}
const SECURITY = new Set(["sign_in", "member_added", "member_removed", "role_changed"]);

/**
 * Notifications for the signed-in person (opening the page marks them read), and, for owners and reviewers, the
 * organisation's security and activity log (migration 20261117000200). People are shown by role, not by email.
 */
export default async function ActivityPage() {
  const viewer = await getViewer();
  if (viewer.state !== "signed_in") return null;
  const { db, userId } = viewer;
  const org = viewer.memberships[0];
  const canSeeLog = org && (org.role === "owner" || org.role === "reviewer");

  const [{ data: notes }, log, { data: members }] = await Promise.all([
    db.from("notifications").select("id, item_id, kind, body, created_at, read_at").order("created_at", { ascending: false }).limit(50),
    canSeeLog
      ? db.from("activity_log").select("id, actor_id, action, target_table, detail, at").eq("org_id", org.orgId).order("at", { ascending: false }).limit(100)
      : Promise.resolve({ data: null }),
    org ? db.from("memberships").select("user_id, role").eq("org_id", org.orgId) : Promise.resolve({ data: null }),
  ]);
  if (notes?.some((n) => !n.read_at)) await db.from("notifications").update({ read_at: new Date().toISOString() }).is("read_at", null);

  const roleOf = new Map((members ?? []).map((m) => [m.user_id, m.role]));
  const who = (id: string | null) =>
    !id ? "System" : id === userId ? "You" : `${roleOf.has(id) ? ROLE_LABEL[roleOf.get(id)!] : "Former member"} ${id.slice(0, 8)}`;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">Activity</h1>

      <section aria-labelledby="notes-heading" className="space-y-3">
        <h2 id="notes-heading" className="text-lg font-medium">Notifications</h2>
        {!notes?.length ? (
          <p className="text-sm text-muted-foreground">Nothing yet. Decisions, comments and new versions on your work show up here.</p>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {notes.map((n) => (
              <li key={n.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3 text-sm">
                <span className="min-w-0">
                  {!n.read_at && <Badge className="mr-2">New</Badge>}
                  {n.item_id ? <Link href={`/items/${n.item_id}`} className="underline-offset-4 hover:underline">{n.body}</Link> : n.body}
                </span>
                <time dateTime={n.created_at} className="text-xs text-muted-foreground">{when.format(new Date(n.created_at))}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      {canSeeLog && (
        <section aria-labelledby="log-heading" className="space-y-3">
          <h2 id="log-heading" className="text-lg font-medium">Security and activity log</h2>
          <p className="text-sm text-muted-foreground">
            Sign-ins, role changes, approvals and every change to content and the knowledge base, written by the database. Nobody can edit or delete it. Latest 100.
          </p>
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <caption className="sr-only">Activity log, newest first</caption>
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-3 font-medium">When</th>
                  <th scope="col" className="px-4 py-3 font-medium">Who</th>
                  <th scope="col" className="px-4 py-3 font-medium">What</th>
                </tr>
              </thead>
              <tbody>
                {(log.data ?? []).map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground"><time dateTime={r.at}>{when.format(new Date(r.at))}</time></td>
                    <td className="px-4 py-2.5">{who(r.actor_id)}</td>
                    <td className="px-4 py-2.5">
                      {SECURITY.has(r.action) && <Badge variant="outline" className="mr-2">Security</Badge>}
                      {describe(r.action, r.target_table, r.detail as Detail)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
