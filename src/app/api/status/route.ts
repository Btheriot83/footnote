import { timingSafeEqual } from "node:crypto";
import { LIMITS, readAllowance, remaining } from "@/lib/server/allowance";
import { hostedBudgetAvailable, snapshot } from "@/lib/server/budget";
import { hasServerKey, USER_KEY_HEADER } from "@/lib/server/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdmin(req: Request): boolean {
  // Trimmed: the stored secret carries a trailing newline.
  const secret = process.env.FOOTNOTE_SECRET?.trim();
  const given = req.headers.get("x-footnote-admin")?.trim();
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const noStore = { "Cache-Control": "no-store" };

  // Owner-only spend check: GET /api/status?budget=1 with header x-footnote-admin: $FOOTNOTE_SECRET.
  if (new URL(req.url).searchParams.has("budget")) {
    if (!isAdmin(req)) return Response.json({ error: "not_found" }, { status: 404, headers: noStore });
    const s = await snapshot();
    return Response.json(s ?? { error: "budget_unreadable" }, { status: s ? 200 : 503, headers: noStore });
  }

  const a = readAllowance(req);
  // The hosted key is only offered while the global budget has room (fails closed).
  const hostedAvailable = hasServerKey() && (await hostedBudgetAvailable());
  return Response.json(
    {
      hosted: hostedAvailable,
      hostedAvailable,
      userKey: Boolean(req.headers.get(USER_KEY_HEADER)),
      limits: {
        enhances: LIMITS.enhances,
        asks: LIMITS.asks,
        transcribeMinutes: Math.round(LIMITS.transcribeSeconds / 60),
      },
      remaining: remaining(a),
    },
    { headers: noStore },
  );
}
