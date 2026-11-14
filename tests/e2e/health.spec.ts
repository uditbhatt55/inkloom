import { expect, test } from "@playwright/test";

// Milestone M5 (PLAN.md): Brand Health works on the seeded history (supabase/demo-history.sql) with a real owner account.
// This test only READS the live demo organisation. Editing a fact would move its updated_at for good and leave a
// permanent "Changed" alert in the demo; that edit-to-"Changed" logic is covered in tests/integration/health.test.ts.
const owner = { email: process.env.E2E_OWNER_EMAIL, password: process.env.E2E_OWNER_PASSWORD };

test("M5: owner sees recurring mistakes, an expired fact with its approved item, and can ask for AI help", async ({ browser }) => {
  test.skip(!owner.email || !owner.password, "Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD in .env.local, and load supabase/demo-history.sql");
  test.setTimeout(150_000);

  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Work email").fill(owner.email!);
  await page.getByLabel("Password").fill(owner.password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  await page.getByRole("link", { name: "Brand Health" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Brand Health" })).toBeVisible();

  // recurring mistakes: the banned product name is the rule broken most often in the seeded history
  const recurring = page.getByRole("table", { name: /Findings per rule in the last 30 days/ });
  await expect(recurring.getByRole("rowheader").first()).toHaveText("TERM-02");

  // fact impact: the June email was approved while INR 499 (FACT-05) was current; that fact has expired since
  const alert = page.getByRole("listitem").filter({ hasText: "FACT-05" });
  await expect(alert).toContainText("Expired");
  await expect(alert.getByRole("link", { name: "Vault launch email" })).toBeVisible();

  // AI help: a draft rewrite for an unclear rule, and the clause-pair comparison (either the real model or the recorded demo)
  const unclear = page.getByRole("listitem").filter({ hasText: /is dismissed or waived in/ }).first();
  await unclear.getByRole("button", { name: "Suggest a rewrite" }).click();
  await expect(unclear.getByText("Suggested rewrite")).toBeVisible({ timeout: 70_000 });
  await expect(unclear.getByText(/Nothing changes until an owner saves it/)).toBeVisible();

  await page.getByRole("button", { name: "Compare rules with AI" }).click();
  await expect(page.getByText(/AI found no contradictions|needs the real model|Needs a human check/).first()).toBeVisible({ timeout: 70_000 });
});
