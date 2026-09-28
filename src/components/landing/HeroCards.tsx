"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { ReceiptRule } from "./Paper";
import { useSampleClip } from "./useSampleClip";

const BULLETS = [
  {
    text: "Series B closed: $32M, led by Northstar",
    origin: "you",
    who: "Dana (Acme)",
    at: "00:15",
    from: 15760,
    to: 22500,
    before: "Right, we closed our Series B two weeks ago.",
    quote: "$32 million, led by Northstar.",
  },
  {
    text: "Seats grow from 40 to about 120 by March",
    origin: "ai",
    who: "Dana (Acme)",
    at: "00:26",
    from: 26500,
    to: 34700,
    before: "Support goes from 40 people to about 110 by March.",
    quote: "With ops and success, call it 120 seats.",
  },
  {
    text: "Needs year one under $90K, open to two years",
    origin: "you",
    who: "Dana (Acme)",
    at: "01:11",
    from: 70950,
    to: 76500,
    before: "A two-year term could work.",
    quote: "But I need year one under $90K.",
  },
] as const;

type Slip = { i: number; key: number; leaving?: boolean };

/**
 * "Pull the receipt": the hero's note card sits on a tiny thermal printer. Click a
 * footnote and a torn slip feeds out from under the card at printer pace, the cited
 * words get highlighted, and "hear it" plays the real seconds from the sample call.
 * It prints on its own until you reach for it.
 */
function usePrinter() {
  const [slips, setSlips] = useState<Slip[]>([]);
  const [active, setActive] = useState(0);
  const [touched, setTouched] = useState(false);
  const [visible, setVisible] = useState(true);
  const key = useRef(0);
  const reduce = useRef(false);

  const print = useCallback((i: number) => {
    key.current += 1;
    const k = key.current;
    setActive(i);
    setSlips((s) => [...s.filter((x) => !x.leaving).map((x) => ({ ...x, leaving: true })), { i, key: k }].slice(-3));
    // Tossed slips leave the DOM once they've fallen away.
    setTimeout(() => setSlips((s) => s.filter((x) => !x.leaving || x.key > k)), 700);
  }, []);

  // First slip prints once the card has landed on the desk.
  useEffect(() => {
    reduce.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => print(0), reduce.current ? 0 : 1100);
    return () => clearTimeout(t);
  }, [print]);

  // Keeps printing on its own (only while on screen) until someone clicks.
  useEffect(() => {
    if (touched || !visible || reduce.current) return;
    const id = setInterval(() => print((active + 1) % BULLETS.length), 5600);
    return () => clearInterval(id);
  }, [touched, visible, active, print]);

  return {
    slips,
    active,
    visible,
    setVisible,
    pick: (i: number) => {
      setTouched(true);
      print(i);
    },
  };
}

