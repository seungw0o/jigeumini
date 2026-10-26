// 대전 전체 정류소 카탈로그(stop_catalog) 시드 SQL을 만든다.
// TAGO getSttnNoList(cityCode 25)를 페이지로 다 읽고, 좌표마다 카카오 coord2regioncode로 구를 붙인다.
// 실행: bun scripts/build-stop-catalog.ts  (bun이 .env.local의 DATA_GO_KR_KEY, KAKAO_REST_KEY를 읽는다)
// 결과: workers/collector/seeds/stop_catalog.sql
// 적용: cd workers/collector && wrangler d1 execute jigeumini --local|--remote --file=seeds/stop_catalog.sql
import { mkdirSync, writeFileSync } from "node:fs";
import { toDaejeonNodeId } from "../src/apis/tago/ids";

const TAGO_URL = "https://apis.data.go.kr/1613000/BusSttnInfoInqireService/getSttnNoList";
const KAKAO_URL = "https://dapi.kakao.com/v2/local/geo/coord2regioncode.json";
const DAEJEON_CITY_CODE = "25";
const PAGE_ROWS = 100;
const KAKAO_CONCURRENCY = 8;
const OUT = new URL("../workers/collector/seeds/stop_catalog.sql", import.meta.url);

interface CatalogStop {
  nodeId: string;
  ars: string | null;
  name: string;
  lat: number;
  lng: number;
  district: string;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set (.env.local)`);
  return value;
}

async function fetchJson(url: URL | string, init?: RequestInit, attempts = 3): Promise<unknown> {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return await res.json();
    } catch (error) {
      if (attempt >= attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

type TagoItem = { nodeid: string; nodenm: string; nodeno?: number | string; gpslati: number; gpslong: number };

async function tagoPage(serviceKey: string, pageNo: number): Promise<{ items: TagoItem[]; totalCount: number }> {
  const url = new URL(TAGO_URL);
  for (const [key, value] of Object.entries({
    serviceKey,
    _type: "json",
    numOfRows: String(PAGE_ROWS),
    pageNo: String(pageNo),
    cityCode: DAEJEON_CITY_CODE,
  })) {
    url.searchParams.set(key, value);
  }
  const json = (await fetchJson(url)) as {
    response?: { header?: { resultCode?: string; resultMsg?: string }; body?: { items?: { item?: TagoItem | TagoItem[] } | ""; totalCount?: number } };
  };
  const header = json.response?.header;
  if (header?.resultCode !== "00") throw new Error(`TAGO page ${pageNo}: ${header?.resultCode} ${header?.resultMsg ?? ""}`);
  const body = json.response?.body;
  const item = body && typeof body.items === "object" ? body.items.item : undefined;
  const items = item === undefined ? [] : Array.isArray(item) ? item : [item];
  return { items, totalCount: Number(body?.totalCount ?? 0) };
}

async function districtOf(kakaoKey: string, lat: number, lng: number): Promise<string> {
  const json = (await fetchJson(`${KAKAO_URL}?x=${lng}&y=${lat}`, { headers: { Authorization: `KakaoAK ${kakaoKey}` } })) as {
    documents?: { region_type: string; region_1depth_name: string; region_2depth_name: string }[];
  };
  // 법정동(B)을 먼저 본다. 대전 밖(세종, 계룡 등)이면 시도 이름이 구 자리에 들어간다
  const doc = json.documents?.find((d) => d.region_type === "B") ?? json.documents?.[0];
  if (!doc) return "unknown";
  if (doc.region_1depth_name !== "대전광역시") return doc.region_2depth_name ? `${doc.region_1depth_name} ${doc.region_2depth_name}` : doc.region_1depth_name;
  return doc.region_2depth_name || "unknown";
}

const sqlText = (value: string | null) => (value === null ? "NULL" : `'${value.replaceAll("'", "''")}'`);

async function main() {
  const serviceKey = requireEnv("DATA_GO_KR_KEY");
  const kakaoKey = requireEnv("KAKAO_REST_KEY");

  const first = await tagoPage(serviceKey, 1);
  const pages = Math.ceil(first.totalCount / PAGE_ROWS);
  console.log(`TAGO totalCount=${first.totalCount} pages=${pages}`);
  const raw: TagoItem[] = [...first.items];
  for (let page = 2; page <= pages; page++) raw.push(...(await tagoPage(serviceKey, page)).items);

  const byNode = new Map<string, Omit<CatalogStop, "district">>();
  let skipped = 0;
  for (const item of raw) {
    const nodeId = toDaejeonNodeId(String(item.nodeid));
    const lat = Number(item.gpslati);
    const lng = Number(item.gpslong);
    if (nodeId === null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      skipped++;
      continue;
    }
    const ars = item.nodeno === undefined || item.nodeno === "" ? null : String(item.nodeno);
    byNode.set(nodeId, { nodeId, ars, name: String(item.nodenm).trim(), lat, lng });
  }
  console.log(`TAGO items=${raw.length} unique=${byNode.size} skipped=${skipped}`);

  const pending = [...byNode.values()].sort((a, b) => (a.nodeId < b.nodeId ? -1 : 1));
  const stops: CatalogStop[] = new Array(pending.length);
  let next = 0;
  async function worker() {
    while (next < pending.length) {
      const index = next++;
      const stop = pending[index];
      stops[index] = { ...stop, district: await districtOf(kakaoKey, stop.lat, stop.lng) };
      if ((index + 1) % 500 === 0) console.log(`kakao ${index + 1}/${pending.length}`);
    }
  }
  await Promise.all(Array.from({ length: KAKAO_CONCURRENCY }, worker));

  const counts = new Map<string, number>();
  for (const stop of stops) counts.set(stop.district, (counts.get(stop.district) ?? 0) + 1);
  const countLines = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([district, n]) => `--   ${district}: ${n}`);

  const lines = [
    `-- 대전 정류소 카탈로그. scripts/build-stop-catalog.ts가 ${new Date().toISOString()}에 만들었다 (TAGO getSttnNoList cityCode 25 + 카카오 coord2regioncode).`,
    "-- 다시 넣어도 측정 기록(last_measured_on, measure_count)은 그대로 둔다.",
    `-- 정류소 ${stops.length}곳, 구별:`,
    ...countLines,
  ];
  const CHUNK = 200;
  for (let i = 0; i < stops.length; i += CHUNK) {
    const values = stops
      .slice(i, i + CHUNK)
      .map((s) => `  (${sqlText(s.nodeId)}, ${sqlText(s.ars)}, ${sqlText(s.name)}, ${s.lat}, ${s.lng}, ${sqlText(s.district)})`)
      .join(",\n");
    lines.push(
      `INSERT INTO stop_catalog (node_id, ars, name, lat, lng, district) VALUES\n${values}\n` +
        "ON CONFLICT(node_id) DO UPDATE SET ars = excluded.ars, name = excluded.name, lat = excluded.lat, lng = excluded.lng, district = excluded.district;",
    );
  }
  mkdirSync(new URL(".", OUT), { recursive: true });
  writeFileSync(OUT, `${lines.join("\n")}\n`);
  console.log(`wrote ${OUT.pathname}`);
  console.log(countLines.join("\n"));
}

await main();
