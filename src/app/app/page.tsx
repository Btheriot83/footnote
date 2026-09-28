import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace } from "@/components/workspace/Workspace";

export const metadata: Metadata = {
  title: "Workspace",
};

export default function AppPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <Workspace />
    </Suspense>
  );
}
