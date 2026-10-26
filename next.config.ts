import type { NextConfig } from "next";

// 서비스 워커는 알림 확인(ack)을 워커(collector)로 보낸다. CSP가 그 출처로의 fetch만 따로 허용한다
function collectorOrigin(): string | null {
  try {
    return new URL(process.env.NEXT_PUBLIC_COLLECTOR_URL ?? "").origin;
  } catch {
    return null;
  }
}
const swConnectSrc = ["'self'", collectorOrigin()].filter(Boolean).join(" ");

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // 서비스 워커는 항상 최신본을 받게 하고 자기 출처 스크립트만 허용한다 (Next PWA 가이드)
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: `default-src 'self'; script-src 'self'; connect-src ${swConnectSrc}` },
        ],
      },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
