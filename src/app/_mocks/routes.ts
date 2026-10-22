import type { BusStop, RouteSearch, TransitRoute } from "@/utils/types";
import { mockPlaces } from "./places";

const stop = (id: string, name: string, arsId: string, lat: number, lng: number): BusStop => ({
  id,
  name,
  arsId,
  position: { lat, lng },
});

const DAEDEOK_UNIV = stop("s-43420", "대덕대학교", "43420", 36.3849, 127.3633);
const DAEDEOK_UNIV_GATE = stop("s-43410", "대덕대학교정문", "43410", 36.3866, 127.3622);
const DAEDEOK_HS = stop("s-43350", "대덕고등학교", "43350", 36.3792, 127.3712);
const DAEDEOK_HS_OPP = stop("s-43360", "대덕고등학교건너편", "43360", 36.3788, 127.3727);
const GOV_COMPLEX = stop("s-31130", "정부청사역", "31130", 36.3592, 127.3812);
const GALLERIA = stop("s-32120", "갤러리아타임월드", "32120", 36.3527, 127.3771);

const ORIGIN = mockPlaces[0];
const DEST = mockPlaces[1];

const routeA: TransitRoute = {
  id: "a",
  leaveAt: "09:58",
  leaveInMinutes: 10,
  arriveAt: "10:30",
  totalMinutes: 42,
  travelMinutes: 30,
  waitMinutes: 0,
  marginMinutes: 2,
  fare: 1500,
  transferCount: 0,
  legs: [
    { kind: "walk", minutes: 7, distanceM: 420, from: ORIGIN.name, to: DAEDEOK_UNIV.name },
    {
      kind: "bus",
      routeNo: "318",
      busType: "trunk",
      boardStop: DAEDEOK_UNIV,
      alightStop: GALLERIA,
      stopCount: 12,
      rideMinutes: 20,
      arrivals: [
        { routeNo: "318", busType: "trunk", status: { kind: "live", minutes: 19, stopsAway: 10 } },
        { routeNo: "318", busType: "trunk", status: { kind: "live", minutes: 30, stopsAway: 15 } },
      ],
      catchIndex: 0,
      waitMinutes: 0,
      boardAt: "10:07",
      alightAt: "10:27",
    },
    { kind: "walk", minutes: 3, distanceM: 190, from: GALLERIA.name, to: DEST.name },
  ],
  path: [
    [ORIGIN.position, DAEDEOK_UNIV.position],
    [DAEDEOK_UNIV.position, { lat: 36.3778, lng: 127.3741 }, { lat: 36.3655, lng: 127.3769 }, GALLERIA.position],
    [GALLERIA.position, DEST.position],
  ],
};

const routeB: TransitRoute = {
  id: "b",
  leaveAt: "09:58",
  leaveInMinutes: 10,
  arriveAt: "10:33",
  totalMinutes: 45,
  travelMinutes: 29,
  waitMinutes: 4,
  marginMinutes: 2,
  fare: 1500,
  transferCount: 1,
  quickTransferChance: 72,
  legs: [
    { kind: "walk", minutes: 7, distanceM: 420, from: ORIGIN.name, to: DAEDEOK_UNIV.name },
    {
      kind: "bus",
      routeNo: "318",
      busType: "trunk",
      boardStop: DAEDEOK_UNIV,
      alightStop: GOV_COMPLEX,
      stopCount: 8,
      rideMinutes: 13,
      arrivals: [
        { routeNo: "318", busType: "trunk", status: { kind: "live", minutes: 19, stopsAway: 10 } },
        { routeNo: "318", busType: "trunk", status: { kind: "live", minutes: 30, stopsAway: 15 } },
      ],
      catchIndex: 0,
      waitMinutes: 0,
      boardAt: "10:07",
      alightAt: "10:20",
    },
    { kind: "walk", minutes: 1, distanceM: 60, from: GOV_COMPLEX.name, to: GOV_COMPLEX.name },
    {
      kind: "bus",
      routeNo: "3",
      busType: "express",
      boardStop: GOV_COMPLEX,
      alightStop: GALLERIA,
      stopCount: 3,
      rideMinutes: 5,
      arrivals: [
        { routeNo: "3", busType: "express", status: { kind: "live", minutes: 37, stopsAway: 9 } },
        { routeNo: "3", busType: "express", status: { kind: "live", minutes: 52, stopsAway: 16 } },
      ],
      catchIndex: 0,
      waitMinutes: 4,
      boardAt: "10:25",
      alightAt: "10:30",
    },
    { kind: "walk", minutes: 3, distanceM: 190, from: GALLERIA.name, to: DEST.name },
  ],
  path: [
    [ORIGIN.position, DAEDEOK_UNIV.position],
    [DAEDEOK_UNIV.position, { lat: 36.3778, lng: 127.3741 }, { lat: 36.3668, lng: 127.3801 }, GOV_COMPLEX.position],
    [GOV_COMPLEX.position, GOV_COMPLEX.position],
    [GOV_COMPLEX.position, { lat: 36.3561, lng: 127.3796 }, GALLERIA.position],
    [GALLERIA.position, DEST.position],
  ],
};

