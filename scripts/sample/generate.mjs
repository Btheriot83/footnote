// Generates the "Try a sample meeting" audio with OpenAI TTS (two voices)
// and a transcript with line-level timestamps.
//
//   OPENAI_API_KEY=sk-... node scripts/sample/generate.mjs
//
// Outputs:
//   public/sample/acme-renewal.mp3
//   src/lib/sample/transcript.json
// Requires ffmpeg + ffprobe on PATH.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const script = JSON.parse(readFileSync(join(here, "script.json"), "utf8"));
const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error("OPENAI_API_KEY is not set");
  process.exit(1);
}

const work = join(tmpdir(), "footnote-sample");
mkdirSync(work, { recursive: true });

const GAP_S = 0.38; // pause between speakers
const LEAD_S = 0.6; // silence before the first line
const SAMPLE_RATE = 24000;

function probeDuration(file) {
  const out = execFileSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file,
  ]).toString().trim();
  return parseFloat(out);
}

async function tts(line, i) {
  const wav = join(work, `line-${String(i).padStart(2, "0")}.wav`);
  if (existsSync(wav) && !process.argv.includes("--fresh")) return wav;
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini-tts",
      voice: script.speakers[line.speaker].voice,
      input: line.text,
      instructions: script.instructions[line.speaker],
      response_format: "wav",
    }),
  });
  if (!res.ok) throw new Error(`TTS failed (${res.status}): ${await res.text()}`);
  const raw = join(work, `raw-${i}.wav`);
  writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  // Normalize to mono 24k and trim leading/trailing silence.
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-i", raw,
    "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
    "-ac", "1", "-ar", String(SAMPLE_RATE), wav,
  ]);
  return wav;
}

const files = [];
for (let i = 0; i < script.lines.length; i++) {
  process.stdout.write(`line ${i + 1}/${script.lines.length}\r`);
  files.push(await tts(script.lines[i], i));
}

const silence = (s, name) => {
  const f = join(work, name);
  execFileSync("ffmpeg", [
    "-y", "-v", "error", "-f", "lavfi", "-i", `anullsrc=r=${SAMPLE_RATE}:cl=mono`,
    "-t", String(s), f,
  ]);
  return f;
};
const lead = silence(LEAD_S, "lead.wav");
const gap = silence(GAP_S, "gap.wav");

const segments = [];
const concatList = [`file '${lead}'`];
let cursor = LEAD_S;
files.forEach((f, i) => {
  const d = probeDuration(f);
  const line = script.lines[i];
  segments.push({
    id: `s${i + 1}`,
    speaker: line.speaker,
    label: script.speakers[line.speaker].label,
    t: Math.round(cursor * 1000),
    end: Math.round((cursor + d) * 1000),
    text: line.display ?? line.text,
  });
  concatList.push(`file '${f}'`);
  cursor += d;
  if (i < files.length - 1) {
    concatList.push(`file '${gap}'`);
    cursor += GAP_S;
  }
});
concatList.push(`file '${lead}'`);
cursor += LEAD_S;

const listFile = join(work, "list.txt");
writeFileSync(listFile, concatList.join("\n"));
const outMp3 = join(root, "public", "sample", "acme-renewal.mp3");
mkdirSync(dirname(outMp3), { recursive: true });
execFileSync("ffmpeg", [
  "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", listFile,
  "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "64k", outMp3,
]);

const transcript = {
  title: script.title,
  durationMs: Math.round(cursor * 1000),
  segments,
};
writeFileSync(
  join(root, "src", "lib", "sample", "transcript.json"),
  JSON.stringify(transcript, null, 2) + "\n",
);
console.log(`\nWrote ${outMp3} (${cursor.toFixed(1)}s) and transcript.json (${segments.length} lines)`);
