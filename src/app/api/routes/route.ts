import { connection, type NextRequest } from "next/server";
import { isApiError } from "@/apis/errors";
import { getRoutePlan } from "@/apis/live/plan.server";
import type { LiveErrorResponse, RoutePlan } from "@/apis/live/types";
import { parseRoutePair, readFailFlag } from "@/utils/routeQuery";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  await connection();
  const params = request.nextUrl.searchParams;
  const pair = parseRoutePair(params);
  if (!pair) {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "from and to must be lat,lng" } } satisfies LiveErrorResponse,
      { status: 400, headers: NO_STORE },
    );
  }
  if (readFailFlag(params) === "routes") {
    return Response.json(
      { error: { code: "FORCED", message: "forced failure (?fail=routes)" } } satisfies LiveErrorResponse,
      { status: 502, headers: NO_STORE },
    );
  }

  try {
    const plan = await getRoutePlan(pair.origin, pair.destination);
    return Response.json(plan satisfies RoutePlan, { headers: NO_STORE });
  } catch (error) {
    if (!isApiError(error)) throw error;
    return Response.json(
      { error: { code: error.code, message: `route search failed (${error.source})` } } satisfies LiveErrorResponse,
      { status: 502, headers: NO_STORE },
    );
  }
}
