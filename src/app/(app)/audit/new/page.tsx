import type { Metadata } from "next";
import { NotReady } from "@/components/not-ready";
import { canSubmit, getViewer } from "@/lib/session";
import { AuditForm } from "./audit-form";

export const metadata: Metadata = { title: "New audit · INKLOOM AI" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function NewAuditPage({ searchParams }: { searchParams: Promise<{ item?: string }> }) {
  const viewer = await getViewer();
  if (viewer.state !== "signed_in") return null;
  const orgs = viewer.memberships.filter((m) => canSubmit(m.role));
  if (!orgs.length) return <NotReady kind="no_org" />;

  const { item: itemId } = await searchParams;
  let item: { id: string; title: string } | null = null;
  if (itemId && UUID.test(itemId)) {
    const { data } = await viewer.db.from("content_items").select("id, title").eq("id", itemId).maybeSingle();
    item = data;
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{item ? `New version of "${item.title}"` : "New audit"}</h1>
        <p className="text-sm text-muted-foreground">INKLOOM checks the content against your approved guidelines, facts, terms and brand assets. A person makes every final decision.</p>
      </div>
      <AuditForm orgs={orgs.map((o) => ({ orgId: o.orgId, orgName: o.orgName }))} item={item} />
    </div>
  );
}
