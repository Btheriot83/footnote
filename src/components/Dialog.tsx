"use client";
import { useEffect, useRef } from "react";
import { CloseIcon } from "./icons";
import { cx } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Native <dialog>: focus trapping, Escape and inert background for free. */
export function Dialog({ open, onClose, title, description, children, footer, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="dialog-title"
      className={cx(
        "m-auto w-[calc(100%-24px)] max-w-[560px] rounded-[20px] border border-rule bg-sheet p-0 text-ink shadow-lift",
        "backdrop:bg-[rgba(27,25,21,0.28)] backdrop:backdrop-blur-[2px] open:animate-fade-up",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[min(88vh,820px)] flex-col">
          <header className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
            <div>
              <h2 id="dialog-title" className="font-serif text-[26px] leading-tight tracking-[-0.01em]">
                {title}
              </h2>
              {description && <div className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{description}</div>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="-mr-2 -mt-1 rounded-lg p-2 text-muted hover:bg-paper-2 hover:text-ink"
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </header>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-4">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-rule px-6 py-4">{footer}</footer>
          )}
        </div>
      )}
    </dialog>
  );
}
