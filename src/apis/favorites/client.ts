import type { User } from "firebase/auth";
import type { Place } from "@/utils/types";

type FavoritePlace = Omit<Place, "distanceM"> & { createdAt: string };

export class FavoritesError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string) {
    super(`favorites ${status}: ${code}`);
    this.name = "FavoritesError";
    this.status = status;
    this.code = code;
  }
}

const baseUrl = () => process.env.NEXT_PUBLIC_COLLECTOR_URL;

// 워커 주소가 설정돼 있을 때만 즐겨찾기를 쓸 수 있다
export function favoritesEnabled(): boolean {
  return Boolean(baseUrl());
}

async function send(user: User, path: string, init: RequestInit, forceRefresh: boolean): Promise<Response> {
  const token = await user.getIdToken(forceRefresh);
  try {
    return await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new FavoritesError(0, "network");
  }
}

// 401이면 토큰을 강제 갱신해 한 번만 재시도한다
async function request(user: User, path: string, init: RequestInit = {}): Promise<Response> {
  let res = await send(user, path, init, false);
  if (res.status === 401) res = await send(user, path, init, true);
  return res;
}

async function failure(res: Response): Promise<FavoritesError> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return new FavoritesError(res.status, body?.error ?? `http_${res.status}`);
}

// 서버 응답의 createdAt은 버린다
function toPlace({ id, name, address, category, position }: FavoritePlace): Place {
  return { id, name, address, category, position };
}

export async function listFavorites(user: User): Promise<Place[]> {
  const res = await request(user, "/favorites");
  if (!res.ok) throw await failure(res);
  const body = (await res.json()) as { favorites: FavoritePlace[] };
  return body.favorites.map(toPlace);
}

export async function putFavorite(user: User, place: Place): Promise<Place> {
  const { name, address, category, position } = place;
  const res = await request(user, `/favorites/${encodeURIComponent(place.id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, address, category, position }),
  });
  if (!res.ok) throw await failure(res);
  const body = (await res.json()) as { favorite: FavoritePlace };
  return toPlace(body.favorite);
}

// 404는 이미 지워진 것이므로 성공으로 본다
export async function deleteFavorite(user: User, placeId: string): Promise<void> {
  const res = await request(user, `/favorites/${encodeURIComponent(placeId)}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) throw await failure(res);
}
