/** CRC-16/CCITT-FALSE: polynomial 0x1021, initial value 0xffff. */
export function crc16(bytes: Uint8Array): number {
  let crc = 0xffff;

  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }

  return crc;
}
