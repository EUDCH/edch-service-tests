import { When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

// Steps for Drupal-specific and JSON-endpoint assertions, kept out of http.steps.mjs so the
// shared HTTP vocabulary stays service-agnostic.

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

// Asserting the *shape* of every item, not just the first, so a partially-malformed upstream
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

// ── email obfuscation ───────────────────────────────────────────────────────────────────

// Ignore <style> and <script> so a CSS selector or a JS string can't satisfy — or break — an
// assertion about rendered page text.
function renderedText(body) {
  return body.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "");
}

// Deliberately not anchored to a module name: this asserts the *outcome* (no reachable address)
// rather than the mechanism, so it keeps working if the obfuscation implementation changes.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

Then("the response body contains no email address", function () {
  const found = [...new Set(renderedText(this.response.body).match(EMAIL_RE) ?? [])];
  assert.equal(
    found.length,
    0,
    // Report only the domain half; the local part is the personal data we are asserting is absent.
    `${this.response.url} exposes ${found.length} unobfuscated address(es), e.g. ***@${found[0]?.split("@")[1]}`,
  );
});

Then("the response body contains no mailto link", function () {
  assert.ok(
    !renderedText(this.response.body).toLowerCase().includes("mailto:"),
    `${this.response.url} contains a mailto: link, so contact addresses are directly harvestable`,
  );
});

// ── Drupal version ──────────────────────────────────────────────────────────────────────

function drupalMajor(body) {
  const m = body.match(/<meta\s+name="Generator"\s+content="Drupal\s+(\d+)/i);
  if (!m) throw new Error("No Drupal Generator meta tag in the response — cannot read the major version");
  return Number(m[1]);
}

Then("the Drupal major version is at least {int}", function (min) {
  const major = drupalMajor(this.response.body);
  assert.ok(major >= min, `${this.response.url} reports Drupal ${major}, expected >= ${min}`);
});

// Exact-version gate, opt-in via environment. The suite's default target is production, and
// production and the test instance are deliberately on different majors during a migration —
// so a hardcoded major would have to be wrong somewhere. Setting the variable in the test-env
// CI job turns this into a hard "the migration target really is on N" assertion; unset, it is
// a no-op rather than a silent pass.
Then("the Drupal major version equals {string} when that variable is set", function (varName) {
  const expected = process.env[varName];
  if (!expected) return "skipped";
  const major = drupalMajor(this.response.body);
  assert.equal(
    major,
    Number(expected),
    `${this.response.url} reports Drupal ${major} but ${varName}=${expected}`,
  );
});

// ── following a link discovered at runtime ──────────────────────────────────────────────

// Organisation profile paths are pathauto aliases of real, operator-managed content, so
// hardcoding one would couple the suite to a single record that an editor can rename or
// unpublish. Discover one from the listing instead: same coverage, no fixture dependency.
When("I GET the first organisation profile linked from {string}", async function (listingPath) {
  await this.get(listingPath);
  assert.equal(this.response.status, 200, `Listing ${listingPath} returned ${this.response.status}`);
  const links = [
    ...renderedText(this.response.body).matchAll(/<div class="OrgList">[\s\S]*?<a href="(\/[^"#]+)"/g),
  ].map((m) => m[1]);
  assert.ok(
    links.length > 0,
    `No organisation profile link found in ${listingPath}. Either the listing rendered no rows or its row markup changed`,
  );
  await this.get(links[0]);
});
