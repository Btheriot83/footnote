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
      {history.current.map((v, i) => (
        <span
          key={i}
          className="w-[2px] rounded-full bg-faint transition-[height] duration-100"
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
      className="flex h-11 items-center gap-2.5 rounded-xl border border-rule bg-sheet pl-3.5 pr-3 shadow-[0_1px_1px_rgba(40,32,20,0.04)]"
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
      <span className={cx("text-[15px] font-medium", dot === "accent" ? "text-accent" : "text-muted")}>{label}</span>
      <span className="text-[15px] font-medium tabular-nums text-ink">{formatClock(elapsedMs)}</span>
      <span className="hidden sm:inline-flex">
        <Waveform active={live} />
      </span>
    </div>
  );
}
