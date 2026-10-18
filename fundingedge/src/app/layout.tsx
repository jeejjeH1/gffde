import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "FundingEdge — Funding Rate Scanner",
  description: "Analytics-only scanner for cross-exchange perpetual funding rate differences. Not trading advice.",
};
export const viewport: Viewport = { themeColor: "#07090d", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-text">
        <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
          <div className="mx-auto flex h-12 max-w-[1500px] items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-block h-3 w-3 rounded-sm bg-accent" /> FundingEdge
            </Link>
            <span className="text-[11px] text-muted">Analytics only · no trading · no API keys</span>
          </div>
        </header>
        <main className="mx-auto max-w-[1500px] px-4 py-4">{children}</main>
        <footer className="mx-auto max-w-[1500px] px-4 pb-8 pt-2 text-[11px] leading-relaxed text-muted">
          All figures are hypothetical estimates derived from currently published funding rates, which change before settlement
          and may not persist. Nothing here is guaranteed profit or financial advice. Equal-notional hedges reduce but do not
          eliminate basis, execution, liquidation, funding-uncertainty and exchange-counterparty risk.
        </footer>
      </body>
    </html>
  );
}
