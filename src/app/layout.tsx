import type { Metadata, Viewport } from "next";
import { Inter, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const serif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "Footnote: meeting notes with receipts",
    template: "%s · Footnote",
  },
  description:
    "Type rough notes during the call. Footnote turns them into clear notes where every line links to the exact moment it was said. Runs in your browser. Bring your own key. Pay once.",
  openGraph: {
    title: "Footnote: meeting notes with receipts",
    description: "AI meeting notes where every line links to the moment it was said. Local-first, bring your own key, $59 once.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f7f5f0",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
