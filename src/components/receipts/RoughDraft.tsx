"use client";
import { useMemo } from "react";
import { cx } from "@/components/ui";
import { contentTokens } from "@/lib/reconcile";
import type { EnhancedNotes } from "@/lib/types";

/** Content lines of the rough notes, bullet markers stripped. */
export function roughLines(notes: string): string[] {
  return notes
    .split("\n")
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+\.)\s*/, "").trim())
    .filter(Boolean);
}

/**
 * While Enhance writes, the rough notes stay on the page: a highlighter reads down them,
 * and each line is crossed off in pencil once a clean bullet has been written from it.
 * When the write-up is done, the draft folds away beneath it.
 */
export function RoughDraft({ notes, written, done }: { notes: string; written: EnhancedNotes | null; done: boolean }) {
  const lines = useMemo(() => roughLines(notes), [notes]);
  const consumed = useMemo(() => {
    const out = new Set<number>();
    if (!written) return out;
    const bullets = written.sections.flatMap((s) => s.bullets.filter((b) => b.origin === "you").map((b) => contentTokens(b.text)));
    lines.forEach((line, i) => {
      const lt = contentTokens(line);
      if (lt.size === 0) return;
      if (bullets.some((bt) => [...lt].filter((t) => bt.has(t)).length / lt.size >= 0.5)) out.add(i);
    });
    return out;
  }, [lines, written]);
  const started = !!written && written.sections.length > 0;
  if (!lines.length) return null;
  return (
    <div
      className={cx(
        "grid transition-[grid-template-rows,opacity,margin] duration-700 [transition-timing-function:var(--ease-out)]",
        done ? "mt-0 grid-rows-[0fr] opacity-0" : started ? "mt-10 grid-rows-[1fr] opacity-100" : "mt-2 grid-rows-[1fr] opacity-100",
      )}
      aria-hidden
    >
      <div className="overflow-hidden">
        <p className={cx("smallcaps text-[10px] text-faint transition-opacity duration-500", !started && "opacity-0")}>
          Your rough notes
        </p>
        <ul
          className={cx(
            "mt-2 space-y-0.5 font-serif transition-[font-size,color] duration-700",
            started ? "text-[16px] text-faint" : "text-[19px] text-ink-2",
          )}
        >
          {lines.map((l, i) => {
            const crossed = consumed.has(i);
            return (
              <li key={i} className="relative w-fit max-w-full pl-5 leading-[1.7]">
                <span aria-hidden className="absolute left-1 top-[0.78em] h-[5px] w-[5px] rounded-full bg-current opacity-60" />
                <span
                  className={cx(!started && "hl hl-swipe")}
                  style={!started ? { ["--hl-delay" as string]: `${180 + i * 260}ms` } : undefined}
                >
                  {l}
                </span>
                <svg
                  aria-hidden
                  className={cx(
                    "strike pointer-events-none absolute left-4 top-1/2 h-[10px] w-[calc(100%-16px)] -translate-y-1/2 overflow-visible",
                    crossed && "is-on",
                  )}
                  viewBox="0 0 100 10"
                  preserveAspectRatio="none"
                >
                  <path
                    pathLength={1}
                    d="M0 6 C 20 3, 45 7, 70 4.5 S 95 5, 100 4"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    fill="none"
                  />
                </svg>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
