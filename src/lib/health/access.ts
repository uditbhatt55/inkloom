import { NextResponse } from "next/server";
import { createUserClient, type Db } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/**
 * Brand Health actions are for the organisation's owner and reviewers (same as the page). Reads go through the user's own
 * client, so RLS still decides what they can see. Returns the client and org, or the error response to send back.
 */
export async function requireOwnerOrReviewer(orgId: unknown): Promise<{ db: Db; orgId: string } | NextResponse> {
  if (typeof orgId !== "string" || !UUID.test(orgId)) return fail(400, "Missing organisation.");
  const db = await createUserClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return fail(401, "Please sign in.");
  const { data: m } = await db.from("memberships").select("role").eq("org_id", orgId).eq("user_id", auth.user.id).maybeSingle();
  if (m?.role !== "owner" && m?.role !== "reviewer") return fail(403, "Only the brand owner and reviewers can use Brand Health.");
  return { db, orgId };
}
