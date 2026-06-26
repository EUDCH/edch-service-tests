import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// Load and lightly validate the service inventory once.
export function loadInventory() {
  const path = join(HERE, "..", "config", "services.json");
  const data = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(data.services) || data.services.length === 0) {
    throw new Error("config/services.json: 'services' must be a non-empty array");
  }
  for (const s of data.services) {
    if (!s.name || !s.envs) throw new Error(`service entry missing name/envs: ${JSON.stringify(s)}`);
  }
  return data;
}
