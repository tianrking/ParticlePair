const WORDS = [
  "AURORA","BLOOM","COMET","DELTA","EMBER","FROST","GLYPH","HALO",
  "ION","JADE","KITE","LUMEN","MINT","NOVA","ORBIT","PRISM",
  "QUARTZ","RIPPLE","SOLAR","TIDAL","ULTRA","VELVET","WAVE","XENON",
  "YONDER","ZENITH","AMBER","CORAL","DRIFT","ECHO","FLARE","GLOW",
  "HELIOS","IRIS","JUNO","KARMA","LOTUS","MIRAGE","NEON","ONYX",
  "PULSE","QUASAR","RADIANT","SILK","TEMPLE","UMBRA","VIOLET","WHISPER",
  "XYLO","YARROW","ZEPHYR","ARC","BEACON","CIPHER","DUSK","ELECTRIC",
  "FUSION","GARDEN","HORIZON","INDIGO","JELLY","KINETIC","LASER","MOON",
] as const;

export interface PairingSas { code: string; words: readonly [string, string, string] }

export async function derivePairingSas(secret: Uint8Array, sessionId = 0): Promise<PairingSas> {
  const domain = new TextEncoder().encode("ParticlePair/SAS/v1");
  const input = new Uint8Array(domain.length + secret.length + 4); input.set(domain); input.set(secret, domain.length);
  const view = new DataView(input.buffer); view.setUint32(domain.length + secret.length, sessionId >>> 0, false);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", input));
  const words: [string, string, string] = [WORDS[digest[0] & 63], WORDS[digest[1] & 63], WORDS[digest[2] & 63]];
  const code = Array.from(digest.slice(3, 6), (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return { code, words };
}
