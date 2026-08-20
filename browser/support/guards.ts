import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const inv = JSON.parse(readFileSync(join(here, "..", "..", "config", "services.json"), "utf8"));

/**
 * Hostnames that must never receive test data, derived from the inventory's own prod URLs so a
 * newly added service cannot be left off the list.
 */
export function prodHostnames(): Set<string> {
  return new Set(
    (inv.services as Array<{ envs?: Record<string, string> }>)
      .map((s) => s.envs?.prod)
      .filter((u): u is string => Boolean(u))
      .map((u) => new URL(u).hostname),
  );
}

/**
 * Fail closed before a spec writes anything.
 *
 * The base URL resolution deliberately falls back to prod when the per-env override is unset,
 * which is right for read-only checks and dangerous for writes: `EDCH_ENV=test` with no
 * `EDCH_REGISTRY_TEST_URL` resolves to the live site, so the env name is not evidence of the
 * target. Only the resolved hostname is. Throwing here (rather than skipping) makes a
 * misconfigured CI run loud instead of silently green.
 */
export function assertNotProduction(baseURL: string | undefined, what: string): string {
  if (!baseURL) throw new Error(`${what}: no baseURL resolved`);
  const host = new URL(baseURL).hostname;
  if (prodHostnames().has(host)) {
    throw new Error(
      `${what} refuses to run against production host "${host}". ` +
        `Set EDCH_ENV and the matching EDCH_<SERVICE>_<ENV>_URL to a non-production instance.`,
    );
  }
  return baseURL;
}

/**
 * Dismiss the Klaro consent dialog.
 *
 * Klaro runs here with `mustConsent: true`, so it renders a blocking overlay (`#klaro .cm-bg`)
 * that swallows pointer events until it is answered. Any spec that clicks anything must call
 * this first, or Playwright retries the click until it times out and the real cause —
 * "something invisible is on top" — is buried in the retry log.
 *
 * Tolerant by design: no dialog (consent already stored, or Klaro not deployed on this
 * service) is a no-op, not a failure.
 */
export async function dismissConsent(page: import("@playwright/test").Page): Promise<void> {
  const accept = page.locator("#klaro button.cm-btn-accept");
  if (await accept.count()) {
    await accept.first().click();
    await page.locator("#klaro .cm-bg").waitFor({ state: "hidden", timeout: 10_000 }).catch(() => {});
  }
}

/** A marker that makes every artifact this suite creates attributable and greppable. */
export function testMarker(prefix = "edch-service-tests"): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  return `${prefix}-${stamp}`;
}