const routeD: TransitRoute = {
  id: "d",
  leaveAt: "10:01",
  leaveInMinutes: 13,
  arriveAt: "10:39",
  totalMinutes: 51,
  travelMinutes: 32,
  waitMinutes: 7,
  marginMinutes: 2,
  fare: 1500,
  transferCount: 1,
  quickTransferChance: 41,
  legs: [
    { kind: "walk", minutes: 2, distanceM: 130, from: ORIGIN.name, to: DAEDEOK_UNIV_GATE.name },
    {
      kind: "bus",
      routeNo: "1",
      busType: "village",
      boardStop: DAEDEOK_UNIV_GATE,
      alightStop: DAEDEOK_HS,
      stopCount: 5,
      rideMinutes: 6,
      arrivals: [
        { routeNo: "1", busType: "village", status: { kind: "garage", departAt: "10:05" }, runLabel: "first" },
      ],
      catchIndex: 0,
      waitMinutes: 0,
      boardAt: "10:05",
      alightAt: "10:11",
    },
    { kind: "walk", minutes: 3, distanceM: 216, from: DAEDEOK_HS.name, to: DAEDEOK_HS_OPP.name },
    {
      kind: "bus",
      routeNo: "301",
      busType: "branch",
      boardStop: DAEDEOK_HS_OPP,
      alightStop: GALLERIA,
      stopCount: 11,
      rideMinutes: 18,
      arrivals: [
        { routeNo: "301", busType: "branch", status: { kind: "live", minutes: 30, stopsAway: 13 } },
        { routeNo: "301", busType: "branch", status: { kind: "live", minutes: 47, stopsAway: 21 } },
      ],
      catchIndex: 0,
      waitMinutes: 4,
      boardAt: "10:18",
      alightAt: "10:36",
    },
    { kind: "walk", minutes: 3, distanceM: 190, from: GALLERIA.name, to: DEST.name },
  ],
  path: [
    [ORIGIN.position, DAEDEOK_UNIV_GATE.position],
    [DAEDEOK_UNIV_GATE.position, { lat: 36.3835, lng: 127.3672 }, DAEDEOK_HS.position],
    [DAEDEOK_HS.position, DAEDEOK_HS_OPP.position],
    [DAEDEOK_HS_OPP.position, { lat: 36.3702, lng: 127.3758 }, { lat: 36.3601, lng: 127.3752 }, GALLERIA.position],
    [GALLERIA.position, DEST.position],
  ],
};

const routeC: TransitRoute = {
  id: "c",
  leaveAt: "10:01",
  leaveInMinutes: 13,
  arriveAt: "10:40",
  totalMinutes: 52,
  travelMinutes: 37,
  waitMinutes: 0,
  marginMinutes: 2,
  fare: 1500,
  transferCount: 0,
  legs: [
    { kind: "walk", minutes: 7, distanceM: 420, from: ORIGIN.name, to: DAEDEOK_UNIV.name },
    {
      kind: "bus",
      routeNo: "604",
      busType: "branch",
      boardStop: DAEDEOK_UNIV,
      alightStop: GALLERIA,
      stopCount: 17,
      rideMinutes: 26,
      arrivals: [
        { routeNo: "604", busType: "branch", status: { kind: "live", minutes: 4, stopsAway: 2 } },
        { routeNo: "604", busType: "branch", status: { kind: "live", minutes: 22, stopsAway: 11 } },
      ],
      catchIndex: 1,
      waitMinutes: 0,
      boardAt: "10:10",
      alightAt: "10:36",
    },
    { kind: "walk", minutes: 4, distanceM: 240, from: GALLERIA.name, to: DEST.name },
  ],
  path: [
    [ORIGIN.position, DAEDEOK_UNIV.position],
    [DAEDEOK_UNIV.position, { lat: 36.3741, lng: 127.3592 }, { lat: 36.3612, lng: 127.3688 }, GALLERIA.position],
    [GALLERIA.position, DEST.position],
  ],
};

export const mockRouteSearch: RouteSearch = {
  origin: ORIGIN,
  destination: DEST,
  baseTime: "09:48",
  updatedSecondsAgo: 12,
  routes: [routeA, routeB, routeD, routeC],
};

export const mockEmptyRouteSearch: RouteSearch = { ...mockRouteSearch, routes: [] };

export const mockRouteIds = mockRouteSearch.routes.map((r) => r.id);

export function getRouteById(id: string): TransitRoute | undefined {
  return mockRouteSearch.routes.find((r) => r.id === id);
}
