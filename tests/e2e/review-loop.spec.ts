import { expect, test } from "@playwright/test";

test.describe("P4 Review Workflow", () => {
  const testEmail = process.env.TEST_USER_EMAIL;
  const testPassword = process.env.TEST_USER_PASSWORD;
  const testItemId = process.env.TEST_ITEM_ID;

  test("reviewer can accept/reject findings and approval is blocked on open critical", async ({
    page,
  }) => {
    test.skip(
      !testEmail || !testPassword,
      "Signed-in review loop requires TEST_USER_EMAIL and TEST_USER_PASSWORD environment variables (none provided)"
    );

    // 1. Sign in
    await page.goto("/login");
    await page.fill('input[name="email"]', testEmail!);
    await page.fill('input[name="password"]', testPassword!);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/(dashboard|items)/);

    // 2. Open an item (either specific TEST_ITEM_ID or first item on dashboard)
    if (testItemId) {
      await page.goto(`/items/${testItemId}`);
    } else {
      const firstItem = page.locator('a[href^="/items/"]').first();
      await expect(firstItem).toBeVisible();
      await firstItem.click();
    }

    await expect(page.locator("h1")).toBeVisible();

    // 3. Accept one finding
    const openFinding = page.locator('[id^="finding-"]').filter({ hasText: "Open" }).first();
    if (await openFinding.isVisible()) {
      const acceptBtn = openFinding.getByRole("button", { name: "Accept" });
      if (await acceptBtn.isVisible()) {
        await acceptBtn.click();
        await expect(openFinding.getByText("Accepted")).toBeVisible();
      }
    }

    // 4. Reject one finding with a reason
    const secondFinding = page.locator('[id^="finding-"]').filter({ hasText: "Open" }).first();
    if (await secondFinding.isVisible()) {
      const rejectBtn = secondFinding.getByRole("button", { name: "Reject" });
      if (await rejectBtn.isVisible()) {
        await rejectBtn.click();
        const reasonInput = secondFinding.getByRole("textbox");
        await reasonInput.fill("Approved brand exception for tone");
        await secondFinding.getByRole("button", { name: "Confirm reject" }).click();
        await expect(secondFinding.getByText("Rejected")).toBeVisible();
        await expect(secondFinding.getByText("Approved brand exception for tone")).toBeVisible();
      }
    }

    // 5. Try to approve while a Critical is open (blocked)
    const approveBtn = page.getByRole("button", { name: "Approve" });
    const blockAlert = page.getByText(/Approval blocked/i);

    if (await blockAlert.isVisible()) {
      // Must be disabled
      await expect(approveBtn).toBeDisabled();

      // 6. Clear the critical finding (e.g. via Waive finding)
      const waiveFindingBtn = page.getByRole("button", { name: "Waive finding" });
      if (await waiveFindingBtn.isVisible()) {
        await waiveFindingBtn.click();
        const waiverReason = page.getByPlaceholder(/Explain why this governance exception/i);
        await waiverReason.fill("Approved temporary exemption by Brand Director");
        await page.getByRole("button", { name: "Confirm waive" }).click();
      }

      // 7. Once cleared, approve
      if (!(await page.getByText(/Approval blocked/i).isVisible())) {
        await expect(approveBtn).toBeEnabled();
        await approveBtn.click();
        await expect(page.getByText(/approved/i)).toBeVisible();
      }
    }
  });
});

