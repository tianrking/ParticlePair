import type { Metadata } from "next";
import { ParticlePairLab } from "../components/ParticlePairLab";

export const metadata: Metadata = {
  title: "ParticlePair — 粒子光学配对实验室",
  description: "将一次性配对秘密编码进动态粒子云，并通过相机连续帧完成带纠错的光学带外认证。",
};

export default function Home() {
  return <ParticlePairLab />;
}
