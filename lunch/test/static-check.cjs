/* lunch/ 정적 점검 — 문법 · 태그 · CSS · data-action · 자산 경로 · PWA 설정 */
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
const storeSrc = read("store.js");
const config = read("config.js");
const sw = read("sw.js");
const manifestText = read("manifest.webmanifest");

console.log("\n[1] JS 문법");
["app.js", "store.js", "config.js", "sw.js"].forEach((f) => {
  try {
    execFileSync(process.execPath, ["--check", path.join(ROOT, f)]);
    check(f + " 문법", true);
  } catch (e) {
    check(f + " 문법", false, String(e.message).slice(0, 200));
  }
});

console.log("\n[2] HTML 태그 균형");
{
  const VOID = new Set(["meta", "link", "img", "br", "hr", "input", "source", "area", "base", "col", "embed", "param", "track", "wbr"]);
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
  check("Pretendard 폰트 사용", /Pretendard/.test(css));
  check("모바일 퍼스트 미디어쿼리", /@media \(min-width: 860px\)/.test(css));
}

console.log("\n[4] data-action 연결");
{
  const used = new Set();
  const addAll = (text) => {
    let m;
    const re1 = /data-action="([a-z0-9-]+)"/g;
    while ((m = re1.exec(text))) used.add(m[1]);
  };
  addAll(html);
  addAll(app);
  const handled = new Set();
  let m;
  const re3 = /case\s+"([a-z0-9-]+)"\s*:/g;
  while ((m = re3.exec(app))) handled.add(m[1]);
  const missing = [...used].filter((a) => !handled.has(a));
  check("모든 data-action 에 처리기 있음", missing.length === 0, missing.join(", "));
  const orphan = [...handled].filter((a) => !used.has(a));
  check("처리기만 있고 안 쓰는 action 없음", orphan.length === 0, orphan.join(", "));
}

console.log("\n[5] 앱이 찾는 요소 id 가 HTML 에 있음");
{
  const ids = new Set();
  const re = /id="([A-Za-z0-9_-]+)"/g;
  let m;
  while ((m = re.exec(html))) ids.add(m[1]);
  const wanted = new Set();
  const re2 = /\$\("#([A-Za-z0-9_-]+)"\)/g;
  while ((m = re2.exec(app))) wanted.add(m[1]);
  const missing = [...wanted].filter((id) => !ids.has(id));
  check("모든 참조 id 존재", missing.length === 0, missing.join(", "));
  check("탭 요소", ids.has("tabMenu") && ids.has("tabPlaces") && ids.has("viewMenu") && ids.has("viewPlaces"));
  check("추첨 요소", ids.has("drawBtn") && ids.has("drawSlot") && ids.has("drawResult"));
  check("메뉴판 요소", ids.has("menuList") && ids.has("addMenuForm") && ids.has("menuName") && ids.has("menuCategory") && ids.has("menuMemo"));
  check("기록 요소", ids.has("historyList"));
  check("맛집 요소", ids.has("locate") === false && ids.has("restList") && ids.has("restSlot") && ids.has("placeQuery"));
  check("상태 요소", ids.has("syncBadge") && ids.has("toast") && ids.has("kakaoNotice"));
}

