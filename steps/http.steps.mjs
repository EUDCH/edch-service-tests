import { Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

Given("the {string} service", function (name) {
  this.useService(name);
});

When("I GET {string}", async function (path) {
  await this.get(path);
});

Then("the response status is {int}", function (expected) {
  assert.equal(
    this.response.status,
    expected,
    `GET ${this.response.url} returned ${this.response.status}, expected ${expected}`,
  );
});

Then("the response body contains {string}", function (text) {
  assert.ok(
    this.response.body.toLowerCase().includes(text.toLowerCase()),
    `Body of ${this.response.url} does not contain "${text}"`,
  );
});

// Page-specific assertion: the <title> uniquely identifies the rendered page. Stronger than a
// body substring (which matches shared nav/footer text) and it catches a silent redirect to a
// different page — the homepage title differs, so a redirect home fails this check.
Then("the page title contains {string}", function (text) {
  const m = this.response.body.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = m ? m[1].trim() : "";
  assert.ok(
    title.toLowerCase().includes(text.toLowerCase()),
    `Page title of ${this.response.url} is "${title}", expected to contain "${text}"`,
  );
});
