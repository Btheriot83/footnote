import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";

export const metadata: Metadata = {
  title: "Workspace",
};

export default function AppPage() {
  return (
    <Suspense fallback={<div className="h-dvh bg-paper" />}>
      <WorkspaceLoader />
    </Suspense>
  );
}
