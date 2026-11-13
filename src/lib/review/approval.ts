import type { FindingStatus, Severity, Confidence } from "@/lib/audit/types";
import type { Role } from "@/lib/session";

export type FindingCheck = {
  severity: Severity;
  confidence: Confidence;
  status: FindingStatus;
};

/**
 * Checks whether approval is blocked by any unresolved critical finding.
 * Mirrors the database gate in `apply_decision()` (decision D1, proposal §7.5, §8):
 * A Critical finding blocks approval unless its status is 'dismissed', 'waived', or 'resolved'.
 * Critical findings with low confidence do not block.
 */
export function isApproveBlocked(findings: FindingCheck[]): {
  blocked: boolean;
  openCriticalCount: number;
  message?: string;
} {
  const cleared: FindingStatus[] = ["dismissed", "waived", "resolved"];
  const blocking = findings.filter(
    (f) =>
      f.severity === "critical" &&
      f.confidence !== "low" &&
      !cleared.includes(f.status)
  );

  const count = blocking.length;
  if (count > 0) {
    return {
      blocked: true,
      openCriticalCount: count,
      message: `Approval blocked: ${count} critical finding${count > 1 ? "s are" : " is"} still open. Fix ${count > 1 ? "them" : "it"} in a new version, or a reviewer can waive with a written reason.`,
    };
  }

  return { blocked: false, openCriticalCount: 0 };
}

/**
 * Permission checks for reviewing and deciding on content items (§8.1).
 * Only owner or reviewer who is NOT the item author may decide.
 */
export function canUserDecideItem({
  role,
  isItemAuthor,
}: {
  role?: Role;
  isItemAuthor: boolean;
}): { allowed: boolean; reason?: string } {
  if (!role) {
    return { allowed: false, reason: "You are not a member of this organisation." };
  }
  if (role !== "owner" && role !== "reviewer") {
    return { allowed: false, reason: "Only a reviewer or owner can make decisions on items." };
  }
  if (isItemAuthor) {
    return { allowed: false, reason: "You cannot review or approve your own content item." };
  }
  return { allowed: true };
}

/**
 * Only reviewer or owner (not the item author) can dismiss or waive findings.
 */
export function canDismissOrWaiveFinding({
  role,
  isItemAuthor,
}: {
  role?: Role;
  isItemAuthor: boolean;
}): boolean {
  return (role === "owner" || role === "reviewer") && !isItemAuthor;
}

/**
 * Creators can accept or reject findings on their own items.
 * Reviewers and owners can also accept or reject findings.
 * Viewers cannot.
 */
export function canAcceptOrRejectFinding({
  role,
  isItemAuthor,
}: {
  role?: Role;
  isItemAuthor: boolean;
}): boolean {
  if (!role || role === "viewer") return false;
  return isItemAuthor || role === "owner" || role === "reviewer";
}

/**
 * Anyone who can see the item except viewers can post comments.
 */
export function canUserComment({ role }: { role?: Role }): boolean {
  return role !== undefined && role !== "viewer";
}

