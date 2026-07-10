import assert from "node:assert/strict";
import test from "node:test";
import { extractPayloadBits, layoutBits } from "../lib/optical-layout";
import { decodeDifferentialFrames } from "../lib/optical-decoder";
import { decodeParticleCode, encodeParticleCode } from "../lib/protocol";

const SECRET = Uint8Array.from({ length: 16 }, (_, index) => index * 11 + 3);

test("particle protocol survives a clean optical layout round trip", () => {
  const cells = layoutBits(encodeParticleCode(SECRET));
  const decoded = decodeParticleCode(extractPayloadBits(cells));

  assert.deepEqual(decoded.secret, SECRET);
  assert.equal(decoded.correctedCodewords, 0);
});

test("differential pixel decoding removes exposure drift and restores the secret", () => {
  const cells = layoutBits(encodeParticleCode(SECRET));
  const reference = cells.map((cell, index) =>
    (cell ? 32 : 104) * (0.72 + (index % 11) * 0.018),
  );
  const current = cells.map((cell, index) =>
    (cell ? 104 : 32) * (0.72 + (index % 11) * 0.018) + 13,
  );

  const { analysis, decoded } = decodeDifferentialFrames(current, reference);
  assert.deepEqual(decoded.secret, SECRET);
  assert.ok(analysis.quality > 0.9);
});

test("Hamming coding corrects one flipped bit in separate codewords", () => {
  const bits = encodeParticleCode(SECRET);
  bits[2] = !bits[2];
  bits[12 + 8] = !bits[12 + 8];
  bits[12 * 13 + 5] = !bits[12 * 13 + 5];

  const decoded = decodeParticleCode(bits);
  assert.deepEqual(decoded.secret, SECRET);
  assert.equal(decoded.correctedCodewords, 3);
});

test("CRC rejects corruption beyond the correction budget", () => {
  const bits = encodeParticleCode(SECRET);
  bits[24] = !bits[24];
  bits[25] = !bits[25];

  assert.throws(() => decodeParticleCode(bits));
});
