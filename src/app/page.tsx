import Link from "next/link";
import { Faq } from "@/components/landing/Faq";
import { HeroCards } from "@/components/landing/HeroCards";
import { btn, cx } from "@/components/ui";
import { SITE } from "@/lib/site";

function Wordmark({ size = "lg" }: { size?: "lg" | "sm" }) {
  return (
    <span
      className={cx(
        "inline-flex items-start font-serif font-medium leading-none tracking-[-0.02em] text-ink",
        size === "lg" ? "text-[34px] sm:text-[42px]" : "text-[26px]",
      )}
    >
      Footnote
      <span
        className={cx("rounded-full bg-accent", size === "lg" ? "ml-[2px] mt-[4px] h-[7px] w-[7px]" : "ml-[1px] mt-[3px] h-[5px] w-[5px]")}
        aria-hidden
      />
    </span>
  );
}

function Sup({ children }: { children: React.ReactNode }) {
  return <sup className="ml-0.5 font-sans text-[0.55em] font-semibold text-accent">{children}</sup>;
}

const STEPS = [
  {
    title: "Type rough notes",
    body: "Start a meeting and jot the fragments that matter to you, the way you already do. Pick a template: sales call, 1:1, standup, interview, user research.",
  },
  {
    title: "Footnote listens",
    body: "Your mic is transcribed right in the browser. Share the Meet, Zoom or Teams tab and the other side is transcribed too, labeled by speaker.",
  },
  {
    title: "Enhance, with receipts",
    body: "One keystroke turns your fragments into clean notes. Your words stay in ink, AI additions arrive in gray, and every added line cites where it came from.",
  },
];

const EXTRAS = [
  {
    title: "One-click follow-ups",
    body: "Draft the follow-up email, list the action items, or see what's still open. Each sentence cites the line it came from.",
    example: "“I'll send two pricing options and our SOC 2 report by Thursday.”",
    n: 6,
  },
  {
    title: "Ask all your meetings",
    body: "Ask a question across everything you've recorded. The answer names the meeting and the moment, and one click takes you there.",
    example: "“Acme's CFO will push on price; year one has to stay under $90K.”",
    n: 2,
  },
  {
    title: "Receipts you can hear",
    body: "In the sample call, click any footnote to play the exact seconds it cites. The transcript follows along when you replay the call.",
    example: "“Right, we closed our Series B two weeks ago.”",
    n: 1,
  },
];

const COMPARE: { label: string; granola: string; footnote: string }[] = [
  { label: "Price", granola: "$14 a month, every month", footnote: "$59 once with your own key, or free to self-host" },
  { label: "Where notes live", granola: "Their cloud", footnote: "Your device (IndexedDB)" },
  { label: "AI key", granola: "Theirs, bundled into the plan", footnote: "Bring your own; pay OpenAI cents" },
  { label: "Source code", granola: "Closed", footnote: "Open source" },
  { label: "Every AI line cites the transcript", granola: "No", footnote: "Yes: hover to see the words, click to hear them" },
  { label: "Chat across meetings", granola: "Yes", footnote: "Yes, and every answer cites its sources" },
  { label: "Follow-up email, action items", granola: "Yes, with recipes", footnote: "Yes, one click, with receipts" },
  { label: "Share", granola: "Link to their cloud", footnote: "Read-only link; the note lives inside the link" },
  { label: "Install", granola: "Desktop app", footnote: "Nothing; it's a web page" },
  { label: "Hears desktop Zoom", granola: "Yes", footnote: "No; use the web client and share the tab" },
];

