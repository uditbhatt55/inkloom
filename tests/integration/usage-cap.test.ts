import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import type { AiReviewer } from "@/lib/ai/reviewer";
import { gateAudit, type Counter } from "@/lib/audit/usage-cap";
import { createDb } from "../db/harness";

// The real counts, in SQL, as supabaseCounter makes them through supabase-js: audit_runs rows by user and by organisation.
const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const U1 = "00000000-0000-4000-8000-0000000000c1";
const U2 = "00000000-0000-4000-8000-0000000000c2";
const NOW = new Date("2026-11-14T12:00:00Z");
const real: AiReviewer = { mode: "real", model: "gpt-6-luna", review: async () => null };

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${U1}','u1@t.test'),('${U2}','u2@t.test');
    insert into organizations (id, name) values ('${A}','A'),('${B}','B');
    insert into memberships values ('${A}','${U1}','creator'),('${A}','${U2}','creator'),('${B}','${U2}','creator');
    insert into content_items (id, org_id, title, owner_id) values ('00000000-0000-4000-8000-0000000000d1','${A}','a','${U1}'),('00000000-0000-4000-8000-0000000000d2','${B}','b','${U2}');
    insert into content_versions (id, org_id, item_id, n, text, sha256, created_by) values
      ('00000000-0000-4000-8000-0000000000e1','${A}','00000000-0000-4000-8000-0000000000d1',1,'x','h','${U1}'),
      ('00000000-0000-4000-8000-0000000000e2','${B}','00000000-0000-4000-8000-0000000000d2',1,'x','h','${U2}');
  `);
  const run = (org: string, ver: string, user: string, mode: string, minutesAgo: number) =>
    `insert into audit_runs (org_id, version_id, mode, requested_by, created_at) values ('${org}','${ver}','${mode}','${user}', '${NOW.toISOString()}'::timestamptz - interval '${minutesAgo} minutes');`;
  const V1 = "00000000-0000-4000-8000-0000000000e1", V2 = "00000000-0000-4000-8000-0000000000e2";
  await db.exec([
    run(A, V1, U1, "real", 1), run(A, V1, U1, "real", 5), run(A, V1, U1, "rule_only", 8), run(A, V1, U1, "real", 30), // U1: 3 in the last 10 minutes
    run(A, V1, U2, "real", 120), run(A, V1, U2, "simulated", 2),                                                  // U2 in A: 1 in 10 minutes
    run(B, V2, U2, "real", 3),                                                                                    // other organisation
    run(A, V1, U1, "real", 60 * 30),                                                                              // older than 24 hours
  ].join("\n"));
}, 120_000);

const counter = (org: string, user: string): Counter => ({
  userRuns: async (since) => (await db.query<{ n: number }>("select count(*)::int as n from audit_runs where requested_by = $1 and created_at >= $2", [user, since.toISOString()])).rows[0].n,
  orgRealRuns: async (since) => (await db.query<{ n: number }>("select count(*)::int as n from audit_runs where org_id = $1 and mode = 'real' and created_at >= $2", [org, since.toISOString()])).rows[0].n,
});

describe("usage cap counts (audit_runs)", () => {
  it("refuses the account that is over the burst limit, not the other account", async () => {
    const limits = { burstMax: 3, burstMinutes: 10, dailyMax: 100 };
    expect((await gateAudit(counter(A, U1), real, limits, NOW)).kind).toBe("burst");
    expect((await gateAudit(counter(A, U2), real, limits, NOW)).kind).toBe("ok");
  });

  it("the daily limit counts real runs of ONE organisation in the last 24 hours only", async () => {
    // organisation A: real runs by U1 at 1, 5, 30 minutes ago and U2 at 120 minutes ago = 4 (the 30-hour-old one is outside the day)
    const withDay = (dailyMax: number) => gateAudit(counter(A, U2), real, { burstMax: 99, burstMinutes: 10, dailyMax }, NOW);
    expect(await withDay(5)).toMatchObject({ kind: "ok", ai: real });
    expect(await withDay(4)).toMatchObject({ kind: "ok", ai: null });
    // organisation B has a single real run, so its day is far from the limit
    expect(await gateAudit(counter(B, U2), real, { burstMax: 99, burstMinutes: 10, dailyMax: 2 }, NOW)).toMatchObject({ ai: real });
  });
});
