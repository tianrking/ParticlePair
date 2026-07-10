export interface DiagnosticReportInput {
  createdAt: string;
  device: { deviceMemoryGiB: number | null; hardwareConcurrency: number; pixelRatio: number; viewport: { height: number; width: number } };
  transmitter: { modulationStrength: number; protocolVersion: 1 | 2; renderQuality: string; v2DwellMs: number | null; visualMode: string };
  verification: unknown;
}

export function buildDiagnosticReport(input: DiagnosticReportInput) {
  return {
    schema: "particlepair-diagnostic/v1",
    createdAt: input.createdAt,
    privacy: { cameraFramesIncluded: false, sasIncluded: false, secretIncluded: false, sessionIdIncluded: false },
    transmitter: input.transmitter,
    verification: input.verification,
    device: input.device,
  } as const;
}
