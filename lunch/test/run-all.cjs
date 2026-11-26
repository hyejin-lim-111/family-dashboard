/* 점심 뭐 먹지? — 테스트 전체 실행
   사용: node lunch/test/run-all.cjs  (jsdom 은 /workspace/.cache/famdash-test/node_modules) */
const { spawnSync } = require("child_process");
const path = require("path");

const files = ["static-check.cjs", "store-merge-test.cjs", "app-boot-test.cjs", "sync-test.cjs", "place-test.cjs"];
let failed = 0;

for (const f of files) {
  console.log("\n### " + f);
  const res = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: "inherit" });
  if (res.status !== 0) { failed++; console.log("→ 실패: " + f); }
}

console.log("\n========================================");
if (failed) { console.log("실패한 파일: " + failed + "개"); process.exit(1); }
console.log("점심 앱 테스트 모두 통과 ✅");
