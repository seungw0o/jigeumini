import { authenticate, type VerifyOptions } from "./auth";
import { json } from "./json";

export const FAVORITES_LIMIT = 50;
export const MAX_BODY_BYTES = 2048;

export type FavoritePlace = {
  id: string;
  name: string;
  address: string;
  category: string;
  position: { lat: number; lng: number };
  createdAt: string;
};

type FavoriteRow = {
  place_id: string;
  name: string;
  address: string;
  category: string;
  lat: number;
  lng: number;
  created_at: string;
};

type FavoriteInput = { name: string; address: string; category: string; lat: number; lng: number };

const PLACE_ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const COLUMNS = "place_id, name, address, category, lat, lng, created_at";

const toPlace = (row: FavoriteRow): FavoritePlace => ({
  id: row.place_id,
  name: row.name,
  address: row.address,
  category: row.category,
  position: { lat: row.lat, lng: row.lng },
  createdAt: row.created_at,
});

function parsePlaceId(segment: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(segment);
  } catch {
    return null;
  }
  return PLACE_ID_RE.test(decoded) ? decoded : null;
}

const isFiniteIn = (value: unknown, limit: number): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= -limit && value <= limit;

// 모르는 키는 무시하고 필요한 필드만 검사한다
function parseInput(body: unknown): FavoriteInput | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  const { name, address, category, position } = body as Record<string, unknown>;
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return null;
  if (typeof address !== "string" || address.length > 200) return null;
  if (typeof category !== "string" || category.length > 50) return null;
  if (typeof position !== "object" || position === null) return null;
  const { lat, lng } = position as Record<string, unknown>;
  if (!isFiniteIn(lat, 90) || !isFiniteIn(lng, 180)) return null;
  return { name: trimmed, address, category, lat, lng };
}

async function readBody(request: Request): Promise<{ ok: true; text: string } | { ok: false; response: Response }> {
  const tooLarge = () => ({ ok: false as const, response: json({ error: "body too large" }, 413) });
  const length = request.headers.get("Content-Length");
  // 선언된 길이가 크면 본문을 읽지 않는다
  if (length !== null && Number(length) > MAX_BODY_BYTES) return tooLarge();
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) return tooLarge();
  return { ok: true, text };
}

async function listFavorites(db: D1Database, uid: string): Promise<Response> {
  const { results } = await db
    .prepare(`SELECT ${COLUMNS} FROM favorites WHERE uid = ? ORDER BY created_at DESC, place_id ASC`)
    .bind(uid)
    .all<FavoriteRow>();
  return json({ favorites: results.map(toPlace) });
}

async function putFavorite(
  request: Request,
  db: D1Database,
  uid: string,
  placeId: string,
  now: Date,
): Promise<Response> {
  const body = await readBody(request);
  if (!body.ok) return body.response;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const input = parseInput(parsed);
  if (input === null) return json({ error: "invalid body" }, 400);

  // 한도 검사와 upsert를 한 문장으로 해 동시 요청에도 한도를 넘지 않는다. 기존 created_at은 유지한다
  const result = await db
    .prepare(
      `INSERT INTO favorites (uid, ${COLUMNS})
       SELECT ?, ?, ?, ?, ?, ?, ?, ?
       WHERE (SELECT COUNT(*) FROM favorites WHERE uid = ?) < ?
          OR EXISTS (SELECT 1 FROM favorites WHERE uid = ? AND place_id = ?)
       ON CONFLICT(uid, place_id) DO UPDATE SET
         name = excluded.name,
         address = excluded.address,
         category = excluded.category,
         lat = excluded.lat,
         lng = excluded.lng`,
    )
    .bind(
      uid,
      placeId,
      input.name,
      input.address,
      input.category,
      input.lat,
      input.lng,
      now.toISOString(),
      uid,
      FAVORITES_LIMIT,
      uid,
      placeId,
    )
    .run();
  if (result.meta.changes === 0) return json({ error: "favorites limit reached", limit: FAVORITES_LIMIT }, 409);

  const row = await db
    .prepare(`SELECT ${COLUMNS} FROM favorites WHERE uid = ? AND place_id = ?`)
    .bind(uid, placeId)
    .first<FavoriteRow>();
  if (row === null) throw new Error("favorite missing after upsert");
  return json({ favorite: toPlace(row) });
}

async function deleteFavorite(db: D1Database, uid: string, placeId: string): Promise<Response> {
  const result = await db.prepare("DELETE FROM favorites WHERE uid = ? AND place_id = ?").bind(uid, placeId).run();
  if (result.meta.changes === 0) return json({ error: "not found" }, 404);
  return new Response(null, { status: 204 });
}

export async function handleFavorites(
  request: Request,
  db: D1Database,
  projectIds: readonly string[],
  options?: VerifyOptions,
): Promise<Response> {
  const { pathname } = new URL(request.url);
  const isCollection = pathname === "/favorites";
  let segment = "";
  if (!isCollection) {
    if (!pathname.startsWith("/favorites/")) return json({ error: "not found" }, 404);
    segment = pathname.slice("/favorites/".length);
    if (segment.includes("/")) return json({ error: "not found" }, 404);
  }

  const allowed = isCollection ? ["GET"] : ["PUT", "DELETE"];
  if (!allowed.includes(request.method)) return json({ error: "method not allowed" }, 405);

  let auth;
  try {
    auth = await authenticate(request, projectIds, options);
  } catch (err) {
    // 토큰이나 헤더가 섞이지 않도록 메시지만 기록한다
    console.error("auth key fetch failed:", err instanceof Error ? err.message : "unknown");
    return json({ error: "auth unavailable" }, 503);
  }
  if (!auth.ok) {
    const res = json({ error: auth.reason }, 401);
    res.headers.set("WWW-Authenticate", "Bearer");
    return res;
  }

  if (isCollection) return listFavorites(db, auth.uid);

  const placeId = parsePlaceId(segment);
  if (placeId === null) return json({ error: "invalid place id" }, 400);
  if (request.method === "PUT") return putFavorite(request, db, auth.uid, placeId, options?.now ?? new Date());
  return deleteFavorite(db, auth.uid, placeId);
}
