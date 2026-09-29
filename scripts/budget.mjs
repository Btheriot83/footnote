// Reads or resets the hosted-key spend counter (the Vercel Blob document behind src/lib/server/budget.ts).
//
//   vercel env pull .env.budget --environment=production --yes
//   node --env-file=.env.budget scripts/budget.mjs show
//   node --env-file=.env.budget scripts/budget.mjs reset      # spentCents back to 0
//   rm .env.budget
//
// The cap itself is FOOTNOTE_HOSTED_BUDGET_CENTS (default 900) in Vercel env; change it and redeploy.
import { del, get } from "@vercel/blob";

const PATHNAME = process.env.BUDGET_DOC || "footnote-budget/budget.json"; // production counter
const cmd = process.argv[2] || "show";
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN is not set (see the header of this file).");
  process.exit(1);
}

if (cmd === "show") {
  const res = await get(PATHNAME, { access: "private", useCache: false });
  if (!res) {
    console.log("No spend recorded yet (document not created).");
  } else {
    const doc = JSON.parse(await new Response(res.stream).text());
    const reserved = Object.values(doc.reservations || {}).reduce((s, r) => s + r.cents, 0);
    console.log(`spent:    ${doc.spentCents.toFixed(2)}¢  ($${(doc.spentCents / 100).toFixed(2)})`);
    console.log(`reserved: ${reserved.toFixed(2)}¢ in ${Object.keys(doc.reservations || {}).length} in-flight call(s)`);
    console.log("recent charges:");
    for (const l of (doc.log || []).slice(-15)) console.log(`  ${new Date(l.at).toISOString()}  ${l.kind.padEnd(10)} ${l.cents.toFixed(2)}¢`);
  }
} else if (cmd === "reset") {
  // Deleting the document resets to zero; the next hosted call recreates it.
  await del(PATHNAME);
  console.log("Reset: spend counter deleted (starts again at 0).");
} else {
  console.error("Usage: scripts/budget.mjs show|reset");
  process.exit(1);
}
