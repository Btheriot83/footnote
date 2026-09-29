const items = (hosted: boolean): { q: string; a: string }[] => [
  {
    q: "Where do my meetings live?",
    a: "On this device, in your browser. There's no account and no copy on a server. Export to Markdown, or share a read-only link that carries the note inside it.",
  },
  {
    q: "What stops the AI making things up?",
    a: "Receipts. Every line it adds must cite the transcript, and the server checks each citation. Lines that can't point to a source are dropped before you see them.",
  },
  {
    q: "What's free?",
    a: `Everything, with your own OpenAI key (about 10¢ a meeting). Without one, the sample call works in full${
      hosted ? ", plus five enhancements a day on us" : " with cached demos"
    }. Notes, search and export never need a key.`,
  },
  {
    q: "What gets sent where?",
    a: "Your mic is transcribed by the browser (Chrome uses Google's speech service). Tab audio and Enhance go to OpenAI. Nothing is stored on a server.",
  },
  {
    q: "Can it hear the Zoom desktop app?",
    a: "No. A web page can't hear other apps. Join from the web client (Meet, Zoom or Teams) and share that tab's audio when Footnote asks.",
  },
  {
    q: "Which browsers work?",
    a: "Chrome and Edge on a computer do everything. Safari does the mic and notes, but not tab audio. On a phone: notes and your mic.",
  },
];

const STOCK = ["paper-sky", "paper-butter", "paper-blush", "paper-sage", "paper-lavender", "paper-stone"];
const TILT = ["-rotate-[0.3deg]", "rotate-[0.25deg]", "-rotate-[0.15deg]", "rotate-[0.3deg]", "-rotate-[0.2deg]", "rotate-[0.15deg]"];
const NUDGE = ["", "md:mt-6", "md:mt-2", "", "md:mt-4", "md:-mt-2"];

/** A scatter of pastel sticky notes, every answer in view. */
export function Faq({ hosted }: { hosted: boolean }) {
  return (
    <ul className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
      {items(hosted).map((item, i) => (
        <li key={item.q} className={`reveal ${NUDGE[i]}`} style={{ ["--d" as string]: `${(i % 3) * 90}ms` }}>
          <div className={`paper lift rounded-[1px] px-6 pb-6 pt-5 ${STOCK[i]} ${TILT[i]}`}>
            <h3 className="font-serif text-[20px] font-medium leading-snug tracking-[-0.005em] text-ink">{item.q}</h3>
            <p className="mt-2 text-[16px] leading-[1.5] text-ink-2">{item.a}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
