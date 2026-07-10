import { crc16 } from "./crc16";
import { decodeHamming12, encodeHamming12 } from "./hamming";

export const SECRET_BYTES = 16;
export const PACKET_BYTES = 21;
export const ENCODED_BITS = PACKET_BYTES * 12;

const MAGIC = 0xa7;
const VERSION = 1;

export interface DecodedParticleCode {
  secret: Uint8Array;
  secretHex: string;
  correctedCodewords: number;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function hexToBytes(value: string): Uint8Array {
  const normalized = value.replaceAll(/[^0-9a-f]/gi, "").toLowerCase();
  if (normalized.length !== SECRET_BYTES * 2) {
    throw new Error(`配对秘密必须是 ${SECRET_BYTES * 2} 个十六进制字符`);
  }

  return Uint8Array.from(
    { length: SECRET_BYTES },
    (_, index) => Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16),
  );
}

export function createRandomSecret(): Uint8Array {
  const secret = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(secret);
  return secret;
}

export function encodeParticleCode(secret: Uint8Array): boolean[] {
  if (secret.length !== SECRET_BYTES) {
    throw new Error(`Secret must contain ${SECRET_BYTES} bytes`);
  }

  const packet = new Uint8Array(PACKET_BYTES);
  packet[0] = MAGIC;
  packet[1] = VERSION;
  packet[2] = SECRET_BYTES;
  packet.set(secret, 3);

  const checksum = crc16(packet.subarray(0, 19));
  packet[19] = checksum >> 8;
  packet[20] = checksum & 0xff;

  return Array.from(packet).flatMap(encodeHamming12);
}

export function decodeParticleCode(bits: readonly boolean[]): DecodedParticleCode {
  if (bits.length < ENCODED_BITS) {
    throw new Error("可用数据不足，无法恢复配对码");
  }

  const packet = new Uint8Array(PACKET_BYTES);
  let correctedCodewords = 0;

  for (let index = 0; index < PACKET_BYTES; index += 1) {
    const result = decodeHamming12(bits.slice(index * 12, index * 12 + 12));
    packet[index] = result.byte;
    if (result.corrected) correctedCodewords += 1;
  }

  if (packet[0] !== MAGIC || packet[1] !== VERSION || packet[2] !== SECRET_BYTES) {
    throw new Error("没有识别到有效的 Particle Code 数据帧");
  }

  const expected = (packet[19] << 8) | packet[20];
  const actual = crc16(packet.subarray(0, 19));
  if (expected !== actual) {
    throw new Error("数据帧校验失败，请保持镜头稳定后重试");
  }

  const secret = packet.slice(3, 19);
  return { secret, secretHex: bytesToHex(secret), correctedCodewords };
}
