import { expect, test, type Browser, type Page } from "@playwright/test";

// Milestone M4 (PLAN.md): the full review loop with two real accounts in the demo organisation.
// The item's author can't approve it (§8.1), so the owner submits and a reviewer decides.
const owner = { email: process.env.E2E_OWNER_EMAIL, password: process.env.E2E_OWNER_PASSWORD };
const reviewer = { email: process.env.E2E_REVIEWER_EMAIL, password: process.env.E2E_REVIEWER_PASSWORD };

async function signIn(browser: Browser, who: { email?: string; password?: string }): Promise<Page> {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Work email").fill(who.email!);
  await page.getByLabel("Password").fill(who.password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 }); // first render after a cold start can be slow
  return page;
}

test("M4: author can't approve; reviewer is blocked by an open Critical, waives it, then approves", async ({ browser }) => {
  test.skip(
    !owner.email || !owner.password || !reviewer.email || !reviewer.password,
    "Set E2E_OWNER_EMAIL, E2E_OWNER_PASSWORD, E2E_REVIEWER_EMAIL, E2E_REVIEWER_PASSWORD in .env.local",
  );
  test.setTimeout(120_000);

  // 1. The owner submits public content containing a registered internal codename.
  const author = await signIn(browser, owner);
  await author.goto("/audit/new");
  await author.getByPlaceholder("Spring launch LinkedIn post").fill(`E2E review loop ${Date.now()}`);
  await author.getByPlaceholder("Paste the post, email or ad copy…").fill("Excited to share that Project Atlas is our most revolutionary product ever.");
  await author.getByRole("button", { name: "Audit content" }).click();
  await expect(author).toHaveURL(/\/items\/[0-9a-f-]{36}/, { timeout: 60_000 });
  const itemUrl = author.url().split("?")[0];

  const authorCritical = author.locator('[id^="finding-"]').filter({ hasText: "Project Atlas" });
  const authorMinor = author.locator('[id^="finding-"]').filter({ hasText: "PACK-HYPE" }); // the hype-word finding on "revolutionary"
  await expect(authorCritical).toContainText("Critical");
  await expect(author.getByText("Approval blocked", { exact: true })).toBeVisible();

  // 2. The author has no approve control on their own item.
  await expect(author.getByText("You cannot review or approve your own content item.")).toBeVisible();
  await expect(author.getByRole("button", { name: "Approve", exact: true })).toHaveCount(0);

  // 3. The author rejects the Minor finding with a reason.
  await authorMinor.getByRole("button", { name: "Reject", exact: true }).click();
  await authorMinor.getByRole("textbox").fill("E2E: approved campaign wording");
  await authorMinor.getByRole("button", { name: "Confirm reject" }).click();
  await expect(authorMinor).toContainText("Rejected");

  // 4. The reviewer can't approve while the Critical is open.
  const rev = await signIn(browser, reviewer);
  await rev.goto(itemUrl);
  const approve = rev.getByRole("button", { name: "Approve", exact: true });
  await expect(approve).toBeDisabled();

  // 5. The reviewer waives the Critical with a written reason, then approves.
  const revCritical = rev.locator('[id^="finding-"]').filter({ hasText: "Project Atlas" });
  await revCritical.getByRole("button", { name: "Waive", exact: true }).click();
  await revCritical.getByRole("textbox").fill("E2E: approved exemption");
  await revCritical.getByRole("button", { name: "Confirm waive" }).click();
  await expect(revCritical).toContainText("Waived");
  await expect(approve).toBeEnabled();
  await approve.click();
  await expect(rev.getByText("approved", { exact: true }).first()).toBeVisible();
});
