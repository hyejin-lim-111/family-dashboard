/* 정적 점검 — 문법·태그·CSS·data-action 연결·로컬 자산 경로 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = __dirname + "/..";
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.log("  ✗ FAIL: " + name + (extra ? " — " + extra : "")); }
}

const html = read("index.html");
const css = read("styles.css");
const app = read("app.js");

console.log("\n[1] JS 문법");
["app.js", "store.js", "config.js"].forEach((f) => {
  try {
    execFileSync(process.execPath, ["--check", path.join(ROOT, f)]);
    check(f + " 문법", true);
  } catch (e) {
    check(f + " 문법", false, String(e.message).slice(0, 200));
  }
});

console.log("\n[2] HTML 태그 균형");
const VOID = new Set(["meta", "link", "img", "br", "hr", "input", "source", "area", "base", "col", "embed", "param", "track", "wbr"]);
{
  const stack = [];
  let ok = true, msg = "";
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const selfClose = /\/\s*$/.test(m[3]);
    if (VOID.has(tag) || selfClose) continue;
    if (!closing) stack.push(tag);
    else {
      const top = stack.pop();
      if (top !== tag) { ok = false; msg = "닫는 태그 불일치: <" + tag + "> vs <" + top + ">"; break; }
    }
  }
  if (stack.length) { ok = false; msg = msg || "닫히지 않은 태그: " + stack.join(","); }
  check("index.html 태그 균형", ok, msg);
}

console.log("\n[3] CSS 중괄호");
{
  let depth = 0, minDepth = 0;
  for (const ch of css) {
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth < minDepth) minDepth = depth; }
  }
  check("중괄호 짝", depth === 0 && minDepth === 0, "depth=" + depth);
}

console.log("\n[4] data-action 연결");
{
  const used = new Set();
  const addAll = (text) => {
    let m;
    const re1 = /data-action="([a-z0-9-]+)"/g;
    while ((m = re1.exec(text))) used.add(m[1]);
    const re2 = /setAttribute\(\s*"data-action"\s*,\s*"([a-z0-9-]+)"\s*\)/g;
    while ((m = re2.exec(text))) used.add(m[1]);
  };
  addAll(html);
  addAll(app);
  const handled = new Set();
  let m;
  const re3 = /case\s+"([a-z0-9-]+)"\s*:/g;
  while ((m = re3.exec(app))) handled.add(m[1]);

  const missing = [...used].filter((a) => !handled.has(a));
  check("모든 data-action에 처리기 있음", missing.length === 0, missing.join(", "));
  const orphan = [...handled].filter((a) => !used.has(a));
  check("처리기만 있고 쓰이지 않는 동작 없음", orphan.length === 0, orphan.join(", "));
  console.log("    (동작 " + used.size + "종 / 처리기 " + handled.size + "종)");
}

console.log("\n[5] 로컬 자산 경로");
{
  const files = new Set();
  const addAll = (text) => {
    let m;
    const re = /(?:src|href)="(assets\/[^"]+)"/g;
    while ((m = re.exec(text))) files.add(m[1]);
    // 캐시 무효화 쿼리(?v=...)가 붙은 경로도 파일 존재를 확인한다
    const re2 = /["'](assets\/[a-z_]+\.png)(?:\?[^"']*)?["']/g;
    while ((m = re2.exec(text))) files.add(m[1]);
  };
  addAll(html);
  addAll(app);
  const missing = [...files].filter((f) => !fs.existsSync(path.join(ROOT, f)));
  check("모든 자산 파일 존재", missing.length === 0, missing.join(", "));
  console.log("    (자산 " + files.size + "종 확인)");
}

console.log("\n[6] 화면 골격");
{
  check("탭 6개", (html.match(/class="tab-btn/g) || []).length === 6, String((html.match(/class="tab-btn/g) || []).length));
  check("뷰 6개", (html.match(/data-view="/g) || []).length === 6, String((html.match(/data-view="/g) || []).length));
  check("함께 뷰 존재", /data-view="together"/.test(html));
  check("config.js 키 보존", /sb_publishable_OJHJjHENxITeZVor5C9PiA_-9QMxUaC/.test(read("config.js")));
}

console.log("\n================================");
if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
console.log("ALL STATIC CHECKS PASSED ✅");
