import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Resolve the Registry base URL for the chosen env from the shared inventory, so the browser
// layer and the HTTP layer always target the same place.
const here = dirname(fileURLToPath(import.meta.url));
const inv = JSON.parse(readFileSync(join(here, "..", "config", "services.json"), "utf8"));
const env = process.env.EDCH_ENV || inv.defaultEnv || "prod";
const registry = inv.services.find((s: { name: string }) => s.name === "registry");
const baseURL = registry.envs[env] || registry.envs.prod;

export default defineConfig({
  testDir: "specs",
  timeout: 30_000,
  retries: 1,
  use: { baseURL, headless: true },
  reporter: [["list"]],
});
