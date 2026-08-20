import { test, expect } from "@playwright/test";
import { assertNotProduction, dismissConsent } from "../support/guards";

/**
 * Authenticated Registry flows. Two things live here that no HTTP assertion can reach:
 *
 *   1. the post-login redirect into `organization_validation`'s /check-organisation, and
 *   2. the `webform_geonames` city autocomplete actually firing — its JS library is attached
 *      only to the `organisation_registry` form, which is 403 for anonymous users, and the
 *      suggestions are fetched and rendered client-side.
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
  // kilobytes on a populated instance and comfortably exceeds the suite's 30s default.
  test.describe.configure({ timeout: 120_000 });

  test.skip(
    !USER || !PASSWORD,
    "Set EDCH_REGISTRY_TEST_USER and EDCH_REGISTRY_TEST_PASSWORD to run the authenticated flows",
  );

  test.beforeEach(async ({ page, baseURL }) => {
    // Logging in creates server-side session state and the flows below reach a form that writes,
    // so this is gated the same way as a submission.
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

  // KNOWN BROKEN, and deliberately kept as an expected failure rather than deleted or skipped:
  // it is the only check that covers the user-visible autocomplete, and marking it `fail`
  // means the suite tells us the moment the feature starts working again.
  //
  // The module's own Drupal endpoint is healthy — features/registry.feature proves it returns
  // suggestions. What is broken is the browser-side step before it: the script resolves the
  // selected country to an ISO code via restcountries.com/v3.1, which is now deprecated. Two
  // independent failures, either of which is fatal:
  //   1. the deprecation response is a 301 carrying no Access-Control-Allow-Origin, so the
  //      browser blocks the cross-origin fetch before it can follow the redirect
  //      ("blocked by CORS policy", then "Error fetching country code: TypeError: Failed to
  //      fetch" — observed on the test instance 2026-08-20);
  //   2. the redirect target no longer returns an array but
  //      {"success":false,"errors":[{"message":"This API version has been deprecated…"}]},
  //      so `data[0]?.cca2` would still be undefined even if the fetch succeeded.
  // With no country code the city query is never issued and no suggestions render. Affects
  // prod identically — same script, and the missing CORS header is origin-independent.
  test("webform_geonames offers city suggestions on the registration form", async ({ page }) => {
    // Scoped to this test only — at describe level this modifier would mark every test in the
    // block as expected-to-fail.
    test.fail();
    await page.goto("/form/organisation-registry");
    await dismissConsent(page);

    // The autocomplete JS resolves the selected country to an ISO code before querying, so the
    // country must be chosen first — typing a city with no country selected yields nothing.
    await page.selectOption('[name="country[select]"]', "Denmark");

    const city = page.locator(".webform-city-autocomplete").first();
    await expect(city, "city input carrying the webform_geonames hook class").toHaveCount(1);
    // Type a full city name: the upstream lookup does not match on short prefixes, so a
    // partial string returns an empty set and would make this look like a broken module.
    await city.fill("Copenhagen");
    await city.dispatchEvent("input");

    // The library debounces 500ms and appends its own container to <body>.
    const suggestions = page.locator(".city-suggestions");
    await expect(suggestions.first()).toBeVisible({ timeout: 20_000 });
    await expect(suggestions.first()).toContainText(/Copenhagen/i);
  });
});