export default function Landing() {
  return (
    <div className="min-h-dvh overflow-x-clip bg-paper text-ink">
      {/* Nav */}
      <header className="mx-auto flex max-w-[1380px] items-center gap-6 px-5 pt-6 sm:px-10 sm:pt-8 lg:px-[74px]">
        <Link href="/" aria-label="Footnote home">
          <Wordmark />
        </Link>
        <nav className="mx-auto hidden items-center gap-12 text-[18px] text-ink md:flex" aria-label="Primary">
          <a href="#how" className="hover:text-ink-2">
            How it works
          </a>
          <a href="#pricing" className="hover:text-ink-2">
            Pricing
          </a>
          <a href={SITE.github} target="_blank" rel="noreferrer" className="hover:text-ink-2">
            GitHub
          </a>
        </nav>
        <Link href="/app" className={cx(btn.base, btn.primary, "ml-auto h-12 px-5 text-[17px] md:ml-0 md:h-[54px] md:px-6 md:text-[19px]")}>
          Open Footnote
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-[1380px] items-center gap-12 px-5 pb-10 pt-14 sm:px-10 sm:pt-20 lg:grid-cols-[1.08fr_1fr] lg:gap-6 lg:px-[74px] lg:pb-12 lg:pt-24">
        <div>
          <h1 className="animate-fade-up font-serif text-[52px] font-medium leading-[1.02] tracking-[-0.03em] sm:text-[72px] lg:text-[88px]">
            Meeting notes
            <br />
            with receipts.
          </h1>
          <p
            className="animate-fade-up mt-7 max-w-[640px] text-[20px] leading-[1.45] text-ink sm:text-[24px] lg:text-[26px]"
            style={{ animationDelay: "80ms" }}
          >
            Type rough notes during the call. Footnote turns them into clear notes where every line links to the exact
            moment it was said. Runs in your browser. Bring your own key. Pay once.
          </p>
          <div className="animate-fade-up mt-9 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "160ms" }}>
            <Link href="/app?sample=1" className={cx(btn.base, btn.primary, "h-14 px-7 text-[19px] sm:h-[62px] sm:text-[21px]")}>
              Try a sample meeting
            </Link>
            <Link
              href="/app"
              className={cx(
                btn.base,
                "h-14 border border-ink bg-transparent px-7 text-[19px] text-ink hover:bg-sheet sm:h-[62px] sm:text-[21px]",
              )}
            >
              Open the app
            </Link>
          </div>
          <p className="animate-fade-up mt-6 text-[16px] text-ink-2 sm:text-[18px]" style={{ animationDelay: "220ms" }}>
            No account. No subscription. Your meetings stay on your device.
          </p>
        </div>
        <HeroCards />
      </section>

      {/* Price line */}
      <div className="mx-auto max-w-[1380px] px-5 sm:px-10 lg:px-[74px]">
        <div className="flex flex-col gap-3 border-y border-ink/80 py-6 sm:flex-row sm:items-baseline sm:gap-0 sm:py-8">
          <p className="font-serif text-[26px] sm:w-[40%] sm:text-[32px]">
            Granola <span className="ml-4 font-sans text-[22px] text-ink-2 line-through decoration-1 sm:text-[28px]">$14/mo</span>
          </p>
          <p className="text-[20px] sm:text-[27px]">
            <span className="font-serif text-[26px] sm:text-[32px]">Footnote</span> — $59 once, with your own key
          </p>
        </div>
      </div>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-[1380px] scroll-mt-8 px-5 py-24 sm:px-10 lg:px-[74px] lg:py-32">
        <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-muted">How it works</p>
        <h2 className="mt-3 max-w-[820px] font-serif text-[40px] leading-[1.08] tracking-[-0.02em] sm:text-[54px]">
          You listen. Footnote keeps the record.
        </h2>
        <ol className="mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t border-rule pt-6">
              <p className="font-serif text-[28px] leading-tight sm:text-[30px]">
                {s.title}
                <Sup>{i + 1}</Sup>
              </p>
              <p className="mt-3 max-w-[400px] text-[17px] leading-relaxed text-ink-2">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Receipts */}
      <section className="border-y border-rule bg-sheet">
        <div className="mx-auto grid max-w-[1380px] items-center gap-14 px-5 py-24 sm:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:px-[74px] lg:py-32">
          <div>
            <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-muted">Receipts</p>
            <h2 className="mt-3 font-serif text-[40px] leading-[1.08] tracking-[-0.02em] sm:text-[54px]">
              No receipt, no claim.
            </h2>
            <div className="mt-6 space-y-4 text-[18px] leading-relaxed text-ink-2">
              <p>
                AI notes are only useful if you can trust them. So Footnote shows its work: your own points stay in{" "}
                <span className="text-ink">ink</span>, anything the AI adds is set in <span className="text-muted">gray</span>,
                and every added line ends in a footnote<Sup>1</Sup>.
              </p>
              <p>
                Hover a footnote and the transcript jumps to the exact line. Click it in the sample call and you hear the
                moment itself. Click a line in the transcript to see which notes lean on it.
              </p>
              <p>
                The model is told never to claim anything it can&rsquo;t cite, and the server checks every citation against
                the real transcript. Lines that can&rsquo;t point to a source are dropped before you see them.
              </p>
            </div>
          </div>
          <ReceiptsIllustration />
        </div>
      </section>

      {/* After the call */}
      <section className="mx-auto max-w-[1380px] px-5 pt-24 sm:px-10 lg:px-[74px] lg:pt-32">
        <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-muted">After the call</p>
        <h2 className="mt-3 max-w-[900px] font-serif text-[40px] leading-[1.08] tracking-[-0.02em] sm:text-[54px]">
          Everything you&rsquo;d ask a colleague who was there.
        </h2>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {EXTRAS.map((x) => (
            <div key={x.title} className="rounded-[22px] border border-rule bg-sheet p-7">
              <p className="font-serif text-[24px] leading-tight">{x.title}</p>
              <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{x.body}</p>
              <p className="mt-5 rounded-xl bg-paper px-4 py-3 font-serif text-[15.5px] italic leading-snug text-ink-2">
                {x.example}
                <Sup>{x.n}</Sup>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="mx-auto max-w-[1380px] px-5 py-24 sm:px-10 lg:px-[74px] lg:py-32">
        <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-muted">Footnote vs Granola</p>
        <h2 className="mt-3 max-w-[900px] font-serif text-[40px] leading-[1.08] tracking-[-0.02em] sm:text-[54px]">
          The same core job, without the subscription.
        </h2>
        <div className="mt-12 overflow-hidden rounded-2xl border border-rule bg-sheet">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Comparison of Granola and Footnote</caption>
            <thead>
              <tr className="border-b border-rule text-[14px] text-muted">
                <th scope="col" className="w-[34%] px-5 py-4 font-medium sm:px-7">
                  <span className="sr-only">Feature</span>
                </th>
                <th scope="col" className="px-5 py-4 font-serif text-[20px] font-normal text-ink-2 sm:px-7">
                  Granola
                </th>
                <th scope="col" className="px-5 py-4 font-serif text-[20px] font-normal text-ink sm:px-7">
                  Footnote
                </th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row) => (
                <tr key={row.label} className="border-b border-rule last:border-0">
                  <th scope="row" className="px-5 py-4 align-top text-[15px] font-medium text-ink sm:px-7 sm:text-[16px]">
                    {row.label}
                  </th>
                  <td className="px-5 py-4 align-top text-[15px] text-muted sm:px-7 sm:text-[16px]">{row.granola}</td>
                  <td className="px-5 py-4 align-top text-[15px] text-ink sm:px-7 sm:text-[16px]">{row.footnote}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[13.5px] text-muted">
          Granola is a great product and a trademark of its owners. Pricing as listed on their site for individuals.
        </p>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-8 border-t border-rule bg-paper-2/40">
        <div className="mx-auto max-w-[1380px] px-5 py-24 sm:px-10 lg:px-[74px] lg:py-32">
          <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-muted">Pricing</p>
          <h2 className="mt-3 font-serif text-[40px] leading-[1.08] tracking-[-0.02em] sm:text-[54px]">Pay once. Keep it.</h2>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            <PriceCard
              name="Try it"
              price="Free"
              note="No account, no key"
              features={[
                "The full sample meeting, receipts and all",
                "5 enhancements a day on our key",
                "10 minutes of tab audio a day",
                "Unlimited notes and mic transcript",
              ]}
              cta={{ label: "Try a sample meeting", href: "/app?sample=1" }}
            />
            <PriceCard
              featured
              name="License"
              price="$59"
              suffix="once"
              note="Use Footnote here with your own OpenAI key"
              features={[
                "No daily caps: enhance, ask and transcribe as much as you like",
                "Your key, your bill: about 10¢ per 30-minute meeting",
                "Every update, for good. No subscription",
                "Your meetings never leave your device",
              ]}
              cta={{ label: "Open Footnote", href: "/app" }}
              fine="Free for everyone during The Build Games. Checkout opens after."
            />
            <PriceCard
              name="Hosted"
              price="Soon"
              note="For people who'd rather not manage a key"
              features={["Our key, a fair monthly allowance", "Same local-first notes", "Same receipts on every line"]}
              cta={{ label: "Follow on GitHub", href: SITE.github, external: true }}
            />
          </div>
          <p className="mt-6 max-w-[860px] text-[15px] leading-relaxed text-muted">
            Prefer to run it yourself? Footnote is open source (MIT): deploy it to Vercel with your key in a few minutes, free
            forever. The license pays for the maintained app at this address, so there&rsquo;s nothing to deploy or update.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-[1080px] px-5 py-24 sm:px-10 lg:py-32">
        <p className="text-[14px] font-medium uppercase tracking-[0.16em] text-muted">Questions</p>
        <h2 className="mb-10 mt-3 font-serif text-[40px] leading-[1.08] tracking-[-0.02em] sm:text-[54px]">
          Privacy, limits and honest answers.
        </h2>
        <Faq />
      </section>

      {/* Closing */}
      <section className="mx-auto max-w-[1380px] px-5 pb-24 sm:px-10 lg:px-[74px]">
        <div className="rounded-[28px] bg-ink px-8 py-14 text-paper sm:px-14 sm:py-16">
          <h2 className="max-w-[720px] font-serif text-[38px] leading-[1.08] tracking-[-0.02em] sm:text-[52px]">
            Hear a two-minute call, then watch the notes cite it.
          </h2>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/app?sample=1"
              className={cx(btn.base, "h-14 bg-paper px-7 text-[18px] text-ink hover:bg-white")}
            >
              Try a sample meeting
            </Link>
            <Link
              href="/app"
              className={cx(btn.base, "h-14 border border-paper/40 px-7 text-[18px] text-paper hover:border-paper")}
            >
              Open the app
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1380px] flex-col gap-6 px-5 py-10 text-[15px] text-ink-2 sm:flex-row sm:items-center sm:px-10 lg:px-[74px]">
          <Wordmark size="sm" />
          <p className="text-muted">Built for The Build Games 2026. Local-first, open source.</p>
          <nav className="flex gap-6 sm:ml-auto" aria-label="Footer">
            <a href="#how" className="hover:text-ink">
              How it works
            </a>
            <a href="#pricing" className="hover:text-ink">
              Pricing
            </a>
            <a href="#faq" className="hover:text-ink">
              FAQ
            </a>
            <a href={SITE.github} target="_blank" rel="noreferrer" className="hover:text-ink">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function PriceCard({
  name,
  price,
  suffix,
  note,
  features,
  cta,
  featured,
  fine,
}: {
  name: string;
  price: string;
  suffix?: string;
  note: string;
  features: string[];
  cta: { label: string; href: string; external?: boolean };
  featured?: boolean;
  fine?: string;
}) {
  const cls = cx(btn.base, featured ? btn.primary : btn.secondary, "mt-8 h-12 w-full text-[16px]");
  return (
    <div
      className={cx(
        "flex flex-col rounded-[22px] border p-7 sm:p-8",
        featured ? "border-ink bg-sheet shadow-lift" : "border-rule bg-sheet/70",
      )}
    >
      <p className="text-[15px] font-medium text-muted">{name}</p>
      <p className="mt-3 font-serif text-[52px] leading-none tracking-[-0.02em]">
        {price}
        {suffix && <span className="ml-2 font-sans text-[18px] tracking-normal text-muted">{suffix}</span>}
      </p>
      <p className="mt-2 text-[15px] text-ink-2">{note}</p>
      <ul className="mt-6 space-y-2.5 text-[15.5px] text-ink-2">
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-ink/60" aria-hidden />
            {f}
          </li>
        ))}
      </ul>
      <div className="mt-auto">
        {cta.external ? (
          <a href={cta.href} target="_blank" rel="noreferrer" className={cls}>
            {cta.label}
          </a>
        ) : (
          <Link href={cta.href} className={cls}>
            {cta.label}
          </Link>
        )}
        {fine && <p className="mt-3 text-[12.5px] leading-snug text-muted">{fine}</p>}
      </div>
    </div>
  );
}

