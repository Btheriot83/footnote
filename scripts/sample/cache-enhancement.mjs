// Pre-computes the sample meeting's enhancement for its default notes, so the
// demo still works on a server with no OpenAI key ("cached demo").
//
//   npm run dev   (with OPENAI_API_KEY set)
//   node scripts/sample/cache-enhancement.mjs [http://localhost:3000]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const sampleDir = join(here, "..", "..", "src", "lib", "sample");
const base = process.argv[2] || "http://localhost:3000";
const transcript = JSON.parse(readFileSync(join(sampleDir, "transcript.json"), "utf8"));
const notes = JSON.parse(readFileSync(join(sampleDir, "notes.json"), "utf8"));

const res = await fetch(`${base}/api/enhance`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    template: "sales",
    title: transcript.title,
    userNotes: notes.map((n) => n.text).join("\n"),
    transcriptSegments: transcript.segments.map(({ id, speaker, label, t, text }) => ({ id, speaker, label, t, text })),
  }),
});
if (!res.ok) {
  console.error(res.status, await res.text());
  process.exit(1);
}
let final = null;
for (const line of (await res.text()).split("\n")) {
  if (!line.trim()) continue;
  const msg = JSON.parse(line);
  if (msg.type === "final") final = msg;
  if (msg.type === "error") throw new Error(msg.message);
}
if (!final) throw new Error("No final result");
const out = { ...final.notes, title: transcript.title };
writeFileSync(join(sampleDir, "cached-enhancement.json"), JSON.stringify(out, null, 2) + "\n");
console.log("report:", final.report);
console.log(JSON.stringify(out, null, 2));
