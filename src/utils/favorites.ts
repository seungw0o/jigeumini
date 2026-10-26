// 워커 workers/collector/src/favorites.ts FAVORITES_LIMIT와 같은 값
export const FAVORITES_LIMIT = 50;
export const FAVORITES_FULL_MESSAGE = `즐겨찾기는 ${FAVORITES_LIMIT}곳까지 저장할 수 있어요`;

export type FavoriteToggle = "add" | "remove" | "full";

export function favoriteToggle(favorites: readonly { id: string }[], placeId: string): FavoriteToggle {
  if (favorites.some((p) => p.id === placeId)) return "remove";
  return favorites.length >= FAVORITES_LIMIT ? "full" : "add";
}
