import type { Metadata } from "next";
import { Suspense } from "react";
import { AppShellSkeleton } from "@/components/workspace/Skeleton";
import { WorkspaceLoader } from "@/components/workspace/WorkspaceLoader";

export const metadata: Metadata = {
  title: "Workspace",
  alternates: { canonical: "/app" },
};

export default function AppPage() {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <WorkspaceLoader />
    </Suspense>
  );
}
