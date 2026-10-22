import { connection, type NextRequest } from "next/server";
import { isApiError } from "@/apis/errors";
import { searchPlaces } from "@/apis/kakao/kakao.server";
import type { LiveErrorResponse, PlacesResponse } from "@/apis/live/types";
import { parseCoord } from "@/utils/routeQuery";

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  await connection();
  const params = request.nextUrl.searchParams;
  const q = params.get("q")?.trim() ?? "";
  if (q.length < 1 || q.length > 50) {
    return Response.json(
      { error: { code: "BAD_REQUEST", message: "q must be 1-50 characters" } } satisfies LiveErrorResponse,
      { status: 400, headers: NO_STORE },
    );
  }

  const near = parseCoord(`${params.get("lat") ?? ""},${params.get("lng") ?? ""}`);
  try {
    const result = await searchPlaces(q, near ? { near, radiusM: 20000, size: 10 } : { size: 10 });
    return Response.json({ places: result.places } satisfies PlacesResponse, { headers: NO_STORE });
  } catch (error) {
    if (!isApiError(error)) throw error;
    return Response.json(
      { error: { code: error.code, message: "place search failed" } } satisfies LiveErrorResponse,
      { status: 502, headers: NO_STORE },
    );
  }
}
