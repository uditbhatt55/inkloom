import { describe, expect, it } from "vitest";
import { friendlyDbError } from "./errors";

describe("friendlyDbError", () => {
  it("rephrases the approval gate with the count", () => {
    expect(friendlyDbError({ code: "P0001", message: "approval blocked: 2 open critical finding(s)" })).toMatch(/^Approval is blocked: 2 critical findings are still open/);
    expect(friendlyDbError({ code: "P0001", message: "approval blocked: 1 open critical finding(s)" })).toMatch(/1 critical finding is still open\. Fix it/);
  });

  it("maps permission, constraint, FK, duplicate, session and network errors", () => {
    expect(friendlyDbError({ code: "42501", message: 'new row violates row-level security policy for table "decisions"' })).toBe("You don't have permission to do that.");
    expect(friendlyDbError({ code: "42501", message: "only a reviewer or owner (not the author) can dismiss, waive or resolve a finding" })).toMatch(/^Only a reviewer or owner/);
    expect(friendlyDbError({ code: "23514", message: 'violates check constraint "decisions_check"' })).toMatch(/written reason/);
    expect(friendlyDbError({ code: "23503", message: "fk" })).toMatch(/no longer exists/);
    expect(friendlyDbError({ code: "23505", message: "dup" })).toMatch(/already saved/);
    expect(friendlyDbError({ code: "PGRST301", message: "JWT expired" })).toMatch(/session has expired/);
    expect(friendlyDbError({ message: "TypeError: Failed to fetch" })).toMatch(/connection/);
  });

  it("never echoes raw database text", () => {
    const raw = { code: "XX000", message: 'internal error in table "findings" near policy findings_decide' };
    const out = friendlyDbError(raw);
    expect(out).toBe("That didn't work. Please try again.");
    expect(out).not.toMatch(/findings|policy|table/);
    expect(friendlyDbError(null)).toBe("That didn't work. Please try again.");
  });
});
