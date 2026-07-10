import type { Metadata } from "next";
import { ParticlePairLab } from "../components/ParticlePairLab";

export const metadata: Metadata = {
  title: "ParticlePair — Optical Pairing Lab",
  description: "Encode a one-time pairing secret into an animated particle galaxy and recover it through an error-protected camera channel.",
};

export default function Home() {
  return <ParticlePairLab />;
}
