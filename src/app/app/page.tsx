import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";

export const metadata: Metadata = {
  title: "Workspace",
  alternates: { canonical: "/app" },
};

export default function AppPage() {
  return (
    <Suspense fallback={<div className="desk h-dvh" />}>
      <WorkspaceLoader />
    </Suspense>
  );
}
