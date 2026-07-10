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
];

export function visualMode(id: VisualModeId): VisualMode {
  return VISUAL_MODES.find((mode) => mode.id === id) ?? VISUAL_MODES[0];
}
