import type { RenderQualitySetting } from "./render-performance";
import { VISUAL_MODES, type VisualModeId } from "./visual-modes";

export interface StudioPreset {
  dwell: 600 | 900 | 1200;
  mode: VisualModeId;
  protocol: 1 | 2;
  quality: RenderQualitySetting;
  strength: number;
}

const QUALITY: readonly RenderQualitySetting[] = ["auto", "efficient", "balanced", "ultra"];

export function encodeStudioPreset(preset: StudioPreset): string {
  const strength = Math.round(Math.max(0.25, Math.min(1, preset.strength)) * 100);
  return `pp1~${preset.mode}~${preset.protocol}~${preset.dwell}~${strength}~${preset.quality}`;
}

export function decodeStudioPreset(encoded: string | null | undefined): StudioPreset | null {
  if (!encoded || encoded.length > 96) return null;
  const [version, mode, protocol, dwell, strength, quality, extra] = encoded.split("~");
  if (version !== "pp1" || extra !== undefined || !VISUAL_MODES.some((candidate) => candidate.id === mode)) return null;
  const protocolNumber = Number(protocol); const dwellNumber = Number(dwell); const strengthNumber = Number(strength);
  if ((protocolNumber !== 1 && protocolNumber !== 2) || ![600, 900, 1200].includes(dwellNumber) || !Number.isInteger(strengthNumber) || strengthNumber < 25 || strengthNumber > 100 || !QUALITY.includes(quality as RenderQualitySetting)) return null;
  return { dwell: dwellNumber as StudioPreset["dwell"], mode: mode as VisualModeId, protocol: protocolNumber as 1 | 2, quality: quality as RenderQualitySetting, strength: strengthNumber / 100 };
}

export function studioPresetUrl(currentHref: string, preset: StudioPreset): string {
  const url = new URL(currentHref); url.search = ""; url.hash = ""; url.searchParams.set("studio", encodeStudioPreset(preset)); return url.toString();
}

export function studioPresetId(preset: StudioPreset): string {
  let hash = 0x811c9dc5;
  for (const character of encodeStudioPreset(preset)) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 0x01000193); }
  return (hash >>> 0).toString(16).padStart(8, "0").toUpperCase();
}
