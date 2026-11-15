import { readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { AiJson } from "@/lib/ai/json";
import { chooseImporter, draftBrandBook } from "@/lib/knowledge/import-service";
import { parseUpload } from "@/lib/parsers";

/** P2b brand-book import on the real sample PDF (seed/northbeam/brandbook.pdf, 8 pages). No live AI unless RECORD_IMPORT=1. */
const pdf = () => parseUpload(new Uint8Array(readFileSync("seed/northbeam/brandbook.pdf")));
const seedLike = {
  clauses: [{ text: "Do not describe service levels as guaranteed; refer to the SLA." }],
  terms: [{ term: "NB Sync" }, { term: "Northbeam Sync" }],
  colours: [{ hex: "#1B2A4A" }],
};
const none = { clauses: [], terms: [], colours: [] };

describe("brand-book import (demo mode, recorded draft)", () => {
  it("the parser records where each of the 8 pages starts", async () => {
    const p = await pdf();
    expect(p.meta.pages).toBe(8);
    expect(p.meta.pageStarts).toHaveLength(8);
    expect(p.text.slice(p.meta.pageStarts![3]).startsWith("NORTHBEAM CLOUD BRAND BOOK\nNorthbeam Cloud\nTerminology")).toBe(true);
  });

  it("drafts guidelines, terms and colours with their source pages; nothing is dropped", async () => {
    const r = await draftBrandBook(await pdf(), none, chooseImporter({}));
    expect(r.mode).toBe("simulated");
    expect(r.dropped).toEqual([]);
    expect(r.draft.clauses.length).toBeGreaterThanOrEqual(10);
    const page = (term: string) => r.draft.terms.find((t) => t.term === term)?.page;
    expect(page("NB Sync")).toBe(4);
    expect(page("Project Atlas")).toBe(4);
    expect(r.draft.terms.find((t) => t.term === "Project Atlas")?.kind).toBe("internal");
    expect(r.draft.colours.map((c) => [c.hex, c.page])).toEqual([["#1B2A4A", 6], ["#14B8A6", 6], ["#F8FAFC", 6], ["#334155", 6]]);
    expect(r.draft.clauses.find((c) => c.text.startsWith("Do not describe service levels"))?.page).toBe(5);
    expect(r.draft.clauses.find((c) => c.category === "accessibility")?.page).toBe(7);
  });

  it("marks what the organisation already has as duplicates", async () => {
    const r = await draftBrandBook(await pdf(), seedLike, chooseImporter({}));
    const dup = (list: { duplicate: boolean }[]) => list.filter((x) => x.duplicate).length;
    expect(dup(r.draft.clauses)).toBe(1);
    expect(dup(r.draft.terms)).toBe(2);
    expect(dup(r.draft.colours)).toBe(1);
  });

  it("a document with no recording in demo mode drafts nothing and says why", async () => {
    const other = await parseUpload(new TextEncoder().encode("Our brand voice is calm and clear."));
    const r = await draftBrandBook(other, none, chooseImporter({}));
    expect(r).toMatchObject({ mode: "skipped", draft: { clauses: [], terms: [], colours: [] } });
    expect(r.warnings.join(" ")).toMatch(/demo mode/);
  });
});

describe("brand-book import with the real model (fake AI here)", () => {
  const fakeAi = (answer: () => Promise<unknown>): AiJson => ({ model: "gpt-6-luna", call: answer });

  it("sends the document as data and keeps only grounded items", async () => {
    let sent = "";
    const ai: AiJson = {
      model: "gpt-6-luna",
      call: async ({ messages, name }) => {
        sent = messages[1].content;
        expect(name).toBe("brand_book_draft");
        return { clauses: [{ category: "claim", text: "Say we are #1.", quote: "We are India's #1 sync platform." }], terms: [{ term: "NB Sync", kind: "banned", replacement: "Northbeam Sync", quote: "NB Sync Northbeam Sync" }], colours: [] };
      },
    };
    const r = await draftBrandBook(await pdf(), none, chooseImporter({}, ai));
    expect(sent.startsWith("<document>\n")).toBe(true);
    expect(r).toMatchObject({ mode: "real", model: "gpt-6-luna" });
    expect(r.draft.clauses).toEqual([]);
    expect(r.draft.terms.map((t) => t.term)).toEqual(["NB Sync"]);
    expect(r.dropped).toHaveLength(1);
  });

  it("a slow model ends in an empty draft with a note, not an error", async () => {
    const r = await draftBrandBook(await pdf(), none, chooseImporter({}, fakeAi(() => new Promise((ok) => setTimeout(() => ok({}), 2000)))), 100);
    expect(r.mode).toBe("failed");
    expect(r.warnings.join(" ")).toMatch(/did not answer in time/);
  });

  it("a malformed answer drafts nothing", async () => {
    const r = await draftBrandBook(await pdf(), none, chooseImporter({}, fakeAi(async () => ({ clauses: "all of them" }))));
    expect(r.draft).toEqual({ clauses: [], terms: [], colours: [] });
    expect(r.dropped[0]).toMatch(/did not match/);
  });
});

/** Records a REAL model answer for the demo: RECORD_IMPORT=1 DEMO_MODE=false npm run test:int (Azure keys in .env.local). */
describe.skipIf(!process.env.RECORD_IMPORT)("record the brand-book draft from the real model", () => {
  it("writes src/lib/ai/recordings/brandbook-import.json", async () => {
    const p = await pdf();
    const importer = chooseImporter();
    expect(importer.mode).toBe("real");
    const response = await importer.draft(p.text);
    const rec = { note: "Recorded from the real model with RECORD_IMPORT=1.", recorded_by: importer.model, content: p.text, response };
    writeFileSync("src/lib/ai/recordings/brandbook-import.json", JSON.stringify(rec, null, 1) + "\n");
    writeFileSync("tests/fixtures/ai/brandbook-import.json", JSON.stringify(rec, null, 1) + "\n");
  }, 120_000);
});
