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
    description: "A source-available noncommercial optical pairing lab built around an animated particle galaxy.",
    icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
    openGraph: {
      title: "ParticlePair — Pairing, hidden in motion",
      description: "Error-protected optical pairing through an animated particle galaxy.",
      type: "website",
      images: [{ url: socialImage, width: 1672, height: 941, alt: "ParticlePair optical pairing lab" }],
    },
    twitter: {
      card: "summary_large_image",
      title: "ParticlePair — Pairing, hidden in motion",
      description: "Error-protected optical pairing through an animated particle galaxy.",
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
