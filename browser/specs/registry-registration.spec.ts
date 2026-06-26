import { test, expect } from "@playwright/test";

// Interactive flow that HTTP alone can't verify: the organisation-registration form actually
// renders its fields in a real browser. Extend this to fill + submit against a local DDEV or
// test instance (never submit test data to prod). Kept minimal as the pattern for browser-layer
// scenarios; the bulk of the baseline lives in the HTTP features.
test.describe("Registry — organisation registration", () => {
  test("registration form renders", async ({ page }) => {
    await page.goto("/register");
    await expect(page).toHaveTitle(/EDCH Registry|Register/i);
    // A form should be present on the registration page.
    await expect(page.locator("form")).toHaveCount(1, { timeout: 10_000 });
  });
});
