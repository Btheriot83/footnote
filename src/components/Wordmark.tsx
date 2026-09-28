import { cx } from "./ui";

/** "Footnote" set in Newsreader with its vermilion footnote dot. */
export function Wordmark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cx("inline-flex items-start font-serif font-medium leading-none tracking-[-0.02em] text-ink", className)}
      style={{ fontSize: size }}
    >
      Footnote
      <span
        className="rounded-full bg-accent"
        style={{ width: Math.max(4, size * 0.17), height: Math.max(4, size * 0.17), marginLeft: size * 0.05, marginTop: size * 0.1 }}
        aria-hidden
      />
    </span>
  );
}