function ReceiptsIllustration() {
  return (
    <div className="relative grid gap-4 rounded-[24px] border border-rule bg-paper p-4 shadow-card sm:grid-cols-[1.25fr_1fr] sm:p-5">
      <div className="rounded-2xl bg-sheet p-6">
        <p className="font-serif text-[22px]">Pricing</p>
        <ul className="mt-3 space-y-2.5 font-serif text-[17px] leading-snug">
          <li className="flex gap-2.5 text-ink">
            <span className="mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full bg-ink" />
            <span>
              Pushback on $65 a seat; the CFO will object<Sup>4</Sup>
            </span>
          </li>
          <li className="flex gap-2.5 rounded-md bg-accent-softer text-muted shadow-[inset_2px_0_0_var(--color-accent)]">
            <span className="mt-[0.5em] ml-1.5 h-[6px] w-[6px] shrink-0 rounded-full bg-faint" />
            <span>
              A multi-year term lowers the per-seat price<Sup>7</Sup>
            </span>
          </li>
          <li className="flex gap-2.5 text-ink">
            <span className="mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full bg-ink" />
            <span>
              Year one must stay under $90K<Sup>8</Sup>
            </span>
          </li>
        </ul>
        <p className="mt-6 flex gap-4 font-sans text-[12.5px] text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[6px] w-[6px] rounded-full bg-ink" /> yours
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-[6px] w-[6px] rounded-full bg-faint" /> added, with source
          </span>
        </p>
      </div>
      <div className="rounded-2xl bg-sheet p-5">
        <p className="font-serif text-[19px]">Transcript</p>
        <div className="mt-3 space-y-1.5">
          <div className="rounded-xl px-3 py-2">
            <p className="flex justify-between text-[12.5px] text-muted">
              <span>Dana (Acme)</span>
              <span>00:50</span>
            </p>
            <p className="mt-0.5 font-serif text-[15px] leading-snug text-ink-2">…at $65 a seat, 120 seats is a big jump.</p>
          </div>
          <div className="rounded-xl bg-accent-soft px-3 py-2">
            <p className="flex justify-between text-[12.5px] text-muted">
              <span>
                You <span className="align-super text-[10px] font-semibold text-accent">7</span>
              </span>
              <span>01:01</span>
            </p>
            <p className="mt-0.5 font-serif text-[15px] leading-snug text-ink">
              …a multi-year term usually brings the per-seat price down quite a bit.
            </p>
          </div>
          <div className="rounded-xl px-3 py-2">
            <p className="flex justify-between text-[12.5px] text-muted">
              <span>Dana (Acme)</span>
              <span>01:11</span>
            </p>
            <p className="mt-0.5 font-serif text-[15px] leading-snug text-ink-2">But I need year one under $90K.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
