import { describe, expect, it } from "vitest";
import { forbiddenTermIn, safeSuggestion } from "./suggestion";

const terms = [
  { term: "NB Sync", kind: "banned" }, { term: "cloud drive", kind: "banned" },
  { term: "Project Atlas", kind: "internal" }, { term: "Northbeam Sync", kind: "preferred" },
];

describe("forbiddenTermIn", () => {
  it("finds a banned or internal term, including the hidden-trick variants the Guard sees", () => {
    expect(forbiddenTermIn("Try NB Sync today", terms)).toBe("NB Sync");
    expect(forbiddenTermIn("our CLOUD-DRIVE", terms)).toBe("cloud drive");
    expect(forbiddenTermIn("code name Pro​ject Atlas", terms)).toBe("Project Atlas");
    expect(forbiddenTermIn("code name Prоject Atlаs", terms)).toBe("Project Atlas");
  });
  it("lets preferred terms and clean text through", () => {
    expect(forbiddenTermIn("Northbeam Sync keeps files in step", terms)).toBeNull();
    expect(forbiddenTermIn("", terms)).toBeNull();
    expect(forbiddenTermIn("Atlassian tools", terms)).toBeNull();
  });
  it("a banned term that the original text already contains on purpose (a rule about it) is allowed, an internal one never", () => {
    const rule = 'Never call the product "NB Sync" or "Project Atlas".';
    expect(forbiddenTermIn('Do not write "NB Sync" in public copy.', terms, rule)).toBeNull();
    expect(forbiddenTermIn("Do not write Project Atlas in public copy.", terms, rule)).toBe("Project Atlas");
  });
});

describe("safeSuggestion", () => {
  it("keeps a clean fix and drops one that reintroduces a banned or internal term", () => {
    expect(safeSuggestion("Northbeam Sync", terms)).toBe("Northbeam Sync");
    expect(safeSuggestion("NB Sync", terms)).toBeNull();
    expect(safeSuggestion("the Project Atlas platform", terms)).toBeNull();
  });
  it("null stays null", () => {
    expect(safeSuggestion(null, terms)).toBeNull();
  });
});
