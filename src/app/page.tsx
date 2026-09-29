import type { Metadata } from "next";
import Link from "next/link";
import { Faq } from "@/components/landing/Faq";
import { HeroCards } from "@/components/landing/HeroCards";
import { HearMark } from "@/components/landing/HearMark";
import { CtaStrip, DeskHeading, Hand, PrintPhoto } from "@/components/landing/Paper";
import { Reveal } from "@/components/landing/Reveal";
import { WriteBack } from "@/components/landing/WriteBack";
import { cx } from "@/components/ui";
import { Wordmark } from "@/components/Wordmark";
import { hasServerKey } from "@/lib/server/keys";
import { SITE } from "@/lib/site";

const EXTRAS = [
  {
    label: "Recipes",
    title: "One-click follow-ups",
    body: "The follow-up email, the action items, what's still open. Each sentence cites its line.",
    example: "“I'll send two pricing options and our SOC 2 report by Thursday.”",
    cites: [{ n: 6, who: "you", at: "1:58", from: 118218, to: 128265 }],
    stock: "paper paper-white",
    tilt: "-rotate-[1.2deg]",
  },
  {
    label: "Ask",
    title: "Ask all your meetings",
    body: "Ask across everything you've recorded. The answer names the meeting and the moment.",
    example: "“Acme's CFO will push on price; year one has to stay under $90K.”",
    cites: [
      { n: 2, who: "Dana", at: "0:50", from: 50722, to: 61065 },
      { n: 3, who: "Dana", at: "1:11", from: 71110, to: 76264 },
    ],
    stock: "paper paper-sky",
    tilt: "rotate-[0.8deg] md:mt-10",
  },
  {
    label: "Audio",
    title: "Receipts you can hear",
    body: "Click a footnote to hear the exact seconds it cites. The audio never leaves your device.",
    example: "“Right, we closed our Series B two weeks ago.”",
    cites: [{ n: 1, who: "Dana", at: "0:15", from: 15760, to: 22324 }],
    stock: "paper paper-blush",
    tilt: "-rotate-[0.6deg] md:mt-3",
  },
];

