const PARITY_POSITIONS = new Set([1, 2, 4, 8]);

/** Encode one byte as a Hamming(12, 8) codeword, least-significant bit first. */
export function encodeHamming12(byte: number): boolean[] {
  const code = Array<boolean>(13).fill(false);
  let dataBit = 0;

  for (let position = 1; position <= 12; position += 1) {
    if (!PARITY_POSITIONS.has(position)) {
      code[position] = ((byte >> dataBit) & 1) === 1;
      dataBit += 1;
    }
  }

  for (const parityPosition of PARITY_POSITIONS) {
    let parity = false;
    for (let position = 1; position <= 12; position += 1) {
      if (position !== parityPosition && (position & parityPosition) !== 0) {
        parity = parity !== code[position];
      }
    }
    code[parityPosition] = parity;
  }

  return code.slice(1);
}

export interface HammingDecodeResult {
  byte: number;
  corrected: boolean;
}

/** Decode a Hamming(12, 8) codeword and correct one flipped bit. */
export function decodeHamming12(bits: readonly boolean[]): HammingDecodeResult {
  if (bits.length !== 12) {
    throw new Error("Hamming codeword must contain exactly 12 bits");
  }

  const code = [false, ...bits];
  let syndrome = 0;

  for (const parityPosition of PARITY_POSITIONS) {
    let parity = false;
    for (let position = 1; position <= 12; position += 1) {
      if ((position & parityPosition) !== 0) {
        parity = parity !== code[position];
      }
    }
    if (parity) syndrome += parityPosition;
  }

  const corrected = syndrome >= 1 && syndrome <= 12;
  if (corrected) code[syndrome] = !code[syndrome];

  let byte = 0;
  let dataBit = 0;
  for (let position = 1; position <= 12; position += 1) {
    if (!PARITY_POSITIONS.has(position)) {
      if (code[position]) byte |= 1 << dataBit;
      dataBit += 1;
    }
  }

  return { byte, corrected };
}
