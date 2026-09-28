import { Wordmark } from "@/components/Wordmark";
import { cx } from "@/components/ui";

/** A pencil line where words will be: ghost text on paper. */
function Ghost({ w, className }: { w: string; className?: string }) {
  return <span aria-hidden className={cx("ghost-line block rounded-full", className)} style={{ width: w }} />;
}

/**
 * The meeting pane before its meeting has loaded: the same header, sheet and transcript
 * receipt, with pencil lines where the words will be. The page turn lands on this, so the
 * app appears in place instead of cutting in.
 */
export function PaneSkeleton() {
  return (
    <div className="flex h-full min-w-0 flex-col" aria-busy aria-label="Loading the meeting">
      <header className="flex h-[64px] shrink-0 items-center gap-2 px-3 sm:h-[72px] sm:gap-3 sm:px-5 lg:pl-1">
        <span className="pill h-10 w-10 shrink-0 lg:hidden" aria-hidden />
        <span className="paper paper-white h-10 w-[150px] rounded-full sm:w-[210px]" aria-hidden />
        <span className="ml-auto flex items-center gap-2" aria-hidden>
          <span className="pill h-10 w-[104px] sm:w-[150px]" />
          <span className="pill h-10 w-10 max-md:hidden md:w-[96px]" />
          <span className="pill h-10 w-10" />
        </span>
      </header>
      <div className="flex min-h-0 flex-1">
        <main className="min-w-0 flex-1 overflow-hidden px-2 pb-3 pt-1 sm:px-4 sm:pb-5 lg:pl-1">
          <div className="paper paper-cream sheet-shadow mx-auto h-[calc(100%-4px)] w-full max-w-[800px] rounded-[3px] px-5 pt-9 sm:px-12 sm:pt-12 xl:px-[72px] xl:pt-14">
            <Ghost w="62%" className="h-[30px] sm:h-[38px]" />
            <Ghost w="38%" className="mt-4 h-3.5" />
            <Ghost w="30%" className="mt-12 h-[22px]" />
            <div className="mt-7 space-y-4">
              {["88%", "72%", "81%", "54%"].map((w, i) => (
                <Ghost key={i} w={w} className="h-3.5" />
              ))}
            </div>
            <Ghost w="26%" className="mt-10 h-[20px]" />
            <div className="mt-6 space-y-4">
              {["76%", "84%", "60%"].map((w, i) => (
                <Ghost key={i} w={w} className="h-3.5" />
              ))}
            </div>
          </div>
        </main>
        <aside className="hidden shrink-0 flex-col pb-4 pl-1 pr-4 pt-2 md:flex md:w-[340px] xl:w-[392px] xl:pr-5" aria-hidden>
          <div className="receipt h-full px-5 pt-5">
            <Ghost w="40%" className="mx-auto h-3" />
            <Ghost w="56%" className="mx-auto mt-3 h-2.5" />
            <hr className="receipt-rule mt-5" />
            <div className="mt-6 space-y-7">
              {["80%", "92%", "66%", "86%", "72%"].map((w, i) => (
                <div key={i}>
                  <Ghost w="24%" className="h-2.5" />
                  <Ghost w={w} className="mt-2.5 h-3" />
                  <Ghost w="48%" className="mt-2 h-3" />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

/** The whole workspace before the app code has loaded: sidebar, header, sheet, receipt. */
export function AppShellSkeleton() {
  return (
    <div className="desk flex h-dvh overflow-hidden text-ink" data-page="app" data-ready="shell">
      <aside className="hidden w-[292px] shrink-0 lg:block xl:w-[330px]" aria-hidden>
        <div className="flex h-full flex-col gap-4 px-4 pb-4 pt-5 sm:px-5">
          <div className="px-1.5 pt-1">
            <Wordmark size={29} />
          </div>
          <div className="space-y-3">
            <span className="paper paper-cream block h-11 rounded-[3px]" />
            <span className="pill flex h-11 w-full" />
          </div>
          <div className="paper relative rounded-[3px] pb-16 [--paper:var(--color-index)]">
            <span className="absolute inset-y-0 left-[30px] w-px bg-margin/80" />
            <div className="border-b border-index-line py-3 pl-[44px]">
              <Ghost w="30%" className="h-2.5" />
            </div>
            {[0, 1, 2].map((i) => (
              <div key={i} className="border-b border-index-line py-3.5 pl-[44px] pr-6">
                <Ghost w={["70%", "82%", "58%"][i]} className="h-3.5" />
                <Ghost w="44%" className="mt-2.5 h-2.5" />
              </div>
            ))}
          </div>
          <span className="paper paper-stone mt-auto block h-[132px] rounded-[3px]" />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <PaneSkeleton />
      </div>
    </div>
  );
}
