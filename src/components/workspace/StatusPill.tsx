"use client";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { formatClock } from "@/lib/format";
import { useLevel } from "@/lib/client/session";

const BARS = 14;

export function Waveform({ active }: { active: boolean }) {
  const level = useLevel();
  const history = useRef<number[]>(Array(BARS).fill(0.08));
  const [, force] = useState(0);
  useEffect(() => {
    const h = history.current;
    h.push(active ? Math.max(0.08, level) : 0.08);
    if (h.length > BARS) h.shift();
    force((n) => (n + 1) % 1000);
  }, [level, active]);
  return (
    <span className="flex h-5 items-center gap-[2px]" aria-hidden>
      {(active ? history.current : Array<number>(BARS).fill(0.08)).map((v, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-ink/40 transition-[height] duration-100"
          style={{ height: `${Math.round(3 + v * 17)}px`, opacity: 0.45 + (i / BARS) * 0.55 }}
        />
      ))}
    </span>
  );
}

export function useTicker(active: boolean, startedAt: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [active]);
  return active ? Math.max(0, now - startedAt) : 0;
}

export function RecordingPill({
  label,
  elapsedMs,
  live,
  dot = "accent",
}: {
  label: string;
  elapsedMs: number;
  live: boolean;
  dot?: "accent" | "muted";
}) {
  return (
    <div
      className="paper paper-white flex h-10 items-center gap-2 rounded-full pl-3.5 pr-4 sm:gap-2.5"
      role="status"
    >
      <span
        className={cx(
          "h-2.5 w-2.5 shrink-0 rounded-full",
          dot === "accent" ? "bg-accent" : "bg-faint",
          live && "animate-pulse-dot",
        )}
        aria-hidden
      />
      <span className={cx("smallcaps hidden whitespace-nowrap text-[10.5px] xl:inline", dot === "accent" ? "text-accent" : "text-muted")}>
        {label}
      </span>
      <span className="font-mono text-[14px] tabular-nums text-ink">{formatClock(elapsedMs)}</span>
      <span className="hidden sm:inline-flex md:hidden xl:inline-flex">
        <Waveform active={live} />
      </span>
    </div>
  );
}
