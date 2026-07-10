import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the ParticlePair product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>ParticlePair/);
  assert.match(html, /Let pairing codes/);
  assert.match(html, /Broadcast particle code/);
  assert.match(html, /Camera receiver/);
  assert.match(html, /Recover secret from animation/);
  assert.match(html, /STABLE FRAME/);
  assert.match(html, /FOUNTAIN STREAM/);
  assert.match(html, /V2 CANVAS PROOF/);
  assert.match(html, /IMMERSIVE TRANSMIT/);
  assert.match(html, /VALIDATE ALL 50 VISUAL MODES/);
  assert.match(html, /RUN CAMERA STRESS SUITE/);
  assert.match(html, /AUDIT ALL 50 VISUALS/);
  assert.match(html, /AUTO CALIBRATE/);
  assert.match(html, /Spiral Galaxy/);
  assert.match(html, /Quantum Foam/);
  assert.match(html, /aria-label="Language"/);
  assert.match(html, /aria-pressed="true"[^>]*>EN</);
  assert.match(html, /aria-pressed="false"[^>]*>ES</);
  assert.match(html, /aria-pressed="false"[^>]*>中文</);
  assert.match(html, /scan-quality-label/);
  assert.match(html, /SYNC/);
  assert.match(html, /Hamming\(12,8\)/);
  assert.match(html, /ORBITACERO · PARTICLEPAIR · 2026/);
  assert.doesNotMatch(html, /POLYFORM NONCOMMERCIAL 1\.0\.0/);
  assert.doesNotMatch(html, /value="[0-9a-f]{32}"/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});
