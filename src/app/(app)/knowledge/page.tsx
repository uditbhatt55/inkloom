import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getViewer } from "@/lib/session";
import { KnowledgeTabs } from "./knowledge-tabs";

export const metadata: Metadata = { title: "Knowledge Centre · INKLOOM AI" };

export default async function KnowledgePage() {
  const viewer = await getViewer();
  if (viewer.state !== "signed_in") return null;
  const { db } = viewer;

  // Use the first org the viewer belongs to (same approach as the dashboard)
  const orgId = viewer.memberships[0]?.orgId;
  if (!orgId) notFound();

  const role = viewer.memberships.find((m) => m.orgId === orgId)?.role;
  const isOwner = role === "owner";

  const [{ data: clauses }, { data: facts }, { data: terms }, { data: assets }] =
    await Promise.all([
      db
        .from("guideline_clauses")
        .select("id, code, category, text, examples_do, examples_dont, status, version, source_page")
        .eq("org_id", orgId)
        .order("code"),
      db
        .from("approved_facts")
        .select("id, code, statement, valid_from, valid_until, visibility, owner_name, evidence_ref")
        .eq("org_id", orgId)
        .order("code"),
      db
        .from("terminology")
        .select("id, code, term, kind, replacement, owner_name")
        .eq("org_id", orgId)
        .order("code"),
      db
        .from("brand_assets")
        .select("id, name, type, hex, font_name, rules")
        .eq("org_id", orgId)
        .order("name"),
    ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge Centre</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Guidelines, approved facts, terminology and brand assets for{" "}
          <strong>{viewer.memberships[0]?.orgName ?? "your organisation"}</strong>.
          {isOwner && " As owner you can add, edit and retire entries."}
        </p>
      </div>

      <KnowledgeTabs
        clauses={clauses ?? []}
        facts={facts ?? []}
        terms={terms ?? []}
        assets={assets ?? []}
        orgId={orgId}
        isOwner={isOwner}
      />
    </div>
  );
}