const COMPARE: { label: string; granola: string; footnote: React.ReactNode }[] = [
  {
    label: "Every AI line cites the transcript",
    granola: "No",
    footnote: (
      <>
        <span className="hover-only">Yes: hover to read it, click to hear it</span>
        <span className="touch-only">Yes: tap a number to read it and hear it</span>
      </>
    ),
  },
  { label: "Where notes live", granola: "Their cloud", footnote: "On your device" },
  { label: "Price", granola: "$14 a month", footnote: "Free with your key, or $59 once" },
  { label: "Source code", granola: "Closed", footnote: "Open source (MIT)" },
  { label: "Ask across meetings", granola: "Yes", footnote: "Yes, with receipts" },
  { label: "Share", granola: "A link to their cloud", footnote: "A link that carries the note itself" },
  { label: "Install", granola: "Desktop app", footnote: "Nothing; it's a web page" },
  { label: "Hears the Zoom desktop app", granola: "Yes", footnote: "No; use the web client" },
];

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Landing() {
  // Only promise a free allowance on our key when this deployment actually has one.
  const hosted = hasServerKey();
  return (
    <div className="desk-page min-h-dvh overflow-x-clip text-ink" data-page="landing" data-ready>
      <Reveal />

      <header className="relative z-20 mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-5 pt-5 sm:px-8 sm:pt-7">
        <Link href="/" aria-label="Footnote home" className="rounded-sm">
          <Wordmark size={28} />
        </Link>
        <Link href="/app" data-page-turn className="pill h-10 px-5 text-[11px]">
          Open Footnote
        </Link>
      </header>

      {/* Hero: the desk */}
      <section className="relative mx-auto max-w-[1800px] xl:min-h-[900px]">
        {/* A photo and a card peeking in (phone and tablet) */}
        <div className="pointer-events-none relative h-[128px] sm:h-[170px] xl:hidden" aria-hidden>
          <div className="absolute -left-6 top-3 w-[150px] -rotate-[8deg] sm:left-2 sm:w-[190px]">
            <PrintPhoto src="/desk/photo-call.webp" caption="acme, tues" className="arrive" eager />
          </div>
          <div className="absolute right-6 top-10 hidden w-[240px] rotate-[5deg] sm:block">
            <div className="paper paper-index arrive rounded-[2px] pb-4 pl-[50px] pr-4 pt-[12px] [--d:120ms] [--rule-gap:28px] [--rule-top:38px]">
              <p className="smallcaps h-[26px] pt-[7px] text-[9.5px] text-pen/80">Your notes</p>
              <p className="translate-y-[5px] font-hand text-[20px] leading-[28px] text-pen">series B closed?? 32M</p>
              <p className="translate-y-[5px] font-hand text-[20px] leading-[28px] text-pen">120 seats by march</p>
            </div>
          </div>
        </div>

        {/* The words */}
        <div className="relative z-10 mx-auto max-w-[640px] px-5 pb-8 text-center xl:pt-[70px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/desk/icon.webp"
            alt=""
            loading="lazy"
            width={240}
            height={240}
            className="arrive relative z-10 mx-auto h-[76px] w-[76px] sm:h-[92px] sm:w-[92px]"
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
          <p className="arrive on-wood mx-auto mt-7 max-w-[540px] text-[20px] leading-[1.45] [--d:160ms] sm:text-[23px]">
            Type rough notes during the call. Footnote writes them up, and every line links to the moment it was said.
          </p>
          <CtaStrip className="arrive mt-9 [--d:240ms]" />
          <p className="arrive on-wood mt-5 text-[15.5px] [--d:300ms]">
            No account. Free with your own key.{" "}
            <Link href="/app" data-page-turn className="underline decoration-current/40 underline-offset-4 hover:decoration-current">
              Open the app
            </Link>
          </p>
        </div>

        {/* Papers around the edges (desktop) */}
        <div className="pointer-events-none absolute inset-0 hidden xl:block [&>*]:pointer-events-auto">
          <div className="absolute left-[-10px] top-[40px] w-[220px] -rotate-[7deg] 2xl:left-[1%] 2xl:w-[228px]">
            <PrintPhoto src="/desk/photo-call.webp" caption="acme call, tues 10am" className="arrive [--d:120ms] [--r-from:-9deg]" eager />
          </div>
          <div className="absolute -left-10 top-[380px] w-[320px] rotate-[3deg] 2xl:left-[-1%] 2xl:w-[330px]">
            <div className="paper paper-index lift arrive rounded-[2px] pb-8 pl-[54px] pr-6 pt-[14px] [--d:200ms] [--r-from:7deg] [--rule-gap:32px] [--rule-top:44px]">
              <p className="smallcaps h-[30px] pt-[9px] text-pen/80">Your notes · 00:42</p>
              <ul className="translate-y-[6px] font-hand text-[23px] leading-[32px] text-pen">
                <li>acme renewal w/ Dana (ops)</li>
                <li>series B closed?? 32M</li>
                <li>40 → 120 seats by march</li>
                <li>CFO will push on price</li>
              </ul>
            </div>
          </div>
          <div className="absolute bottom-[40px] left-[12%] w-[190px] rotate-[5deg] 2xl:left-[15%]">
            <PrintPhoto src="/desk/photo-coffee.webp" caption="notes before the call" className="arrive [--d:520ms] [--r-from:10deg]" />
          </div>
          <HeroCards layout="desk" />
          <div className="absolute bottom-[40px] right-[27%] w-[176px] -rotate-[4deg] 2xl:right-[30%]">
            <div className="paper paper-butter lift arrive rounded-[1px] px-5 pb-6 pt-5 [--d:620ms] [--r-from:-10deg]">
              <p className="font-hand text-[24px] leading-[1.05] text-ink-2">thurs: send 2 pricing options + SOC 2</p>
            </div>
          </div>
        </div>

        {/* The printer, in the flow on smaller screens */}
        <div className="px-5 xl:hidden">
          <HeroCards layout="flow" />
        </div>
      </section>

      {/* The 30-second tour */}
      <section id="tour" className="relative scroll-mt-6 px-5 pb-24 pt-16 sm:px-8 lg:pb-28 xl:pt-6" aria-labelledby="tour-heading">
        <DeskHeading id="tour-heading" lede="Rough notes in, clean notes out, and every line proves itself.">
          See it in 30 seconds.
        </DeskHeading>
        <div className="reveal mx-auto mt-10 max-w-[1040px] lg:mt-12">
          <div className="paper lift rounded-[2px] p-2 sm:p-3">
            <video
              className="block aspect-video w-full rounded-[1px] bg-[#EFE9DE]"
              src="/tour.mp4"
              poster="/tour-poster.jpg"
              controls
              playsInline
              preload="metadata"
              aria-label="A 30-second tour of Footnote: a sample sales call, enhanced notes, and a footnote that plays the moment it came from"
            />
          </div>
          <p className="on-wood-2 mt-3 text-center text-[14px]">Sound on. The sample call uses AI-generated voices.</p>
        </div>
      </section>

      {/* How it works, shown rather than told */}
      <section id="how" className="relative scroll-mt-6 px-5 pb-28 pt-16 sm:px-8 lg:pb-32 xl:pt-4" aria-labelledby="how-heading">
        <DeskHeading id="how-heading" lede="Nothing to install. No bot joins the call.">
          You listen. Footnote keeps{" "}
          <Hand src="/desk/hand-record.webp" text="the record." width={760} height={192} className="-mb-[0.14em] h-[0.9em]" />
        </DeskHeading>
        <WriteBack />
        <ol className="mx-auto mt-20 grid max-w-[980px] gap-8 text-center sm:grid-cols-3 lg:mt-24">
          {[
            ["Type rough notes", "During the call. Fragments are fine."],
            ["Press Enhance", "One keystroke writes them up."],
            ["No receipt, no claim", "Every added line cites the moment it came from."],
          ].map(([t, d], i) => (
            <li key={t} className="reveal" style={{ ["--d" as string]: `${i * 100}ms` }}>
              <p className="on-wood font-serif text-[22px] font-medium leading-tight">{t}</p>
              <p className="on-wood-2 mx-auto mt-1 max-w-[260px] text-[16.5px] leading-snug">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* After the call */}
      <section className="relative px-5 pb-28 sm:px-8 lg:pb-32" aria-labelledby="after-heading">
        <DeskHeading id="after-heading" lede="Recipes and questions answer from the transcript, with receipts.">
          Ask it like a colleague who was there.
        </DeskHeading>
        <div className="mx-auto mt-14 grid max-w-[1160px] items-start gap-8 md:grid-cols-3 lg:mt-16">
          {EXTRAS.map((x, i) => (
            <div key={x.title} className="reveal" style={{ ["--d" as string]: `${i * 110}ms` }}>
              <div className={cx(x.stock, x.tilt, "lift rounded-[2px] px-7 pb-7 pt-6")}>
                <p className="smallcaps text-muted">{x.label}</p>
                <h3 className="mt-2 font-serif text-[25px] font-medium leading-tight tracking-[-0.01em]">{x.title}</h3>
                <p className="mt-2 text-[16.5px] leading-[1.5] text-ink-2">{x.body}</p>
                <p className="mt-5 border-t border-ink/10 pt-4 font-serif text-[16px] italic leading-snug text-ink-2">
                  {x.example}
                  {x.cites.map((c) => (
                    <HearMark key={c.n} {...c} />
                  ))}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Comparison */}
      <section className="relative px-5 pb-28 sm:px-8 lg:pb-32" aria-labelledby="compare-heading">
        <DeskHeading id="compare-heading" lede="Footnote vs Granola, line by line.">
          The same job, without the subscription.
        </DeskHeading>
        <div className="reveal mx-auto mt-12 max-w-[920px] lg:mt-14">
          <div className="paper paper-cream rounded-[2px] px-3 py-3 sm:px-6 sm:py-5">
            <table className="hidden w-full border-collapse text-left sm:table">
              <caption className="sr-only">Comparison of Granola and Footnote</caption>
              <thead>
                <tr className="border-b border-ink/25">
                  <th scope="col" className="w-[36%] px-4 pb-3 pt-2">
                    <span className="sr-only">Feature</span>
                  </th>
                  <th scope="col" className="px-4 pb-3 pt-2">
                    <Wordmark size={20} />
                  </th>
                  <th scope="col" className="smallcaps px-4 pb-3 pt-2 text-muted">
                    Granola
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARE.map((row) => (
                  <tr key={row.label} className="border-b border-rule last:border-0">
                    <th scope="row" className="px-4 py-3 align-top font-serif text-[16px] font-medium text-ink">
                      {row.label}
                    </th>
                    <td className="px-4 py-3 align-top text-[16px] text-ink">{row.footnote}</td>
                    <td className="px-4 py-3 align-top text-[16px] text-muted">{row.granola}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Phones: one row per feature, Footnote first. */}
            <dl className="divide-y divide-rule sm:hidden">
              {COMPARE.map((row) => (
                <div key={row.label} className="px-2 py-3">
                  <dt className="font-serif text-[16.5px] font-medium text-ink">{row.label}</dt>
                  <dd className="mt-1 grid grid-cols-[84px_1fr] gap-x-3 gap-y-0.5 text-[15.5px] leading-snug">
                    <span className="smallcaps pt-[3px] text-[9.5px] text-accent">Footnote</span>
                    <span className="text-ink">{row.footnote}</span>
                    <span className="smallcaps pt-[3px] text-[9.5px] text-muted">Granola</span>
                    <span className="text-muted">{row.granola}</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="px-3 pb-1 pt-3 text-[13px] italic text-muted sm:px-4">
              Granola is a great product and a trademark of its owners. Pricing as listed on their site for individuals.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="relative scroll-mt-6 px-5 pb-28 sm:px-8 lg:pb-32" aria-labelledby="pricing-heading">
        <DeskHeading id="pricing-heading" lede="Free for good with your own OpenAI key. Pro is for people who'd rather not manage one.">
          Free with your key. Or pay once.
        </DeskHeading>
        <div className="mx-auto mt-12 grid max-w-[820px] items-start gap-8 md:grid-cols-2 lg:mt-14">
          <PriceCard
            className="paper paper-cream -rotate-[0.8deg]"
            name="Open source"
            price="Free"
            suffix="with your key"
            note="Everything. You pay OpenAI about 10¢ a meeting."
            features={[
              "Enhance, recipes, Ask and tab transcription",
              hosted ? "No key yet? The sample, plus five enhancements a day on us" : "No key yet? The sample call works in full",
              "Your key stays in your browser, your meetings on your device",
              "Use it here or self-host it (MIT)",
            ]}
            cta={{ label: "Try a sample meeting", href: "/app?sample=1", primary: true }}
          />
          <PriceCard
            featured
            className="paper paper-white rotate-[0.6deg] md:mt-6"
            delay={110}
            name="Footnote Pro"
            price="$59"
            suffix="once"
            note="No key, no setup: the AI is included."
            features={[
              "1,000 enhancements and 20 hours of transcription a year",
              "Ask and one-click recipes included",
              "Priority updates, for good. No subscription",
            ]}
            cta={{ label: "Watch for it on GitHub", href: SITE.github, external: true, quiet: true }}
            fine="Checkout opens after The Build Games. Nothing is sold or charged today."
          />
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="relative scroll-mt-6 px-5 pb-28 sm:px-8 lg:pb-32" aria-labelledby="faq-heading">
        <DeskHeading id="faq-heading">Honest answers.</DeskHeading>
        <div className="mx-auto mt-12 max-w-[1100px] lg:mt-14">
          <Faq hosted={hosted} />
        </div>
      </section>

      {/* Closing */}
      <section className="relative mx-auto max-w-[1440px] px-5 pb-12 pt-6 sm:px-8 lg:pt-10" aria-labelledby="close-heading">
        <div className="reveal absolute left-[4%] top-[20px] hidden w-[200px] -rotate-[6deg] [--r-from:-10deg] lg:block xl:left-[9%]" aria-hidden>
          <PrintPhoto src="/desk/photo-room.webp" caption="room 4b, 2pm" />
        </div>
        <div className="reveal absolute right-[4%] top-[110px] hidden w-[190px] rotate-[5deg] [--d:150ms] [--r-from:9deg] lg:block xl:right-[9%]" aria-hidden>
          <PrintPhoto src="/desk/photo-board.webp" caption="launch plan, v3" />
        </div>
        <DeskHeading id="close-heading" lede="No account, no key, nothing to install.">
          Hear a call. Watch the notes cite it.
        </DeskHeading>
        <div className="reveal [--d:120ms]">
          <CtaStrip className="mt-10" />
        </div>
      </section>

      <footer className="relative px-5 pb-10 pt-16 text-center sm:px-8">
        <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3" aria-label="Footer">
          {[
            ["#how", "How it works"],
            ["#pricing", "Pricing"],
            ["#faq", "FAQ"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="smallcaps on-wood-2 rounded-sm hover:underline">
              {label}
            </a>
          ))}
          <a href={SITE.github} target="_blank" rel="noreferrer" className="smallcaps on-wood-2 rounded-sm hover:underline">
            GitHub
          </a>
        </nav>
        <p className="on-wood-2 mt-6 text-[15px]">© 2026 Footnote · Built for The Build Games 2026 · Local-first, open source (MIT)</p>
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
  /** The one working next step is inked; a plan you can't buy yet is a quiet link. */
  cta: { label: string; href: string; external?: boolean; primary?: boolean; quiet?: boolean };
  featured?: boolean;
  fine?: string;
  className?: string;
  delay?: number;
}) {
  const cls = cta.quiet
    ? "mt-8 inline-flex items-center gap-1.5 rounded-sm font-serif text-[17px] italic text-ink-2 underline decoration-current/35 underline-offset-4 hover:text-ink hover:decoration-current"
    : cx("pill mt-8 h-12 w-full px-4 text-[11.5px]", cta.primary && "pill-ink");
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
              {cta.quiet && <span aria-hidden>&rarr;</span>}
            </a>
          ) : (
            <Link href={cta.href} data-page-turn className={cls}>
              {cta.label}
            </Link>
          )}
          {fine && <p className="mt-3 text-[13px] italic leading-snug text-muted">{fine}</p>}
        </div>
      </div>
    </div>
  );
}
