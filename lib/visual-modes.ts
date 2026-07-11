export type VisualModeId = string;
export type SceneKind = "galaxy" | "curtain" | "rings" | "petals" | "orbits" | "nodes" | "tendrils" | "clouds" | "weave" | "facets" | "glyph" | "city" | "embers";
export type VisualCategory = "Cosmic" | "Organic" | "Geometric" | "Atmospheric" | "Synthetic";

export interface VisualMode {
  id: VisualModeId;
  name: string;
  subtitle: string;
  kind: SceneKind;
  category: VisualCategory;
  colors: readonly [string, string, string];
  icon: string;
  algorithm: string;
  extraction: string;
  robustness: string;
}

const ALGORITHMS: Record<SceneKind, Pick<VisualMode, "algorithm" | "extraction" | "robustness">> = {
  galaxy: { algorithm: "Deterministic spiral field over a complementary 18×18 phase carrier.", extraction: "Two-frame cyan chroma difference, border correlation, then Hamming and CRC.", robustness: "Static stars cancel between phases; payload survives blur and display scaling." },
  curtain: { algorithm: "Parallel sinusoidal curtains provide a low-frequency aesthetic envelope.", extraction: "Spatial carrier is isolated by normalized cyan-channel differencing.", robustness: "Wide ribbons remain visible while their slow motion cancels as common-mode energy." },
  rings: { algorithm: "Concentric wavefronts create rotation-invariant radial structure.", extraction: "Opposite-phase cell sampling is synchronized by the asymmetric outer border.", robustness: "Radial symmetry tolerates camera rotation and moderate defocus." },
  petals: { algorithm: "Layered polar petals rotate around a stable optical center.", extraction: "The receiver rectifies the square ROI and decodes the carrier below the petal field.", robustness: "Central symmetry gives a strong acquisition target without owning payload bits." },
  orbits: { algorithm: "Multiple angular oscillators form a deterministic orbital clock.", extraction: "Relative frame difference rejects orbit brightness and recovers signed cell energy.", robustness: "Slow orbital motion remains well below the 300 ms differential symbol cadence." },
  nodes: { algorithm: "Anchored nodes and links create a sparse, repeatable topology.", extraction: "Green-dominant carrier values are separated from broadband decorative stars.", robustness: "Sparse edges preserve contrast and tolerate partial occlusion." },
  tendrils: { algorithm: "Bezier tendrils carry a slow bioelectric pulse beneath the code field.", extraction: "Paired-frame subtraction removes the shared body and flowing tentacles.", robustness: "Large organic landmarks improve alignment on small or distant screens." },
  clouds: { algorithm: "Seeded volumetric gradients create a deterministic diffusion field.", extraction: "Chromatic projection suppresses magenta/blue cloud energy before bit decisions.", robustness: "Soft fields remain aesthetically continuous under compression and blur." },
  weave: { algorithm: "Orthogonal luminous curves form a phase-stable textile lattice.", extraction: "Known border polarity estimates orientation and common exposure offset.", robustness: "Repeated strands provide visual structure without requiring line tracking." },
  facets: { algorithm: "Twelve-fold mirrored facets turn redundancy into symmetry.", extraction: "The decoder ignores facet identity and reads the invariant differential carrier.", robustness: "Symmetry masks local damage and remains legible through reflections." },
  glyph: { algorithm: "Concentric symbols and rotating ticks provide a visual protocol clock.", extraction: "Signed phase energy is sampled on the fixed Cartesian carrier grid.", robustness: "Independent inner and outer landmarks stabilize scale and rotation search." },
  city: { algorithm: "Procedural towers and complementary windows form a luminous skyline.", extraction: "Window animation is common-mode; cyan carrier polarity provides payload bits.", robustness: "Hard architectural edges support focus and perspective correction." },
  embers: { algorithm: "Deterministic rising particles sit above a stable firelight envelope.", extraction: "Temporal pairing removes moving sparks while preserving complementary cells.", robustness: "High local contrast works on dim displays and in dark environments." },
};

function mode(id: string, name: string, subtitle: string, kind: SceneKind, category: VisualCategory, colors: readonly [string, string, string], icon: string): VisualMode {
  return { id, name, subtitle, kind, category, colors, icon, ...ALGORITHMS[kind] };
}

