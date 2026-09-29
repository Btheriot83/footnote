import type { MetadataRoute } from "next";

/** Installable as an app: opens straight onto the desk. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Footnote: meeting notes with receipts",
    short_name: "Footnote",
    description: "Type rough notes during the call. Footnote writes them up, and every line links to the moment it was said.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#d9c9ac",
    theme_color: "#d9c9ac",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
