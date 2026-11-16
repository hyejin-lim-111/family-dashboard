/* 모든 테스트를 차례로 실행한다.
   사용: node test/run-all.cjs   (jsdom 은 /workspace/.cache/famdash-test/node_modules 에 있음) */
const { spawnSync } = require("child_process");
const path = require("path");

const files = ["static-check.cjs", "boot-test.cjs", "compat-test.cjs", "evening-test.cjs", "store-sync-test.cjs", "home-layout-test.cjs", "growth-chat-test.cjs"];
let failed = 0;

for (const f of files) {
  console.log("\n### " + f);
  const res = spawnSync(process.execPath, [path.join(__dirname, f)], { stdio: "inherit" });
  if (res.status !== 0) { failed++; console.log("→ 실패: " + f); }
}

console.log("\n================================");
if (failed) { console.log("실패한 파일: " + failed + "개"); process.exit(1); }
console.log("모든 테스트 통과 ✅");
