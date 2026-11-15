import { describe, expect, it } from "vitest";
import type { Db } from "@/lib/supabase/server";
import { stagedPath } from "./files";
import { takeStagedFile } from "./staged";

const ME = "00000000-0000-4000-8000-0000000000a1";
const OTHER = "00000000-0000-4000-8000-0000000000b1";
const ID = "11111111-2222-4333-8444-555555555555";

/** A stand-in for the service client's Storage: one bucket held in a Map. */
function fakeService(files: Map<string, Blob>) {
  const removed: string[] = [];
  const bucket = {
    download: async (p: string) => (files.has(p) ? { data: files.get(p)!, error: null } : { data: null, error: { message: "not found" } }),
    remove: async (ps: string[]) => { removed.push(...ps); ps.forEach((p) => files.delete(p)); return { data: [], error: null }; },
  };
  return { service: { storage: { from: () => bucket } } as unknown as Db, removed };
}

describe("takeStagedFile", () => {
  it("does nothing when the form has no staged path", async () => {
    const fd = new FormData();
    fd.set("text", "hello");
    await takeStagedFile(fd, ME, fakeService(new Map()).service);
    expect([...fd.keys()]).toEqual(["text"]);
  });

  it("turns the user's staged upload back into the form's file and deletes it from Storage", async () => {
    const path = stagedPath(ME, ID, "brand book.pdf");
    const { service, removed } = fakeService(new Map([[path, new Blob([new Uint8Array([1, 2, 3])])]]));
    const fd = new FormData();
    fd.set("staged", path);
    await takeStagedFile(fd, ME, service);
    const file = fd.get("file") as File;
    expect(file.name).toBe("brand-book.pdf");
    expect(new Uint8Array(await file.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect(fd.has("staged")).toBe(false);
    expect(removed).toEqual([path]);
  });

  it("refuses a path from another user's staging folder without reading it", async () => {
    const path = stagedPath(OTHER, ID, "secret.pdf");
    const { service, removed } = fakeService(new Map([[path, new Blob(["x"])]]));
    const fd = new FormData();
    fd.set("staged", path);
    await expect(takeStagedFile(fd, ME, service)).rejects.toMatchObject({ status: 400 });
    expect(removed).toEqual([]);
    expect(fd.has("file")).toBe(false);
  });

  it("refuses a staged file that is missing or over 10 MB", async () => {
    const missing = new FormData();
    missing.set("staged", stagedPath(ME, ID, "gone.pdf"));
    await expect(takeStagedFile(missing, ME, fakeService(new Map()).service)).rejects.toMatchObject({ status: 400 });

    const path = stagedPath(ME, ID, "huge.pdf");
    const big = new FormData();
    big.set("staged", path);
    await expect(takeStagedFile(big, ME, fakeService(new Map([[path, new Blob([new Uint8Array(10 * 1024 * 1024 + 1)])]])).service)).rejects.toMatchObject({ status: 413 });
  });
});
