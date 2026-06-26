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

// Decode the handful of HTML entities that show up in <title> text, so a marker like
// "News & Events" matches a title rendered as "News &amp; Events". &amp; is decoded last to
// avoid double-decoding (e.g. "&amp;lt;").
function decodeEntities(s) {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

// Page-specific assertion: the <title> uniquely identifies the rendered page. Stronger than a
// body substring (which matches shared nav/footer text) and it catches a silent redirect to a
// different page — the homepage title differs, so a redirect home fails this check.
Then("the page title contains {string}", function (text) {
  const m = this.response.body.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = m ? decodeEntities(m[1]).trim() : "";
  assert.ok(
    title.toLowerCase().includes(text.toLowerCase()),
    `Page title of ${this.response.url} is "${title}", expected to contain "${text}"`,
  );
});
