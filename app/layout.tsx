import type { Metadata } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import type { ReactNode } from "react";
import Providers from "./providers";
import "./globals.css";

const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-display" });

export const metadata: Metadata = {
  title: "Inventory | Apex Logistics",
  description: "Search, filter and sort every SKU across all warehouses.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
