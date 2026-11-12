import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

describe("safeNext (open-redirect guard)", () => {
  it("keeps same-site paths", () => {
    expect(safeNext("/items/123?v=2")).toBe("/items/123?v=2");
  });
  it("falls back for external, protocol-relative, backslash and header-injection values", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "/ok\r\nSet-Cookie: x=1", "", null, undefined]) {
      expect(safeNext(bad as string)).toBe("/dashboard");
    }
  });
});
