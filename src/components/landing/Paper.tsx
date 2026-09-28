import Link from "next/link";
import { cx } from "@/components/ui";

/** A small printed photo with a white border and a handwritten caption. */
export function PrintPhoto({
  src,
  caption,
  className,
  style,
  eager,
}: {
  src: string;
  caption: string;
  className?: string;
  style?: React.CSSProperties;
  eager?: boolean;
}) {
  return (
    <figure className={cx("print lift relative", className)} style={style}>
      {/* Decorative: the caption says what it is. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" width={520} height={520} loading={eager ? "eager" : "lazy"} decoding="async" />
      <figcaption className="absolute inset-x-3 bottom-[7px] truncate text-center font-hand text-[19px] leading-none text-ink-2">
        {caption}
      </figcaption>
    </figure>
  );
}

/** A torn strip of thermal paper. The wrapper carries the rotation and position. */
export function Receipt({
  children,
  className,
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cx("receipt px-5 pb-5 pt-4 text-[12.5px] leading-[1.55]", className)} style={style}>
      {children}
    </div>
  );
}

export function ReceiptRule({ className }: { className?: string }) {
  return <hr className={cx("receipt-rule my-2.5", className)} />;
}

/** Heading set straight on the wood, with an optional hand-lettered word. */
export function DeskHeading({
  id,
  children,
  lede,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  lede?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("reveal mx-auto max-w-[760px] text-center", className)}>
      <h2
        id={id}
        className="on-wood font-serif text-[40px] font-medium leading-[1.04] tracking-[-0.025em] sm:text-[56px]"
      >
        {children}
      </h2>
      {lede && <p className="on-wood mx-auto mt-4 max-w-[560px] text-[19px] leading-[1.45] sm:text-[21px]">{lede}</p>}
    </div>
  );
}

/** The paper strip that holds the call to action, like a slip with a button on it. */
export function CtaStrip({ note, className }: { note: string; className?: string }) {
  return (
    <div className={cx("mx-auto w-full max-w-[560px]", className)}>
      <div className="paper paper-cream flex flex-col gap-3 rounded-[3px] p-3 sm:flex-row sm:items-center sm:gap-4 sm:py-3 sm:pl-6 sm:pr-3">
        <p className="flex-1 border-b border-rule-strong/70 px-2 pb-2 pt-1 text-left font-serif text-[18px] italic text-muted sm:px-0">
          {note}
        </p>
        <Link href="/app?sample=1" className="pill h-[52px] px-7 text-[12.5px] sm:h-12">
          Try a sample meeting
        </Link>
      </div>
    </div>
  );
}

/** Hand-lettered words are images: the text stays for screen readers and search. */
export function Hand({
  src,
  text,
  width,
  height,
  className,
}: {
  src: string;
  text: string;
  width: number;
  height: number;
  className?: string;
}) {
  return (
    <span className={cx("relative inline-block align-baseline", className)}>
      <span className="sr-only">{text}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" aria-hidden width={width} height={height} className="inline-block h-full w-auto" draggable={false} />
    </span>
  );
}

export function Sup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <sup className={cx("ml-0.5 font-sans text-[0.58em] font-semibold text-accent", className)}>{children}</sup>
  );
}
