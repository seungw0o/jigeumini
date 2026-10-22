import { getArrivalsByArs, getArrivalsByStopId, getBusPositions } from "../src/apis/daejeon/daejeon.server";
import { isApiError } from "../src/apis/errors";
import { searchPlaces, getTransitRoutes, getWalkRoute } from "../src/apis/kakao/kakao.server";
import { boardingTargetOf, matchStop } from "../src/apis/matching";
import { toDaejeonNodeId, toDaejeonRouteCd } from "../src/apis/tago/ids";
import { findNearbyStops, getRoutesThroughStop, searchStopsByName } from "../src/apis/tago/tago.server";

const ORIGIN = { lat: 36.39007, lng: 127.362274 };
const DEST = { lat: 36.35272, lng: 127.37907 };
let exitCode = 0;

function print(label: string, value: unknown) {
  console.log(`[${label}]`, typeof value === "number" ? value : JSON.stringify(value));
}

async function run<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    const result = await fn();
    return result;
  } catch (error) {
    exitCode = 1;
    if (isApiError(error)) {
      console.error(`[FAIL ${label}] ${error.code}: ${error.message}`);
    } else {
      console.error(`[FAIL ${label}]`, error);
    }
    return null;
  }
}

console.log("=== 카카오 대중교통 (대덕대학교 → 갤러리아타임월드) ===");
const transit = await run("kakao-transit", () =>
  getTransitRoutes({ origin: ORIGIN, destination: DEST, originName: "대덕대학교", destinationName: "갤러리아타임월드" }),
);
if (transit) {
  print("status", transit.status);
  print("routes", transit.routes.length);
  print("counts", transit.counts);
  const first = transit.routes[0];
  if (first) print("first-route", `${first.type} ${first.totalSeconds}s ${first.transfers}환승 ${first.fare.value}원`);
}

console.log("\n=== 카카오 도보 ===");
const walk = await run("kakao-walk", () => getWalkRoute(ORIGIN, DEST));
if (walk) print("walk", `${walk.distanceM}m ${walk.seconds}s path=${walk.path.length}pts`);

console.log("\n=== 카카오 키워드 검색 (갤러리아타임월드) ===");
const places = await run("kakao-keyword", () => searchPlaces("갤러리아타임월드", { near: ORIGIN, radiusM: 20000 }));
if (places) {
  print("places", places.places.length);
  print("first", places.places[0]?.name);
}

console.log("\n=== TAGO 주변 정류장 (대덕대학교 좌표) ===");
const nearby = await run("tago-nearby", () => findNearbyStops(ORIGIN));
if (nearby) {
  print("stops", nearby.length);
  nearby.slice(0, 3).forEach((stop) => print("stop", `${stop.nodeId} ${stop.name} ars=${stop.arsId}`));
}

console.log("\n=== TAGO 이름 검색 (대덕대학교) ===");
const byName = await run("tago-byname", () => searchStopsByName("대덕대학교"));
if (byName) {
  print("stops", byName.length);
  byName.forEach((stop) => print("stop", `${stop.nodeId} ars=${stop.arsId}`));
}

console.log("\n=== TAGO 정류장 노선 (DJB8001318) ===");
const routes = await run("tago-routes", () => getRoutesThroughStop("DJB8001318"));
if (routes) {
  print("routes", routes.length);
  routes.forEach((route) => print("route", `${route.routeNo} ${route.routeTypeLabel} ${route.routeId}`));
}

console.log("\n=== 정류장 매칭 (카카오 318 첫 구간 → TAGO → 대전 ID) ===");
if (transit && nearby) {
  const busStep = transit.routes[0]?.steps.find((step) => step.mode === "bus");
  if (busStep) {
    const target = boardingTargetOf(busStep);
    if (target) {
      const match = matchStop(target, nearby);
      if (match) {
        print("matched", `${match.name} nodeId=${match.daejeonNodeId} ars=${match.arsId} ${match.distanceM.toFixed(1)}m`);
        print("toDaejeonNodeId", toDaejeonNodeId(match.tagoNodeId));
        print("toDaejeonRouteCd", toDaejeonRouteCd(routes?.[0]?.routeId ?? ""));
      } else {
        console.log("[WARN] no match found");
      }
    }
  }
}

console.log("\n=== 대전 도착정보 by stopId (8001318) ===");
const arrById = await run("daejeon-arrivals-stopid", () => getArrivalsByStopId("8001318"));
if (arrById) {
  print("arrivals", arrById.length);
  arrById.forEach((arrival) => {
    const state =
      arrival.state.kind === "approaching"
        ? `${arrival.state.phase} ${arrival.state.etaSeconds}s ${arrival.state.stopsAway}stops`
        : arrival.state.kind === "waitingAtDepot"
          ? `depot ${arrival.state.scheduledDeparture}`
          : `unknown(${arrival.state.msgType})`;
    print("bus", `${arrival.routeNo}(${arrival.routeType}) ${state}`);
  });
}

console.log("\n=== 대전 도착정보 by ARS (43420) ===");
const arrByArs = await run("daejeon-arrivals-ars", () => getArrivalsByArs("43420"));
if (arrByArs) print("arrivals", arrByArs.length);

console.log("\n=== 대전 버스 위치 (318 ROUTE_CD 30300062) — 1회만 호출 ===");
const positions = await run("daejeon-buspos", () => getBusPositions("30300062"));
if (positions) {
  print("buses", positions.length);
  positions.slice(0, 2).forEach((pos) =>
    print("pos", `${pos.plateNo} node=${pos.nodeId} (${pos.position.lat},${pos.position.lng})`),
  );
}

console.log(`\n=== 완료: exitCode=${exitCode} ===`);
process.exit(exitCode);
