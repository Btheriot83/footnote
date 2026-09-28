"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EnhancedView } from "@/components/receipts/EnhancedView";
import { TranscriptPanel } from "@/components/receipts/TranscriptPanel";
import { useReceipts } from "@/components/receipts/useReceipts";
import { btn, cx } from "@/components/ui";
import { numberFootnotes } from "@/lib/citations";
import { formatDate, formatDuration } from "@/lib/format";
import { decodeShare, type SharePayload } from "@/lib/share";
import { getTemplate } from "@/lib/templates";

export function SharedNote() {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "ok"; data: SharePayload }>({
    status: "loading",
  });
  const [wide, setWide] = useState(true);

  useEffect(() => {
    const read = () => {
      const data = decodeShare(window.location.hash);
      setState(data ? { status: "ok", data } : { status: "error" });
    };
    read();
    window.addEventListener("hashchange", read);
    const mq = window.matchMedia("(min-width: 1024px)");
    const onMq = () => setWide(mq.matches);
    onMq();
    mq.addEventListener("change", onMq);
    return () => {
      window.removeEventListener("hashchange", read);
      mq.removeEventListener("change", onMq);
    };
  }, []);

  const data = state.status === "ok" ? state.data : null;
  const numbers = useMemo(() => numberFootnotes(data?.enhanced), [data]);
  const byId = useMemo(() => new Map((data?.segments ?? []).map((s) => [s.id, s])), [data]);
  const receipts = useReceipts(data?.enhanced ?? null);

  useEffect(() => {
    if (data) document.title = `${data.title} · Footnote`;
  }, [data]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper lg:h-dvh">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-rule px-5 sm:px-8">
        <Link href="/" className="inline-flex items-start font-serif text-[24px] leading-none tracking-[-0.015em]">
          Footnote
          <span className="ml-[1px] mt-[2px] h-[5px] w-[5px] rounded-full bg-accent" aria-hidden />
        </Link>
        <span className="hidden text-[13.5px] text-muted sm:inline">Shared note · read-only</span>
        <Link href="/" className={cx(btn.base, btn.secondary, btn.sm, "ml-auto")}>
          Make notes like this
        </Link>
      </header>

      {state.status === "loading" ? (
        <div className="flex flex-1 items-center justify-center" aria-busy>
          <span className="h-2 w-2 animate-pulse-dot rounded-full bg-faint" />
        </div>
      ) : state.status === "error" || !data ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-[440px] text-center">
            <h1 className="font-serif text-[34px] leading-tight">This link is incomplete</h1>
            <p className="mt-3 text-[16px] leading-relaxed text-ink-2">
              Shared notes live entirely inside the link, so a link that was cut short can&rsquo;t be opened. Ask for the
              full link again.
            </p>
            <Link href="/" className={cx(btn.base, btn.primary, btn.md, "mt-6")}>
              What is Footnote?
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <main className="scroll-thin min-w-0 flex-1 overflow-y-auto bg-sheet">
            <article className="mx-auto w-full max-w-[720px] px-5 pb-24 pt-10 sm:px-10 sm:pt-14">
              <h1 className="font-serif text-[34px] leading-[1.15] tracking-[-0.018em] sm:text-[46px]">{data.title}</h1>
              <p className="mt-2.5 text-[16px] text-ink-2/80 sm:text-[17px]">
                {formatDate(data.createdAt, { year: true })}
                {data.durationMs > 0 && <> • {formatDuration(data.durationMs)}</>} · {getTemplate(data.template).name}{" "}
                template
              </p>
              {data.enhanced && data.enhanced.sections.length > 0 ? (
                <div className="mt-9">
                  <h2 className="font-serif text-[29px] leading-tight sm:text-[32px]">Enhanced notes</h2>
                  <p className="mt-1.5 flex flex-wrap items-center gap-x-4 text-[13.5px] text-muted">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-[6px] w-[6px] rounded-full bg-ink" /> Written by the note-taker
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-[6px] w-[6px] rounded-full bg-faint" /> Added from the transcript
                      <sup className="font-semibold text-accent">1</sup>
                    </span>
                  </p>
                  <div className="mt-7">
                    <EnhancedView
                      notes={data.enhanced}
                      numbers={numbers}
                      segmentsById={byId}
                      receipts={receipts}
                      inlineQuotes={!wide}
                    />
                  </div>
                </div>
              ) : null}
              {data.notes && (
                <section className="mt-12">
                  <h2 className="font-serif text-[22px] text-ink-2">
                    {data.enhanced ? "Original rough notes" : "Notes"}
                  </h2>
                  <pre className="mt-3 whitespace-pre-wrap font-serif text-[18px] leading-[1.7] text-ink">{data.notes}</pre>
                </section>
              )}
              {!wide && data.segments.length > 0 && !data.enhanced && (
                <section className="mt-12">
                  <h2 className="font-serif text-[22px] text-ink-2">Transcript</h2>
                  <ol className="mt-3 space-y-3">
                    {data.segments.map((s) => (
                      <li key={s.id}>
                        <p className="text-[13.5px] text-muted">{s.label || s.speaker}</p>
                        <p className="font-serif text-[17px] leading-snug">{s.text}</p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </article>
          </main>
          {wide && data.segments.length > 0 && (
            <aside className="flex w-[390px] shrink-0 flex-col border-l border-rule bg-sheet" aria-label="Transcript">
              <TranscriptPanel
                className="h-full"
                segments={data.segments}
                numbers={numbers}
                notes={data.enhanced}
                receipts={receipts}
                header={
                  <div className="px-7 pb-3 pt-7">
                    <h2 className="font-serif text-[26px] leading-none">{data.citedOnly ? "Sources" : "Transcript"}</h2>
                    {data.citedOnly && (
                      <p className="mt-2 text-[13px] text-muted">Only the quoted lines of the transcript were shared.</p>
                    )}
                  </div>
                }
              />
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
