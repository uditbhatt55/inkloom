import { describe, expect, it } from "vitest";
import { checkAsciSgc } from "./asci-sgc";

const codes = (t: string, off: string[] = []) => checkAsciSgc(t, new Set(off)).map((f) => `${f.ruleCode}:${f.quote}`);

describe("ASCI synthetic-content labelling (Sept 2026 guidelines)", () => {
  it("flags a synthetic influencer, a cloned voice and an unbuilt-project render when the copy has no AI label", () => {
    expect(codes("Meet Kyra, our virtual influencer. Hear the story in a cloned voice of our founder. Take the 3D walkthrough of Tower B, launching 2028.")).toEqual([
      "ASCI-SGC-LABEL:virtual influencer", "ASCI-SGC-LABEL:cloned voice", "ASCI-SGC-LABEL:3D walkthrough",
    ]);
  });

  it("does not flag them once the copy carries a label", () => {
    expect(codes("Meet Kyra, our virtual influencer. Video created using AI.")).toEqual([]);
    expect(codes("Meet Kyra, our AI avatar #madewithAI")).toEqual([]);
  });

  it("flags fabricated testimonials and deepfakes even when labelled (clause 1)", () => {
    const f = checkAsciSgc("Read our AI-generated testimonials and watch the deepfake ad. Video created using AI.");
    expect(f.map((x) => x.ruleCode)).toEqual(["ASCI-SGC-PROHIBITED", "ASCI-SGC-PROHIBITED"]);
    expect(f[0]).toMatchObject({ category: "claim", severity: "major", confidence: "medium", source: "rule" });
    expect(f[0].explanation).toMatch(/even with an AI label/);
  });

  it("asks for 'Sponsored by' on AI recommendations, as a minor check", () => {
    expect(checkAsciSgc("Our AI stylist recommends the Hydra moisturiser for Mumbai weather.").map((f) => [f.ruleCode, f.severity])).toEqual([["ASCI-SGC-SPONSORED", "minor"]]);
    expect(codes("Our AI stylist recommends the Hydra moisturiser. Sponsored by Hydra.")).toEqual([]);
  });

  it("leaves clause 3 uses alone: copy writing, subtitles, translation, a human digital influencer, AI features", () => {
    expect(codes("Subtitles generated with AI. Our copy was refined with AI. Northbeam's AI models sort your files; top digital influencer Riya uses it.")).toEqual([]);
  });

  it("an organisation can switch a rule off", () => {
    expect(codes("Meet our virtual influencer.", ["ASCI-SGC-LABEL"])).toEqual([]);
  });
});
