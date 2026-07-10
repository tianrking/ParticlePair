import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const socialImage = new URL("/og.png", `${protocol}://${host}`).toString();

  return {
    title: "ParticlePair",
    description: "源码可见的非商业粒子光学配对实验室",
    icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
    openGraph: {
      title: "ParticlePair — 让配对码隐入粒子",
      description: "通过粒子云完成带纠错的一次性光学配对认证。",
      type: "website",
      images: [{ url: socialImage, width: 1672, height: 941, alt: "ParticlePair 粒子光学配对实验室" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ParticlePair — 让配对码隐入粒子",
      description: "通过粒子云完成带纠错的一次性光学配对认证。",
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
