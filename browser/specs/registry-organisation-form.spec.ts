import { test, expect } from "@playwright/test";
import { assertNotProduction, dismissConsent, testMarker } from "../support/guards";

/**
 * End-to-end submission of the organisation registration form — the one flow the HTTP layer
 * genuinely cannot reach, because it needs a real browser to drive the webform's conditional
 * fields and its client-side validation.
 *
 * Target is the `organisation_registry_test` webform, not `organisation_registry`. Three
 * reasons, all deliberate:
 *   - it is open to anonymous users, so the spec needs no credentials;
 *   - it has no email handlers, so a submission notifies nobody;
 *   - it writes a webform submission rather than an organisation node, so it cannot disturb
 *     the real organisation records the instance carries.
 *
 * Every submission is tagged with a dated marker so anything this suite creates is
 * attributable and can be cleaned up by searching for that prefix.
 */

const FORM_PATH = "/form/organisation-registry-test";

test.describe("Registry — organisation registration form", () => {
  test("form renders its required fields", async ({ page, baseURL }) => {
    // Read-only: safe on any environment, so no production guard here.
    await page.goto(FORM_PATH);
    await dismissConsent(page);
    await expect(page).toHaveTitle(/Organisation Registry Test \| EDCH Registry/i);
    for (const name of ["organization_name", "website", "organization_email_address", "institutional_email"]) {
      await expect(page.locator(`[name="${name}"]`), `field ${name}`).toHaveCount(1);
    }
    expect(baseURL).toBeTruthy();
  });

  test("@writes a complete submission is accepted", async ({ page, baseURL }) => {
    // Fail closed BEFORE the first keystroke, not before the submit — a guard that runs late
    // still types test data into a production form.
    assertNotProduction(baseURL, "organisation form submission");

    const marker = testMarker();
    await page.goto(FORM_PATH);
    await dismissConsent(page);

    await page.fill('[name="organization_name"]', `${marker} Organisation`);
    await page.fill('[name="acronym"]', "ESTS");
    await page.fill('[name="website"]', "https://example.org");
    await page.fill('[name="organization_email_address"]', `${marker}@example.org`);
    await page.fill('[name="city[items][0][_item_]"]', "Copenhagen");
    await page.selectOption('[name="country[select]"]', "Denmark");
    await page.selectOption('[name="legal_entity_type[select]"]', "Public organisation");
    await page.selectOption('[name="parent_organization_"]', "false");
    await page.selectOption('[name="geographical_range_of_services"]', "National ");
    await page.selectOption('[name="supported_languages[select][]"]', ["English"]);
    await page.selectOption('[name="disciplinary_coverage[]"]', ["Multidisciplinary"]);

    // Tableselect groups are required server-side but carry no HTML `required` attribute, so
    // omitting them fails validation on submit rather than in the browser.
    await page.check('[name="type[Service provider]"]');
    await page.check('[name="services_offered_or_supported_with_tools_and_technologies[Hosting]"]');
    await page.check('[name="published_or_supported_output_types[Academic Journals]"]');

    await page.fill('[name="name"]', `${marker} Contact`);
    await page.fill('[name="institutional_email"]', `${marker}@example.org`);
    await page.fill('[name="position"]', "Test Engineer");
    await page.check('[name="i_certify_that"]');

    await page.click('[name="op"]');

    // Assert the absence of validation errors explicitly. Without this, a form that silently
    // re-rendered with "field is required" would still satisfy a loose success check, and the
    // error text is what makes a genuine failure diagnosable from the CI log.
    const errors = page.locator(".messages--error, [data-drupal-messages] .messages--error");
    if (await errors.count()) {
      throw new Error(`Submission rejected: ${(await errors.first().innerText()).trim()}`);
    }
    await expect(page.locator(".webform-confirmation, .messages--status")).toBeVisible({ timeout: 20_000 });
  });
});
