"use client";
import { Fragment, useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { formatClock } from "@/lib/format";
import type { EnhancedNotes, Segment } from "@/lib/types";
import type { Receipts } from "./useReceipts";

interface Props {
  notes: EnhancedNotes;
  numbers: Map<string, number>;
  segmentsById: Map<string, Segment>;
  receipts: Receipts;
  streaming?: boolean;
  /** When the transcript isn't visible (phone, share page), footnotes open an inline quote. */
  inlineQuotes?: boolean;
}

export function EnhancedView({ notes, numbers, segmentsById, receipts, streaming, inlineQuotes }: Props) {
  const [openQuote, setOpenQuote] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Scroll to and flash a bullet selected from the transcript.
  useEffect(() => {
    if (!receipts.flashBullet) return;
    const el = rootRef.current?.querySelector<HTMLElement>(`[data-bullet="${receipts.flashBullet.key}"]`);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.animate(
      [{ backgroundColor: "rgba(224,72,43,0.16)" }, { backgroundColor: "rgba(224,72,43,0)" }],
      { duration: 1400, easing: "ease-out" },
    );
  }, [receipts.flashBullet]);

  return (
    <div ref={rootRef} className="space-y-7" onMouseLeave={() => receipts.hoverCites(null)}>
      {notes.sections.map((section, si) => (
        <section key={si} className="animate-fade-up">
          <h3 className="font-serif text-[25px] leading-tight tracking-[-0.01em] text-ink sm:text-[27px]">
            {section.heading}
          </h3>
          <ul className="mt-3 space-y-2.5">
            {section.bullets.map((b, bi) => {
              const key = `${si}:${bi}`;
              const highlighted = receipts.highlightedBullets.has(key);
              const quoteOpen = openQuote === key;
              return (
                <li
                  key={bi}
                  data-bullet={key}
                  data-origin={b.origin}
                  className={cx(
                    "animate-fade-up group relative -mx-2 rounded-lg px-2 py-0.5 pl-7 font-serif text-[18.5px] leading-[1.55] transition-colors sm:text-[19.5px]",
                    highlighted && "bg-accent-softer shadow-[inset_2px_0_0_var(--color-accent)]",
                  )}
                  onMouseEnter={() => b.cites.length && receipts.hoverCites(b.cites)}
                >
                  <span
                    aria-hidden
                    className={cx(
                      "absolute left-2.5 top-[0.72em] h-[6px] w-[6px] rounded-full",
                      b.origin === "you" ? "bg-ink" : "bg-faint",
                    )}
                  />
                  <span className={b.origin === "you" ? "text-ink" : "text-muted"}>
                    {b.text}
                    {b.origin === "ai" && <span className="sr-only"> (added by AI)</span>}
                  </span>
                  {[...b.cites]
                    .sort((a, z) => (numbers.get(a) ?? 0) - (numbers.get(z) ?? 0))
                    .map((c, ci) => {
                    const n = numbers.get(c);
                    const seg = segmentsById.get(c);
                    if (!n) return null;
                    return (
                      <Fragment key={c}>
                        {ci > 0 && <sup className="text-[0.6em] text-accent">,</sup>}
                        <button
                          type="button"
                          className="fn-mark"
                          data-active={receipts.activeSegments.has(c)}
                          aria-label={`Source ${n}${seg ? `: ${seg.label || seg.speaker} at ${formatClock(seg.t)}` : ""}`}
                          onMouseEnter={() => receipts.hoverCites([c])}
                          onFocus={() => receipts.hoverCites([c])}
                          onClick={(e) => {
                            e.stopPropagation();
                            receipts.clickCite(c);
                            if (inlineQuotes) setOpenQuote(quoteOpen ? null : key);
                          }}
                        >
                          {n}
                        </button>
                      </Fragment>
                    );
                  })}
                  {inlineQuotes && quoteOpen && (
                    <div className="animate-fade-in mt-2 space-y-2 rounded-xl border border-rule bg-paper px-3.5 py-3">
                      {b.cites.map((c) => {
                        const seg = segmentsById.get(c);
                        if (!seg) return null;
                        return (
                          <figure key={c} className="text-[15px] leading-snug">
                            <figcaption className="mb-0.5 font-sans text-[12.5px] text-muted">
                              <span className="font-semibold text-accent">{numbers.get(c)}</span> · {seg.label || seg.speaker} ·{" "}
                              {formatClock(seg.t)}
                            </figcaption>
                            <blockquote className="font-serif italic text-ink-2">&ldquo;{seg.text}&rdquo;</blockquote>
                          </figure>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
            {streaming && si === notes.sections.length - 1 && (
              <li className="relative pl-7 font-serif text-[19px] text-faint">
                <span className="caret-blink" aria-hidden />
              </li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}
