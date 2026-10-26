import { deleteFavorite, favoritesEnabled, listFavorites, putFavorite } from "@/apis/favorites/client";
import { useAuth } from "@/components/AuthProvider";
import { showToast } from "@/components/Toast";
import { FAVORITES_FULL_MESSAGE, favoriteToggle } from "@/utils/favorites";
import type { Place } from "@/utils/types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type FavoritesStatus = "disabled" | "loading" | "ready" | "error";

export function useFavorites(): {
  favorites: Place[];
  isFavorite: (placeId: string) => boolean;
  toggleFavorite: (place: Place) => void;
  status: FavoritesStatus;
} {
  const auth = useAuth();
  const queryClient = useQueryClient();
  const user = auth.user;
  const uid = user?.uid;
  const enabled = auth.status === "signedIn" && favoritesEnabled();
  const queryKey = ["favorites", uid];

  const query = useQuery({
    queryKey,
    queryFn: () => listFavorites(user!),
    enabled,
  });

  const mutation = useMutation({
    mutationFn: async ({ place, add }: { place: Place; add: boolean }) => {
      if (add) await putFavorite(user!, place);
      else await deleteFavorite(user!, place.id);
    },
    // 낙관적 업데이트: 서버 순서(최신순)에 맞춰 앞에 추가한다
    onMutate: async ({ place, add }) => {
      await queryClient.cancelQueries({ queryKey });
      const snapshot = queryClient.getQueryData<Place[]>(queryKey);
      queryClient.setQueryData<Place[]>(queryKey, (old = []) => {
        const rest = old.filter((p) => p.id !== place.id);
        if (!add) return rest;
        const { id, name, address, category, position } = place;
        return [{ id, name, address, category, position }, ...rest];
      });
      return { snapshot };
    },
    onError: (error, { add }, context) => {
      // 목록을 한 번도 못 받았으면 snapshot이 undefined다. setQueryData(undefined)는 무시되므로 빈 목록으로 되돌린다
      queryClient.setQueryData<Place[]>(queryKey, context?.snapshot ?? []);
      console.error("favorite update failed:", error instanceof Error ? error.message : error);
      // 다른 기기에서 채운 목록이라 서버가 409로 막은 경우
      const full = add && (error as { status?: number }).status === 409;
      showToast(full ? FAVORITES_FULL_MESSAGE : add ? "즐겨찾기를 저장하지 못했어요" : "즐겨찾기에서 지우지 못했어요");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  const favorites = query.data ?? [];

  let status: FavoritesStatus;
  if (auth.status === "error" || !favoritesEnabled()) status = "disabled";
  else if (auth.status === "loading" || query.isPending) status = "loading";
  else if (query.isError) status = "error";
  else status = "ready";

  return {
    favorites,
    isFavorite: (placeId) => favorites.some((p) => p.id === placeId),
    toggleFavorite: (place) => {
      if (!enabled || place.id === "current") return;
      const action = favoriteToggle(favorites, place.id);
      if (action === "full") {
        showToast(FAVORITES_FULL_MESSAGE);
        return;
      }
      mutation.mutate({ place, add: action === "add" });
    },
    status,
  };
}
