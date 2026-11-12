import { describe, expect, it } from "vitest";
import recording from "./recordings/northbeam-post.json";
import { chooseReviewer } from "./select";

const azure = { AZURE_OPENAI_ENDPOINT: "https://x.openai.azure.com/openai/v1", AZURE_OPENAI_API_KEY: "test-key", AZURE_DEPLOYMENT_DEFAULT: "gpt-6-luna" };

describe("chooseReviewer", () => {
  it("defaults to demo (simulated) when DEMO_MODE is unset or true, even with keys", () => {
    expect(chooseReviewer({}).mode).toBe("simulated");
    expect(chooseReviewer({ ...azure }).mode).toBe("simulated");
    expect(chooseReviewer({ ...azure, DEMO_MODE: "true" }).mode).toBe("simulated");
  });
  it("uses Azure only with demo off and endpoint, key and deployment all set", () => {
    const r = chooseReviewer({ ...azure, DEMO_MODE: "false" });
    expect(r).toMatchObject({ mode: "real", model: "gpt-6-luna" });
    expect(chooseReviewer({ ...azure, DEMO_MODE: "false", AZURE_OPENAI_API_KEY: "" }).mode).toBe("simulated");
  });
  it("demo reviewer returns the recording for the seeded post and null for anything else", async () => {
    const r = chooseReviewer({});
    expect(await r.review({ messages: [], content: recording.content })).toEqual(recording.response);
    expect(await r.review({ messages: [], content: "something new" })).toBeNull();
  });
});
