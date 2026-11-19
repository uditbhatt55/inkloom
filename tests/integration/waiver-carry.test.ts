import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb } from "../db/harness";

// Migration 20261119000000: a carry-forward waiver covers the same finding in later versions of the post.
const A = "00000000-0000-4000-8000-00000000000a";
const CREATOR = "00000000-0000-4000-8000-0000000000c1";
const REVIEWER = "00000000-0000-4000-8000-0000000000c2";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ITEM = id(101);

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${CREATOR}','c@a.test'),('${REVIEWER}','r@a.test');
    insert into organizations (id, name) values ('${A}','Org A');
    insert into memberships values ('${A}','${CREATOR}','creator'),('${A}','${REVIEWER}','reviewer');
    insert into content_items (id, org_id, title, owner_id) values ('${ITEM}','${A}','Launch post','${CREATOR}');
  `);
}, 120_000);

const finding = (quote: string) => ({ category: "confidentiality", severity: "critical", confidence: "high", quote,
  start_offset: -1, end_offset: -1, rule_code: "TERM-02", source: "rule", explanation: "internal name" });

/** New version n with one critical finding per quote, audited by the service role. Returns the finding ids. */
async function auditVersion(n: number, quotes: string[]) {
  const v = id(200 + n);
  await db.exec(`insert into content_versions (id, org_id, item_id, n, text, sha256, created_by)
    values ('${v}','${A}','${ITEM}',${n},'v${n}','h${n}','${CREATOR}')`);
  const run = (await db.query<{ id: string }>("select public.save_audit($1::jsonb) as id",
    [JSON.stringify({ org_id: A, version_id: v, mode: "rule_only", score: 50, findings: quotes.map(finding) })])).rows[0].id;
  const rows = (await db.query<{ id: string; status: string; reason: string | null }>(
    `select id, status::text, reason from findings where run_id = '${run}' order by quote`)).rows;
  return { v, rows };
}

// committed as the reviewer through RLS (asUser always rolls back, and later audits must see this waiver)
const waive = (v: string, f: string, carry: boolean, expires = "null") =>
  db.transaction((tx) => tx.exec(`set local role authenticated;
    select set_config('request.jwt.claims', '${JSON.stringify({ sub: REVIEWER, role: "authenticated" })}', true);
    insert into decisions (org_id, item_id, version_id, finding_id, author_id, decision, reason, carry_forward, expires_at)
    values ('${A}','${ITEM}','${v}','${f}','${REVIEWER}','waive','legal said yes',${carry},${expires})`));

describe("carry-forward waivers", () => {
  it("only a carry-forward waiver reaches the next version, and only for the same words", async () => {
    const v1 = await auditVersion(1, ["NB Sync", "Project Kite"]);
    await waive(v1.v, v1.rows[0].id, true); // "NB Sync"
    await waive(v1.v, v1.rows[1].id, false); // "Project Kite": this version only

    const v2 = await auditVersion(2, ["NB Sync", "Project Kite"]);
    expect(v2.rows.map((r) => r.status)).toEqual(["waived", "open"]);
    expect(v2.rows[0].reason).toBe("Carried from version 1: legal said yes");

    // carried again to v3 without stacking prefixes; a changed quote is a new finding and stays open
    const v3 = await auditVersion(3, ["NB Sync", "NB Sync Pro"]);
    expect(v3.rows.map((r) => r.status)).toEqual(["waived", "open"]);
    expect(v3.rows[0].reason).toBe("Carried from version 2: legal said yes");
  });

  it("an expired waiver is not carried", async () => {
    const v4 = await auditVersion(4, ["Old Codename"]);
    await waive(v4.v, v4.rows[0].id, true, "now() + interval '1 day'");
    await db.exec(`update decisions set expires_at = now() - interval '1 minute' where finding_id = '${v4.rows[0].id}'`);
    expect((await auditVersion(5, ["Old Codename"])).rows[0].status).toBe("open");
  });

  it("carry_forward is refused on anything but a waiver", async () => {
    const err = await asUser(db, REVIEWER, (tx) => tx.exec(`insert into decisions (org_id, item_id, version_id, author_id, decision, reason, carry_forward)
      values ('${A}','${ITEM}','${id(201)}','${REVIEWER}','reject','no',true)`)).then(() => "ok", (e: Error) => e.message);
    expect(err).toMatch(/decisions_carry_only_waive/);
  });
});
