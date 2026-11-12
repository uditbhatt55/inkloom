import type { Database } from "@/lib/database.types";
import { ConfigError, createUserClient, type Db } from "@/lib/supabase/server";

export type Role = Database["public"]["Enums"]["member_role"];
export type Membership = { orgId: string; orgName: string; demo: boolean; role: Role };
export type Viewer =
  | { state: "not_configured" }
  | { state: "signed_out" }
  | { state: "signed_in"; db: Db; userId: string; email: string; memberships: Membership[] };

/** Who is looking, and in which organisations, read under RLS with the user's own session. */
export async function getViewer(): Promise<Viewer> {
  let db: Db;
  try {
    db = await createUserClient();
  } catch (e) {
    if (e instanceof ConfigError) return { state: "not_configured" };
    throw e;
  }
  const { data } = await db.auth.getUser();
  if (!data.user) return { state: "signed_out" };
  const [{ data: rows }, { data: orgs }] = await Promise.all([
    db.from("memberships").select("org_id, role").eq("user_id", data.user.id),
    db.from("organizations").select("id, name, demo"),
  ]);
  const byId = new Map((orgs ?? []).map((o) => [o.id, o]));
  const memberships = (rows ?? [])
    .map((m) => ({ orgId: m.org_id, role: m.role, orgName: byId.get(m.org_id)?.name ?? "Organisation", demo: byId.get(m.org_id)?.demo ?? false }))
    .sort((a, b) => a.orgName.localeCompare(b.orgName));
  return { state: "signed_in", db, userId: data.user.id, email: data.user.email ?? "", memberships };
}

/** Roles that may submit content (§8.1). */
export const canSubmit = (r: Role) => r === "owner" || r === "reviewer" || r === "creator" || r === "agency";