function NoteCard({ active, onPick, className }: { active: number; onPick: (i: number) => void; className?: string }) {
  return (
    <div
      className={cx("paper paper-white relative z-[2] rounded-[2px] px-6 pb-6 pt-6 sm:px-7", className)}
      role="group"
      aria-label="Example: enhanced notes where each line links to what was said"
    >
      <p className="smallcaps text-muted">Enhanced notes · Mon, Sep 28</p>
      <p className="mt-2 font-serif text-[27px] font-medium leading-none tracking-[-0.015em]">Acme renewal</p>
      <ul className="mt-4 space-y-1.5">
        {BULLETS.map((x, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => onPick(i)}
              aria-label={`${x.text}. Print its receipt.`}
              aria-pressed={active === i}
              className={cx(
                "group/b -mx-2 flex w-[calc(100%+16px)] items-baseline gap-2.5 rounded-[3px] px-2 py-0.5 text-left font-serif text-[17.5px] leading-snug transition-colors hover:bg-accent-softer/70",
                x.origin === "you" ? "text-ink" : "text-muted",
              )}
            >
              <span className={cx("mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full", x.origin === "you" ? "bg-ink/80" : "bg-faint")} />
              <span>
                {x.text.slice(0, x.text.lastIndexOf(" ") + 1)}
                <span className="whitespace-nowrap">
                  {x.text.slice(x.text.lastIndexOf(" ") + 1)}
                  <span className="fn-mark" data-active={active === i} aria-hidden>
                    {i + 1}
                  </span>
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-sans text-[11.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[5px] w-[5px] rounded-full bg-ink/80" /> from your notes
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[5px] w-[5px] rounded-full bg-faint" /> added by Footnote
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="fn-mark !ml-0 !cursor-default !text-[9px]" aria-hidden>
            1
          </span>
          where it was said
        </span>
      </p>
    </div>
  );
}

function ReceiptSlip({
  i,
  leaving,
  clip,
}: {
  i: number;
  leaving?: boolean;
  clip: ReturnType<typeof useSampleClip>;
}) {
  const b = BULLETS[i];
  const k = `hero-${i}`;
  const playing = clip.playing === k;
  return (
    <div className={cx("[grid-area:1/1]", leaving ? "tear-off" : "feed")} style={{ ["--feed-dur" as string]: "1150ms", ["--feed-steps" as string]: "15" }}>
      <div className="receipt px-5 pb-4 pt-4 text-[12.5px] leading-[1.55]" aria-hidden={leaving || undefined}>
        <p className="text-center text-[11px] tracking-[0.22em] text-[var(--receipt-dim)]">TRANSCRIPT · ACME RENEWAL</p>
        <ReceiptRule />
        <p className="flex justify-between text-[11.5px] text-[#5d584f]">
          <span>
            {b.who.toUpperCase()} <span className="fn-mark !ml-1 !text-[10px]">{i + 1}</span>
          </span>
          <span className="tabular-nums">{b.at}</span>
        </p>
        <blockquote className="mt-1.5 text-[13px] leading-[1.6] text-[var(--receipt-ink)]">
          {b.before}{" "}
          <mark className={cx("hl bg-transparent text-inherit", !leaving && "hl-swipe")} style={{ ["--hl-delay" as string]: "1250ms" }}>
            {b.quote}
          </mark>
        </blockquote>
        <ReceiptRule />
        <div className="flex items-center justify-between text-[11px] text-[var(--receipt-dim)]">
          <span>SOURCE {i + 1} OF 3</span>
          <button
            type="button"
            tabIndex={leaving ? -1 : 0}
            onClick={() => void clip.play(k, b.from, b.to)}
            className="-mr-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[11px] tracking-[0.08em] text-[var(--receipt-ink)] transition-colors hover:bg-black/[0.06]"
            aria-label={playing ? "Stop" : `Hear ${b.who} say it (${b.at})`}
          >
            {playing ? <span className="h-2 w-2 rounded-[1px] bg-accent" aria-hidden /> : <span aria-hidden>▶</span>}
            {playing ? "PLAYING" : "HEAR IT"}
          </button>
        </div>
        <span
          aria-hidden
          className="mt-1.5 block h-[2px] origin-left rounded-full bg-accent/70"
          style={{ transform: `scaleX(${playing ? clip.progress : 0})` }}
        />
      </div>
    </div>
  );
}

function Printer({ slips, clip, className }: { slips: Slip[]; clip: ReturnType<typeof useSampleClip>; className?: string }) {
  const current = slips.find((s) => !s.leaving);
  return (
    <div className="relative">
      {/* The printer's tear bar, just under the card's edge. */}
      <div aria-hidden className="relative z-[3] mx-auto -mt-[3px] h-[10px] w-[86%] rounded-b-[4px] bg-[linear-gradient(180deg,#5d574e,#3a3630_60%,#2b2823)] shadow-[0_2px_3px_rgba(40,28,10,0.35)]">
        <span className="absolute inset-x-2 top-[3px] h-px bg-white/20" />
      </div>
      {/* Paper only shows below the slot; tossed slips can fall past the sides. */}
      <div
        className={cx("relative z-[1] mx-auto -mt-[4px] grid w-[80%] origin-top [clip-path:inset(0_-160px_-260px_-160px)]", className)}
        aria-live="polite"
      >
        {slips.map((s) => (
          <ReceiptSlip key={s.key} i={s.i} leaving={s.leaving} clip={clip} />
        ))}
        {!current && <div className="h-[170px] [grid-area:1/1]" />}
      </div>
    </div>
  );
}

/** Desktop: the printer lives at the right edge of the desk. Phones get it in the flow. */
export function HeroCards({ layout }: { layout: "desk" | "flow" }) {
  const printer = usePrinter();
  const clip = useSampleClip();
  const root = useRef<HTMLDivElement>(null);
  const { setVisible } = printer;
  useEffect(() => {
    const el = root.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [setVisible]);

  if (layout === "flow") {
    return (
      <div ref={root} className="relative mx-auto mt-10 w-full max-w-[400px] pb-6">
        <div className="arrive rotate-[1.2deg]">
          <NoteCard active={printer.active} onPick={printer.pick} />
          <Printer slips={printer.slips} clip={clip} className="-rotate-[1deg]" />
        </div>
      </div>
    );
  }
  return (
    <div ref={root} className="absolute right-[18px] top-[86px] w-[340px] rotate-[3deg] 2xl:right-[2.5%] 2xl:w-[372px]">
      <p aria-hidden className="on-wood-2 arrive absolute -left-[118px] top-[200px] w-[110px] -rotate-[8deg] text-right font-hand text-[21px] leading-[1.05] [--d:1400ms] [--r-from:-4deg]">
        click a number
        <svg width="46" height="20" viewBox="0 0 46 20" fill="none" className="ml-auto mt-1 block">
          <path d="M2 4c12 10 26 12 40 6M36 4l6 6-8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </p>
      <div className="arrive [--d:260ms] [--r-from:6deg]">
        <NoteCard active={printer.active} onPick={printer.pick} className="lift" />
        <Printer slips={printer.slips} clip={clip} className="-rotate-[1.2deg]" />
      </div>
    </div>
  );
}
