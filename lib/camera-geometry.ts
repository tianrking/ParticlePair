export interface SourceRectangle {
  height: number;
  width: number;
  x: number;
  y: number;
}

export interface CameraCrop {
  key: string;
  side: number;
  x: number;
  y: number;
}

const GUIDE_HEIGHT_RATIO = 0.76;
const CROP_SCALES = [0.84, 0.92, 1, 1.08, 1.16] as const;
const CROP_OFFSETS = [
  [0, 0],
  [-0.06, 0],
  [0.06, 0],
  [0, -0.06],
  [0, 0.06],
] as const;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Return the source-video rectangle visible through an object-fit: cover box.
 * Camera coordinates must be derived from this rectangle, not the raw short
 * edge: a portrait iPhone stream is heavily cropped inside the landscape UI.
 */
export function objectFitCoverSourceRectangle(
  videoWidth: number,
  videoHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): SourceRectangle {
  if (
    videoWidth <= 0 ||
    videoHeight <= 0 ||
    viewportWidth <= 0 ||
    viewportHeight <= 0
  ) {
    throw new Error("Camera and viewport dimensions must be positive");
  }

  const videoAspect = videoWidth / videoHeight;
  const viewportAspect = viewportWidth / viewportHeight;

  if (videoAspect > viewportAspect) {
    const width = videoHeight * viewportAspect;
    return {
      height: videoHeight,
      width,
      x: (videoWidth - width) / 2,
      y: 0,
    };
  }

  const height = videoWidth / viewportAspect;
  return {
    height,
    width: videoWidth,
    x: 0,
    y: (videoHeight - height) / 2,
  };
}

/** Build scale/position candidates around the square guide shown to the user. */
export function guideCropCandidates(visible: SourceRectangle): CameraCrop[] {
  const guideSide = visible.height * GUIDE_HEIGHT_RATIO;
  const centerX = visible.x + visible.width / 2;
  const centerY = visible.y + visible.height / 2;

  return CROP_SCALES.flatMap((scale) => {
    const side = guideSide * scale;
    return CROP_OFFSETS.map(([offsetX, offsetY]) => {
      const candidateCenterX = clamp(
        centerX + offsetX * guideSide,
        visible.x + side / 2,
        visible.x + visible.width - side / 2,
      );
      const candidateCenterY = clamp(
        centerY + offsetY * guideSide,
        visible.y + side / 2,
        visible.y + visible.height - side / 2,
      );

      return {
        key: `${scale}:${offsetX}:${offsetY}`,
        side,
        x: candidateCenterX - side / 2,
        y: candidateCenterY - side / 2,
      };
    });
  });
}
