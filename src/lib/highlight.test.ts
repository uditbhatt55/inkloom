import { describe, expect, it } from "vitest";
import { bySeverity, segmentText } from "./highlight";

describe("segmentText", () => {
  it("no findings: one plain segment; empty text: none", () => {
    expect(segmentText("Hello", [])).toEqual([{ text: "Hello", ids: [] }]);
    expect(segmentText("", [])).toEqual([]);
  });
  it("marks one span and keeps all text in order", () => {
    const segs = segmentText("NB Sync is great", [{ id: "a", start: 0, end: 7 }]);
    expect(segs).toEqual([{ text: "NB Sync", ids: ["a"] }, { text: " is great", ids: [] }]);
    expect(segs.map((s) => s.text).join("")).toBe("NB Sync is great");
  });
  it("overlapping spans: the shared part lists both findings", () => {
    const segs = segmentText("99.99% uptime, guaranteed.", [{ id: "claim", start: 0, end: 25 }, { id: "word", start: 15, end: 25 }]);
    expect(segs).toEqual([
      { text: "99.99% uptime, ", ids: ["claim"] },
      { text: "guaranteed", ids: ["claim", "word"] },
      { text: ".", ids: [] },
    ]);
  });
  it("ignores null, reversed, empty and out-of-range spans", () => {
    const segs = segmentText("abc", [{ id: "n", start: null, end: null }, { id: "r", start: 2, end: 1 }, { id: "e", start: 1, end: 1 }, { id: "o", start: 1, end: 99 }]);
    expect(segs).toEqual([{ text: "abc", ids: [] }]);
  });
});

describe("bySeverity", () => {
  it("critical first, then by position, document-level last", () => {
    const rows = [
      { id: 1, severity: "minor", start_offset: 0 },
      { id: 2, severity: "critical", start_offset: 50 },
      { id: 3, severity: "critical", start_offset: null },
      { id: 4, severity: "critical", start_offset: 5 },
    ];
    expect(rows.sort(bySeverity).map((r) => r.id)).toEqual([4, 2, 3, 1]);
  });
});
