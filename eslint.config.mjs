import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Cloudflare Worker(workers/collector)가 같이 번들하는 파일. Next 전용 모듈과 process.env가 들어가면 Worker가 깨진다.
const WORKER_SHARED_FILES = [
  "src/apis/xml.ts",
  "src/apis/errors.ts",
  "src/apis/http.ts",
  "src/apis/daejeon/types.ts",
  "src/apis/daejeon/parse.ts",
  "src/utils/types.ts",
];
const WORKER_SHARED_MESSAGE = "Shared with the Cloudflare Worker: no server-only, next/*, @/ alias or process.env here.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: WORKER_SHARED_FILES,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [{ name: "server-only", message: WORKER_SHARED_MESSAGE }],
          patterns: [{ group: ["next", "next/*", "@/*"], message: WORKER_SHARED_MESSAGE }],
        },
      ],
      "no-restricted-syntax": [
        "error",
        { selector: "MemberExpression[object.name='process'][property.name='env']", message: WORKER_SHARED_MESSAGE },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
