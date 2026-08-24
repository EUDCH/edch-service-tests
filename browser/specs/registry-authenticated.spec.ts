import { test, expect } from "@playwright/test";
import { assertNotProduction, dismissConsent } from "../support/guards";

/**
 * Authenticated Registry flows that no HTTP assertion can reach:
 *
 *   1. the post-login redirect into `organization_validation`'s /check-organisation, and
 *   2. authenticated access to the organisation registration form (the anonymous 403 side is
 *      asserted in features/registry.feature; together they confirm the access rule).
 *
 * Credentials come from the environment and are never committed. With them unset the whole
 * file skips rather than fails, so the default CI run stays green without secrets:
 *
 *   EDCH_REGISTRY_TEST_USER=…  EDCH_REGISTRY_TEST_PASSWORD=…
 */

const USER = process.env.EDCH_REGISTRY_TEST_USER;
const PASSWORD = process.env.EDCH_REGISTRY_TEST_PASSWORD;

test.describe("Registry — authenticated flows", () => {
  // The post-login landing page renders the full organisation table, which is hundreds of
  // kilobytes on a populated instance and comfortably exceeds the suite's default.
  test.describe.configure({ timeout: 120_000 });

  test.skip(
    !USER || !PASSWORD,
    "Set EDCH_REGISTRY_TEST_USER and EDCH_REGISTRY_TEST_PASSWORD to run the authenticated flows",
  );

  test.beforeEach(async ({ page, baseURL }) => {
    // Logging in creates server-side session state, so this is gated like a write.
    assertNotProduction(baseURL, "authenticated Registry flows");
    await page.goto("/user/login");
    await dismissConsent(page);
    await page.fill('[name="name"]', USER!);
    await page.fill('[name="pass"]', PASSWORD!);
    // Wait for the navigation the submit triggers, rather than letting the next action race it.
    await Promise.all([
      page.waitForURL((u) => !u.pathname.startsWith("/user/login"), { timeout: 90_000 }),
      page.locator('form.user-login-form [type="submit"], #edit-submit').first().click(),
    ]);
  });

  test("login lands on the organisation check served by organization_validation", async ({ page }) => {
    // The redirect target IS the assertion: organization_validation wires it via a form_alter,
    // so landing here proves the module's hook ran, not merely that login worked.
    await expect(page).toHaveURL(/\/check-organisation/);
    // Assert the page rendered one of the controller's known branches, without asserting
    // anything about how many records it lists — the row content is live registry data.
    const markers = [
      "Matching Organisations",
      "No matches found in the Registry database",
      "Your Organisation",
      "already been registered by another user",
    ];
    const body = await page.locator("body").innerText();
    expect(
      markers.some((m) => body.includes(m)),
      `/check-organisation rendered none of the known organization_validation branches`,
    ).toBe(true);
  });

  test("the organisation registration form is reachable once authenticated", async ({ page }) => {
    // Anonymous users get 403 here (asserted in features/registry.feature); authenticated
    // users must get the form. The pair is what proves the access rule, not either alone.
    const res = await page.goto("/form/organisation-registry");
    expect(res?.status(), "authenticated access to the real registration form").toBe(200);
    await dismissConsent(page);
    await expect(page.locator('[name="organization_name"]')).toHaveCount(1);
  });
});
