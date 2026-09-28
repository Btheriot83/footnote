"use client";
import { useEffect, useRef } from "react";
import { dismissToast, useToasts } from "@/lib/client/toast";
import { CloseIcon } from "./icons";
import { cx } from "./ui";

export function Toaster() {
  const toasts = useToasts();
  const ref = useRef<HTMLDivElement>(null);

  // Toasts live in the top layer (a manual popover) so they sit above open dialogs.
  // Re-showing moves them to the top of the stack if a dialog opened since.
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.showPopover !== "function") return;
    try {
      if (el.matches(":popover-open")) el.hidePopover();
      if (toasts.length) el.showPopover();
    } catch {
      /* popover unsupported: falls back to z-index */
    }
  }, [toasts]);

  return (
    <div
      ref={ref}
      popover="manual"
      className="pointer-events-none fixed inset-x-0 bottom-4 top-auto z-50 m-0 flex h-auto w-full max-w-none flex-col items-center gap-2 overflow-visible border-0 bg-transparent p-0 px-4 [&:not(:popover-open)]:hidden"
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            "pointer-events-auto flex max-w-[520px] animate-fade-up items-start gap-3 rounded-2xl px-4 py-3 text-[14.5px] leading-snug shadow-lift",
            t.tone === "error" ? "border border-rule bg-sheet text-ink" : "bg-ink text-paper",
          )}
        >
          {t.tone === "error" && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-hidden />}
          <span className="flex-1">{t.message}</span>
          {t.action && (
            <button
              type="button"
              className="shrink-0 font-semibold underline underline-offset-2"
              onClick={() => {
                t.action!.onClick();
                dismissToast(t.id);
              }}
            >
              {t.action.label}
            </button>
          )}
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="-mr-1 shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            <CloseIcon size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
