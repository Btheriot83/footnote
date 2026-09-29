"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { canTurnPages, turnPage, waitFor, warmPageTurn } from "@/lib/client/page-turn";

/**
 * Links marked `data-page-turn` go to the next page under a turning sheet of paper
 * instead of a hard cut: landing → app and back.
 */
export function PageTurnLinks() {
  const router = useRouter();
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[data-page-turn]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || !canTurnPages()) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      // Capture phase, before next/link's own handler: we navigate once the sheet covers the page.
      e.preventDefault();
      e.stopPropagation();
      const href = url.pathname + url.search + url.hash;
      router.prefetch(href);
      void turnPage({
        onCovered: () => router.push(href),
        ready: async () => {
          // The real page, not its loading shell: the sheet lifts off the app itself.
          await waitFor(`[data-page="${url.pathname === "/" ? "landing" : url.pathname.slice(1).split("/")[0]}"][data-ready="true"]`);
        },
      });
    };
    const onOver = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest?.("a[data-page-turn]")) warmPageTurn();
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerover", onOver, { passive: true });
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerover", onOver);
    };
  }, [router]);
  return null;
}