const RAW_VISUAL_MODES: readonly VisualMode[] = [
  mode("galaxy", "Spiral Galaxy", "Differential starlight", "galaxy", "Cosmic", ["#3012ff", "#9d08ff", "#ff0aa6"], "✦"),
  mode("aurora", "Aurora Veil", "Luminous curtains", "curtain", "Atmospheric", ["#24ffd1", "#42a5ff", "#b76cff"], "≈"),
  mode("ripple", "Ripple Code", "Radial wavefronts", "rings", "Geometric", ["#24d9ff", "#5078ff", "#d56dff"], "◎"),
  mode("bloom", "Bloom Cipher", "Living petal matrix", "petals", "Organic", ["#ff4fc8", "#a86cff", "#40e6ff"], "✿"),
  mode("orbit", "Orbital Handshake", "Celestial rendezvous", "orbits", "Cosmic", ["#54e7ff", "#7c6cff", "#ffb45c"], "◉"),
  mode("constellation", "Constellation Key", "Connected anchor stars", "nodes", "Cosmic", ["#ffffff", "#77d8ff", "#a98cff"], "⌁"),
  mode("jellyfish", "Bioluminescent", "Jellyfish pulse paths", "tendrils", "Organic", ["#42fff3", "#557dff", "#dc61ff"], "♆"),
  mode("ink", "Ink Diffusion", "Chromatic fluid clouds", "clouds", "Organic", ["#ff3cac", "#784ba0", "#2b86c5"], "◌"),
  mode("weave", "Weave Protocol", "Luminous cipher threads", "weave", "Geometric", ["#2ee8df", "#ff6f8f", "#ffd166"], "⌘"),
  mode("kaleidoscope", "Kaleidoscope", "Symmetric optical facets", "facets", "Geometric", ["#ff42a1", "#7c4dff", "#23d5ff"], "✧"),
  mode("glyph", "Glyph Ritual", "Concentric cipher rings", "glyph", "Synthetic", ["#34f5c5", "#6d62ff", "#ff4ec7"], "⌾"),
  mode("city", "Citylight Code", "Encrypted window glow", "city", "Synthetic", ["#2356ff", "#7b3cff", "#ffd76a"], "▥"),
  mode("ember", "Ember Transfer", "Firelight data ascent", "embers", "Organic", ["#ff3d00", "#ff8a00", "#ffe66d"], "♨"),
];

function structuralDescription(kind: SceneKind, variant: number): string {
  const percent = Math.round(variant * 100);
  switch (kind) {
    case "galaxy": return `Structural variant ${percent}:1 warps arm twist, radial falloff, and vertical compression.`;
    case "curtain": return `Structural variant ${percent}:1 sets wave frequency and signed atmospheric horizon tilt.`;
    case "rings": return `Structural variant ${percent}:1 uses ${9 + Math.floor(variant * 7)} offset wavefronts.`;
    case "petals": return `Structural variant ${percent}:1 uses ${8 + Math.floor(variant * 8)} petals with a distinct aspect ratio.`;
    case "orbits": return `Structural variant ${percent}:1 changes orbital eccentricity, phase spacing, and clock rate.`;
    case "nodes": return `Structural variant ${percent}:1 uses graph stride ${3 + Math.floor(variant * 9)} and unique node scale.`;
    case "tendrils": return `Structural variant ${percent}:1 uses ${10 + Math.floor(variant * 9)} tendrils with distinct flow amplitude.`;
    case "clouds": return `Structural variant ${percent}:1 changes diffusion spiral, lobe radius, and vertical turbulence.`;
    case "weave": return `Structural variant ${percent}:1 uses ${8 + Math.floor(variant * 7)} tilted strands and unique wavelength.`;
    case "facets": return `Structural variant ${percent}:1 uses ${6 + Math.floor(variant * 8)}-fold crystalline symmetry.`;
    case "glyph": return `Structural variant ${percent}:1 uses ${5 + Math.floor(variant * 4)} rings with a unique tick cadence.`;
    case "city": return `Structural variant ${percent}:1 uses ${14 + Math.floor(variant * 9)} towers and a distinct skyline sequence.`;
    case "embers": return `Structural variant ${percent}:1 changes plume spread, ascent height, and particle scale.`;
  }
}

const PALETTE_REFINEMENTS: Readonly<Record<string, readonly [string, string, string]>> = {
  bloom: ["#ff3d9e", "#ffbd4a", "#3fe7ff"],
  constellation: ["#ffd76a", "#57e8ff", "#a56cff"],
  glyph: ["#35ffd2", "#7560ff", "#ffaf45"],
  jellyfish: ["#39ffe1", "#6372ff", "#ff4f9a"],
};

// One representative per genuinely different renderer family.
export const VISUAL_MODES: readonly VisualMode[] = RAW_VISUAL_MODES.map((candidate) => {
  const family = RAW_VISUAL_MODES.filter((modeCandidate) => modeCandidate.kind === candidate.kind);
  const variant = (family.findIndex((modeCandidate) => modeCandidate.id === candidate.id) + 0.5) / family.length;
  return { ...candidate, colors: PALETTE_REFINEMENTS[candidate.id] ?? candidate.colors, algorithm: `${candidate.algorithm} ${structuralDescription(candidate.kind, variant)}` };
});
export const VISUAL_MODE_COUNT = VISUAL_MODES.length;

export const VISUAL_CATEGORIES: readonly ("All" | VisualCategory)[] = ["All", "Cosmic", "Organic", "Geometric", "Atmospheric", "Synthetic"];

export function visualMode(id: VisualModeId): VisualMode {
  return VISUAL_MODES.find((candidate) => candidate.id === id) ?? VISUAL_MODES[0];
}

/** Evenly spaced structural parameter within a renderer family, stable across frames. */
export function visualModeVariant(id: VisualModeId): number {
  const selected = visualMode(id);
  const family = VISUAL_MODES.filter((candidate) => candidate.kind === selected.kind);
  const index = Math.max(0, family.findIndex((candidate) => candidate.id === selected.id));
  return (index + 0.5) / family.length;
}
