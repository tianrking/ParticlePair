/**
 * Project camera RGB into the cyan carrier channel.
 *
 * The optical cells use a green-heavy cyan while the decorative galaxy uses
 * blue, violet, and magenta with little green. This lets the visual layer stay
 * vivid without becoming differential noise for the decoder.
 */
export function opticalPixelValue(
  red: number,
  green: number,
  blue: number,
): number {
  // Preserve carrier amplitude while rejecting the red/blue energy used by
  // the decorative nebula. Unlike hue/chromaticity normalization this remains
  // sensitive to the complementary bright/dim optical phases.
  return green - red * 0.42 - blue * 0.16;
}
