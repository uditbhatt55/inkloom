/** Shape of a Supabase/PostgREST error (or a thrown fetch error). */
export type DbError = { code?: string | null; message?: string | null } | null | undefined;

/**
 * Turns a database error into a fixed, user-safe sentence. Raw Postgres/PostgREST text (table names, policy names,
 * constraint names) is never shown. Messages raised on purpose by our own triggers are rephrased, not passed through.
 */
export function friendlyDbError(err: DbError): string {
  const code = err?.code ?? "";
  const msg = (err?.message ?? "").toLowerCase();

  const blocked = /approval blocked: (\d+) open critical/.exec(msg);
  if (blocked) {
    const n = Number(blocked[1]);
    return `Approval is blocked: ${n} critical finding${n === 1 ? " is" : "s are"} still open. Fix ${n === 1 ? "it" : "them"} in a new version, or waive with a written reason.`;
  }
  if (msg.includes("version does not belong")) return "This version no longer matches the item. Reload the page and try again.";
  if (msg.includes("only a reviewer or owner")) return "Only a reviewer or owner who did not write this content can dismiss, waive or resolve a finding.";
  if (code === "42501" || msg.includes("row-level security") || msg.includes("permission denied")) return "You don't have permission to do that.";
  if (code === "23514" || code === "23502") return "A written reason is required for this action.";
  if (code === "23503") return "That item or finding no longer exists. Reload the page.";
  if (code === "23505") return "This was already saved. Reload the page to see it.";
  if (code === "PGRST301" || code === "PGRST303" || msg.includes("jwt")) return "Your session has expired. Please sign in again.";
  if (msg.includes("failed to fetch") || msg.includes("network")) return "Could not reach the server. Check your connection and try again.";
  return "That didn't work. Please try again.";
}
