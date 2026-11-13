import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

/**
 * Public pages and the "not configured" state (CI has no Supabase keys). The signed-in flow
 * (upload → findings → approve) needs a real Supabase and is tested once `supabase start` runs in CI.
 */
const serious = async (page: import("@playwright/test").Page) =>
  (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.length}`);

test("landing page explains the product and links to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "INKLOOM AI" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  expect(await serious(page)).toEqual([]);
});

test("login page has labelled fields and says when sign-in is not set up", async ({ page }) => {
  await page.goto("/login?next=//evil.example");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in to INKLOOM AI");
  await expect(page.getByText(/not set up/i)).toBeVisible();
  expect(await serious(page)).toEqual([]);
});

for (const path of ["/dashboard", "/audit/new"]) {
  test(`${path} shows a clear "not set up" message without Supabase keys`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText("Not set up yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeAttached();
    expect(await serious(page)).toEqual([]);
  });
}

test("audit API refuses requests without a session or configuration, with a fixed message", async ({ request }) => {
  test.setTimeout(120_000); // a reused dev server compiles the route on first hit
  const res = await request.post("/api/audit", { multipart: { text: "hello", orgId: "00000000-0000-4000-8000-000000000001", title: "t" } });
  expect([401, 503]).toContain(res.status());
  const body = await res.json();
  expect(Object.keys(body)).toEqual(["error"]);
  expect(body.error).not.toMatch(/supabase|env|stack|Error:/i);
});
