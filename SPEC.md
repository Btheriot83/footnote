# Footnote: product spec (the asks)

**Footnote is a browser-based replacement for Granola** ($14/mo AI meeting notepad). It's our single entry in The Build Games (https://canivibecodeit.com/thebuildgames). Deadline: **Wed Sep 30 2026, 9pm Phoenix (midnight NY)**. Submission needs a public demo URL and a public GitHub repo.

It's judged in three independent categories:
- **Best Replacement**: "does it actually replace the paid product's core job, and would a real user switch?"
- **Most Creative**: "originality of the idea and of how it was built"
- **Most Polished**: "design, reliability, and completeness of the shipped thing"

The judges are Tony Dinh (TypingMind: bring your own key, sold as a one-time license), Dudu (Shotbase) and Andrej (TranscriptAPI). After the contest it has to be sellable: a $59 one-time license with your own key, and optionally a hosted plan later.

## Visual target (dream loop)
- `.dream-loop/target-landing.png`: the landing page.
- `.dream-loop/target-workspace.png`: the app workspace.
- Match the composition, typography, palette, spacing and feel. Ignore garbled filler words in the targets and write real copy.
- **Palette:** warm paper `#F7F5F0`, white paper for documents, near-black ink, warm grays, and a single accent, vermilion `#E0482B`, used **only** for footnote markers, the recording dot and source highlights.
- **Type:** a refined serif for headings and the wordmark (Source Serif 4 or Newsreader via next/font), and a clean sans (Inter) for UI.

## Core loop (the job Granola does)
1. **New meeting**: pick a template (General, 1:1, Sales call, Standup, Interview, User research), then start.
2. **Live transcript** in the right panel, labeled by speaker:
   - **"You" (mic):** the Web Speech API (free, Chrome/Edge/Safari), with interim results shown in gray.
   - **"Them" (a shared browser tab, e.g. Google Meet / Zoom web / Teams web):** `getDisplayMedia({audio:true})`, then MediaRecorder chunks of about 8–10s, POSTed to `/api/transcribe` (OpenAI `gpt-4o-mini-transcribe`). Keep the segments' timestamps relative to the meeting start.
   - A first-run explainer covers the honest limits: a browser can't hear the desktop Zoom app; use the web client or pick "Share tab audio".
   - Fallback: when Web Speech is unavailable, send mic chunks through `/api/transcribe` as well.
3. **Notepad** in the center: a plain, fast editor where the user types rough notes during the call (a markdown-ish bullet list is fine; keep it simple and reliable).
4. **Enhance notes**: POST `{template, userNotes, transcriptSegments[{id, speaker, t, text}]}` to `/api/enhance`.
   - Structured output (zod schema, AI SDK `streamObject`, stream it in): sections, then bullets, each `{text, origin: "you" | "ai", cites: segmentId[]}`.
   - The user's own points stay in **ink**, AI additions render in **warm gray**, and every AI bullet ends with vermilion superscript footnote numbers.
   - **Receipts:** hovering or clicking a footnote (or bullet) scrolls the transcript to the cited segment and highlights it (pale vermilion). Clicking a transcript line that's cited shows which bullets cite it.
   - The prompt must forbid claims without a citation. Validate on the server that cited ids exist, and drop invalid cites.
   - "Show my original notes" toggles back to the rough notes.
5. **History**: every meeting is stored locally in IndexedDB (Dexie): title, template, date, duration, notes, transcript, enhanced output. The sidebar lists meetings with search across titles, notes and transcript.
6. **Export / share**:
   - Copy as Markdown (with footnotes rendered as `[^n]` markdown footnotes quoting the transcript), Copy for Slack, Download .md.
   - **Share link:** a read-only page at `/s#<lz-string compressed JSON>`, so no server storage is needed.
7. **Ask** (stretch, only if time): a small "Ask this meeting" box that answers with citations the same way.

## Try a sample meeting (the wow feature; build it first)
- A landing-page button opens `/app?sample=1`, which plays a staged, realistic ~2-minute sales call:
  - A seller (the user) and "Dana from Acme" discuss a renewal, their Series B, seat count, a pricing objection, a security review, and next steps.
  - Audio is pre-generated with OpenAI TTS using two voices (script: `scripts/sample/`, output: `public/sample/`). Use a transcript with line-level timestamps.
- Playback reveals transcript lines in sync with the audio, exactly as a live meeting would look, with no transcription cost.
- Pre-filled rough notes appear as if typed. The judge can type too.
- A nudge then says "Now hit Enhance". Enhance runs live against the real transcript and notes.
- Everything must work with zero setup for a judge.

## Keys and cost
- **Settings:** the user can paste their own OpenAI API key (stored in localStorage, sent as `x-user-openai-key`). The server uses it when present.
- **Hosted allowance:** without a user key, the server uses `process.env.OPENAI_API_KEY`, with a per-visitor cap (signed cookie counter: about 5 enhances and about 10 transcription minutes per day), small max tokens, and friendly limit messages.
- If `OPENAI_API_KEY` is unset on the server and no user key is given, the UI explains this clearly instead of crashing. The sample meeting then falls back to a bundled pre-computed enhancement for its default notes, labeled "cached demo".
- Never log keys. Never persist user keys on the server.

## Pages
- `/`: the landing page (match `target-landing.png`). Sections: hero, "How it works" (3 steps), receipts explainer, a comparison vs Granola (price, local-first, bring your own key, open source), pricing ($59 once with your own key; hosted "coming soon"), FAQ (privacy, limits), footer with GitHub link.
- `/app`: the workspace (match `target-workspace.png`). Desktop is the priority; at phone width it must still work (sidebar becomes a drawer, transcript becomes a tab).
- `/s`: the read-only shared note.

## Quality bar
- **Stack:** Next.js (App Router, TypeScript), Tailwind, the Vercel AI SDK with `@ai-sdk/openai`, Dexie, zod. Deploys on Vercel.
- **States:** every empty, loading, error and permission-denied state is designed. Handle the case where no mic permission is granted.
- **Keyboard:** `⌘/Ctrl+Enter` enhances; `⌘K` searches.
- **No dead ends:** every button works.
- **Accessibility:** focus rings, labels, reduced motion.
- **Tests:** Playwright covers the sample-meeting flow end to end, with the enhance API mocked. Keep a few unit tests for the citation validation.
- **README:** a clean pitch with a GIF placeholder, the comparison, a self-host guide and the honest browser limits. No pipeline or process clutter in the repo.
- **Commits:** small and honest, with real timestamps. Never rewrite history.
