import { GRID_SIZE } from "./optical-layout";
import {
  analyzeDifferentialFrames,
  decodeDifferentialFrames,
  type DifferentialFrameAnalysis,
} from "./optical-decoder";

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

const CAPTURE_COUNT = 18;
const CAPTURE_INTERVAL_MS = 50;
const MINIMUM_SYNC_QUALITY = 0.52;
const PREVIEW_SIZE = 240;

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
    return (
      pixels[offset] * 0.2126 +
      pixels[offset + 1] * 0.7152 +
      pixels[offset + 2] * 0.0722
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

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

/** Capture real rendered Canvas pixels and recover the secret from two phases. */
export async function runRenderedPixelLoopback(
  canvas: HTMLCanvasElement,
  expectedSecretHex: string,
): Promise<RenderedPixelLoopbackResult> {
  const captures: CapturedCanvasFrame[] = [];
  let best:
    | {
        analysis: DifferentialFrameAnalysis;
        current: CapturedCanvasFrame;
        decoded: ReturnType<typeof decodeDifferentialFrames>["decoded"];
        reference: CapturedCanvasFrame;
      }
    | undefined;

  for (let captureIndex = 0; captureIndex < CAPTURE_COUNT; captureIndex += 1) {
    if (captureIndex > 0) await wait(CAPTURE_INTERVAL_MS);
    const current = captureCanvasFrame(canvas);

    for (const reference of captures) {
      const analysis = analyzeDifferentialFrames(
        current.values,
        reference.values,
      );
      if (
        analysis.quality < MINIMUM_SYNC_QUALITY ||
        (best && analysis.quality <= best.analysis.quality)
      ) {
        continue;
      }

      try {
        const { decoded } = decodeDifferentialFrames(
          current.values,
          reference.values,
        );
        best = { analysis, current, decoded, reference };
      } catch {
        // Strong synchronization can still contain too many payload errors.
      }
    }

    captures.push(current);
  }

  if (!best) {
    throw new Error("真实像素帧未通过同步与CRC校验，请提高调制强度后重试");
  }

  return {
    correctedCodewords: best.decoded.correctedCodewords,
    currentImage: best.current.preview.toDataURL("image/png"),
    differenceImage: createDifferenceImage(best.analysis),
    matchesExpected: best.decoded.secretHex === expectedSecretHex.toLowerCase(),
    quality: best.analysis.quality,
    recoveredSecretHex: best.decoded.secretHex,
    referenceImage: best.reference.preview.toDataURL("image/png"),
  };
}
