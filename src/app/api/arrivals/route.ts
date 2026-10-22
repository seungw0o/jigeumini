import { connection, type NextRequest } from "next/server";
import { getArrivalsForStops, validStopIds } from "@/apis/live/arrivals.server";
import type { ArrivalsResponse, LiveErrorResponse } from "@/apis/live/types";
import { readFailFlag } from "@/utils/routeQuery";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  await connection();
  const params = request.nextUrl.searchParams;
  const ids = validStopIds((params.get("stops") ?? "").split(","));
  if (ids.length === 0) {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "stops must list 7-digit stop ids" } } satisfies LiveErrorResponse,
      { status: 400, headers: NO_STORE },
    );
  }

  const body = await getArrivalsForStops(ids, { forceFail: readFailFlag(params) === "arrivals" });
  return Response.json(body satisfies ArrivalsResponse, { headers: NO_STORE });
}
