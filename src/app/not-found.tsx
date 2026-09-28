import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

/** A page with no source: the same rule as the notes, "no receipt, no claim". */
export default function NotFound() {
  return (
    <div className="desk-page flex min-h-dvh flex-col overflow-x-clip text-ink" data-page="not-found" data-ready>
      <header className="mx-auto flex w-full max-w-[1440px] items-center justify-between gap-6 px-5 pt-5 sm:px-8 sm:pt-7">
        <Link href="/" aria-label="Footnote home" className="rounded-sm">
          <Wordmark size={28} />
        </Link>
        <Link href="/app" data-page-turn className="pill h-10 px-5 text-[11px]">
          Open Footnote
        </Link>
      </header>

      <main className="relative mx-auto flex w-full max-w-[760px] flex-1 flex-col items-center justify-center px-5 pb-20 pt-10">
        <div className="relative w-full max-w-[520px]">
          {/* The page itself */}
          <div className="paper paper-cream animate-settle relative -rotate-[1.2deg] rounded-[3px] px-7 pb-9 pt-8 sm:px-11 sm:pb-11 sm:pt-10">
            <p className="smallcaps text-muted">Error 404</p>
            <h1 className="mt-3 font-serif text-[38px] font-medium leading-[1.05] tracking-[-0.025em] sm:text-[48px]">
              This page has no source.
              <span className="fn-mark !cursor-default align-[0.9em] !text-[0.34em]" aria-hidden>
                ?
              </span>
            </h1>
            <p className="mt-4 text-[18px] leading-relaxed text-ink-2">
              Footnote only writes what it can cite, and nothing here links to this address. It may have moved, or the
              link was cut short.
            </p>
            <nav className="mt-8 flex flex-col gap-3 sm:flex-row" aria-label="Ways back">
              <Link href="/" className="pill pill-ink h-12 px-6 text-[11.5px]">
                Back to the desk
              </Link>
              <Link href="/app?sample=1" data-page-turn className="pill h-12 px-6 text-[11.5px]">
                Try a sample meeting
              </Link>
            </nav>
          </div>

          {/* A torn receipt tucked under its corner, with nothing printed on it */}
          <div
            aria-hidden
            className="receipt animate-settle absolute -bottom-[92px] right-2 w-[210px] rotate-[5deg] px-4 pb-4 pt-3 text-[11px] leading-[1.6] [animation-delay:180ms] sm:-right-10"
            style={{ zIndex: -1 }}
          >
            <p className="text-center tracking-[0.22em] text-[var(--receipt-dim)]">TRANSCRIPT</p>
            <hr className="receipt-rule my-2" />
            <p className="flex justify-between text-[var(--receipt-dim)]">
              <span>SOURCE ?</span>
              <span>--:--</span>
            </p>
            <p className="mt-1 text-[var(--receipt-ink)]">[ no lines match this page ]</p>
          </div>
        </div>
      </main>
    </div>
  );
}
