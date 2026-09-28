export function cx(...parts: (string | number | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

/**
 * Buttons are white ceramic pills with small letter-spaced caps (see .pill in globals.css);
 * the one next step on a screen is inked.
 */
export const btn = {
  base: "inline-flex items-center justify-center gap-2 select-none disabled:opacity-50 disabled:pointer-events-none",
  primary: "pill pill-ink",
  secondary: "pill",
  ghost:
    "rounded-full font-sans font-semibold uppercase tracking-[0.14em] text-ink-2 transition-colors hover:bg-ink/[0.06] active:bg-ink/10",
  sm: "h-9 px-4 text-[10.5px]",
  md: "h-10 px-5 text-[11px]",
  lg: "h-12 px-6 text-[12px]",
  icon: "h-9 w-9 p-0",
};
