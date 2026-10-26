import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "지금이니?",
    short_name: "지금이니?",
    description: "기다림까지 더한 도착 예상 시간과, 언제까지 나서면 되는지 알려주는 버스 길찾기",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      // any: 배경 없는 핀(안드로이드 시작 화면에 쓰임), maskable: 주황 타일(홈 화면 아이콘에 쓰임)
      { src: "/icon-pin-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-pin-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
