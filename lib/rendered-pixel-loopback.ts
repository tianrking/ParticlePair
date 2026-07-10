import { extractPayloadBits, GRID_SIZE, isBorderCell, layoutBits } from "./optical-layout";
import { opticalPixelValue } from "./optical-color";
import {
  decodeDifferentialFrames,
  analyzeDifferentialFrames,
  type DifferentialFrameAnalysis,
} from "./optical-decoder";
import { renderParticleFrame } from "./particle-renderer";
import type { VisualModeId } from "./visual-modes";
import { decodeV2Fragment, encodeV2Fragment, V2FountainDecoder } from "./protocol-v2";

interface CapturedCanvasFrame {
  preview: HTMLCanvasElement;
  values: number[];
}

export interface RenderedPixelLoopbackResult {
  correctedCodewords: number;
  currentImage: string;
  differenceImage: string;
  matchesExpected: boolean;
  quality: number;
  recoveredSecretHex: string;
  referenceImage: string;
}

export type CameraChannelProfile = "clean" | "low-light" | "exposure-drift" | "defocus" | "sensor-noise" | "partial-occlusion";
export const CAMERA_CHANNEL_PROFILES: readonly CameraChannelProfile[] = ["clean", "low-light", "exposure-drift", "defocus", "sensor-noise", "partial-occlusion"];

export interface RenderedV2LoopbackResult { fragments: number; ranks: number[]; recoveredSecretHex: string; }

const PREVIEW_SIZE = 240;

function renderPhaseFrame(
  source: HTMLCanvasElement,
  cells: readonly boolean[],
  strength: number,
  time: number,
  mode: VisualModeId,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, source.width);
  canvas.height = Math.max(1, source.height);
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("无法创建确定性相位画布");

  renderParticleFrame({
    cells,
    context,
    height: canvas.height,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    strength,
    time,
    width: canvas.width,
    mode,
  });
  return canvas;
}

function captureCanvasFrame(source: HTMLCanvasElement): CapturedCanvasFrame {
  const sourceSide = Math.min(source.width, source.height);
  const sourceX = (source.width - sourceSide) / 2;
  const sourceY = (source.height - sourceSide) / 2;

  const samplingCanvas = document.createElement("canvas");
  samplingCanvas.width = GRID_SIZE;
  samplingCanvas.height = GRID_SIZE;
  const samplingContext = samplingCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!samplingContext) throw new Error("无法创建像素采样画布");
  samplingContext.drawImage(
    source,
    sourceX,
    sourceY,
    sourceSide,
    sourceSide,
    0,
    0,
    GRID_SIZE,
    GRID_SIZE,
  );

  const pixels = samplingContext.getImageData(
    0,
    0,
    GRID_SIZE,
    GRID_SIZE,
  ).data;
  const values = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => {
    const offset = index * 4;
    return opticalPixelValue(
      pixels[offset],
      pixels[offset + 1],
      pixels[offset + 2],
    );
  });

  const preview = document.createElement("canvas");
  preview.width = PREVIEW_SIZE;
  preview.height = PREVIEW_SIZE;
  const previewContext = preview.getContext("2d");
  if (!previewContext) throw new Error("无法创建像素预览画布");
  previewContext.drawImage(
    source,
    sourceX,
    sourceY,
    sourceSide,
    sourceSide,
    0,
    0,
    PREVIEW_SIZE,
    PREVIEW_SIZE,
  );

  return { preview, values };
}

function applyCameraChannel(source: HTMLCanvasElement, profile: CameraChannelProfile, phase: 0 | 1): HTMLCanvasElement {
  if (profile === "clean" || profile === "sensor-noise" || profile === "partial-occlusion") return source;
  const canvas = document.createElement("canvas"); canvas.width = source.width; canvas.height = source.height;
  const context = canvas.getContext("2d", { alpha: false }); if (!context) return source;
  if (profile === "low-light") context.filter = "brightness(55%) saturate(85%) contrast(112%)";
  if (profile === "exposure-drift") context.filter = phase ? "brightness(122%)" : "brightness(78%)";
  if (profile === "defocus") context.filter = `blur(${Math.max(1, Math.min(source.width, source.height) / 360)}px)`;
  context.drawImage(source, 0, 0); return canvas;
}

function applySampleChannel(values: number[], profile: CameraChannelProfile, phase: 0 | 1): number[] {
  if (profile === "sensor-noise") return values.map((value, index) => value + ((((index * 73 + phase * 41) % 17) - 8) * 0.9));
  if (profile === "partial-occlusion") {
    const payload = values.map((_, index) => index).filter((index) => !isBorderCell(index));
    const erased = new Set([payload[13], payload[91], payload[181]]);
    return values.map((value, index) => erased.has(index) ? 0 : value);
  }
  return values;
}

