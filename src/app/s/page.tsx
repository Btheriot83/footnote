import type { Metadata } from "next";
import { SharedNote } from "@/components/share/SharedNote";

export const metadata: Metadata = {
  title: "Shared note",
  robots: { index: false },
};

export default function SharePage() {
  return <SharedNote />;
}
