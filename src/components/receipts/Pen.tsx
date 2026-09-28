/** A pen writing a loop of ink while the model reads: the waiting state for anything AI. */
export function Pen({ label, className }: { label: string; className?: string }) {
  return (
    <div role="status" className={`flex items-center gap-4 ${className ?? ""}`}>
      <svg width="132" height="30" viewBox="0 0 132 30" fill="none" aria-hidden className="pen-line shrink-0 text-ink-2">
        <path
          pathLength={1}
          d="M3 20c7-9 12-12 15-8s-3 11 3 9 9-15 15-12-4 13 2 12 8-11 13-10 0 9 5 9 7-10 12-9 1 8 6 8 7-9 12-8 2 7 7 7 8-6 12-6 6 3 10 1"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-serif text-[17px] italic text-muted">{label}</span>
    </div>
  );
}
