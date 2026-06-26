// Cucumber-js configuration. Runs every .feature against step definitions; the env
// (local | test | prod) is chosen via EDCH_ENV and resolved per service in config/services.json.
export default {
  paths: ["features/**/*.feature"],
  import: ["steps/**/*.mjs", "support/**/*.mjs"],
  format: ["progress", ["html", "reports/cucumber.html"]],
  formatOptions: { snippetInterface: "async-await" },
};
