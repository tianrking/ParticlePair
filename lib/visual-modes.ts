export type VisualModeId =
  | "galaxy" | "aurora" | "ripple" | "bloom" | "orbit" | "constellation"
  | "jellyfish" | "ink" | "weave" | "kaleidoscope" | "glyph" | "city" | "ember";

export type SceneKind = "galaxy" | "curtain" | "rings" | "petals" | "orbits" | "nodes" | "tendrils" | "clouds" | "weave" | "facets" | "glyph" | "city" | "embers";

export interface VisualMode {
  id: VisualModeId;
  name: string;
  subtitle: string;
  kind: SceneKind;
  colors: readonly [string, string, string];
  icon: string;
}

export const VISUAL_MODES: readonly VisualMode[] = [
  { id: "galaxy", name: "Spiral Galaxy", subtitle: "Differential starlight", kind: "galaxy", colors: ["#3012ff", "#9d08ff", "#ff0aa6"], icon: "✦" },
  { id: "aurora", name: "Aurora Veil", subtitle: "Luminous curtains", kind: "curtain", colors: ["#24ffd1", "#42a5ff", "#b76cff"], icon: "≈" },
  { id: "ripple", name: "Ripple Code", subtitle: "Radial wavefronts", kind: "rings", colors: ["#24d9ff", "#5078ff", "#d56dff"], icon: "◎" },
  { id: "bloom", name: "Bloom Cipher", subtitle: "Living petal matrix", kind: "petals", colors: ["#ff4fc8", "#a86cff", "#40e6ff"], icon: "✿" },
  { id: "orbit", name: "Orbital Handshake", subtitle: "Celestial rendezvous", kind: "orbits", colors: ["#54e7ff", "#7c6cff", "#ffb45c"], icon: "◉" },
  { id: "constellation", name: "Constellation Key", subtitle: "Connected anchor stars", kind: "nodes", colors: ["#ffffff", "#77d8ff", "#a98cff"], icon: "⌁" },
  { id: "jellyfish", name: "Bioluminescent", subtitle: "Jellyfish pulse paths", kind: "tendrils", colors: ["#42fff3", "#557dff", "#dc61ff"], icon: "♆" },
  { id: "ink", name: "Ink Diffusion", subtitle: "Chromatic fluid clouds", kind: "clouds", colors: ["#ff3cac", "#784ba0", "#2b86c5"], icon: "◌" },
  { id: "weave", name: "Weave Protocol", subtitle: "Luminous cipher threads", kind: "weave", colors: ["#2ee8df", "#ff6f8f", "#ffd166"], icon: "⌘" },
  { id: "kaleidoscope", name: "Kaleidoscope", subtitle: "Symmetric optical facets", kind: "facets", colors: ["#ff42a1", "#7c4dff", "#23d5ff"], icon: "✧" },
];

export function visualMode(id: VisualModeId): VisualMode {
  return VISUAL_MODES.find((mode) => mode.id === id) ?? VISUAL_MODES[0];
}
