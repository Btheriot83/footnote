"use client";
import { dismissToast, useToasts } from "@/lib/client/toast";
import { CloseIcon } from "./icons";
import { cx } from "./ui";

export function Toaster() {
  const toasts = useToasts();
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
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
