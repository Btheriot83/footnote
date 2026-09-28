export function cx(...parts: (string | number | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export const btn = {
  base: "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 disabled:opacity-50 disabled:pointer-events-none select-none active:translate-y-px",
  primary: "bg-ink text-paper hover:bg-ink-2 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset,0_1px_2px_rgba(0,0,0,0.2)]",
  secondary: "bg-sheet text-ink border border-rule hover:border-rule-strong hover:bg-white shadow-[0_1px_1px_rgba(40,32,20,0.04)]",
  ghost: "text-ink-2 hover:bg-paper-2",
  sm: "h-9 px-3.5 text-[14px]",
  md: "h-10 px-4 text-[15px]",
  lg: "h-12 px-6 text-[16px]",
  icon: "h-9 w-9 p-0",
};
