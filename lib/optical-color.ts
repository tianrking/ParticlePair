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
  void red;
  void blue;
  return green;
}
