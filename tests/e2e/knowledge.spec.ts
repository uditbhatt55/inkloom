import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

// P2 Knowledge Centre (M2): an owner adds a banned term, and the next audit catches it, citing that term.
// Cleanup deletes the test's content item (its findings go with it) and the term, with the service role from .env.local.
// Seeded rows (CLAIM-01…, FACT-03…, TERM-01…) are never touched: eval and recordings use them.
const owner = { email: process.env.E2E_OWNER_EMAIL, password: process.env.E2E_OWNER_PASSWORD };

test("M2: an owner adds a banned term and the next audit flags it", async ({ page }) => {
  test.skip(!owner.email || !owner.password, "Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD in .env.local");
  test.setTimeout(120_000);
  const stamp = Date.now();
  const term = `Zorblax${stamp}`;
  const title = `E2E knowledge ${stamp}`;

  try {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(owner.email!);
    await page.getByLabel("Password").fill(owner.password!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

    // 1. Add the banned term in the Knowledge Centre
    await page.goto("/knowledge");
    await page.getByRole("tab", { name: /^Terms/ }).click();
    await page.getByRole("button", { name: "Add term" }).click();
    await page.getByLabel("Term", { exact: true }).fill(term);
    await page.getByLabel("Kind").selectOption("banned");
    await page.getByLabel("Use instead").fill("Northbeam Sync");
    await page.locator("form").getByRole("button", { name: "Add term" }).click();
    await expect(page.getByText(term, { exact: true })).toBeVisible({ timeout: 15_000 });

    // 2. A new audit catches it and cites the new term
    await page.goto("/audit/new");
    await page.getByPlaceholder("Spring launch LinkedIn post").fill(title);
    await page.getByPlaceholder("Paste the post, email or ad copy…").fill(`Keep every file in step with ${term} across your devices.`);
    await page.getByRole("button", { name: "Audit content" }).click();
    await expect(page).toHaveURL(/\/items\/[0-9a-f-]{36}/, { timeout: 60_000 });
    const finding = page.locator('[id^="finding-"]').filter({ hasText: term }).first();
    await expect(finding).toContainText("Terminology");
    await expect(finding).toContainText(`banned: "${term}"`);
    await expect(finding).toContainText("Northbeam Sync");
  } finally {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      await admin.from("content_items").delete().eq("title", title);
      await admin.from("terminology").delete().eq("term", term);
    } else {
      console.warn(`cleanup skipped: no service key; remove item "${title}" and term "${term}" by hand`);
    }
  }
});
