import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";

const heading = Cinzel({ variable: "--font-heading", subsets: ["latin"] });
const body = Inter({ variable: "--font-body", subsets: ["latin"] });
export const metadata: Metadata = { title: "Grenzmark – Erobere dein Reich", description: "Ein beständiges Browser-Strategiespiel um Gebiete, Bündnisse und langfristige Feldzüge." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de" className={`${heading.variable} ${body.variable}`}><body suppressHydrationWarning>{children}</body></html>;
}