function createDifferenceImage(analysis: DifferentialFrameAnalysis): string {
  const cellCanvas = document.createElement("canvas");
  cellCanvas.width = GRID_SIZE;
  cellCanvas.height = GRID_SIZE;
  const cellContext = cellCanvas.getContext("2d");
  if (!cellContext) throw new Error("无法创建差分预览画布");

  const oriented = analysis.differences.map(
    (difference) => difference * analysis.orientation,
  );
  const amplitudes = oriented.map(Math.abs).sort((left, right) => left - right);
  const scale = amplitudes[Math.floor(amplitudes.length * 0.9)] || 1;
  const image = cellContext.createImageData(GRID_SIZE, GRID_SIZE);

  oriented.forEach((difference, index) => {
    const strength = Math.min(1, Math.abs(difference) / scale);
    const offset = index * 4;
    if (difference > 0) {
      image.data[offset] = 46 * strength;
      image.data[offset + 1] = 232 * strength;
      image.data[offset + 2] = 223 * strength;
    } else {
      image.data[offset] = 255 * strength;
      image.data[offset + 1] = 111 * strength;
      image.data[offset + 2] = 61 * strength;
    }
    image.data[offset + 3] = 255;
  });
  cellContext.putImageData(image, 0, 0);

  const preview = document.createElement("canvas");
  preview.width = PREVIEW_SIZE;
  preview.height = PREVIEW_SIZE;
  const previewContext = preview.getContext("2d");
  if (!previewContext) throw new Error("无法放大差分预览");
  previewContext.imageSmoothingEnabled = false;
  previewContext.drawImage(
    cellCanvas,
    0,
    0,
    PREVIEW_SIZE,
    PREVIEW_SIZE,
  );
  return preview.toDataURL("image/png");
}

/** Render real Canvas pixels for both phases and recover the secret deterministically. */
export async function runRenderedPixelLoopback(
  canvas: HTMLCanvasElement,
  cells: readonly boolean[],
  strength: number,
  expectedSecretHex: string,
  mode: VisualModeId = "galaxy",
  profile: CameraChannelProfile = "clean",
): Promise<RenderedPixelLoopbackResult> {
  const reference = captureCanvasFrame(applyCameraChannel(
    renderPhaseFrame(canvas, cells, strength, 1200, mode), profile, 0,
  ));
  const current = captureCanvasFrame(applyCameraChannel(
    // This now exercises the same 300 ms separation as a physical camera. The
    // decoration must cancel because its motion is phase-paired by the renderer.
    renderPhaseFrame(canvas, cells, strength, 1500, mode), profile, 1,
  ));
  reference.values = applySampleChannel(reference.values, profile, 0);
  current.values = applySampleChannel(current.values, profile, 1);
  const { analysis, decoded } = decodeDifferentialFrames(
    current.values,
    reference.values,
  );

  return {
    correctedCodewords: decoded.correctedCodewords,
    currentImage: current.preview.toDataURL("image/png"),
    differenceImage: createDifferenceImage(analysis),
    matchesExpected: decoded.secretHex === expectedSecretHex.toLowerCase(),
    quality: analysis.quality,
    recoveredSecretHex: decoded.secretHex,
    referenceImage: reference.preview.toDataURL("image/png"),
  };
}

/** Full v2 optical path: five rendered fragments, one duplicate, then GF(2) recovery. */
export async function runRenderedV2FountainLoopback(
  canvas: HTMLCanvasElement,
  secret: Uint8Array,
  strength: number,
  mode: VisualModeId,
  sessionId: number,
  issuedMinute: number,
): Promise<RenderedV2LoopbackResult> {
  const decoder = new V2FountainDecoder(); const ranks: number[] = []; const sequence = [4, 4, 5, 9, 1];
  for (const fragmentSequence of sequence) {
    const cells = layoutBits(encodeV2Fragment(secret, sessionId, issuedMinute, fragmentSequence));
    const reference = captureCanvasFrame(renderPhaseFrame(canvas, cells, strength, 1200, mode));
    const current = captureCanvasFrame(renderPhaseFrame(canvas, cells, strength, 1500, mode));
    const analysis = analyzeDifferentialFrames(current.values, reference.values);
    const fragment = decodeV2Fragment(extractPayloadBits(analysis.cells), issuedMinute);
    const progress = decoder.add(fragment, issuedMinute); ranks.push(progress.rank);
    if (progress.complete && progress.secretHex) return { fragments: ranks.length, ranks, recoveredSecretHex: progress.secretHex };
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }
  throw new Error("Rendered v2 fountain stream did not reach rank four");
}
