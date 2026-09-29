import type { Metadata } from "next";
import { SharedNote } from "@/components/share/SharedNote";

// The note itself travels in the link's #fragment, which never reaches a server, so the
// preview can't name the meeting; it says what the link is instead. The tab takes the
// meeting's title once the page reads the note.
const share = {
  title: "Meeting notes, with receipts",
  description: "Shared from Footnote. Every added line links to the moment it was said in the call; open it to read the receipts.",
};

export const metadata: Metadata = {
  title: "Shared note",
  description: share.description,
  robots: { index: false },
  openGraph: {
    ...share,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Footnote: meeting notes with receipts" }],
    type: "article",
    siteName: "Footnote",
    url: "/s",
  },
  twitter: { card: "summary_large_image", ...share, images: ["/og.png"] },
};

export default function SharePage() {
  return <SharedNote />;
}