console.log("\n[6] 로컬 자산 경로");
{
  const paths = new Set();
  const re = /(?:src|href)="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const p = m[1];
    if (/^(https?:)?\/\//.test(p) || p.startsWith("#") || p.startsWith("data:")) continue;
    paths.add(p);
  }
  const missing = [...paths].filter((p) => !fs.existsSync(path.join(ROOT, p.replace(/^\.\//, ""))));
  check("모든 로컬 파일 존재", missing.length === 0, missing.join(", "));
  check("아이콘 SVG + PNG", fs.existsSync(path.join(ROOT, "assets/icon.svg")) && fs.existsSync(path.join(ROOT, "assets/icon-192.png")) && fs.existsSync(path.join(ROOT, "assets/icon-512.png")) && fs.existsSync(path.join(ROOT, "assets/icon-maskable-512.png")));
  check("PNG 크기 192", fs.statSync(path.join(ROOT, "assets/icon-192.png")).size > 1000);
  check("PNG 크기 512", fs.statSync(path.join(ROOT, "assets/icon-512.png")).size > 3000);
}

console.log("\n[7] manifest (PWA)");
{
  let mf = null;
  try { mf = JSON.parse(manifestText); } catch (e) { /* 실패는 아래 check 에서 */ }
  check("JSON 파싱", !!mf);
  if (mf) {
    check("start_url = ./", mf.start_url === "./", mf.start_url);
    check("scope = ./", mf.scope === "./", mf.scope);
    check("display standalone", mf.display === "standalone");
    check("192·512 아이콘", mf.icons.some((i) => i.sizes === "192x192") && mf.icons.some((i) => i.sizes === "512x512"));
    check("maskable 아이콘", mf.icons.some((i) => (i.purpose || "").indexOf("maskable") >= 0));
    const iconMissing = mf.icons
      .map((i) => i.src)
      .filter((src) => !fs.existsSync(path.join(ROOT, src)));
    check("manifest 아이콘 파일 존재", iconMissing.length === 0, iconMissing.join(", "));
  }
  check("manifest 링크", /rel="manifest"/.test(html));
  check("테마 컬러", /name="theme-color"/.test(html));
  check("서비스 워커 등록", /serviceWorker\.register\("sw\.js",\s*\{\s*scope:\s*"\.\/"/.test(html));
}

console.log("\n[8] 서비스 워커 범위 (lunch/ 안만 캐시)");
{
  check("Network-First (fetch 먼저)", /fetch\(request\)\.then/.test(sw));
  check("같은 origin 만", /url\.origin !== self\.location\.origin/.test(sw) && /return false/.test(sw));
  check("lunch 경로 밖 요청 제외", /url\.pathname\.indexOf\(base\) !== 0/.test(sw));
  check("sw.js 자신은 캐시 제외", /"\/sw\.js"/.test(sw));
  check("외부 API 미가로채기(respondWith 는 자체 자산만)", /if \(!isOwnAsset\(request\)\) return;/.test(sw));
  check("캐시 이름 분리", /lunch-app-/.test(sw));
}

console.log("\n[9] 설정 값");
{
  check("Supabase 프로젝트 URL", config.includes("https://rfftsmdvvlcuesyqizbs.supabase.co"));
  check("publishable key", config.includes("sb_publishable_OJHJjHENxITeZVor5C9PiA_-9QMxUaC"));
  check("테이블 = lunch_state", /table:\s*"lunch_state"/.test(config));
  check("행 id = company-lunch", /rowId:\s*"company-lunch"/.test(config));
  check("가족 테이블(family_state) 미사용", !/table\s*[:=]\s*["']family_state["']/.test(config + storeSrc) && !/\/rest\/v1\/family_state/.test(storeSrc));
  check("카카오 JavaScript 키", /kakaoAppKey:\s*"[0-9a-f]{32}"/.test(config), "kakaoAppKey 형식 확인");
  check("카카오 SDK 로더 (services, autoload=false)", /libraries=services&autoload=false/.test(app));
  check("categorySearch FD6/CE7", /"FD6"/.test(app) && /"CE7"/.test(app));
  check("반경 300/500/1km/2km", /300/.test(app) && /500/.test(app) && /1000/.test(app) && /2000/.test(app));
  check("geolocation 사용", /navigator\.geolocation/.test(app));
}

console.log("\n[10] 병합·tombstone 구현 요건");
{
  check("store 에 3-way 병합 노출", /mergeStates/.test(storeSrc));
  check("tombstone(deleted)", /mergeDeletedTomb/.test(storeSrc));
  check("Realtime 구독", /postgres_changes/.test(storeSrc));
  check("5초 폴링 fallback", /pollMs:\s*5000/.test(config) && /startPolling/.test(storeSrc));
  check("Read→Merge→Write", /fetchRemote\(\)\.then\(function \(remote\)/.test(storeSrc));
}

console.log("\n[11] 기본 메뉴");
{
  const block = app.split("var DEFAULT_MENUS = [")[1] || "";
  const entries = (block.split("].map(")[0].match(/\["d\d+"/g) || []).length;
  check("기본 메뉴 36종 이상", entries >= 36, String(entries));
  check("6개 분류 모두 포함", ["korean", "chinese", "japanese", "western", "snack", "asian"].every((c) => app.includes('"' + c + '"')));
}

console.log("\n========================================");
if (failures) { console.log("실패 " + failures + "개"); process.exit(1); }
console.log("정적 점검 통과 ✅");
