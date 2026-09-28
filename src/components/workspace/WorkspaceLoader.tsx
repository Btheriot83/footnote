"use client";
import dynamic from "next/dynamic";

// The workspace is local-first (IndexedDB, media devices, platform shortcuts),
// so it renders on the client only.
export const WorkspaceLoader = dynamic(() => import("./Workspace").then((m) => m.Workspace), {
  ssr: false,
  loading: () => <div className="h-dvh bg-paper" />,
});
