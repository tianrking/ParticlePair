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

export const VISUAL_MODES: readonly VisualMode[] = [
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
  mode("andromeda", "Andromeda Bloom", "Violet deep-space arms", "galaxy", "Cosmic", ["#4255ff", "#a535ff", "#ff4fc8"], "✶"),
  mode("quasar", "Quasar Lens", "Relativistic color halo", "rings", "Cosmic", ["#00e5ff", "#5c45ff", "#ff3cac"], "⊚"),
  mode("solar-flare", "Solar Flare", "Magnetic plasma ascent", "embers", "Cosmic", ["#ff2d55", "#ff9500", "#fff06a"], "☼"),
  mode("nebula-rose", "Rose Nebula", "Interstellar petal cloud", "petals", "Cosmic", ["#ff2d9b", "#9b5cff", "#30d9ff"], "❋"),
  mode("event-horizon", "Event Horizon", "Black-hole accretion rings", "rings", "Cosmic", ["#4ddcff", "#7a4dff", "#ff5ba7"], "◍"),
  mode("pulsar", "Pulsar Array", "Precision beacon nodes", "nodes", "Cosmic", ["#d9fbff", "#4ba3ff", "#b44cff"], "⋇"),
  mode("cosmic-web", "Cosmic Web", "Dark-matter filaments", "weave", "Cosmic", ["#32f5ff", "#764cff", "#ff54b0"], "⌗"),
  mode("stardust", "Stardust Drift", "Chromatic stellar embers", "embers", "Cosmic", ["#27e9ff", "#a558ff", "#ff4f9a"], "⁕"),
  mode("lotus", "Quantum Lotus", "Entangled luminous petals", "petals", "Organic", ["#20f6d2", "#5b7cff", "#f64dff"], "❀"),
  mode("coral", "Neon Coral", "Reef-like signal branches", "tendrils", "Organic", ["#00ffd5", "#ff3f8e", "#8c52ff"], "ϟ"),
  mode("synapse", "Synapse Garden", "Neural constellation field", "nodes", "Organic", ["#39ffcc", "#4c7dff", "#ff55d5"], "⋰"),
  mode("dna", "Chromatic Helix", "Paired luminous strands", "weave", "Organic", ["#28f5ff", "#7957ff", "#ff4fa3"], "≋"),
  mode("butterfly", "Photon Butterfly", "Bilateral wing symmetry", "facets", "Organic", ["#00eaff", "#7c4dff", "#ff3fa4"], "꩜"),
  mode("anemone", "Electric Anemone", "Radial living tendrils", "tendrils", "Organic", ["#30ffd0", "#4268ff", "#eb4dff"], "✺"),
  mode("mycelium", "Mycelium Network", "Biological key topology", "nodes", "Organic", ["#70ffbf", "#3a93ff", "#bf55ff"], "⌬"),
  mode("prism", "Prism Cathedral", "Spectral mirrored vault", "facets", "Geometric", ["#13e8ff", "#7950ff", "#ff3cbd"], "◇"),
  mode("mandala", "Photon Mandala", "Radial protocol symmetry", "glyph", "Geometric", ["#2affd5", "#536dff", "#fc4dff"], "✥"),
  mode("moire", "Moiré Nexus", "Interference lattice", "weave", "Geometric", ["#00e7ff", "#7357ff", "#ff4b9b"], "≀"),
  mode("tesseract", "Tesseract Gate", "Dimensional node projection", "nodes", "Geometric", ["#30f4ff", "#6657ff", "#e94cff"], "⌑"),
  mode("crystal", "Crystal Lattice", "Faceted phase geometry", "facets", "Geometric", ["#27eaff", "#5d6cff", "#e753ff"], "⬡"),
  mode("halo", "Chromatic Halo", "Nested spectral circles", "rings", "Geometric", ["#20f5e8", "#5574ff", "#fa48dd"], "◉"),
  mode("portal", "Quantum Portal", "Rotating authentication gate", "glyph", "Geometric", ["#15ffd1", "#575dff", "#ff45c8"], "⦿"),
  mode("rain", "Neon Rain", "Atmospheric light threads", "curtain", "Atmospheric", ["#19e8ff", "#526dff", "#d34dff"], "╎"),
  mode("ocean", "Abyssal Current", "Deep-water wave field", "curtain", "Atmospheric", ["#00ffd0", "#087dff", "#7d3cff"], "≋"),
  mode("storm", "Ion Storm", "Charged cloud diffusion", "clouds", "Atmospheric", ["#33f3ff", "#6161ff", "#ee42ff"], "Ϟ"),
  mode("mirage", "Chromatic Mirage", "Refracted horizon bands", "curtain", "Atmospheric", ["#20ffe0", "#5b76ff", "#ff51c8"], "〰"),
  mode("vapor", "Vapor Spectrum", "Volumetric color field", "clouds", "Atmospheric", ["#00eaff", "#8552ff", "#ff4daf"], "☁"),
  mode("glacier", "Aurora Glacier", "Crystalline polar light", "facets", "Atmospheric", ["#47fff0", "#4894ff", "#a34dff"], "❄"),
  mode("horizon", "Synthetic Horizon", "Layered luminous atmosphere", "curtain", "Atmospheric", ["#2bf5ff", "#596dff", "#f14dff"], "━"),
  mode("cybergrid", "Cyber Grid", "Metropolitan signal matrix", "city", "Synthetic", ["#00f5ff", "#605cff", "#ff3dbb"], "▦"),
  mode("neon-tokyo", "Neon Metropolis", "Electric skyline exchange", "city", "Synthetic", ["#00e8ff", "#7d4dff", "#ff2f92"], "▤"),
  mode("circuit", "Circuit Bloom", "Electronic petal routing", "petals", "Synthetic", ["#12ffd0", "#4675ff", "#ff43d0"], "⌘"),
  mode("hologram", "Hologram Seal", "Layered identity glyph", "glyph", "Synthetic", ["#1fffe1", "#4f70ff", "#f444ff"], "⎈"),
  mode("signal-temple", "Signal Temple", "Architectural light code", "city", "Synthetic", ["#24eaff", "#6757ff", "#ff4aad"], "▧"),
  mode("laser-weave", "Laser Weave", "Coherent thread matrix", "weave", "Synthetic", ["#00ffd5", "#5368ff", "#ff3fd5"], "╳"),
  mode("plasma-core", "Plasma Core", "Contained energy handshake", "orbits", "Synthetic", ["#20fff0", "#5261ff", "#ff3eac"], "⊛"),
  mode("quantum-foam", "Quantum Foam", "Vacuum energy diffusion", "clouds", "Synthetic", ["#18f5ff", "#6854ff", "#ff45c6"], "∴"),
];

export const VISUAL_CATEGORIES: readonly ("All" | VisualCategory)[] = ["All", "Cosmic", "Organic", "Geometric", "Atmospheric", "Synthetic"];

export function visualMode(id: VisualModeId): VisualMode {
  return VISUAL_MODES.find((candidate) => candidate.id === id) ?? VISUAL_MODES[0];
}
