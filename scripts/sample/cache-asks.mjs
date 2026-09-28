// Pre-computes answers for the sample call's one-click recipes and the suggested
// "Ask your meetings" questions, so a server with no OpenAI key can still show them
// (labeled "cached demo"). Cites keep their receipts: "sample:s4", "ex_standup:s3".
//
//   npm run dev   (with OPENAI_API_KEY set)
//   node scripts/sample/cache-asks.mjs [http://localhost:3000]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sampleDir = join(here, "..", "..", "src", "lib", "sample");
const base = process.argv[2] || "http://localhost:3000";
const read = (f) => JSON.parse(readFileSync(join(sampleDir, f), "utf8"));
const transcript = read("transcript.json");
const notes = read("notes.json")
  .map((n) => n.text)
  .join("\n");
const examples = read("examples.json");
// Keep in step with RECIPES (src/lib/ask.ts) and the suggestions in AskAllDialog.
const RECIPE_IDS = ["follow-up", "actions", "open-questions"];
const EXAMPLE_QUESTIONS = ["What did I promise people?", "Where does the Acme deal stand?", "Who is blocked, and on what?"];

const wire = (segments) => segments.map(({ id, speaker, label, t, text }) => ({ id, speaker, label, t: Math.round(t), text }));

async function ask(body) {
  const res = await fetch(`${base}/api/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  return (await res.json()).sentences;
}

// Optional filter: node cache-asks.mjs <base> follow-up "Where does the Acme deal stand?"
const only = new Set(process.argv.slice(3));
const want = (k) => only.size === 0 || only.has(k);
let previous = { recipes: {}, askAll: [] };
try {
  previous = read("cached-asks.json");
} catch {
  /* first run */
}
const out = { recipes: { ...previous.recipes }, askAll: [...previous.askAll] };

for (const recipe of RECIPE_IDS.filter(want)) {
  out.recipes[recipe] = await ask({
    question: recipe,
    recipe,
    userNotes: notes,
    transcriptSegments: wire(transcript.segments),
  });
  console.log(recipe, JSON.stringify(out.recipes[recipe], null, 1));
}

const meetings = [
  { ref: "m1", key: "sample", title: transcript.title, notes, segments: transcript.segments },
  ...examples.map((e, i) => ({ ref: `m${i + 2}`, key: `ex_${e.key}`, title: e.title, notes: e.notes, segments: e.segments })),
];
const refToKey = new Map(meetings.map((m) => [m.ref, m.key]));

for (const question of EXAMPLE_QUESTIONS.filter(want)) {
  const sentences = await ask({
    question,
    userNotes: "",
    meetings: meetings.map(({ ref, title, notes }) => ({ ref, title, date: "recent", notes })),
    transcriptSegments: meetings.flatMap((m) => wire(m.segments).map((s) => ({ ...s, id: `${m.ref}:${s.id}` }))),
  });
  const mapped = sentences.map((s) => ({
    ...s,
    cites: s.cites.map((c) => {
      const [ref, sid] = c.split(":");
      return `${refToKey.get(ref)}:${sid}`;
    }),
  }));
  out.askAll = [...out.askAll.filter((a) => a.question !== question), { question, sentences: mapped }].sort(
    (a, b) => EXAMPLE_QUESTIONS.indexOf(a.question) - EXAMPLE_QUESTIONS.indexOf(b.question),
  );
  console.log(question, JSON.stringify(mapped, null, 1));
}

writeFileSync(join(sampleDir, "cached-asks.json"), JSON.stringify(out, null, 2) + "\n");
