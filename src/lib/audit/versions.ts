import { sha256 } from "@/lib/ai/reviewer";
import { RequestError } from "@/lib/audit/request";
import type { Db } from "@/lib/supabase/server";

/**
 * Inserts the next immutable version of an item, as the signed-in user, so RLS decides who may add one (§8.1).
 * Two uploads at the same moment can pick the same number; the unique (item_id, n) index rejects one (23505) and it
 * retries once with the next number.
 */
export async function createNextVersion(db: Db, item: { id: string; org_id: string }, text: string, userId: string): Promise<{ id: string; n: number }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: last } = await db.from("content_versions").select("n").eq("item_id", item.id).order("n", { ascending: false }).limit(1).maybeSingle();
    const n = (last?.n ?? 0) + 1;
    const { data, error } = await db.from("content_versions")
      .insert({ org_id: item.org_id, item_id: item.id, n, text, sha256: sha256(text), created_by: userId })
      .select("id, n").single();
    if (!error && data) return data;
    if (error?.code !== "23505") throw new RequestError(403, "You can't add a version to this item.");
  }
  throw new RequestError(409, "Another version was saved at the same time. Please try again.");
}
