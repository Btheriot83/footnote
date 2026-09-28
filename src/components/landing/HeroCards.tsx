"use client";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui";
import { Receipt, ReceiptRule } from "./Paper";

const BULLETS = [
  {
    text: "Series B closed: $32M, led by Northstar",
    origin: "you",
    who: "Dana (Acme)",
    at: "00:15",
    before: "Right, we closed our Series B two weeks ago.",
    quote: "$32 million, led by Northstar.",
  },
  {
    text: "Seats grow from 40 to about 120 by March",
    origin: "ai",
    who: "Dana (Acme)",
    at: "00:26",
    before: "Support goes from 40 people to about 110 by March.",
    quote: "With ops and success, call it 120 seats.",
  },
  {
    text: "Needs year one under $90K, open to two years",
    origin: "you",
    who: "Dana (Acme)",
    at: "01:11",
    before: "A two-year term could work.",
    quote: "But I need year one under $90K.",
  },
] as const;

/**
 * The hero's working demo: a note card whose footnotes pick the matching line on a
 * transcript receipt. Cycles on its own until you reach for it.
 */
export function useHeroDemo() {
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  useEffect(() => {
    if (hovering) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((a) => (a + 1) % BULLETS.length), 3600);
    return () => clearInterval(id);
  }, [hovering]);
  return { active, setActive, setHovering };
}

export function NoteCard({
  active,
  onPick,
  onHover,
  className,
}: {
  active: number;
  onPick: (i: number) => void;
  onHover: (h: boolean) => void;
  className?: string;
}) {
  return (
    <div
      className={cx("paper paper-white lift rounded-[2px] px-6 pb-7 pt-6 sm:px-7", className)}
      onMouseLeave={() => onHover(false)}
      role="group"
      aria-label="Example: enhanced notes where each line links to what was said"
    >
      <p className="smallcaps text-muted">Enhanced notes · Mon, Sep 28</p>
      <p className="mt-2 font-serif text-[27px] font-medium leading-none tracking-[-0.015em]">Acme renewal</p>
      <ul className="mt-4 space-y-2">
        {BULLETS.map((x, i) => (
          <li key={i}>
            <button
              type="button"
              onMouseEnter={() => {
                onHover(true);
                onPick(i);
              }}
              onFocus={() => onPick(i)}
              onClick={() => onPick(i)}
              className={cx(
                "flex w-full items-baseline gap-2.5 rounded-sm text-left font-serif text-[17.5px] leading-snug transition-colors",
                x.origin === "you" ? "text-ink" : "text-muted",
              )}
            >
              <span className={cx("mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full", x.origin === "you" ? "bg-ink/80" : "bg-faint")} />
              <span>
                {x.text}
                <sup
                  className={cx(
                    "ml-0.5 rounded px-[3px] font-sans text-[0.62em] font-semibold text-accent transition-colors",
                    active === i && "bg-accent-soft",
                  )}
                >
                  {i + 1}
                </sup>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex gap-4 font-sans text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[5px] w-[5px] rounded-full bg-ink/80" /> yours
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[5px] w-[5px] rounded-full bg-faint" /> added, with a source
        </span>
      </p>
    </div>
  );
}

export function QuoteReceipt({ active, className }: { active: number; className?: string }) {
  const b = BULLETS[active];
  return (
    <Receipt className={className}>
      <p className="text-center tracking-[0.2em]">TRANSCRIPT</p>
      <p className="text-center text-[11px] text-[#6f6a60]">ACME RENEWAL · SALES CALL</p>
      <ReceiptRule />
      <p className="flex justify-between text-[11.5px] text-[#5d584f]">
        <span>
          {b.who.toUpperCase()} <span className="font-sans font-semibold text-accent">{active + 1}</span>
        </span>
        <span className="tabular-nums">{b.at}</span>
      </p>
      <blockquote key={active} className="animate-fade-in mt-1.5 text-[13px] leading-[1.6]">
        {b.before} <mark className="hl hl-swipe bg-transparent text-inherit">{b.quote}</mark>
      </blockquote>
      <ReceiptRule />
      <p className="flex justify-between text-[11px] text-[#6f6a60]">
        <span>SOURCE {active + 1} OF 3</span>
        <span>▶ HEAR IT</span>
      </p>
    </Receipt>
  );
}

/** Desktop: the pair lives at the right edge of the desk. Phones get it in the flow. */
export function HeroCards({ layout }: { layout: "desk" | "flow" }) {
  const { active, setActive, setHovering } = useHeroDemo();
  if (layout === "flow") {
    return (
      <div className="relative mx-auto mt-14 w-full max-w-[380px] pb-10">
        <NoteCard active={active} onPick={setActive} onHover={setHovering} className="arrive rotate-[1.5deg]" />
        <div className="relative -mt-3 ml-auto w-[88%] -rotate-[2.5deg]" style={{ zIndex: 1 }}>
          <QuoteReceipt active={active} className="arrive [--d:200ms]" />
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="absolute right-[-14px] top-[92px] w-[336px] rotate-[3.5deg] 2xl:right-[2%] 2xl:w-[372px]">
        <NoteCard active={active} onPick={setActive} onHover={setHovering} className="arrive [--d:260ms]" />
      </div>
      <div className="absolute right-[1.5%] top-[486px] w-[276px] -rotate-[3deg] 2xl:right-[3%] 2xl:w-[290px]">
        <QuoteReceipt active={active} className="arrive [--d:420ms]" />
      </div>
    </>
  );
}
