/**
 * Shared demo accounts so judges can use the public site without signing up (Round 2: "use its core features without
 * assistance"). Both are members of the Northbeam demo org; two accounts because nobody may approve their own content.
 * Credentials come from server-only environment variables and never reach the browser.
 */
export type DemoRole = "owner" | "reviewer";

type Env = Record<string, string | undefined>;

export function demoAccount(role: DemoRole, env: Env = process.env): { email: string; password: string } | null {
  const key = role === "owner" ? "OWNER" : "REVIEWER";
  const email = env[`DEMO_${key}_EMAIL`]?.trim();
  const password = env[`DEMO_${key}_PASSWORD`];
  return email && password ? { email, password } : null;
}

/** Show the demo buttons only when both accounts are configured. */
export const demoEnabled = (env: Env = process.env) => !!demoAccount("owner", env) && !!demoAccount("reviewer", env);
