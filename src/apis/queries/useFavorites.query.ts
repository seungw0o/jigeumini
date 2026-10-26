import { deleteFavorite, favoritesEnabled, listFavorites, putFavorite } from "@/apis/favorites/client";
import { useAuth } from "@/components/AuthProvider";
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
    onError: (_error, _vars, context) => {
      queryClient.setQueryData(queryKey, context?.snapshot);
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
      mutation.mutate({ place, add: !favorites.some((p) => p.id === place.id) });
    },
    status,
  };
}
