import { LIMITS, readAllowance, remaining } from "@/lib/server/allowance";
import { hasServerKey, USER_KEY_HEADER } from "@/lib/server/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const a = readAllowance(req);
  return Response.json(
    {
      hosted: hasServerKey(),
      userKey: Boolean(req.headers.get(USER_KEY_HEADER)),
      limits: {
        enhances: LIMITS.enhances,
        asks: LIMITS.asks,
        transcribeMinutes: Math.round(LIMITS.transcribeSeconds / 60),
      },
      remaining: remaining(a),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
