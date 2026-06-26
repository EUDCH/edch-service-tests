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
