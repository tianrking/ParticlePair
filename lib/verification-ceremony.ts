import type { PairingSas } from "./pairing-sas";

export type VerificationDecision = "pending" | "accept" | "reject";
export type VerificationCeremonyState = "waiting" | "deriving" | "compare" | "accepted" | "rejected" | "mismatch";

export interface VerificationCeremony {
  canAccept: boolean;
  stages: readonly [boolean, boolean, boolean, boolean, boolean];
  state: VerificationCeremonyState;
}

export function pairingSasMatches(sender: PairingSas | null, receiver: PairingSas | null): boolean {
  return Boolean(sender && receiver && sender.code === receiver.code && sender.words.every((word, index) => word === receiver.words[index]));
}

/** Human confirmation is deliberately separate from optical and CRC success. */
export function verificationCeremony(decoded: boolean, sender: PairingSas | null, receiver: PairingSas | null, decision: VerificationDecision): VerificationCeremony {
  if (!decoded) return { canAccept: false, stages: [false, false, false, false, false], state: "waiting" };
  if (!sender || !receiver) return { canAccept: false, stages: [true, true, false, false, false], state: "deriving" };
  const matches = pairingSasMatches(sender, receiver);
  if (!matches) return { canAccept: false, stages: [true, true, true, false, false], state: "mismatch" };
  if (decision === "reject") return { canAccept: false, stages: [true, true, true, true, false], state: "rejected" };
  if (decision === "accept") return { canAccept: true, stages: [true, true, true, true, true], state: "accepted" };
  return { canAccept: true, stages: [true, true, true, false, false], state: "compare" };
}
