import Link from "next/link";
import { Faq } from "@/components/landing/Faq";
import { HeroCards } from "@/components/landing/HeroCards";
import { CtaStrip, DeskHeading, Hand, PrintPhoto, Receipt, ReceiptRule, Sup } from "@/components/landing/Paper";
import { Reveal } from "@/components/landing/Reveal";
import { cx } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { hasServerKey } from "@/lib/server/keys";
import { SITE } from "@/lib/site";

const EXTRAS = [
  {
    label: "Recipes",
    title: "One-click follow-ups",
    body: "Draft the follow-up email, list the action items, or see what's still open. Each sentence cites the line it came from.",
    example: "“I'll send two pricing options and our SOC 2 report by Thursday.”",
    n: 6,
    stock: "paper paper-white",
    tilt: "-rotate-[1.2deg]",
  },
  {
    label: "Ask",
    title: "Ask all your meetings",
    body: "Ask a question across everything you've recorded. The answer names the meeting and the moment, and one click takes you there.",
    example: "“Acme's CFO will push on price; year one has to stay under $90K.”",
    n: 2,
    stock: "paper paper-sky",
    tilt: "rotate-[0.8deg] md:mt-10",
  },
  {
    label: "Audio",
    title: "Receipts you can hear",
    body: "Click a footnote to play the exact seconds it cites. The audio stays in your browser, and the transcript follows along when you replay the call.",
    example: "“Right, we closed our Series B two weeks ago.”",
    n: 1,
    stock: "paper paper-blush",
    tilt: "-rotate-[0.6deg] md:mt-3",
  },
];

const COMPARE: { label: string; granola: string; footnote: string }[] = [
  { label: "Price", granola: "$14 a month, every month", footnote: "Free with your own key; Pro is $59 once, AI included" },
  { label: "Where notes live", granola: "Their cloud", footnote: "Your device (IndexedDB)" },
  { label: "AI key", granola: "Theirs, bundled into the plan", footnote: "Yours (about 10¢ a meeting), or included with Pro" },
  { label: "Source code", granola: "Closed", footnote: "Open source" },
  { label: "Every AI line cites the transcript", granola: "No", footnote: "Yes: hover to see the words, click to hear them" },
  { label: "Play the moment behind a note", granola: "No; audio isn't kept", footnote: "Yes; the audio stays on your device" },
  { label: "Chat across meetings", granola: "Yes", footnote: "Yes, and every answer cites its sources" },
  { label: "Follow-up email, action items", granola: "Yes, with recipes", footnote: "Yes, one click, with receipts" },
  { label: "Share", granola: "Link to their cloud", footnote: "Read-only link; the note lives inside the link" },
  { label: "Install", granola: "Desktop app", footnote: "Nothing; it's a web page" },
  { label: "Hears desktop Zoom", granola: "Yes", footnote: "No; use the web client and share the tab" },
];

