import type { Metadata, Viewport } from "next";
import { Caveat, IBM_Plex_Mono, Inter, Newsreader } from "next/font/google";
import { DeskLamp } from "@/components/desk/DeskLamp";
import { PageTurnLinks } from "@/components/desk/PageTurnLinks";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const serif = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  axes: ["opsz"],
  style: ["normal", "italic"],
});
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"], display: "swap" });
const hand = Caveat({ variable: "--font-caveat", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "Footnote: meeting notes with receipts",
    template: "%s · Footnote",
  },
  description:
    "Type rough notes during the call. Footnote turns them into clear notes where every line links to the exact moment it was said. Runs in your browser, keeps meetings on your device, and it's free and open source with your own key.",
  metadataBase: new URL("https://footnote-receipts.vercel.app"),
  openGraph: {
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Footnote: meeting notes with receipts" }],
    title: "Footnote: meeting notes with receipts",
    description: "AI meeting notes where every line links to the moment it was said, and you can hear it. Local-first, free with your own key.",
    type: "website",
    siteName: "Footnote",
  },
  twitter: {
    card: "summary_large_image",
    title: "Footnote: meeting notes with receipts",
    description: "AI meeting notes where every line links to the moment it was said, and you can hear it.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#d9c9ac" },
    { media: "(prefers-color-scheme: dark)", color: "#3a2b1d" },
  ],
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${serif.variable} ${mono.variable} ${hand.variable} h-full antialiased`}>
      <body className="min-h-full">
        {children}
        <DeskLamp />
        <PageTurnLinks />
      </body>
    </html>
  );
}
