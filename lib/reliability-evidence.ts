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

export type ReliabilityEvidenceInspection =
  | { status: "verified"; evidence: ReliabilityEvidence; detail: string }
  | { status: "tampered" | "invalid"; detail: string };

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

/** Strict, local-only inspection for untrusted imported evidence files. */
export async function inspectReliabilityEvidence(input: unknown): Promise<ReliabilityEvidenceInspection> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { status: "invalid", detail: "The file is not a ParticlePair evidence object." };
  const value = input as Record<string, unknown>;
  const privacy = value.privacy as Record<string, unknown> | undefined;
  const corpus = value.corpus as Record<string, unknown> | undefined;
  const transmitter = value.transmitter as Record<string, unknown> | undefined;
  const summary = value.summary as Record<string, unknown> | undefined;
  const seal = value.seal as Record<string, unknown> | undefined;
  const results = value.results;
  const hasExactKeys = (record: Record<string, unknown>, keys: readonly string[]) => Object.keys(record).length === keys.length && keys.every((key) => key in record);
  const isRounded = (number: number, places: number) => number === Number(number.toFixed(places));
  const qualityIsValid = (result: unknown) => {
    if (!result || typeof result !== "object" || Array.isArray(result)) return false;
    const cell = result as Record<string, unknown>;
    return hasExactKeys(cell, ["passed", "quality"]) && typeof cell.passed === "boolean" && typeof cell.quality === "number" && Number.isFinite(cell.quality) && cell.quality >= 0 && cell.quality <= 1 && isRounded(cell.quality, 4);
  };
  const privacyIsRedacted = privacy?.cameraFramesIncluded === false && privacy.sasIncluded === false && privacy.secretIncluded === false && privacy.sessionIdIncluded === false;
  const strength = transmitter?.modulationStrength;
  const structureIsValid = hasExactKeys(value, ["schema", "createdAt", "privacy", "corpus", "transmitter", "summary", "results", "seal"])
    && value.schema === "particlepair-reliability/v1"
    && typeof value.createdAt === "string" && Number.isFinite(Date.parse(value.createdAt)) && new Date(value.createdAt).toISOString() === value.createdAt
    && !!privacy && hasExactKeys(privacy, ["cameraFramesIncluded", "sasIncluded", "secretIncluded", "sessionIdIncluded"]) && privacyIsRedacted
    && !!corpus && hasExactKeys(corpus, ["cases", "id", "modes", "secrets"]) && corpus.cases === 400 && corpus.id === "PP-CORPUS-8X50-V1" && corpus.modes === 50 && corpus.secrets === 8
    && !!transmitter && hasExactKeys(transmitter, ["modulationStrength"]) && typeof strength === "number" && Number.isFinite(strength) && strength >= 0 && strength <= 1 && isRounded(strength, 2)
    && !!summary && hasExactKeys(summary, ["minimumQuality", "passed", "rate", "total"])
    && Array.isArray(results) && results.length === 400 && results.every(qualityIsValid)
    && !!seal && hasExactKeys(seal, ["algorithm", "digest", "trust"]) && seal.algorithm === "SHA-256" && typeof seal.digest === "string" && /^[0-9A-F]{64}$/.test(seal.digest)
    && seal.trust === "integrity-only-not-attestation";
  if (!structureIsValid) return { status: "invalid", detail: "Schema, corpus, privacy, or result constraints are invalid." };
  const evidence = input as ReliabilityEvidence;
  if (!await verifyReliabilityEvidence(evidence)) return { status: "tampered", detail: "SHA-256 mismatch: the sealed record was modified." };
  const expected = summarizeReliability(evidence.results);
  const summaryIsValid = summary?.total === 400 && summary.passed === expected.passed
    && summary.minimumQuality === Number(expected.minimumQuality.toFixed(4))
    && summary.rate === Number(expected.rate.toFixed(4));
  if (!summaryIsValid) return { status: "invalid", detail: "The summary does not match the 400 recorded outcomes." };
  return { status: "verified", evidence, detail: "Canonical structure and SHA-256 integrity are valid." };
}
