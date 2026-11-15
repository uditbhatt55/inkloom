import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb } from "../db/harness";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const OWNER_A = "00000000-0000-4000-8000-0000000000a1";
const REVIEWER_A = "00000000-0000-4000-8000-0000000000a2";
const CREATOR_A = "00000000-0000-4000-8000-0000000000a3";
const OTHER_CREATOR_A = "00000000-0000-4000-8000-0000000000a4";
const OWNER_B = "00000000-0000-4000-8000-0000000000b1";
const ITEM = "00000000-0000-4000-8000-0000000000c1";
const VERSION = "00000000-0000-4000-8000-0000000000d1";
const FILE = `${A}/${VERSION}/banner.png`;

let db: PGlite;
beforeAll(async () => {
  db = await createDb();
  await db.exec(`
    insert into auth.users (id, email) values ('${OWNER_A}','oa@t'),('${REVIEWER_A}','ra@t'),('${CREATOR_A}','ca@t'),('${OTHER_CREATOR_A}','xa@t'),('${OWNER_B}','ob@t');
    insert into organizations (id, name) values ('${A}','Org A'),('${B}','Org B');
    insert into memberships values ('${A}','${OWNER_A}','owner'),('${A}','${REVIEWER_A}','reviewer'),('${A}','${CREATOR_A}','creator'),('${A}','${OTHER_CREATOR_A}','agency'),('${B}','${OWNER_B}','owner');
    insert into content_items (id, org_id, title, owner_id) values ('${ITEM}','${A}','Post','${CREATOR_A}');
    insert into content_versions (id, org_id, item_id, n, text, sha256, created_by, file_path, file_name, file_type)
      values ('${VERSION}','${A}','${ITEM}',1,'t','x','${CREATOR_A}','${FILE}','banner.png','image/png');
    insert into storage.objects (bucket_id, name) values ('content-files','${FILE}'), ('brand-assets','${A}/logo-1/logo.png');
  `);
}, 120_000);

const names = async (user: string, bucket: string) =>
  (await asUser(db, user, (tx) => tx.query<{ name: string }>(`select name from storage.objects where bucket_id = '${bucket}'`))).rows.map((r) => r.name);

describe("content-files bucket (originals of uploads)", () => {
  it("is readable by whoever can see the content item", async () => {
    for (const u of [OWNER_A, REVIEWER_A, CREATOR_A]) expect(await names(u, "content-files")).toEqual([FILE]);
  });
  it("is hidden from an agency member who does not own the item, and from another organisation", async () => {
    expect(await names(OTHER_CREATOR_A, "content-files")).toEqual([]);
    expect(await names(OWNER_B, "content-files")).toEqual([]);
  });
  it("cannot be written by any signed-in user (only the server's service role writes)", async () => {
    for (const u of [OWNER_A, CREATOR_A]) {
      await expect(asUser(db, u, (tx) => tx.exec(`insert into storage.objects (bucket_id, name) values ('content-files','${A}/${VERSION}/x.png')`))).rejects.toThrow(/row-level security/);
    }
  });
  it("stores the file columns on the version, which signed-in users cannot change", async () => {
    await expect(asUser(db, CREATOR_A, (tx) => tx.exec(`update content_versions set file_path = 'elsewhere' where id = '${VERSION}'`))).rejects.toThrow();
  });
});

describe("brand-assets bucket (logos)", () => {
  it("is readable by members of the organisation only", async () => {
    for (const u of [OWNER_A, REVIEWER_A, CREATOR_A]) expect(await names(u, "brand-assets")).toEqual([`${A}/logo-1/logo.png`]);
    expect(await names(OWNER_B, "brand-assets")).toEqual([]);
  });
  it("can be uploaded, replaced and deleted by the owner of that organisation", async () => {
    await asUser(db, OWNER_A, async (tx) => {
      await tx.exec(`insert into storage.objects (bucket_id, name) values ('brand-assets','${A}/logo-2/new.png')`);
      await tx.exec(`update storage.objects set name = '${A}/logo-2/renamed.png' where name = '${A}/logo-2/new.png'`);
      const del = await tx.query(`delete from storage.objects where name = '${A}/logo-1/logo.png' returning name`);
      expect(del.rows).toHaveLength(1);
    });
  });
  it("cannot be uploaded or deleted by reviewers, creators, or an owner of another organisation", async () => {
    for (const u of [REVIEWER_A, CREATOR_A, OWNER_B]) {
      await expect(asUser(db, u, (tx) => tx.exec(`insert into storage.objects (bucket_id, name) values ('brand-assets','${A}/logo-3/x.png')`))).rejects.toThrow(/row-level security/);
      const del = await asUser(db, u, (tx) => tx.query(`delete from storage.objects where bucket_id = 'brand-assets' and name like '${A}/%' returning name`));
      expect(del.rows).toHaveLength(0);
    }
  });
  it("cannot be uploaded into a path of another organisation by an owner", async () => {
    await expect(asUser(db, OWNER_B, (tx) => tx.exec(`insert into storage.objects (bucket_id, name) values ('brand-assets','${A}/logo-4/x.png')`))).rejects.toThrow(/row-level security/);
  });
});
