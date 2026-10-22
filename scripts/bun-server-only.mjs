// bun test / bun scripts/*.ts 에서 `import "server-only"`를 빈 모듈로 바꾼다.
// Next는 server-only를 자체 처리하지만(패키지 설치 불필요) Bun은 패키지를 찾지 못해서 필요하다. bunfig.toml preload.
Bun.plugin({
  name: "server-only-shim",
  setup(build) {
    build.module("server-only", () => ({ exports: {}, loader: "object" }));
  },
});
