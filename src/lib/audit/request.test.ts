import { describe, expect, it } from "vitest";
import { readAuditForm, RequestError } from "./request";

const ORG = "00000000-0000-4000-8000-000000000001";
const ITEM = "00000000-0000-4000-8000-0000000000d1";
const form = (o: Record<string, string | File>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.append(k, v);
  return f;
};
const err = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e as RequestError;
  }
  throw new Error("expected an error");
};

describe("readAuditForm", () => {
  it("new item from pasted text, with defaults", () => {
    expect(readAuditForm(form({ orgId: ORG, title: "Launch post", text: "Hello" }))).toMatchObject({ orgId: ORG, title: "Launch post", text: "Hello", channel: "web", audience: "public" });
  });

  it("new version of an existing item from a file", () => {
    const r = readAuditForm(form({ itemId: ITEM, file: new File(["%PDF-1.4"], "a.pdf"), altText: "Banner" }));
    expect(r.itemId).toBe(ITEM);
    expect(r.file?.name).toBe("a.pdf");
  });

  it("needs exactly one source", () => {
    expect(err(() => readAuditForm(form({ orgId: ORG, title: "t" }))).status).toBe(400);
    expect(err(() => readAuditForm(form({ orgId: ORG, title: "t", text: "a", url: "https://example.com" }))).status).toBe(400);
    expect(err(() => readAuditForm(form({ orgId: ORG, title: "t", text: "   " }))).status).toBe(400);
  });

  it("needs an item, or an organisation and a title", () => {
    expect(err(() => readAuditForm(form({ text: "a" }))).message).toMatch(/existing item/);
    expect(err(() => readAuditForm(form({ orgId: ORG, text: "a" }))).status).toBe(400);
  });

  it("rejects bad ids, audiences, urls and half-given colours", () => {
    expect(err(() => readAuditForm(form({ itemId: "1 or 1=1", text: "a" }))).status).toBe(400);
    expect(err(() => readAuditForm(form({ itemId: ITEM, text: "a", audience: "everyone" }))).status).toBe(400);
    expect(err(() => readAuditForm(form({ itemId: ITEM, url: "not a url" }))).status).toBe(400);
    expect(err(() => readAuditForm(form({ itemId: ITEM, text: "a", textColour: "#ffffff" }))).message).toMatch(/both/);
    expect(err(() => readAuditForm(form({ itemId: ITEM, text: "a", textColour: "red", bgColour: "#000000" }))).status).toBe(400);
  });

  it("refuses files over 10 MB with 413", () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "big.pdf");
    expect(err(() => readAuditForm(form({ itemId: ITEM, file: big }))).status).toBe(413);
  });

  it("caps title length and text size", () => {
    expect(err(() => readAuditForm(form({ orgId: ORG, title: "x".repeat(201), text: "a" }))).status).toBe(400);
    expect(err(() => readAuditForm(form({ itemId: ITEM, text: "x".repeat(200_001) }))).status).toBe(400);
  });
});
