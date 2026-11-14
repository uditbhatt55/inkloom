import { describe, expect, it } from "vitest";
import { demoAccount, demoEnabled } from "./demo-accounts";

const env = {
  DEMO_OWNER_EMAIL: " owner@northbeam.example ", DEMO_OWNER_PASSWORD: "p1",
  DEMO_REVIEWER_EMAIL: "reviewer@northbeam.example", DEMO_REVIEWER_PASSWORD: "p2",
};

describe("demo accounts", () => {
  it("reads each role's credentials from its own variables", () => {
    expect(demoAccount("owner", env)).toEqual({ email: "owner@northbeam.example", password: "p1" });
    expect(demoAccount("reviewer", env)).toEqual({ email: "reviewer@northbeam.example", password: "p2" });
  });

  it("is off unless both accounts have an email and a password", () => {
    expect(demoEnabled(env)).toBe(true);
    expect(demoEnabled({ ...env, DEMO_REVIEWER_PASSWORD: "" })).toBe(false);
    expect(demoAccount("owner", { DEMO_OWNER_EMAIL: "x@y.z" })).toBeNull();
    expect(demoEnabled({})).toBe(false);
  });
});