export default function Landing() {
  // Only promise a free allowance on our key when this deployment actually has one.
  const hosted = hasServerKey();
  return (
    <div className="desk-page min-h-dvh overflow-x-clip text-ink">
      <Reveal />

      {/* Nav */}
      <header className="relative z-20 mx-auto flex max-w-[1440px] items-center gap-6 px-5 pt-5 sm:px-8 sm:pt-7">
        <Link href="/" aria-label="Footnote home" className="rounded-sm">
          <Wordmark size={28} />
        </Link>
        <nav className="mx-auto hidden items-center gap-9 md:flex" aria-label="Primary">
          {[
            ["#how", "How it works"],
            ["#pricing", "Pricing"],
            ["#faq", "FAQ"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="smallcaps rounded-sm text-ink-2 hover:text-ink">
              {label}
            </a>
          ))}
          <a href={SITE.github} target="_blank" rel="noreferrer" className="smallcaps rounded-sm text-ink-2 hover:text-ink">
            GitHub
          </a>
        </nav>
        <Link href="/app" className="pill ml-auto h-10 px-5 text-[11px] md:ml-0">
          Open Footnote
        </Link>
      </header>

      {/* Hero: the desk */}
      <section className="relative mx-auto max-w-[1800px] xl:min-h-[920px]">
        {/* Photos peeking in (phone and tablet) */}
        <div className="pointer-events-none relative h-[150px] sm:h-[190px] xl:hidden" aria-hidden>
          <div className="absolute -left-8 top-4 w-[170px] -rotate-[8deg] sm:w-[210px]">
            <PrintPhoto src="/desk/photo-call.webp" caption="acme call, tues" className="arrive" eager />
          </div>
          <div className="absolute -right-10 top-2 w-[200px] rotate-[5deg] sm:right-4 sm:w-[240px]">
            <div className="paper paper-index arrive rounded-[2px] pb-5 pl-[50px] pr-4 pt-[14px] [--d:120ms] [--rule-gap:28px] [--rule-top:40px]">
              <p className="smallcaps h-[26px] pt-[7px] text-[9.5px] text-pen/80">Your notes</p>
              <p className="font-hand text-[20px] leading-[28px] text-pen">series B closed?? 32M</p>
              <p className="font-hand text-[20px] leading-[28px] text-pen">120 seats by march</p>
            </div>
          </div>
        </div>

        {/* The words */}
        <div className="relative z-10 mx-auto max-w-[680px] px-5 pb-10 text-center xl:pt-[78px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/desk/icon.webp"
            alt=""
            width={240}
            height={240}
            className="arrive mx-auto h-[84px] w-[84px] sm:h-[96px] sm:w-[96px]"
          />
          <h1 className="arrive on-wood mt-5 font-serif text-[50px] font-medium leading-[0.98] tracking-[-0.035em] [--d:80ms] sm:text-[74px] lg:text-[84px]">
            Meeting notes
            <br />
            with{" "}
            <Hand
              src="/desk/hand-receipts.webp"
              text="receipts."
              width={760}
              height={355}
              className="ink-line -mb-[0.36em] ml-[0.02em] h-[1.24em]"
            />
          </h1>
          <p className="arrive on-wood mx-auto mt-7 max-w-[590px] text-[19px] leading-[1.5] [--d:160ms] sm:text-[22px]">
            Type rough notes during the call. Footnote turns them into clear notes where every line links to the exact
            moment it was said. Runs in your browser, keeps meetings on your device, and it&rsquo;s free with your own
            OpenAI key.
          </p>
          <CtaStrip note="A two-minute staged call, AI voices, sound on" className="arrive mt-9 [--d:240ms]" />
          <p className="arrive on-wood mt-5 text-[15.5px] [--d:300ms]">
            No account. No subscription.{" "}
            <Link href="/app" className="underline decoration-ink/40 underline-offset-4 hover:decoration-ink">
              Open the app
            </Link>
          </p>
        </div>

        {/* Papers around the edges (desktop) */}
        <div className="pointer-events-none absolute inset-0 hidden xl:block [&>*]:pointer-events-auto">
          <div className="absolute left-[-10px] top-[40px] w-[220px] -rotate-[7deg] 2xl:left-[1%] 2xl:w-[228px]">
            <PrintPhoto src="/desk/photo-call.webp" caption="acme call, tues 10am" className="arrive [--d:120ms]" eager />
          </div>
          <div className="absolute -left-10 top-[380px] w-[320px] rotate-[3deg] 2xl:left-[-1%] 2xl:w-[330px]">
            <div className="paper paper-index lift arrive rounded-[2px] pb-8 pl-[54px] pr-6 pt-[14px] [--d:200ms] [--rule-gap:32px] [--rule-top:44px]">
              <p className="smallcaps h-[30px] pt-[9px] text-pen/80">Your notes · 00:42</p>
              <ul className="font-hand text-[23px] leading-[32px] text-pen">
                <li>acme renewal w/ Dana (ops)</li>
                <li>series B closed?? 32M</li>
                <li>40 → 120 seats by march</li>
                <li>CFO will push on price</li>
              </ul>
            </div>
          </div>
          <div className="absolute bottom-[40px] left-[12%] w-[190px] rotate-[5deg] 2xl:left-[15%]">
            <PrintPhoto src="/desk/photo-coffee.webp" caption="notes before the call" className="arrive [--d:520ms]" />
          </div>
          <HeroCards layout="desk" />
          <div className="absolute bottom-[26px] right-[21%] w-[180px] rotate-[4deg] 2xl:right-[26%]">
            <div className="paper paper-butter lift arrive rounded-[1px] px-5 pb-6 pt-5 [--d:620ms]">
              <p className="font-hand text-[24px] leading-[1.05] text-ink-2">
                thurs: send 2 pricing options + SOC 2
              </p>
            </div>
          </div>
        </div>

        {/* The demo pair, in the flow on smaller screens */}
        <div className="px-5 xl:hidden">
          <HeroCards layout="flow" />
        </div>
      </section>

      {/* Price receipt */}
      <section className="relative px-5 pb-20 pt-6 xl:pt-0" aria-labelledby="cost-heading">
        <div className="reveal mx-auto w-full max-w-[400px] -rotate-[1.2deg]">
          <Receipt className="lift px-6 pb-6 pt-5 text-[13px]">
            <h2 id="cost-heading" className="text-center text-[13px] font-medium tracking-[0.22em]">
              WHAT IT COSTS
            </h2>
            <p className="text-center text-[11px] text-[#6f6a60]">MEETING NOTES, PER PERSON</p>
            <ReceiptRule className="my-3" />
            <dl className="space-y-2.5">
              <div className="flex items-baseline gap-2 text-[#6f6a60]">
                <dt className="line-through decoration-[#6f6a60]/70">Granola, every month</dt>
                <span className="mb-1 flex-1 border-b border-dotted border-[#a8a296]" aria-hidden />
                <dd className="tabular-nums line-through decoration-[#6f6a60]/70">$14.00</dd>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <dt>Footnote, your own key</dt>
                  <span className="mb-1 flex-1 border-b border-dotted border-[#a8a296]" aria-hidden />
                  <dd className="tabular-nums">$0.00</dd>
                </div>
                <p className="text-[11.5px] text-[#6f6a60]">you pay OpenAI about 10¢ a meeting</p>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <dt>
                    <mark className="hl bg-transparent text-inherit">Footnote Pro, once</mark>
                  </dt>
                  <span className="mb-1 flex-1 border-b border-dotted border-[#a8a296]" aria-hidden />
                  <dd className="tabular-nums">$59.00</dd>
                </div>
                <p className="text-[11.5px] text-[#6f6a60]">AI included · coming soon</p>
              </div>
            </dl>
            <ReceiptRule className="my-3" />
            <p className="flex justify-between text-[11px] tracking-[0.12em] text-[#6f6a60]">
              <span>NO SUBSCRIPTION</span>
              <span>THANK YOU</span>
            </p>
          </Receipt>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative scroll-mt-6 px-5 pb-28 pt-16 sm:px-8 lg:pb-36" aria-labelledby="how-heading">
        <DeskHeading
          id="how-heading"
          lede="Nothing to install. No bot joins the call."
        >
          You listen. Footnote keeps{" "}
          <Hand src="/desk/hand-record.webp" text="the record." width={760} height={192} className="-mb-[0.14em] h-[0.9em]" />
        </DeskHeading>

        <ol className="mx-auto mt-16 grid max-w-[1180px] items-start gap-12 md:grid-cols-3 md:gap-8 lg:mt-20">
          <li className="reveal md:mt-0">
            <div className="paper paper-index lift -rotate-[1.4deg] rounded-[2px] pb-8 pl-[56px] pr-7 pt-[14px] [--rule-gap:30px] [--rule-top:44px]">
              <p className="smallcaps h-[30px] pt-[9px] text-pen/80">1 · During the call</p>
              <h3 className="font-serif text-[27px] font-medium leading-[30px] tracking-[-0.01em]">Type rough notes</h3>
              <p className="mt-[6px] text-[17px] leading-[30px] text-ink-2">
                Start a meeting and jot the fragments that matter to you, the way you already do. Pick a template: sales
                call, 1:1, standup, interview, user research.
              </p>
              <p className="font-hand text-[23px] leading-[30px] text-pen">- 120 seats by march?</p>
            </div>
          </li>
          <li className="reveal md:mt-16 [--d:120ms]">
            <Receipt className="lift rotate-[1.2deg] px-6 pb-7 pt-5 text-[13px]">
              <p className="text-center tracking-[0.22em]">2 · FOOTNOTE LISTENS</p>
              <ReceiptRule className="my-3" />
              <h3 className="font-serif text-[27px] font-medium leading-tight tracking-[-0.01em] text-ink">
                It transcribes as you talk
              </h3>
              <p className="mt-2 font-serif text-[17px] leading-[1.55] text-ink-2">
                Your mic is transcribed right in the browser. Share the Meet, Zoom or Teams tab and the other side is
                transcribed too, labeled by speaker.
              </p>
              <ReceiptRule className="my-3" />
              <p className="flex justify-between text-[11px] text-[#5d584f]">
                <span>YOU</span>
                <span>00:08</span>
              </p>
              <p className="text-[12.5px]">How are things at Acme?</p>
              <p className="mt-2 flex justify-between text-[11px] text-[#5d584f]">
                <span>DANA (ACME)</span>
                <span>00:15</span>
              </p>
              <p className="text-[12.5px]">We closed our Series B two weeks ago.</p>
            </Receipt>
          </li>
          <li className="reveal md:mt-6 [--d:240ms]">
            <div className="paper paper-cream lift -rotate-[0.8deg] rounded-[2px] px-7 pb-8 pt-6">
              <p className="smallcaps text-muted">3 · After the call</p>
              <h3 className="mt-2 font-serif text-[27px] font-medium leading-tight tracking-[-0.01em]">
                Enhance, with receipts
              </h3>
              <p className="mt-2 text-[17px] leading-[1.55] text-ink-2">
                One keystroke turns your fragments into clean notes. Your words stay in ink, AI additions arrive in gray,
                and every added line cites where it came from.
              </p>
              <ul className="mt-4 space-y-1.5 border-t border-rule pt-4 font-serif text-[16.5px] leading-snug">
                <li className="flex gap-2.5">
                  <span className="mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full bg-ink" />
                  <span>
                    Series B closed: $32M, led by Northstar<Sup>1</Sup>
                  </span>
                </li>
                <li className="flex gap-2.5 text-muted">
                  <span className="mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full bg-faint" />
                  <span>
                    Seats grow from 40 to about 120 by March<Sup>2</Sup>
                  </span>
                </li>
              </ul>
            </div>
          </li>
        </ol>
      </section>

      {/* Receipts */}
      <section className="relative px-5 pb-28 sm:px-8 lg:pb-36" aria-labelledby="receipts-heading">
        <DeskHeading id="receipts-heading" lede="Every line the AI adds has to point at the moment it came from.">
          No receipt, no claim.
        </DeskHeading>
        <div className="mx-auto mt-14 grid max-w-[1120px] items-start gap-10 lg:mt-20 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
          <div className="reveal">
            <div className="paper paper-cream lift -rotate-[0.6deg] rounded-[2px] px-7 py-8 sm:px-10 sm:py-10">
              <p className="smallcaps text-muted">How receipts work</p>
              <div className="mt-4 space-y-4 text-[18px] leading-[1.6] text-ink-2">
                <p>
                  AI notes are only useful if you can trust them. So Footnote shows its work: your own points stay in{" "}
                  <span className="text-ink">ink</span>, anything the AI adds is set in{" "}
                  <span className="text-muted">gray</span>, and every added line ends in a footnote<Sup>1</Sup>.
                </p>
                <p>
                  Hover a footnote and the transcript jumps to the exact line. Click it and you hear the moment itself,
                  from audio that never leaves your device. Click a line in the transcript to see which notes lean on it.
                </p>
                <p>
                  The model is told never to claim anything it can&rsquo;t cite, and the server checks every citation
                  against the real transcript. Lines that can&rsquo;t point to a source are dropped before you see them.
                </p>
              </div>
            </div>
          </div>
          <div className="reveal relative [--d:140ms]" aria-label="Example: a note and the transcript line it cites">
            <div className="paper paper-white lift ml-auto w-[92%] rotate-[1.6deg] rounded-[2px] px-7 pb-7 pt-6">
              <p className="smallcaps text-muted">Pricing</p>
              <ul className="mt-3 space-y-2 font-serif text-[17.5px] leading-snug">
                <li className="flex gap-2.5 text-ink">
                  <span className="mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full bg-ink" />
                  <span>
                    Pushback on $65 a seat; the CFO will object<Sup>4</Sup>
                  </span>
                </li>
                <li className="flex gap-2.5 text-muted">
                  <span className="mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full bg-faint" />
                  <span>
                    A multi-year term lowers the per-seat price
                    <Sup className="rounded bg-accent-soft px-[3px]">7</Sup>
                  </span>
                </li>
                <li className="flex gap-2.5 text-ink">
                  <span className="mt-[0.5em] h-[6px] w-[6px] shrink-0 rounded-full bg-ink" />
                  <span>
                    Year one must stay under $90K<Sup>8</Sup>
                  </span>
                </li>
              </ul>
            </div>
            <div className="relative -mt-4 w-[84%] -rotate-[2deg] sm:w-[70%]">
              <Receipt className="lift px-5 pb-5 pt-4">
                <p className="flex justify-between text-[11px] text-[#5d584f]">
                  <span>DANA (ACME)</span>
                  <span>00:50</span>
                </p>
                <p className="text-[12.5px] text-[#55514a]">…at $65 a seat, 120 seats is a big jump.</p>
                <ReceiptRule />
                <p className="flex justify-between text-[11px] text-[#5d584f]">
                  <span>
                    YOU <span className="font-sans font-semibold text-accent">7</span>
                  </span>
                  <span>01:01</span>
                </p>
                <p className="text-[12.5px]">
                  <mark className="hl bg-transparent text-inherit">
                    A multi-year term usually brings the per-seat price down quite a bit.
                  </mark>
                </p>
                <ReceiptRule />
                <p className="flex justify-between text-[11px] text-[#5d584f]">
                  <span>DANA (ACME)</span>
                  <span>01:11</span>
                </p>
                <p className="text-[12.5px] text-[#55514a]">But I need year one under $90K.</p>
              </Receipt>
            </div>
            <div className="absolute -bottom-20 right-0 w-[176px] rotate-[5deg] sm:right-[1%]">
              <div className="paper paper-blush lift rounded-[1px] px-4 pb-5 pt-4">
                <p className="font-hand text-[22px] leading-[1.05] text-ink-2">hover a number, the line lights up</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* After the call */}
      <section className="relative px-5 pb-28 sm:px-8 lg:pb-36" aria-labelledby="after-heading">
        <DeskHeading id="after-heading" lede="Recipes and questions answer from the transcript, with receipts.">
          Everything you&rsquo;d ask a colleague who was there.
        </DeskHeading>
        <div className="mx-auto mt-14 grid max-w-[1160px] items-start gap-8 md:grid-cols-3 lg:mt-20">
          {EXTRAS.map((x, i) => (
            <div key={x.title} className="reveal" style={{ ["--d" as string]: `${i * 110}ms` }}>
              <div className={cx(x.stock, x.tilt, "lift rounded-[2px] px-7 pb-7 pt-6")}>
                <p className="smallcaps text-muted">{x.label}</p>
                <h3 className="mt-2 font-serif text-[25px] font-medium leading-tight tracking-[-0.01em]">{x.title}</h3>
                <p className="mt-2 text-[16.5px] leading-[1.55] text-ink-2">{x.body}</p>
                <p className="mt-5 border-t border-ink/10 pt-4 font-serif text-[16px] italic leading-snug text-ink-2">
                  {x.example}
                  <Sup>{x.n}</Sup>
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="relative px-5 pb-28 sm:px-8 lg:pb-36" aria-labelledby="compare-heading">
        <DeskHeading id="compare-heading" lede="Footnote vs Granola, line by line.">
          The same core job, without the subscription.
        </DeskHeading>
        <div className="reveal mx-auto mt-14 max-w-[1020px] lg:mt-16">
          <div className="paper paper-cream rotate-[0.3deg] overflow-x-auto rounded-[2px] px-2 py-3 sm:px-6 sm:py-6">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <caption className="sr-only">Comparison of Granola and Footnote</caption>
              <thead>
                <tr className="border-b border-ink/25">
                  <th scope="col" className="w-[32%] px-4 pb-3 pt-2">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th scope="col" className="smallcaps px-4 pb-3 pt-2 text-muted">
                    Granola
                  </th>
                  <th scope="col" className="px-4 pb-3 pt-2">
                    <Wordmark size={20} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.label} className="border-b border-rule last:border-0">
                    <th scope="row" className="px-4 py-3.5 align-top font-serif text-[16px] font-medium text-ink">
                      {row.label}
                    </th>
                    <td className="px-4 py-3.5 align-top text-[16px] text-muted">{row.granola}</td>
                    <td className="px-4 py-3.5 align-top text-[16px] text-ink">{row.footnote}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="px-4 pb-1 pt-4 text-[13.5px] italic text-muted">
              Granola is a great product and a trademark of its owners. Pricing as listed on their site for individuals.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative scroll-mt-6 px-5 pb-28 sm:px-8 lg:pb-36" aria-labelledby="pricing-heading">
        <DeskHeading id="pricing-heading" lede="Free with your own OpenAI key, for good. Pro is for people who'd rather not manage one.">
          Free with your key. Or pay once.
        </DeskHeading>
        <div className="mx-auto mt-14 grid max-w-[1120px] items-start gap-8 md:grid-cols-3 lg:mt-20">
          <PriceCard
            className="paper paper-sky -rotate-[1deg]"
            name="Try it"
            price="Free"
            note="No account, no key, no setup"
            features={[
              "The full sample call, with receipts you can hear",
              hosted ? "Enhance, recipes and Ask on the sample" : "Enhance and recipes on the sample (cached demo)",
              ...(hosted ? ["A few enhancements a day on our key for your own meetings"] : []),
              "Notes, history, search and export, on your device",
            ]}
            cta={{ label: "Try a sample meeting", href: "/app?sample=1" }}
          />
          <PriceCard
            className="paper paper-cream rotate-[0.6deg] md:mt-6"
            delay={110}
            name="Open source"
            price="Free"
            suffix="with your key"
            note="Everything, with your own OpenAI key"
            features={[
              "Enhance, Ask, recipes and tab transcription",
              "No limits. You pay OpenAI directly: about 10¢ per 30-minute meeting",
              "Your key stays in your browser; your meetings stay on your device",
              "Use it here, or self-host it (MIT)",
            ]}
            cta={{ label: "Open Footnote", href: "/app" }}
          />
          <PriceCard
            featured
            className="paper paper-white -rotate-[0.5deg] md:mt-2"
            delay={220}
            name="Footnote Pro"
            price="$59"
            suffix="once"
            note="No key, no setup: the AI is included"
            features={[
              "1,000 enhancements and 20 hours of transcription a year",
              "Ask and one-click recipes included",
              "Priority updates, for good. No subscription",
              "Funds the open-source app everyone else uses",
            ]}
            cta={{ label: "Coming soon: watch on GitHub", href: SITE.github, external: true }}
            fine="Checkout opens after The Build Games. Nothing is sold or charged today."
          />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative scroll-mt-6 px-5 pb-28 sm:px-8 lg:pb-36" aria-labelledby="faq-heading">
        <DeskHeading id="faq-heading">Privacy, limits and honest answers.</DeskHeading>
        <div className="mx-auto mt-14 max-w-[1140px] lg:mt-16">
          <Faq hosted={hosted} />
        </div>
      </section>

      {/* Closing */}
      <section className="relative mx-auto max-w-[1440px] px-5 pb-16 pt-10 sm:px-8 lg:pt-16" aria-labelledby="close-heading">
        <div className="reveal absolute left-[4%] top-[40px] hidden w-[210px] -rotate-[6deg] lg:block xl:left-[8%]" aria-hidden>
          <PrintPhoto src="/desk/photo-room.webp" caption="room 4b, 2pm" />
        </div>
        <div className="reveal absolute right-[4%] top-[150px] hidden w-[200px] rotate-[5deg] [--d:150ms] lg:block xl:right-[8%]" aria-hidden>
          <PrintPhoto src="/desk/photo-board.webp" caption="launch plan, v3" />
        </div>
        <DeskHeading id="close-heading" lede="No account, no key, nothing to install.">
          Hear a two-minute call, then watch the notes cite it.
        </DeskHeading>
        <div className="reveal [--d:120ms]">
          <CtaStrip note="Sound on, two minutes" className="mt-10" />
          <p className="on-wood mt-5 text-center text-[15.5px]">
            Or{" "}
            <Link href="/app" className="underline decoration-ink/40 underline-offset-4 hover:decoration-ink">
              open the app
            </Link>{" "}
            and start your own meeting.
          </p>
        </div>
      </section>

      <footer className="relative px-5 pb-10 pt-16 text-center sm:px-8">
        <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3" aria-label="Footer">
          {[
            ["#how", "How it works"],
            ["#pricing", "Pricing"],
            ["#faq", "FAQ"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="smallcaps rounded-sm text-ink-2 hover:text-ink">
              {label}
            </a>
          ))}
          <a href={SITE.github} target="_blank" rel="noreferrer" className="smallcaps rounded-sm text-ink-2 hover:text-ink">
            GitHub
          </a>
        </nav>
        <p className="on-wood mt-6 text-[15px]">© 2026 Footnote · Built for The Build Games 2026. Local-first, open source.</p>
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
  className,
  delay = 0,
}: {
  name: string;
  price: string;
  suffix?: string;
  note: string;
  features: string[];
  cta: { label: string; href: string; external?: boolean };
  featured?: boolean;
  fine?: string;
  className?: string;
  delay?: number;
}) {
  const cls = cx("pill mt-8 h-12 w-full px-4 text-[11px]", featured && "pill-ink");
  return (
    <div className="reveal" style={{ ["--d" as string]: `${delay}ms` }}>
      <div className={cx(className, "lift relative flex flex-col rounded-[2px] px-7 pb-7 pt-6 sm:px-8")}>
        {featured && (
          <span
            className="absolute -right-2 top-5 rotate-[8deg] rounded-[3px] border-2 border-accent/80 px-2 py-1 font-sans text-[10.5px] font-bold uppercase tracking-[0.2em] text-accent/85 mix-blend-multiply"
            aria-hidden
          >
            Coming soon
          </span>
        )}
        <p className="smallcaps text-muted">{name}</p>
        <p className="mt-3 font-serif text-[54px] font-medium leading-none tracking-[-0.03em]">
          {price}
          {suffix && <span className="ml-2 font-serif text-[19px] font-normal italic tracking-normal text-muted">{suffix}</span>}
        </p>
        <p className="mt-2 text-[16px] text-ink-2">{note}</p>
        <ul className="mt-5 space-y-2 border-t border-ink/10 pt-5 text-[16px] leading-snug text-ink-2">
          {features.map((f) => (
            <li key={f} className="flex gap-2.5">
              <span className="mt-[8px] h-[5px] w-[5px] shrink-0 rounded-full bg-ink/60" aria-hidden />
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
          {fine && <p className="mt-3 text-[13px] italic leading-snug text-muted">{fine}</p>}
        </div>
      </div>
    </div>
  );
}
