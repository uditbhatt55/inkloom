import { describe, expect, it } from "vitest";
import { findFigure, findTerm, maskTerms } from "./match";

describe("findTerm edge cases", () => {
  it("handles regex special characters in terms", () => {
    expect(findTerm("We love C++ and AT&T (really).", "C++")).toHaveLength(1);
    expect(findTerm("AT&T rocks", "AT&T")).toHaveLength(1);
    expect(findTerm("price $5.00 only", "$5.00")).toHaveLength(1);
  });
  it("a term of only separators or blanks matches nothing", () => {
    expect(findTerm("a - b", "--")).toEqual([]);
    expect(findTerm("a b", "   ")).toEqual([]);
  });
  it("does not hang on long repeated separators", () => {
    const text = "project" + " ".repeat(50_000) + "atlas";
    const t0 = Date.now();
    expect(findTerm(text, "Project Atlas")).toHaveLength(1);
    expect(Date.now() - t0).toBeLessThan(500);
  });
  it("matches non-English words by whole word", () => {
    expect(findTerm("Der Müller sagt", "Müller")).toHaveLength(1);
    expect(findTerm("Müllers Haus", "Müller")).toEqual([]);
  });
});

describe("findTerm sees through hidden-codename tricks (red-team review: Unicode evasion)", () => {
  const ZW = "​", SHY = "­";
  const hits = (text: string, term = "Project Atlas") => findTerm(text, term).map((m) => text.slice(m.start, m.end));

  it("invisible characters inside a word or between words", () => {
    expect(hits(`call it Pro${ZW}ject Atlas.`)).toEqual([`Pro${ZW}ject Atlas`]);
    expect(hits(`call it Project${ZW} Atlas.`)).toHaveLength(1);
    expect(hits(`call it Pro${SHY}ject At${SHY}las.`)).toHaveLength(1);
    expect(hits(`call it P‌‍⁠roject﻿ Atlas.`)).toHaveLength(1);
    expect(hits(`call it Project‎Atlas.`)).toHaveLength(1); // an invisible mark is the only gap
  });
  it("Unicode dashes, a minus sign and a non-breaking space", () => {
    for (const sep of ["‐", "‑", "–", "—", "−", " "]) expect(hits(`Project${sep}Atlas`)).toHaveLength(1);
  });
  it("full-width letters", () => {
    expect(hits("call it Ｐroject Atlas")).toHaveLength(1);
    expect(hits("Ｐｒｏｊｅｃｔ Ａｔｌａｓ")).toHaveLength(1);
    expect(hits("Zone １２", "Zone 12")).toHaveLength(1);
  });
  it("Cyrillic and Greek lookalike letters, in any case", () => {
    expect(hits("Prоject Atlаs")).toHaveLength(1);        // Cyrillic о and а
    expect(hits("PRОJECT ATLАS")).toHaveLength(1);        // upper case Cyrillic О and А
    expect(hits("Prοject Αtlas")).toHaveLength(1);        // Greek ο and Α
    expect(hits("Proјect Atlas")).toHaveLength(1);              // Cyrillic ј for j
  });
  it("all tricks together, and the offsets still point at the original text", () => {
    const text = `Hello! P${ZW}rоject–At${SHY}lаs is secret.`;
    const [m] = findTerm(text, "Project Atlas");
    expect(text.slice(m.start, m.end)).toBe(`P${ZW}rоject–At${SHY}lаs`);
    expect(m.quote).toBe(text.slice(m.start, m.end));
  });
  it("still respects whole words and does not match unrelated text", () => {
    expect(hits("Atlassian and Project Atlases")).toEqual([]);
    expect(hits(`Project${ZW}Atlassian`)).toEqual([]);
    expect(hits("Project Atl")).toEqual([]);
    expect(hits("Prosect Atlas")).toEqual([]);
    expect(hits("Проект Атлас")).toEqual([]); // Russian "Проект Атлас" is not "Project Atlas"
  });
  it("a term that itself has non-Latin letters or regex characters still works", () => {
    expect(findTerm("प्रोजेक्ट अटलस", "प्रोजेक्ट")).toHaveLength(1);
    expect(findTerm("We love C++ and AT&T (really).", "C++")).toHaveLength(1);
    expect(findTerm("a[b]c", "a[b]c")).toHaveLength(1);
  });
  it("does not hang on a long run of invisible characters", () => {
    const text = "Project" + ZW.repeat(50_000) + " Atlas" + SHY.repeat(50_000) + "x";
    const t0 = Date.now();
    expect(findTerm(text, "Project Atlas")).toHaveLength(1);
    expect(Date.now() - t0).toBeLessThan(500);
  });
});

describe("findFigure edge cases", () => {
  it("does not match inside a longer or decimal number", () => {
    expect(findFigure("99.99% uptime", "99.9%")).toEqual([]);
    expect(findFigure("199.9% growth", "99.9%")).toEqual([]);
    expect(findFigure("version 10.2", "10")).toEqual([]);
    expect(findFigure("section 1.99.9% x", "99.9%")).toEqual([]);
  });
  it("matches at a sentence end and in brackets", () => {
    expect(findFigure("We promise 99.9%.", "99.9%")).toHaveLength(1);
    expect(findFigure("uptime (99.9%)", "99.9%")).toHaveLength(1);
    expect(findFigure("Plans: 10, 20", "10")).toHaveLength(1);
  });
});

describe("maskTerms", () => {
  it("keeps length, masks every occurrence and variant", () => {
    const text = "Project Atlas and PROJECT-ATLAS";
    const out = maskTerms(text, ["Project Atlas"]);
    expect(out).toBe("*".repeat(13) + " and " + "*".repeat(13));
    expect(out).toHaveLength(text.length);
  });
  it("masks hidden variants too, with the same length, so nothing readable reaches the AI", () => {
    const text = `a Pro​ject Atlas b Ｐroject-Atlas c Prоject Atlаs d`;
    const out = maskTerms(text, ["Project Atlas"]);
    expect(out).toHaveLength(text.length);
    expect(out.replace(/\*/g, "")).toBe("a  b  c  d");
  });
});
