import type { Metadata } from "next";
import "./globals.css";
import { ErrorBoundary } from "@/components/ErrorBoundary";

// NOTE: We intentionally do NOT use next/font/google here.
// next/font/google downloads fonts at Docker BUILD TIME from fonts.gstatic.com,
// which fails in an air-gapped / offline Docker environment.
// Fonts are instead loaded via @import in globals.css at browser runtime,
// with CSS variable fallbacks defined in :root so all var(--font-*) references
// still resolve correctly.

export const metadata: Metadata = {
  title: "VIKRAM — Predictive MPLS Copilot",
  description:
    "An air-gapped predictive intelligence console for secure MPLS network operations.",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans bg-void text-white antialiased">
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
