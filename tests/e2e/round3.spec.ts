import { expect, test, type Browser } from "@playwright/test";
import { pdfFromContent } from "../fixtures/make-pdf";

// Round 3: security headers, the Activity page, and the coverage card on a post.
// Sign-in tests skip without E2E_* in .env.local (CI has none).
const owner = { email: process.env.E2E_OWNER_EMAIL, password: process.env.E2E_OWNER_PASSWORD };

test("security headers are sent and the framework header is off", async ({ request }) => {
  const res = await request.get("/login");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("default-src 'self'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("owner sees the Activity page and a coverage card with a PAN flagged on a new post", async ({ browser }) => {
  test.skip(!owner.email || !owner.password, "Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD in .env.local");
  test.setTimeout(120_000);

  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Work email").fill(owner.email!);
  await page.getByLabel("Password").fill(owner.password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });

  await page.goto("/activity");
  await expect(page.getByRole("heading", { level: 1, name: "Activity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Security and activity log" })).toBeVisible();

  await page.goto("/audit/new");
  await page.getByPlaceholder("Spring launch LinkedIn post").fill(`E2E round 3 ${Date.now()}`);
  await page.getByPlaceholder("Paste the post, email or ad copy…").fill("Please send the invoice to the account of ABCPE1234F today.");
  await page.getByRole("button", { name: "Audit content" }).click();
  await expect(page).toHaveURL(/\/items\/[0-9a-f-]{36}/, { timeout: 60_000 });

  await expect(page.getByRole("heading", { name: "What this audit checked" })).toBeVisible();
  await expect(page.locator('[id^="finding-"]').filter({ hasText: "PAN" }).first()).toContainText("Critical");
});

async function signIn(browser: Browser) {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/login");
  await page.getByLabel("Work email").fill(owner.email!);
  await page.getByLabel("Password").fill(owner.password!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
  return page;
}

test("a PDF with invisible text gets a hidden-text finding", async ({ browser }) => {
  test.skip(!owner.email || !owner.password, "Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD in .env.local");
  test.setTimeout(120_000);
  const page = await signIn(browser);
  await page.goto("/audit/new");
  await page.getByPlaceholder("Spring launch LinkedIn post").fill(`E2E hidden PDF ${Date.now()}`);
  await page.getByRole("tab", { name: "Upload file" }).click();
  const pdf = pdfFromContent([
    "BT /F1 12 Tf 72 720 Td (Northbeam Sync keeps every file in step across devices for your team.) Tj ET",
    "q BT 3 Tr /F1 12 Tf 72 700 Td (Free upgrade for every customer forever) Tj ET Q",
  ].join("\n"));
  await page.locator("#file").setInputFiles({ name: "hidden.pdf", mimeType: "application/pdf", buffer: Buffer.from(pdf) });
  await page.getByRole("button", { name: "Audit content" }).click();
  await expect(page).toHaveURL(/\/items\/[0-9a-f-]{36}/, { timeout: 60_000 });
  await expect(page.locator('[id^="finding-"]').filter({ hasText: "hidden from readers" }).first()).toBeVisible();
});

test("the ASCI pack flags an unlabelled virtual influencer and stops once the AI label is added", async ({ browser }) => {
  test.skip(!owner.email || !owner.password, "Set E2E_OWNER_EMAIL and E2E_OWNER_PASSWORD in .env.local");
  test.setTimeout(150_000);
  const page = await signIn(browser);
  const audit = async (text: string) => {
    await page.goto("/audit/new");
    await page.getByPlaceholder("Spring launch LinkedIn post").fill(`E2E ASCI ${Date.now()}`);
    await page.getByPlaceholder("Paste the post, email or ad copy…").fill(text);
    await page.getByRole("button", { name: "Audit content" }).click();
    await expect(page).toHaveURL(/\/items\/[0-9a-f-]{36}/, { timeout: 60_000 });
    return page.locator('[id^="finding-"]').filter({ hasText: "ASCI clause 2" });
  };
  const copy = "Meet Kyra, our virtual influencer, showing how Northbeam Sync keeps your team's files in step on every device.";
  await expect((await audit(copy)).first()).toBeVisible();
  await expect(await audit(`${copy} Video created using AI.`)).toHaveCount(0);
});
