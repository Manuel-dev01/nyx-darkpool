import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nyx Darkpool — Trade in the dark",
  description:
    "A ZK-shielded RFQ and order-book system for institutional RWA trading on Stellar. Orders are sealed as Poseidon commitments; a zero-knowledge proof attests a valid match; a Soroban contract verifies it on-chain before settling atomically.",
};

/**
 * Fonts are loaded via Google Fonts <link> (not next/font) on purpose: the
 * design surfaces reference the literal family names ('Spectral', 'Archivo',
 * 'IBM Plex Mono') in their inline styles, so the family names must not be
 * hashed/renamed. The href requests the union of weights used across all pages.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400&family=Archivo:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
