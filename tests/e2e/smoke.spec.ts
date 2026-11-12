import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("home page loads with no serious accessibility issues", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/INKLOOM/);
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.filter((v) => v.impact === "serious" || v.impact === "critical")).toEqual([]);
});
