import { test, expect } from "@playwright/test";

// Interactive flow that HTTP alone can't verify: the organisation-registration form actually
// renders its fields in a real browser. Extend this to fill + submit against a local DDEV or
// test instance (never submit test data to prod). Kept minimal as the pattern for browser-layer
// scenarios; the bulk of the baseline lives in the HTTP features.
test.describe("Registry — organisation registration", () => {
  test("registration form renders", async ({ page }) => {
    // The account/organisation form lives at the standard Drupal user-registration
    // route. `/register` is a content landing page (no form) that links here via
    // `/login-register`, so target `/user/register` directly.
    await page.goto("/user/register");
    // Pin the exact page title (page-specific part + site-name suffix) so the
    // assertion actually discriminates this route and can't silently pass on a
    // wrong page whose title merely contains "EDCH Registry".
    await expect(page).toHaveTitle(/Create new account \| EDCH Registry/i);
    // A form should be present on the registration page.
    await expect(page.locator("form")).toHaveCount(1, { timeout: 10_000 });
  });
});
