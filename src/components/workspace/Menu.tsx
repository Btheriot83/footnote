"use client";
import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";

export interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  onSelect: () => void;
  danger?: boolean;
  hidden?: boolean;
  separatorBefore?: boolean;
}

export function Menu({ trigger, items, label }: { trigger: React.ReactNode; items: MenuItem[]; label: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const btns = Array.from(list.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        const i = btns.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === "ArrowDown" ? (i + 1) % btns.length : (i - 1 + btns.length) % btns.length;
        btns[next]?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    requestAnimationFrame(() => list.current?.querySelector("button")?.focus());
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-2 hover:bg-paper-2"
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={list}
          role="menu"
          className="animate-fade-in absolute right-0 top-12 z-30 w-60 rounded-2xl border border-rule bg-sheet p-1.5 shadow-lift"
        >
          {items
            .filter((i) => !i.hidden)
            .map((item) => (
              <div key={item.label}>
                {item.separatorBefore && <div className="my-1 h-px bg-rule" />}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cx(
                    "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14.5px] hover:bg-paper-2 focus:bg-paper-2 focus:outline-none",
                    item.danger ? "text-accent" : "text-ink",
                  )}
                >
                  <span className="text-muted">{item.icon}</span>
                  {item.label}
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
