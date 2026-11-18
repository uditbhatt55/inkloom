import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createDb } from "../db/harness";

// Migrations 20261117000200 (security log), 000300 (waiver expiry), 000400 (notifications).
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const OWNER = "00000000-0000-4000-8000-0000000000a1";
const REVIEWER = "00000000-0000-4000-8000-0000000000a2";
const CREATOR = "00000000-0000-4000-8000-0000000000a3";
const OUTSIDER = "00000000-0000-4000-8000-0000000000b1";
const ITEM = "00000000-0000-4000-8000-0000000000c1";
const V1 = "00000000-0000-4000-8000-0000000000d1";
const CRIT = "00000000-0000-4000-8000-0000000000f1";

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${OWNER}','o@a'),('${REVIEWER}','r@a'),('${CREATOR}','c@a'),('${OUTSIDER}','x@b');
    insert into organizations (id, name) values ('${A}','Org A'),('${B}','Org B');
    insert into memberships values ('${A}','${OWNER}','owner'),('${A}','${REVIEWER}','reviewer'),('${A}','${CREATOR}','creator'),('${B}','${OUTSIDER}','owner');
    insert into content_items (id, org_id, title, owner_id) values ('${ITEM}','${A}','Launch post','${CREATOR}');
    insert into content_versions (id, org_id, item_id, n, text, sha256, created_by) values ('${V1}','${A}','${ITEM}',1,'NB Sync','h1','${CREATOR}');
  `);
  const run = (await db.query<{ id: string }>(`insert into audit_runs (org_id, version_id, mode) values ('${A}','${V1}','rule_only') returning id`)).rows[0].id;
  await db.exec(`insert into findings (id, org_id, run_id, category, severity, confidence, quote, explanation, source)
    values ('${CRIT}','${A}','${run}','confidentiality','critical','high','NB Sync','internal name','rule')`);
}, 120_000);

const decide = (user: string, sql: string) =>
  asUser(db, user, async (tx) => {
    try {
      await tx.exec(sql);
      return (await tx.query<{ status: string }>(`select status::text from content_items where id = '${ITEM}'`)).rows[0].status;
    } catch (e) {
      return (e as Error).message;
    }
  });

describe("security log", () => {
  it("records a sign-in once per organisation of the user, and role changes with the old and new role", async () => {
    await db.exec(`insert into auth.sessions (user_id, user_agent) values ('${REVIEWER}', 'test-browser')`);
    await db.exec(`update memberships set role = 'owner' where user_id = '${REVIEWER}'; update memberships set role = 'reviewer' where user_id = '${REVIEWER}'`);
    await db.exec(`update memberships set role = 'reviewer' where user_id = '${REVIEWER}'`); // no change: not logged
    const rows = (await db.query<{ action: string; detail: { from: string; to: string } | null; org_id: string }>(
      `select action, detail, org_id from activity_log where target_table in ('sessions','memberships') and target_id = '${REVIEWER}' order by id`)).rows;
    expect(rows.map((r) => [r.action, r.detail?.from ?? null, r.detail?.to ?? null])).toEqual([
      ["member_added", null, "reviewer"], // from the setup above
      ["sign_in", null, null], ["role_changed", "reviewer", "owner"], ["role_changed", "owner", "reviewer"],
    ]);
    expect(rows.every((r) => r.org_id === A)).toBe(true);
  });

  it("is read by owners and reviewers of the organisation only, and nobody can write or delete it", async () => {
    const count = (u: string) => asUser(db, u, async (tx) => (await tx.query<{ n: number }>("select count(*)::int as n from activity_log where action = 'sign_in'")).rows[0].n);
    expect(await count(OWNER)).toBe(1);
    expect(await count(CREATOR)).toBe(0);
    expect(await count(OUTSIDER)).toBe(0);
    expect(await asUser(db, OWNER, (tx) => tx.exec("delete from activity_log").then(() => "deleted", (e: Error) => e.message))).toMatch(/permission denied/);
  });
});

describe("no one decides on their own work (threat model T2)", () => {
  it("the author can neither approve their item nor clear their own finding", async () => {
    // request_changes passes the approval gate, so the refusal here is the row-level policy itself
    expect(await decide(CREATOR, `insert into decisions (org_id, item_id, version_id, author_id, decision, reason) values ('${A}','${ITEM}','${V1}','${CREATOR}','request_changes','x')`))
      .toMatch(/row-level security/);
    expect(await decide(CREATOR, `update findings set status = 'dismissed' where id = '${CRIT}'`)).toMatch(/only a reviewer or owner/);
  });
});

describe("waivers with an expiry date", () => {
  it("refuses an expiry date in the past", async () => {
    expect(await decide(REVIEWER, `insert into decisions (org_id, item_id, version_id, finding_id, author_id, decision, reason, expires_at)
      values ('${A}','${ITEM}','${V1}','${CRIT}','${REVIEWER}','waive','ok for now', now() - interval '1 day')`)).toMatch(/must be in the future/);
  });

  it("a live waiver clears the critical finding; once it has expired, approval is blocked again", async () => {
    const waive = (at: string) => `insert into decisions (org_id, item_id, version_id, finding_id, author_id, decision, reason, expires_at)
      values ('${A}','${ITEM}','${V1}','${CRIT}','${REVIEWER}','waive','legal said yes', ${at});`;
    const approve = `insert into decisions (org_id, item_id, version_id, author_id, decision) values ('${A}','${ITEM}','${V1}','${REVIEWER}','approve');`;
    expect(await decide(REVIEWER, waive("now() + interval '7 days'") + approve)).toBe("approved");
    // an expired waiver: written directly as the database owner, since the trigger refuses past dates
    expect(await asUser(db, REVIEWER, async (tx) => {
      await tx.exec(waive("now() + interval '1 day'"));
      await tx.exec("reset role; update decisions set expires_at = now() - interval '1 minute' where decision = 'waive'; set local role authenticated;");
      return tx.exec(approve).then(() => "approved", (e: Error) => e.message);
    })).toMatch(/1 open critical/);
  });
});

describe("notifications", () => {
  it("the author hears about a decision and a comment; reviewers hear about the author's comment and new versions", async () => {
    await db.exec(`
      insert into comments (org_id, item_id, author_id, body) values ('${A}','${ITEM}','${REVIEWER}','Please drop NB Sync');
      insert into comments (org_id, item_id, author_id, body) values ('${A}','${ITEM}','${CREATOR}','Done');
      insert into content_versions (org_id, item_id, n, text, sha256, created_by) values ('${A}','${ITEM}',2,'Northbeam Sync','h2','${CREATOR}');
      insert into decisions (org_id, item_id, version_id, author_id, decision, reason) values ('${A}','${ITEM}','${V1}','${REVIEWER}','request_changes','Use the full name');
    `);
    const mine = (u: string) => asUser(db, u, async (tx) => (await tx.query<{ kind: string }>("select kind from notifications order by id")).rows.map((r) => r.kind));
    expect(await mine(CREATOR)).toEqual(["comment", "request_changes"]);
    expect(await mine(REVIEWER)).toEqual(["comment", "new_version"]);
    expect(await mine(OWNER)).toEqual(["comment", "new_version"]);
    expect(await mine(OUTSIDER)).toEqual([]);
  });

  it("a person can mark only their own as read, and cannot create or delete any", async () => {
    const res = await asUser(db, CREATOR, async (tx) => {
      await tx.exec("update notifications set read_at = now()");
      const read = (await tx.query<{ n: number }>("select count(*)::int as n from notifications where read_at is not null")).rows[0].n;
      const insert = await tx.exec(`insert into notifications (org_id, user_id, kind, body) values ('${A}','${OWNER}','x','spoof')`).then(() => "inserted", (e: Error) => e.message);
      return { read, insert };
    });
    expect(res.read).toBe(2);
    expect(res.insert).toMatch(/permission denied/);
    expect((await db.query<{ n: number }>(`select count(*)::int as n from notifications where user_id = '${REVIEWER}' and read_at is not null`)).rows[0].n).toBe(0);
  });
});
