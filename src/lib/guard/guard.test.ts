import { describe, expect, it } from "vitest";
import { findLeaks, findSecrets, hiddenTextFindings, maskForAi, maskPii } from "./guard";

const terms = [{ code: "TERM-31", term: "Project Atlas" }, { code: "TERM-40", term: "Acme Corp" }];

describe("findLeaks", () => {
  it.each(["Project Atlas", "PROJECT ATLAS", "project  atlas", "Project-Atlas", "project_atlas", "Project\nAtlas"])(
    "catches %j", (variant) => {
      const text = `Soon: ${variant} will ship.`;
      const [hit] = findLeaks(text, terms);
      expect(hit).toMatchObject({ category: "confidentiality", severity: "critical", confidence: "high", ruleCode: "TERM-31" });
      expect(text.slice(hit.start, hit.end)).toBe(hit.quote);
    });

  it("does not match inside other words (Atlassian, Atlases)", () => {
    expect(findLeaks("We use Project Atlassian and Project Atlases.", terms)).toEqual([]);
  });

  it("finds every occurrence and every term", () => {
    expect(findLeaks("Project Atlas, project atlas and Acme Corp.", terms)).toHaveLength(3);
  });

  it("returns nothing for clean text or no terms", () => {
    expect(findLeaks("Northbeam Sync is great.", terms)).toEqual([]);
    expect(findLeaks("Project Atlas", [])).toEqual([]);
    expect(findLeaks("Project Atlas", [{ code: "X", term: "  " }])).toEqual([]);
  });
});

describe("maskPii", () => {
  it("masks emails and phone numbers, keeping length", () => {
    const text = "Mail priya@northbeam.com or call +91 98765 43210 today.";
    const out = maskPii(text);
    expect(out).toHaveLength(text.length);
    expect(out).not.toContain("priya");
    expect(out).not.toContain("98765");
    expect(out).toContain("today.");
  });

  it("leaves dates, percentages and short numbers alone", () => {
    const text = "Valid until 2026-11-12, 99.9% uptime, 1,000 users, order 12345.";
    expect(maskPii(text)).toBe(text);
  });

  it("masks two phone numbers written back to back (no 13-digit gap)", () => {
    const out = maskPii("Call 9876543210 9876543211 now");
    expect(out).not.toMatch(/987654/);
    expect(out).toContain("now");
  });

  it("masks card-like numbers and several phone formats", () => {
    for (const p of ["4111 1111 1111 1111", "+91-98765-43210", "(022) 2345 6789", "022-23456789", "09876543210"]) {
      expect(maskPii(`x ${p} y`)).toBe(`x ${"*".repeat(p.length)} y`);
    }
  });

  it("does not mask an ISO date followed by an hour", () => {
    const text = "Published 2026-11-12 10:30 sharp.";
    expect(maskPii(text)).toBe(text);
  });

  it("masks several emails and keeps length", () => {
    const text = "a@b.co, first.last+tag@sub.example.org";
    const out = maskPii(text);
    expect(out).toHaveLength(text.length);
    expect(out).not.toContain("@");
  });
});

describe("maskForAi", () => {
  it("hides internal terms and personal data, keeps everything else and the length", () => {
    const text = "Project Atlas ships soon. Mail a@b.co. Northbeam Sync is great.";
    const out = maskForAi(text, [{ code: "T", term: "Project Atlas" }]);
    expect(out).toHaveLength(text.length);
    expect(out).not.toMatch(/Atlas|a@b/);
    expect(out).toContain("Northbeam Sync is great.");
  });
});

describe("secrets and identity numbers (Round 3)", () => {
  const text = "PAN ABCPE1234F, Aadhaar 2345 6789 0123, key sk-proj-abcdefghijklmnopqrstuvwxyz123456 and AKIAABCDEFGHIJKLMNOP.";

  it("are masked before any model call, keeping the length", () => {
    const out = maskForAi(text, []);
    expect(out).toHaveLength(text.length);
    for (const secret of ["ABCPE1234F", "2345 6789 0123", "sk-proj-abcdefghijklmnopqrstuvwxyz123456", "AKIAABCDEFGHIJKLMNOP"]) expect(out).not.toContain(secret);
    expect(out).toContain("PAN ");
  });

  it("are Critical confidentiality findings with exact offsets; ordinary words and codes are not", () => {
    const f = findSecrets(text);
    expect(f.map((x) => x.ruleCode)).toEqual(["GUARD-PAN", "GUARD-KEY", "GUARD-KEY"]);
    expect(f.every((x) => text.slice(x.start, x.end) === x.quote && x.severity === "critical")).toBe(true);
    expect(findSecrets("Use code SAVE20NOW, order NB-2026-11, plan PRO and file report.pdf")).toEqual([]);
  });
});

describe("hidden text (Round 3)", () => {
  it("points at the hidden block in the audited text, or is whole-document when it cannot be found", () => {
    const content = "Northbeam Sync keeps files in step.\nProject Atlas launches in March.";
    const [a, b] = hiddenTextFindings(content, [{ text: "Project Atlas launches in March.", why: "display: none" }, { text: "not in the text", why: "hidden attribute" }]);
    expect([a.start, a.end, content.slice(a.start, a.end), a.ruleCode, a.severity]).toEqual([36, 68, "Project Atlas launches in March.", "GUARD-HIDDEN", "major"]);
    expect([b.start, b.end]).toEqual([-1, -1]);
    expect(a.explanation).toMatch(/display: none/);
  });
});
