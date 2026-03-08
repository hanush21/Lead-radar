import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LeadRadar — Captación Inteligente de Leads",
  description: "Sistema de captación inteligente de leads locales con análisis de oportunidades digitales",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
