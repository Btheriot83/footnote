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
        "paper paper-cream fixed m-auto w-[calc(100%-24px)] max-w-[560px] rounded-[4px] p-0 text-ink shadow-lift",
        "backdrop:bg-[rgba(52,38,20,0.34)] backdrop:backdrop-blur-[1.5px] open:animate-settle",
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[min(88vh,820px)] flex-col">
          <header className="flex items-start justify-between gap-4 px-6 pb-2 pt-6 sm:px-8 sm:pt-7">
            <div>
              <h2 id="dialog-title" className="font-serif text-[29px] font-medium leading-tight tracking-[-0.02em]">
                {title}
              </h2>
              {description && <div className="mt-1.5 text-[16px] leading-relaxed text-ink-2">{description}</div>}
            </div>
            <button type="button" onClick={onClose} className="pill -mr-1 h-9 w-9 shrink-0 p-0 tracking-normal" aria-label="Close">
              <CloseIcon size={17} />
            </button>
          </header>
          <div className="scroll-thin min-h-0 flex-1 overflow-y-auto px-6 py-4 sm:px-8">{children}</div>
          {footer && (
            <footer className="flex flex-wrap items-center justify-end gap-2.5 border-t border-dashed border-rule-strong px-6 py-4 sm:px-8">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
