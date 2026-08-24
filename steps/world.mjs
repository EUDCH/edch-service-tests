import { setWorldConstructor, setDefaultTimeout, World } from "@cucumber/cucumber";
import { loadInventory } from "../support/inventory.mjs";

const inventory = loadInventory();
// Environment under test: local DDEV copy, PCSS test instance, or prod. Default from inventory.
export const ENV = process.env.EDCH_ENV || inventory.defaultEnv || "prod";

// get() budgets up to timeoutMs * (retries + 1) = 40s. Cucumber's default step timeout is 5s,
// which would abort long before the client's own timeout and retry could fire — the URL-bearing
// failure message would be unreachable and a slow instance would report a generic 5s timeout.
// Keep this comfortably above the client budget so the client's timeout is what actually governs.
setDefaultTimeout(45_000);

class EdchWorld extends World {
  constructor(options) {
    super(options);
    this.env = ENV;
    this.service = null;
    this.baseUrl = null;
    this.response = null; // { status, body, url, contentType, location }
  }

  useService(name) {
    const svc = inventory.services.find((s) => s.name === name);
    if (!svc) throw new Error(`Unknown service "${name}" — not in config/services.json`);
    this.service = svc;
    // Resolve base URL: env-var override first (keeps non-public test/local hosts out of the
    // repo), then the committed inventory, then the prod fallback.
    const overrideKey = `EDCH_${name.toUpperCase().replace(/-/g, "_")}_${this.env.toUpperCase()}_URL`;
    this.baseUrl = process.env[overrideKey] || svc.envs[this.env] || svc.envs.prod;
    if (!this.baseUrl) throw new Error(`Service "${name}" has no base URL for env "${this.env}" (set ${overrideKey} or add it to config/services.json)`);
  }

  // `follow: false` keeps the 3xx itself observable. A redirect that is part of the contract
  // (a route that bounces anonymous users to the login form) can only be asserted if the
  // redirect is not silently followed — following it turns a 302 into the login page's 200.
  async get(path, { timeoutMs = 20000, retries = 1, follow = true } = {}) {
    const url = new URL(path, this.baseUrl).href;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { redirect: follow ? "follow" : "manual", signal: ctrl.signal, headers: { "User-Agent": "edch-service-tests/1.0" } });
        const body = await res.text();
        this.response = {
          status: res.status,
          body,
          url,
          contentType: res.headers.get("content-type") ?? "",
          location: res.headers.get("location") ?? "",
        };
        return this.response;
      } catch (e) {
        lastErr = e;
      } finally {
        clearTimeout(timer);
      }
    }
    throw new Error(`GET ${url} failed after ${retries + 1} attempt(s): ${lastErr?.message ?? lastErr}`);
  }
}

setWorldConstructor(EdchWorld);
