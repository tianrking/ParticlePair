import { GRID_SIZE } from "./optical-layout";
import { opticalPixelValue } from "./optical-color";
import {
  decodeDifferentialFrames,
  type DifferentialFrameAnalysis,
} from "./optical-decoder";
import { renderParticleFrame } from "./particle-renderer";
import type { VisualModeId } from "./visual-modes";

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
): Promise<RenderedPixelLoopbackResult> {
  const reference = captureCanvasFrame(
    renderPhaseFrame(canvas, cells, strength, 1200, mode),
  );
  const current = captureCanvasFrame(
    // This now exercises the same 300 ms separation as a physical camera. The
    // decoration must cancel because its motion is phase-paired by the renderer.
    renderPhaseFrame(canvas, cells, strength, 1500, mode),
  );
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
