import type { Metadata } from "next";
import Link from "next/link";
import { NotReady } from "@/components/not-ready";
import { getViewer } from "@/lib/session";
import { KnowledgeTabs } from "./knowledge-tabs";

export const metadata: Metadata = { title: "Knowledge Centre · INKLOOM AI" };

/**
 * Knowledge Centre (P2, proposal §5.1): the approved source material every finding cites.
 * Everything is read under RLS, so creators and agencies never receive internal facts or codenames;
 * only owners can change entries (RLS + the UI hides the controls).
 */
export default async function KnowledgePage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const viewer = await getViewer();
  if (viewer.state !== "signed_in") return null;
  if (!viewer.memberships.length) return <NotReady kind="no_org" />;
  const { db } = viewer;

  // the ?org= value is only used if the viewer is a member of that organisation
  const { org } = await searchParams;
  const membership = viewer.memberships.find((m) => m.orgId === org) ?? viewer.memberships[0];
  const orgId = membership.orgId;
  const isOwner = membership.role === "owner";

  const [{ data: clauses }, { data: history }, { data: facts }, { data: terms }, { data: assets }] = await Promise.all([
    db.from("guideline_clauses").select("id, code, category, text, examples_do, examples_dont, status, version, source_page").eq("org_id", orgId).order("code"),
    db.from("guideline_clause_history").select("id, clause_id, version, text, changed_at").eq("org_id", orgId).order("version", { ascending: false }),
    db.from("approved_facts").select("id, code, statement, valid_from, valid_until, visibility, owner_name, evidence_ref").eq("org_id", orgId).order("code"),
    db.from("terminology").select("id, code, term, kind, replacement, owner_name").eq("org_id", orgId).order("code"),
    db.from("brand_assets").select("id, name, type, hex, font_name, rules").eq("org_id", orgId).order("type").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Centre</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Guidelines, approved facts, terminology and brand assets for <strong>{membership.orgName}</strong>.
            {isOwner ? " As owner you can add, edit and retire entries." : " Only owners can change entries."}
          </p>
        </div>
        {viewer.memberships.length > 1 && (
          <nav aria-label="Organisation" className="flex flex-wrap gap-2 text-sm">
            {viewer.memberships.map((m) => (
              <Link key={m.orgId} href={`/knowledge?org=${m.orgId}`} aria-current={m.orgId === orgId ? "page" : undefined}
                className={`rounded border px-2 py-1 ${m.orgId === orgId ? "bg-foreground text-background" : ""}`}>
                {m.orgName}
              </Link>
            ))}
          </nav>
        )}
      </div>

      <KnowledgeTabs
        clauses={clauses ?? []}
        history={history ?? []}
        facts={facts ?? []}
        terms={terms ?? []}
        assets={assets ?? []}
        orgId={orgId}
        isOwner={isOwner}
      />
    </div>
  );
}
