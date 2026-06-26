import { Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";
import { connect as tlsConnect } from "node:tls";

// Days until the peer certificate of the service's base URL expires. rejectUnauthorized:false
// so an already-expired cert is still readable (and reported), not a connection error.
function certDaysRemaining(baseUrl, timeoutMs = 12000) {
  const u = new URL(baseUrl);
  if (u.protocol !== "https:") return Promise.resolve(Infinity); // non-TLS: nothing to check
  const host = u.hostname;
  const port = u.port ? Number(u.port) : 443;
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (fn, v) => {
      if (done) return;
      done = true;
      try {
        socket.destroy();
      } catch {}
      fn(v);
    };
    const socket = tlsConnect({ host, port, servername: host, timeout: timeoutMs, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      if (!cert || !cert.valid_to) return finish(reject, new Error("no peer certificate"));
      const days = Math.floor((new Date(cert.valid_to).getTime() - Date.now()) / 86_400_000);
      finish(resolve, days);
    });
    socket.on("error", (e) => finish(reject, e));
    socket.on("timeout", () => finish(reject, new Error("tls timeout")));
  });
}

Then("the TLS certificate is valid for at least {int} days", async function (minDays) {
  const days = await certDaysRemaining(this.baseUrl);
  assert.ok(days >= minDays, `Certificate for ${this.baseUrl} expires in ${days}d (need >= ${minDays}d)`);
});
