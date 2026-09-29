"use client";
import { useEffect, useRef, useState } from "react";
import { CloseIcon } from "./icons";
import { cx } from "./ui";

interface Props {
  /** Paper stock: a cream sheet, a ruled index card, or a white slip. */
  stock?: "sheet" | "index" | "slip";
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/** Native <dialog>: focus trapping, Escape and inert background for free. */
const STOCK = {
  sheet: "paper paper-cream",
  index: "paper paper-index head-rule [--margin-x:24px] sm:[--margin-x:38px]",
  slip: "paper paper-white",
};

/**
 * Where the dialog should fly out of: the control that opened it (still focused when
 * `open` flips), as an offset from the viewport centre.
 */
function originOf(el: Element | null): { x: number; y: number } | null {
  if (!el || el === document.body || !(el instanceof HTMLElement)) return null;
  const r = el.getBoundingClientRect();
  if (!r.width && !r.height) return null;
  return { x: r.left + r.width / 2 - window.innerWidth / 2, y: r.top + r.height / 2 - window.innerHeight / 2 };
}

export function Dialog({ open, onClose, title, description, children, footer, className, stock = "sheet" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // Keep the contents on the paper while it tucks away.
  const [prevOpen, setPrevOpen] = useState(open);
  const [linger, setLinger] = useState(false);
  if (prevOpen !== open) {
    setPrevOpen(open);
    setLinger(!open);
  }

  // Fade whichever edge has more to scroll to.
  const body = useRef<HTMLDivElement>(null);
  const edges = () => {
    const el = body.current;
    if (!el) return;
    const f = [el.scrollTop > 2 && "top", el.scrollTop + el.clientHeight < el.scrollHeight - 2 && "bottom"].filter(Boolean).join(" ");
    if (el.dataset.fade !== f) el.dataset.fade = f;
  };
  useEffect(() => {
    const el = body.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(edges);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    edges();
    return () => ro.disconnect();
  });

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      const o = originOf(document.activeElement);
      d.style.setProperty("--from-x", `${o ? Math.round(o.x * 0.85) : 0}px`);
      d.style.setProperty("--from-y", `${o ? Math.round(o.y * 0.85) : 40}px`);
      d.showModal();
    }
    if (!open && d.open) {
      // Close right away (focus and interactivity return to the page now); CSS keeps the
      // paper in the top layer for its exit, and the contents stay until it's gone.
      d.close();
      const t = setTimeout(() => setLinger(false), 200);
      return () => clearTimeout(t);
    }
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
        STOCK[stock],
        "desk-dialog fixed m-auto w-[calc(100%-24px)] max-w-[560px] rounded-[4px] p-0 text-ink shadow-lift",
        stock === "index" && "[&_.dialog-inner]:pl-[26px] sm:[&_.dialog-inner]:pl-[62px]",
        className,
      )}
    >
      {(open || linger) && (
        <div className="dialog-inner flex max-h-[min(88vh,820px)] flex-col">
          <header
            className={cx(
              "flex items-start justify-between gap-4 px-6 pb-2 pt-6 sm:px-8 sm:pt-7",
              stock === "index" && "mb-1 border-b border-index-line pb-4",
            )}
          >
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
          <div ref={body} onScroll={edges} className="scroll-thin scroll-fade min-h-0 flex-1 overflow-y-auto px-6 py-4 sm:px-8">
            {children}
          </div>
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
