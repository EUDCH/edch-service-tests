import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

// Drupal-specific and JSON-endpoint assertions, kept out of http.steps.mjs so the shared
// HTTP vocabulary stays service-agnostic.

// ── redirects as contract ────────────────────────────────────────────────────────────────

When("I GET {string} without following redirects", async function (path) {
  await this.get(path, { follow: false });
});

Then("the redirect location contains {string}", function (text) {
  assert.ok(
    this.response.location.includes(text),
    `Redirect location of ${this.response.url} is "${this.response.location}", expected to contain "${text}"`,
  );
});

// ── JSON endpoints ──────────────────────────────────────────────────────────────────────

Then("the response content type is {string}", function (expected) {
  assert.ok(
    this.response.contentType.toLowerCase().includes(expected.toLowerCase()),
    `Content-Type of ${this.response.url} is "${this.response.contentType}", expected to contain "${expected}"`,
  );
});

function parsedArray(response) {
  let parsed;
  try {
    parsed = JSON.parse(response.body);
  } catch (e) {
    throw new Error(`Body of ${response.url} is not JSON: ${e.message}`);
  }
  assert.ok(Array.isArray(parsed), `Body of ${response.url} is JSON but not an array`);
  return parsed;
}

Then("the JSON response is an empty array", function () {
  const items = parsedArray(this.response);
  assert.equal(items.length, 0, `Expected [] from ${this.response.url}, got ${items.length} item(s)`);
});

Then("the JSON response is a non-empty array", function () {
  const items = parsedArray(this.response);
  assert.ok(items.length > 0, `Expected at least one item from ${this.response.url}, got []`);
});

// Assert the shape of every item, not just the first, so a partially-malformed upstream
// response fails rather than passing on a lucky element 0.
Then("every JSON item has the keys {string}", function (csv) {
  const wanted = csv.split(",").map((k) => k.trim()).filter(Boolean);
  const items = parsedArray(this.response);
  assert.ok(items.length > 0, `No items to check in ${this.response.url}`);
  items.forEach((item, i) => {
    assert.ok(item && typeof item === "object" && !Array.isArray(item), `Item ${i} is not an object`);
    for (const key of wanted) {
      assert.ok(key in item, `Item ${i} of ${this.response.url} is missing key "${key}" (has: ${Object.keys(item).join(", ")})`);
      assert.ok(
        typeof item[key] === "string" && item[key].length > 0,
        `Item ${i} key "${key}" is empty or not a string`,
      );
    }
  });
});

// ── rendered markup ─────────────────────────────────────────────────────────────────────

// Drop <style> and <script> so a CSS selector or a JS string can neither satisfy nor break an
// assertion about what the page actually renders. This is the corpus every rendered-content
// assertion below uses, so the two halves of a check never read different corpora.
function withoutStyleScript(body) {
  return body.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
}

// Text content only: strip every tag. Used for address checks so an address sitting in an
// attribute (a "logo@2x.png" srcset, a mailto href) is not mistaken for rendered contact text.
function renderedText(body) {
  return withoutStyleScript(body).replace(/<[^>]+>/g, " ");
}

Then("the rendered page contains {string}", function (text) {
  assert.ok(
    withoutStyleScript(this.response.body).includes(text),
    `Rendered ${this.response.url} does not contain "${text}"`,
  );
});

// ── email obfuscation ───────────────────────────────────────────────────────────────────

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

Then("the response body contains no email address", function () {
  const found = [...new Set(renderedText(this.response.body).match(EMAIL_RE) ?? [])];
  assert.equal(
    found.length,
    0,
    // Report only the domain half; the local part is the personal data being asserted absent.
    `${this.response.url} exposes ${found.length} unobfuscated address(es), e.g. ***@${found[0]?.split("@")[1]}`,
  );
});

Then("the response body contains no mailto link", function () {
  assert.ok(
    !withoutStyleScript(this.response.body).toLowerCase().includes("mailto:"),
    `${this.response.url} contains a mailto: link, so contact addresses are directly harvestable`,
  );
});

// ── computed / rendered field values ────────────────────────────────────────────────────

// The text a Drupal field div renders. The field wrapper carries a field--name-<machine-name>
// class and the value follows immediately. Drupal omits an empty field from the output
// entirely, so a missing or empty value returns null here — which is what makes the field
// assertions discriminate on the module rather than on the theme's markup.
function fieldValue(body, fieldName) {
  const safe = fieldName.replace(/[^a-z0-9-]/gi, "");
  const m = withoutStyleScript(body).match(
    new RegExp('class="[^"]*field--name-' + safe + '[^"]*"[^>]*>\\s*([^<]*?)\\s*<'),
  );
  return m ? m[1] : null;
}

Then("the {string} field renders a non-empty value", function (fieldName) {
  const value = fieldValue(this.response.body, fieldName);
  assert.ok(value !== null, `${this.response.url} renders no "${fieldName}" field`);
  assert.ok(value.length > 0, `The "${fieldName}" field on ${this.response.url} is empty`);
});

Then("the {string} field value contains {string}", function (fieldName, text) {
  const value = fieldValue(this.response.body, fieldName);
  assert.ok(value !== null, `${this.response.url} renders no "${fieldName}" field`);
  assert.ok(
    value.includes(text),
    `The "${fieldName}" field on ${this.response.url} renders "${value}", expected to contain "${text}"`,
  );
});

// ── following a link discovered at runtime ──────────────────────────────────────────────

// Organisation profile paths are pathauto aliases of operator-managed content, so hardcoding
// one couples the suite to a record an editor can rename or unpublish. Discover one from the
// listing instead. The gap after OrgList is bounded so a first row without an anchor cannot
// match a link elsewhere in the document (which would GET a non-organisation page and blame
// the wrong step).
When("I GET the first organisation profile linked from {string}", async function (listingPath) {
  await this.get(listingPath);
  assert.equal(this.response.status, 200, `Listing ${listingPath} returned ${this.response.status}`);
  const links = [
    ...withoutStyleScript(this.response.body).matchAll(/<div class="OrgList">[\s\S]{0,600}?<a href="(\/[^"#]+)"/g),
  ].map((m) => m[1]);
  assert.ok(
    links.length > 0,
    `No organisation profile link found in ${listingPath}. The listing rendered no rows or its row markup changed`,
  );
  await this.get(links[0]);
});
