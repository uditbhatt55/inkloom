import { describe, expect, it } from "vitest";
import {
  canAcceptOrRejectFinding,
  canDismissOrWaiveFinding,
  canUserComment,
  canUserDecideItem,
  isApproveBlocked,
  type FindingCheck,
} from "./approval";

describe("isApproveBlocked", () => {
  it("does not block when there are no findings", () => {
    const res = isApproveBlocked([]);
    expect(res.blocked).toBe(false);
    expect(res.openCriticalCount).toBe(0);
    expect(res.message).toBeUndefined();
  });

  it("blocks when an open high-confidence critical finding exists", () => {
    const findings: FindingCheck[] = [
      { severity: "critical", confidence: "high", status: "open" },
    ];
    const res = isApproveBlocked(findings);
    expect(res.blocked).toBe(true);
    expect(res.openCriticalCount).toBe(1);
    expect(res.message).toMatch(/Approval blocked: 1 critical finding is still open/);
  });

  it("blocks when a medium-confidence critical finding is open", () => {
    const findings: FindingCheck[] = [
      { severity: "critical", confidence: "medium", status: "open" },
    ];
    const res = isApproveBlocked(findings);
    expect(res.blocked).toBe(true);
    expect(res.openCriticalCount).toBe(1);
  });

  it("does not block when a critical finding has low confidence", () => {
    const findings: FindingCheck[] = [
      { severity: "critical", confidence: "low", status: "open" },
    ];
    const res = isApproveBlocked(findings);
    expect(res.blocked).toBe(false);
    expect(res.openCriticalCount).toBe(0);
  });

  it("does not block when critical findings are dismissed, waived, or resolved", () => {
    const findings: FindingCheck[] = [
      { severity: "critical", confidence: "high", status: "dismissed" },
      { severity: "critical", confidence: "high", status: "waived" },
      { severity: "critical", confidence: "high", status: "resolved" },
    ];
    const res = isApproveBlocked(findings);
    expect(res.blocked).toBe(false);
    expect(res.openCriticalCount).toBe(0);
  });

  it("still blocks when a critical finding is rejected by the creator (decision D1)", () => {
    const findings: FindingCheck[] = [
      { severity: "critical", confidence: "high", status: "rejected" },
    ];
    const res = isApproveBlocked(findings);
    expect(res.blocked).toBe(true);
    expect(res.openCriticalCount).toBe(1);
  });

  it("still blocks when a critical finding is accepted but not yet resolved", () => {
    const findings: FindingCheck[] = [
      { severity: "critical", confidence: "high", status: "accepted" },
    ];
    const res = isApproveBlocked(findings);
    expect(res.blocked).toBe(true);
    expect(res.openCriticalCount).toBe(1);
  });

  it("does not block when only major, minor, or info findings are open", () => {
    const findings: FindingCheck[] = [
      { severity: "major", confidence: "high", status: "open" },
      { severity: "minor", confidence: "high", status: "open" },
      { severity: "info", confidence: "high", status: "open" },
    ];
    const res = isApproveBlocked(findings);
    expect(res.blocked).toBe(false);
    expect(res.openCriticalCount).toBe(0);
  });

  it("counts multiple open criticals accurately in plural message", () => {
    const findings: FindingCheck[] = [
      { severity: "critical", confidence: "high", status: "open" },
      { severity: "critical", confidence: "high", status: "open" },
      { severity: "critical", confidence: "high", status: "dismissed" },
    ];
    const res = isApproveBlocked(findings);
    expect(res.blocked).toBe(true);
    expect(res.openCriticalCount).toBe(2);
    expect(res.message).toMatch(/Approval blocked: 2 critical findings are still open/);
  });
});

describe("canUserDecideItem", () => {
  it("allows reviewer who is not the item author", () => {
    expect(canUserDecideItem({ role: "reviewer", isItemAuthor: false })).toEqual({
      allowed: true,
    });
  });

  it("allows owner who is not the item author", () => {
    expect(canUserDecideItem({ role: "owner", isItemAuthor: false })).toEqual({
      allowed: true,
    });
  });

  it("disallows reviewer or owner if they authored the item (no self-approval)", () => {
    expect(canUserDecideItem({ role: "reviewer", isItemAuthor: true })).toEqual({
      allowed: false,
      reason: "You cannot review or approve your own content item.",
    });
    expect(canUserDecideItem({ role: "owner", isItemAuthor: true })).toEqual({
      allowed: false,
      reason: "You cannot review or approve your own content item.",
    });
  });

  it("disallows creators, agencies, viewers", () => {
    expect(canUserDecideItem({ role: "creator", isItemAuthor: false }).allowed).toBe(false);
    expect(canUserDecideItem({ role: "agency", isItemAuthor: false }).allowed).toBe(false);
    expect(canUserDecideItem({ role: "viewer", isItemAuthor: false }).allowed).toBe(false);
    expect(canUserDecideItem({ role: undefined, isItemAuthor: false }).allowed).toBe(false);
  });
});

describe("canDismissOrWaiveFinding", () => {
  it("allows reviewer or owner who did not author the item", () => {
    expect(canDismissOrWaiveFinding({ role: "reviewer", isItemAuthor: false })).toBe(true);
    expect(canDismissOrWaiveFinding({ role: "owner", isItemAuthor: false })).toBe(true);
  });

  it("disallows creator or author", () => {
    expect(canDismissOrWaiveFinding({ role: "creator", isItemAuthor: true })).toBe(false);
    expect(canDismissOrWaiveFinding({ role: "creator", isItemAuthor: false })).toBe(false);
    expect(canDismissOrWaiveFinding({ role: "reviewer", isItemAuthor: true })).toBe(false);
    expect(canDismissOrWaiveFinding({ role: "owner", isItemAuthor: true })).toBe(false);
    expect(canDismissOrWaiveFinding({ role: "viewer", isItemAuthor: false })).toBe(false);
  });
});

describe("canAcceptOrRejectFinding", () => {
  it("allows creator on their own item", () => {
    expect(canAcceptOrRejectFinding({ role: "creator", isItemAuthor: true })).toBe(true);
  });

  it("disallows creator on another person's item", () => {
    expect(canAcceptOrRejectFinding({ role: "creator", isItemAuthor: false })).toBe(false);
  });

  it("allows reviewer or owner", () => {
    expect(canAcceptOrRejectFinding({ role: "reviewer", isItemAuthor: false })).toBe(true);
    expect(canAcceptOrRejectFinding({ role: "owner", isItemAuthor: true })).toBe(true);
  });

  it("disallows viewers", () => {
    expect(canAcceptOrRejectFinding({ role: "viewer", isItemAuthor: false })).toBe(false);
    expect(canAcceptOrRejectFinding({ role: undefined, isItemAuthor: false })).toBe(false);
  });
});

describe("canUserComment", () => {
  it("allows owner, reviewer, creator, agency", () => {
    expect(canUserComment({ role: "owner" })).toBe(true);
    expect(canUserComment({ role: "reviewer" })).toBe(true);
    expect(canUserComment({ role: "creator" })).toBe(true);
    expect(canUserComment({ role: "agency" })).toBe(true);
  });

  it("disallows viewer or undefined", () => {
    expect(canUserComment({ role: "viewer" })).toBe(false);
    expect(canUserComment({ role: undefined })).toBe(false);
  });
});

