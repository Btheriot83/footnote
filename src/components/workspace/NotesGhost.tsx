"use client";
import { cx } from "@/components/ui";
import { getTemplate } from "@/lib/templates";
import type { TemplateId } from "@/lib/types";
import { Waveform } from "./StatusPill";

const EXAMPLES: Record<TemplateId, string> = {
  general: "budget 50k?  ·  Sam owns the launch doc",
  "one-on-one": "feeling stretched  ·  wants the Q4 roadmap",
  sales: "renewal 30th  ·  CFO will push on price",
  standup: "Leo: SSO fix shipped  ·  Maya blocked on copy",
  interview: "5y at Stripe  ·  led the billing rewrite",
  research: "exports to Excel weekly  ·  hates the filters",
};

/**
 * What an empty page of notes looks like: a pencilled example on the first line (after the
 * "- " the notepad starts with), the template's headings ghosted in below as a promise of
 * where things will land, and, while recording, a quiet "listening" with the mic level.
 * Sits behind the notepad and never takes a click.
 */
export function NotesGhost({
  template,
  started,
  listening,
}: {
  template: TemplateId;
  /** The notepad already holds its "- " marker. */
  started: boolean;
  /** Recording and hearing something: show the mic level. */
  listening: boolean;
}) {
  const t = getTemplate(template);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 select-none font-serif text-[19px] leading-[1.7]">
      <p className="truncate">
        <span className={started ? "invisible" : "text-faint"}>- </span>
        <span className="italic text-faint">{EXAMPLES[template]}</span>
      </p>
      <p className="mt-1 text-[15px] italic leading-snug text-faint">
        Fragments are fine. Footnote fills in the rest from the transcript, with a receipt for every line.
      </p>

      {listening && (
        <p className="animate-fade-in mt-6 inline-flex items-center gap-2.5 rounded-full py-1 pr-3 text-[14px] text-muted">
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-accent" />
          <span className="smallcaps text-[10px] text-accent">Listening</span>
          <Waveform active />
        </p>
      )}

      <div className={cx("mt-10 border-t border-dashed border-rule-strong/70 pt-5", listening && "mt-6")}>
        <p className="smallcaps text-[10px] text-faint">After the call, your notes are sorted into</p>
        <ol className="mt-4 space-y-5">
          {t.sections.map((h, i) => (
            <li key={h} className="opacity-70" style={{ opacity: 0.75 - i * 0.1 }}>
              <p className="text-[22px] font-medium leading-tight tracking-[-0.01em] text-faint">{h}</p>
              <span className="mt-2.5 block h-[3px] w-[58%] rounded-full bg-rule" style={{ width: `${62 - i * 7}%` }} />
              <span className="mt-2 block h-[3px] w-[40%] rounded-full bg-rule" style={{ width: `${44 - i * 4}%` }} />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
