import { summarizeReliability, type ReliabilityCell } from "./reliability-marathon";

export interface ReliabilityEvidence {
  schema: "particlepair-reliability/v1";
  createdAt: string;
  privacy: { cameraFramesIncluded: false; sasIncluded: false; secretIncluded: false; sessionIdIncluded: false };
  corpus: { cases: number; id: "PP-CORPUS-8X50-V1"; modes: 50; secrets: 8 };
  transmitter: { modulationStrength: number };
  summary: { minimumQuality: number; passed: number; rate: number; total: number };
  results: readonly { passed: boolean; quality: number }[];
  seal: { algorithm: "SHA-256"; digest: string; trust: "integrity-only-not-attestation" };
}

async function sha256Hex(value: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function evidencePayload(createdAt: string, modulationStrength: number, cells: readonly ReliabilityCell[]) {
  if (cells.length !== 400) throw new Error("Reliability evidence requires exactly 400 cases");
  const results = cells.map((cell) => ({ passed: cell.passed, quality: Number(cell.quality.toFixed(4)) })); const summary = summarizeReliability(results);
  return { schema: "particlepair-reliability/v1" as const, createdAt, privacy: { cameraFramesIncluded: false as const, sasIncluded: false as const, secretIncluded: false as const, sessionIdIncluded: false as const }, corpus: { cases: 400, id: "PP-CORPUS-8X50-V1" as const, modes: 50 as const, secrets: 8 as const }, transmitter: { modulationStrength: Number(modulationStrength.toFixed(2)) }, summary: { minimumQuality: Number(summary.minimumQuality.toFixed(4)), passed: summary.passed, rate: Number(summary.rate.toFixed(4)), total: summary.total }, results };
}

export async function buildReliabilityEvidence(createdAt: string, modulationStrength: number, cells: readonly ReliabilityCell[]): Promise<ReliabilityEvidence> {
  const payload = evidencePayload(createdAt, modulationStrength, cells); const digest = await sha256Hex(JSON.stringify(payload));
  return { ...payload, seal: { algorithm: "SHA-256", digest, trust: "integrity-only-not-attestation" } };
}

export async function verifyReliabilityEvidence(evidence: ReliabilityEvidence): Promise<boolean> {
  const { seal, ...payload } = evidence; return seal.algorithm === "SHA-256" && seal.trust === "integrity-only-not-attestation" && await sha256Hex(JSON.stringify(payload)) === seal.digest;
}
