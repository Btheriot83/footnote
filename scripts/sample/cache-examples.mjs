// Enhances the example meetings that seed a new user's history (src/lib/sample/examples.json),
// so they arrive with real, validated receipts and no API call at runtime.
//
//   npm run dev   (with OPENAI_API_KEY set)
//   node scripts/sample/cache-examples.mjs [http://localhost:3000]
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "..", "src", "lib", "sample", "examples.json");
const base = process.argv[2] || "http://localhost:3000";
const examples = JSON.parse(readFileSync(file, "utf8"));

for (const ex of examples) {
  const res = await fetch(`${base}/api/enhance`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template: ex.template, title: ex.title, userNotes: ex.notes, transcriptSegments: ex.segments }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  let final = null;
  for (const line of (await res.text()).split("\n")) {
    if (!line.trim()) continue;
    const msg = JSON.parse(line);
    if (msg.type === "final") final = msg;
    if (msg.type === "error") throw new Error(msg.message);
  }
  if (!final) throw new Error("No final result for " + ex.title);
  ex.enhanced = { ...final.notes, title: ex.title };
  console.log(ex.title, final.report);
}
writeFileSync(file, JSON.stringify(examples, null, 2) + "\n");
