export interface VisualDna {
  fingerprint: string;
  label: string;
  seed: number;
  symmetry: number;
  orbitBias: number;
  chromaShift: number;
}

const ATMOSPHERES = ["AURORA", "NOVA", "PRISM", "VELVET", "ION", "COSMIC", "LUMEN", "SOLAR"] as const;
const FORMS = ["ARC", "BLOOM", "CROWN", "DRIFT", "GATE", "HALO", "ORBIT", "VEIL"] as const;

function mix(value: number): number {
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  return (value ^ (value >>> 16)) >>> 0;
}

/** A deterministic, non-cryptographic art seed derived from the complete optical frame. */
export function deriveVisualDna(cells: readonly boolean[]): VisualDna {
  let hash = 0x811c9dc5;
  for (let index = 0; index < cells.length; index += 1) {
    hash ^= (cells[index] ? 0xa7 : 0x39) ^ index;
    hash = Math.imul(hash, 0x01000193);
  }
  const seed = mix(hash ^ Math.imul(cells.length, 0x9e3779b1));
  const secondary = mix(seed ^ 0xa5a5f00d);
  return {
    fingerprint: seed.toString(16).padStart(8, "0").toUpperCase(),
    label: `${ATMOSPHERES[seed & 7]} ${FORMS[(seed >>> 5) & 7]}`,
    seed,
    symmetry: 3 + ((seed >>> 8) % 6),
    orbitBias: ((secondary & 0xffff) / 0xffff) * 2 - 1,
    chromaShift: ((secondary >>> 16) & 0xffff) / 0xffff,
  };
}
