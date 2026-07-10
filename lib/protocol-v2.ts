import { crc16 } from "./crc16";
import { decodeHamming12, encodeHamming12 } from "./hamming";
import { bytesToHex, ENCODED_BITS, PACKET_BYTES, SECRET_BYTES } from "./protocol";

const MAGIC = 0xa7;
const VERSION = 2;
const BLOCK_BYTES = 4;
const BLOCK_COUNT = SECRET_BYTES / BLOCK_BYTES;
const MAX_AGE_MINUTES = 10;
const MASK_SCHEDULE = [0x1, 0x2, 0x4, 0x8, 0x3, 0x5, 0x9, 0x6, 0xa, 0xc, 0x7, 0xb, 0xd, 0xe, 0xf] as const;

export interface V2Fragment {
  correctedCodewords: number;
  issuedMinute: number;
  mask: number;
  payload: Uint8Array;
  sequence: number;
  sessionId: number;
}

export interface V2DecodeProgress {
  complete: boolean;
  rank: number;
  secret?: Uint8Array;
  secretHex?: string;
  sessionId: number;
}

function writeUint32(packet: Uint8Array, offset: number, value: number): void {
  packet[offset] = value >>> 24; packet[offset + 1] = value >>> 16; packet[offset + 2] = value >>> 8; packet[offset + 3] = value;
}

function readUint32(packet: Uint8Array, offset: number): number {
  return ((packet[offset] * 0x1000000) + (packet[offset + 1] << 16) + (packet[offset + 2] << 8) + packet[offset + 3]) >>> 0;
}

function decodePacket(bits: readonly boolean[]): { packet: Uint8Array; correctedCodewords: number } {
  if (bits.length < ENCODED_BITS) throw new Error("Insufficient v2 optical payload");
  const packet = new Uint8Array(PACKET_BYTES); let correctedCodewords = 0;
  for (let index = 0; index < PACKET_BYTES; index += 1) {
    const decoded = decodeHamming12(bits.slice(index * 12, index * 12 + 12)); packet[index] = decoded.byte;
    if (decoded.corrected) correctedCodewords += 1;
  }
  return { packet, correctedCodewords };
}

export function encodeV2Fragment(secret: Uint8Array, sessionId: number, issuedMinute: number, sequence: number): boolean[] {
  if (secret.length !== SECRET_BYTES) throw new Error(`Secret must contain ${SECRET_BYTES} bytes`);
  const mask = MASK_SCHEDULE[sequence % MASK_SCHEDULE.length];
  const payload = new Uint8Array(BLOCK_BYTES);
  for (let block = 0; block < BLOCK_COUNT; block += 1) if (mask & (1 << block)) {
    for (let byte = 0; byte < BLOCK_BYTES; byte += 1) payload[byte] ^= secret[block * BLOCK_BYTES + byte];
  }
  const packet = new Uint8Array(PACKET_BYTES);
  packet[0] = MAGIC; packet[1] = VERSION; writeUint32(packet, 2, sessionId >>> 0); writeUint32(packet, 6, issuedMinute >>> 0);
  packet[10] = sequence & 0xff; packet[11] = mask; packet[12] = BLOCK_BYTES; packet.set(payload, 13); packet[17] = BLOCK_COUNT; packet[18] = SECRET_BYTES;
  const checksum = crc16(packet.subarray(0, 19)); packet[19] = checksum >> 8; packet[20] = checksum;
  return Array.from(packet).flatMap(encodeHamming12);
}

export function decodeV2Fragment(bits: readonly boolean[], nowMinute = Math.floor(Date.now() / 60000)): V2Fragment {
  const { packet, correctedCodewords } = decodePacket(bits);
  if (packet[0] !== MAGIC || packet[1] !== VERSION || packet[12] !== BLOCK_BYTES || packet[17] !== BLOCK_COUNT || packet[18] !== SECRET_BYTES) throw new Error("Not a Particle Code v2 fragment");
  const expected = (packet[19] << 8) | packet[20]; if (crc16(packet.subarray(0, 19)) !== expected) throw new Error("Particle Code v2 CRC mismatch");
  const issuedMinute = readUint32(packet, 6); const age = nowMinute - issuedMinute;
  if (age < -1 || age > MAX_AGE_MINUTES) throw new Error("Particle Code v2 fragment is expired or from the future");
  const mask = packet[11] & 0xf; if (!mask) throw new Error("Particle Code v2 fragment has an empty equation");
  return { correctedCodewords, issuedMinute, mask, payload: packet.slice(13, 17), sequence: packet[10], sessionId: readUint32(packet, 2) };
}

interface Equation { mask: number; payload: Uint8Array }

function reduceEquations(input: readonly Equation[]): Equation[] {
  const rows = input.map((row) => ({ mask: row.mask, payload: row.payload.slice() }));
  let pivotRow = 0;
  for (let column = 0; column < BLOCK_COUNT && pivotRow < rows.length; column += 1) {
    const pivot = rows.findIndex((row, index) => index >= pivotRow && (row.mask & (1 << column)) !== 0);
    if (pivot < 0) continue;
    [rows[pivotRow], rows[pivot]] = [rows[pivot], rows[pivotRow]];
    for (let index = 0; index < rows.length; index += 1) if (index !== pivotRow && (rows[index].mask & (1 << column))) {
      rows[index].mask ^= rows[pivotRow].mask;
      for (let byte = 0; byte < BLOCK_BYTES; byte += 1) rows[index].payload[byte] ^= rows[pivotRow].payload[byte];
    }
    pivotRow += 1;
  }
  return rows.filter((row) => row.mask !== 0);
}

export class V2FountainDecoder {
  private readonly completed = new Set<string>();
  private readonly sessions = new Map<string, Equation[]>();

  add(fragment: V2Fragment): V2DecodeProgress {
    const key = `${fragment.sessionId}:${fragment.issuedMinute}`;
    if (this.completed.has(key)) throw new Error("Particle Code v2 replay rejected");
    const equations = this.sessions.get(key) ?? [];
    if (!equations.some((row) => row.mask === fragment.mask && row.payload.every((value, index) => value === fragment.payload[index]))) equations.push({ mask: fragment.mask, payload: fragment.payload.slice() });
    const reduced = reduceEquations(equations); this.sessions.set(key, reduced);
    const rank = reduced.length;
    const blocks = Array.from({ length: BLOCK_COUNT }, (_, block) => reduced.find((row) => row.mask === (1 << block))?.payload);
    if (rank < BLOCK_COUNT || blocks.some((block) => !block)) return { complete: false, rank, sessionId: fragment.sessionId };
    const secret = new Uint8Array(SECRET_BYTES); blocks.forEach((block, index) => secret.set(block!, index * BLOCK_BYTES));
    this.sessions.delete(key); this.completed.add(key);
    return { complete: true, rank, secret, secretHex: bytesToHex(secret), sessionId: fragment.sessionId };
  }
}

export function v2MinuteNow(): number { return Math.floor(Date.now() / 60000); }
