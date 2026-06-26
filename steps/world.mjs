import { setWorldConstructor, World } from "@cucumber/cucumber";
import { loadInventory } from "../support/inventory.mjs";

const inventory = loadInventory();
// Environment under test: local DDEV copy, PCSS test instance, or prod. Default from inventory.
export const ENV = process.env.EDCH_ENV || inventory.defaultEnv || "prod";

class EdchWorld extends World {
  constructor(options) {
    super(options);
    this.env = ENV;
    this.service = null;
    this.baseUrl = null;
    this.response = null; // { status, body, url }
  }

  useService(name) {
    const svc = inventory.services.find((s) => s.name === name);
    if (!svc) throw new Error(`Unknown service "${name}" — not in config/services.json`);
    this.service = svc;
    this.baseUrl = svc.envs[this.env] || svc.envs.prod;
    if (!this.baseUrl) throw new Error(`Service "${name}" has no base URL for env "${this.env}" (and no prod fallback)`);
  }

  // Timeout + one retry on a transient failure — environments like the PCSS test instance
  // are slow, and a plain fetch with no timeout flakes. A clean HTTP error (4xx/5xx) does not
  // throw, so it is reported, not retried. Redirects are followed.
  async get(path, { timeoutMs = 20000, retries = 1 } = {}) {
    const url = new URL(path, this.baseUrl).href;
    let lastErr;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "User-Agent": "edch-service-tests/1.0" } });
        const body = await res.text();
        this.response = { status: res.status, body, url };
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
