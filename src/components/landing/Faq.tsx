const ITEMS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Where do my meetings live?",
    a: "In your browser, on this device (IndexedDB). There's no Footnote account and no database of your meetings on our side. Export to Markdown any time, or share a read-only link that carries the note inside the link itself.",
  },
  {
    q: "What gets sent where?",
    a: "Your side of the call is transcribed by the browser's built-in speech recognition (in Chrome that runs through Google's speech service). Tab audio is sent in ~10-second chunks to OpenAI for transcription, and your notes plus the transcript go to OpenAI when you press Enhance. Audio is never stored, and your key is never saved on the server.",
  },
  {
    q: "What's free, and what are the limits?",
    a: "Without a key you get a small daily allowance on our key: 5 enhancements and 10 minutes of tab-audio transcription per day. With your own OpenAI key there are no limits; a 30-minute meeting costs roughly 10 cents.",
  },
  {
    q: "Can it hear the Zoom desktop app?",
    a: "No, and we won't pretend otherwise: a web page can't hear other apps. Join from the web client (Google Meet, Zoom web, Teams web) and pick “Share tab audio” when Footnote asks. Your mic works in any modern browser.",
  },
  {
    q: "What stops the AI from making things up?",
    a: "Receipts. Every line the AI adds must cite the transcript lines it came from. The server checks every citation against the real transcript and drops bullets that can't point to a source. Hover any footnote to see the exact words.",
  },
  {
    q: "Why pay $59 if it's open source?",
    a: "You don't have to. Self-hosting is free, and the README shows how. The license is for people who'd rather just use it: the maintained app at this address, with your own key, no daily caps and every update, paid once instead of monthly.",
  },
  {
    q: "Which browsers work?",
    a: "Chrome and Edge on desktop do everything. Safari handles the mic and notes, but can't capture tab audio. On a phone, Footnote works for notes and your mic.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-rule border-y border-rule">
      {ITEMS.map((item) => (
        <details key={item.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-serif text-[21px] leading-snug text-ink marker:hidden sm:text-[23px] [&::-webkit-details-marker]:hidden">
            {item.q}
            <span
              className="relative h-4 w-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-45"
              aria-hidden
            >
              <span className="absolute left-0 top-1/2 h-px w-4 bg-current" />
              <span className="absolute left-1/2 top-0 h-4 w-px bg-current" />
            </span>
          </summary>
          <p className="mt-3 max-w-[720px] text-[16.5px] leading-relaxed text-ink-2">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
