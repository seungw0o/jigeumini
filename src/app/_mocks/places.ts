import type { LatLng, Place } from "@/utils/types";

export const DAEJEON_CENTER: LatLng = { lat: 36.3622, lng: 127.3712 };

export const mockCurrentPosition: LatLng = { lat: 36.3858, lng: 127.3594 };

export const mockPlaces: Place[] = [
  {
    id: "p-daedeok-univ",
    name: "대덕대학교",
    address: "대전 유성구 가정북로 68",
    category: "대학교",
    position: { lat: 36.3861, lng: 127.3611 },
    distanceM: 180,
  },
  {
    id: "p-galleria",
    name: "갤러리아타임월드",
    address: "대전 서구 대덕대로 211",
    category: "백화점",
    position: { lat: 36.3519, lng: 127.3784 },
    distanceM: 4300,
  },
  {
    id: "p-gov-complex",
    name: "정부대전청사",
    address: "대전 서구 청사로 189",
    category: "공공기관",
    position: { lat: 36.3587, lng: 127.3846 },
    distanceM: 3700,
  },
  {
    id: "p-daejeon-station",
    name: "대전역",
    address: "대전 동구 중앙로 215",
    category: "기차역",
    position: { lat: 36.3324, lng: 127.4342 },
    distanceM: 9100,
  },
  {
    id: "p-city-hall",
    name: "대전광역시청",
    address: "대전 서구 둔산로 100",
    category: "시청",
    position: { lat: 36.3504, lng: 127.3848 },
    distanceM: 4500,
  },
  {
    id: "p-yuseong-spa",
    name: "유성온천역",
    address: "대전 유성구 온천로 지하 81",
    category: "지하철역",
    position: { lat: 36.3536, lng: 127.3418 },
    distanceM: 3900,
  },
  {
    id: "p-cnu",
    name: "충남대학교",
    address: "대전 유성구 대학로 99",
    category: "대학교",
    position: { lat: 36.3685, lng: 127.3459 },
    distanceM: 2400,
  },
  {
    id: "p-expo",
    name: "엑스포과학공원",
    address: "대전 유성구 대덕대로 480",
    category: "공원",
    position: { lat: 36.3757, lng: 127.3867 },
    distanceM: 2900,
  },
];

export const mockRecentSearches: Place[] = [mockPlaces[1], mockPlaces[3], mockPlaces[6]];

export function searchPlaces(query: string): Place[] {
  const q = query.trim();
  if (!q) return [];
  return mockPlaces.filter(
    (p) => p.name.includes(q) || p.address.includes(q) || p.category.includes(q),
  );
}

export function getPlaceById(id: string): Place | undefined {
  return mockPlaces.find((p) => p.id === id);
}
