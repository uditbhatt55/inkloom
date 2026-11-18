import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

// Threat model T8 (docs/security/threat-model.md): every page carries the browser security headers.
describe("security headers (next.config.ts)", () => {
  it("sends CSP, HSTS, clickjacking and content-type protection on every path, and hides X-Powered-By", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toHaveLength(1);
    expect(rules[0].source).toBe("/:path*");
    const h = Object.fromEntries(rules[0].headers.map((x) => [x.key, x.value]));
    expect(h["Content-Security-Policy"]).toMatch(/default-src 'self'/);
    expect(h["Content-Security-Policy"]).toMatch(/frame-ancestors 'none'/);
    expect(h["Content-Security-Policy"]).toMatch(/object-src 'none'/);
    expect(h["Content-Security-Policy"]).not.toMatch(/\*(?!\.supabase\.co)/); // no wildcard origins except Supabase's own fallback
    expect(h["Strict-Transport-Security"]).toMatch(/max-age=\d{8}/);
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
