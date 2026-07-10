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
  assert.match(html, /让配对码/);
  assert.match(html, /广播粒子码/);
  assert.match(html, /相机接收/);
  assert.match(html, /从动态画面恢复密钥/);
  assert.match(html, /scan-quality-label/);
  assert.match(html, /SYNC/);
  assert.match(html, /Hamming\(12,8\)/);
  assert.doesNotMatch(html, /value="[0-9a-f]{32}"/);
  assert.doesNotMatch(html, /react-loading-skeleton/);
});
