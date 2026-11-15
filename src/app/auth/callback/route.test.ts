import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const exchange = vi.fn();
// the client the route gets; a plain object so a test can swap in one that throws (as when sign-in is not configured)
let client: { auth: { exchangeCodeForSession: (code: string) => unknown } };
vi.mock("@/lib/supabase/server", () => ({ createUserClient: async () => client }));

import { GET } from "./route";

// The server can see only its inner address on Azure App Service; the redirect must not contain it.
const call = (qs: string) => GET(new NextRequest(`https://0.0.0.0:8080/auth/callback${qs}`));

describe("GET /auth/callback", () => {
  beforeEach(() => {
    exchange.mockReset();
    client = { auth: { exchangeCodeForSession: exchange } };
  });

  it("sends a confirmed sign-up to the dashboard with a relative Location", async () => {
    exchange.mockResolvedValue({ error: null });
    const res = await call("?code=abc");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("/dashboard");
    expect(exchange).toHaveBeenCalledWith("abc");
  });

  it("honours a same-site next path and ignores an outside one", async () => {
    exchange.mockResolvedValue({ error: null });
    expect((await call("?code=abc&next=/items/7")).headers.get("location")).toBe("/items/7");
    expect((await call("?code=abc&next=//evil.com")).headers.get("location")).toBe("/dashboard");
    expect((await call("?code=abc&next=https://evil.com")).headers.get("location")).toBe("/dashboard");
  });

  it("sends an expired or used link to /login, never to the server's inner address", async () => {
    exchange.mockResolvedValue({ error: { message: "otp_expired" } });
    const res = await call("?code=old");
    expect(res.headers.get("location")).toBe("/login");
    expect(res.headers.get("location")).not.toMatch(/0\.0\.0\.0|:8080|^https?:/);
  });

  it("goes to /login when there is no code", async () => {
    expect((await call("")).headers.get("location")).toBe("/login");
    expect(exchange).not.toHaveBeenCalled();
  });

  it("goes to /login when sign-in is not configured (the client throws)", async () => {
    client = { auth: { exchangeCodeForSession: () => { throw new Error("not configured"); } } };
    expect((await call("?code=abc")).headers.get("location")).toBe("/login");
  });
});
