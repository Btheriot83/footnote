"use client";
import { useEffect, useState } from "react";
import { cx } from "@/components/ui";

const BULLETS = [
  {
    text: "Series B closed: $32M, led by Northstar",
    origin: "you",
    who: "Dana (Acme)",
    at: "00:15",
    quote: "Right, we closed our Series B two weeks ago. $32 million, led by Northstar.",
  },
  {
    text: "Seats grow from 40 to about 120 by March",
    origin: "ai",
    who: "Dana (Acme)",
    at: "00:26",
    quote: "Support goes from 40 people to about 110 by March… call it 120 seats.",
  },
  {
    text: "Needs year one under $90K, open to two years",
    origin: "you",
    who: "Dana (Acme)",
    at: "01:11",
    quote: "A two-year term could work. But I need year one under $90K.",
  },
] as const;

export function HeroCards() {
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);

  useEffect(() => {
    if (hovering) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setActive((a) => (a + 1) % BULLETS.length), 3400);
    return () => clearInterval(id);
  }, [hovering]);

  const b = BULLETS[active];

  return (
    <div
      className="relative mx-auto h-[430px] w-full max-w-[600px] sm:h-[520px]"
      onMouseLeave={() => setHovering(false)}
      aria-label="Example: enhanced notes where each line links to what was said"
      role="group"
    >
      {/* Notes card */}
      <div
        className="animate-fade-up absolute right-0 top-2 w-[96%] rotate-[4deg] rounded-[6px] bg-[#ece8df] px-7 pb-12 pt-8 shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_18px_40px_-18px_rgba(60,45,20,0.35)] sm:px-10 sm:pt-10"
        style={{ animationDelay: "120ms" }}
      >
        <p className="font-serif text-[27px] leading-none tracking-[-0.01em] sm:text-[34px]">Acme renewal</p>
        <ul className="mt-5 space-y-2.5 sm:mt-6">
          {BULLETS.map((x, i) => (
            <li key={i}>
              <button
                type="button"
                onMouseEnter={() => {
                  setHovering(true);
                  setActive(i);
                }}
                onFocus={() => setActive(i)}
                onClick={() => setActive(i)}
                className={cx(
                  "group flex w-full items-baseline gap-3 rounded-md text-left font-serif text-[17px] leading-snug transition-colors sm:text-[21px]",
                  x.origin === "you" ? "text-ink" : "text-muted",
                )}
              >
                <span className={cx("mt-[0.45em] h-[7px] w-[7px] shrink-0 rounded-full", x.origin === "you" ? "bg-ink/70" : "bg-faint")} />
                <span>
                  {x.text}
                  <sup
                    className={cx(
                      "ml-0.5 rounded px-[2px] font-sans text-[0.62em] font-semibold text-accent transition-colors",
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
      </div>

      {/* Source card */}
      <figure
        className="animate-fade-up absolute bottom-6 left-[2%] w-[74%] -rotate-[3.5deg] rounded-[6px] bg-white px-7 py-6 shadow-[0_2px_4px_rgba(40,32,20,0.05),0_30px_60px_-24px_rgba(40,32,20,0.35)] sm:bottom-10 sm:px-8 sm:py-7"
        style={{ animationDelay: "320ms" }}
      >
        <figcaption className="flex items-center gap-2 font-sans text-[12px] font-semibold uppercase tracking-[0.14em] text-muted">
          <span className="text-accent">{active + 1}</span>
          <span>{b.who}</span>
          <span className="font-normal tabular-nums">· {b.at}</span>
        </figcaption>
        <blockquote key={active} className="animate-fade-in mt-3 font-serif text-[18px] italic leading-[1.45] text-ink-2 sm:text-[21px]">
          <span className="rounded bg-accent-soft/70 box-decoration-clone px-0.5">&ldquo;{b.quote}&rdquo;</span>
        </blockquote>
      </figure>

      {/* Thread down to the price line */}
      <svg
        className="pointer-events-none absolute -bottom-10 left-[40%] hidden h-24 w-10 sm:block"
        viewBox="0 0 40 96"
        fill="none"
        aria-hidden
      >
        <path d="M8 0 C 6 30, 14 60, 30 96" stroke="#E0482B" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    </div>
  );
}
