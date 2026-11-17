/* PWA(앱 설치) 점검 — manifest · 아이콘 · 메타 태그 · 서비스 워커 · 등록 코드
   사용: node test/pwa-test.cjs */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const exists = (f) => fs.existsSync(path.join(ROOT, f));

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.log("  ✗ FAIL: " + name + (extra ? " — " + extra : "")); }
}

/* PNG 파일의 실제 가로·세로 크기를 IHDR 에서 읽는다 */
function pngSize(file) {
  const buf = fs.readFileSync(path.join(ROOT, file));
  if (buf.length < 24 || buf.toString("ascii", 1, 4) !== "PNG") return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

const html = read("index.html");
const app = read("app.js");
const sw = read("sw.js");

console.log("\n[1] manifest.webmanifest");
let manifest = null;
try {
  manifest = JSON.parse(read("manifest.webmanifest"));
  check("JSON 파싱", true);
} catch (e) {
  check("JSON 파싱", false, String(e.message).slice(0, 160));
}
if (manifest) {
  check("name = 우리 가족 기록장", manifest.name === "우리 가족 기록장", String(manifest.name));
  check("short_name = 가족기록장", manifest.short_name === "가족기록장", String(manifest.short_name));
  check("start_url = /family-dashboard/", manifest.start_url === "/family-dashboard/", String(manifest.start_url));
  check("scope = /family-dashboard/", manifest.scope === "/family-dashboard/", String(manifest.scope));
  check("display = standalone", manifest.display === "standalone", String(manifest.display));
  check("theme_color 지정", /^#[0-9A-Fa-f]{6}$/.test(manifest.theme_color || ""), String(manifest.theme_color));
  check("background_color 지정", /^#[0-9A-Fa-f]{6}$/.test(manifest.background_color || ""), String(manifest.background_color));
  check("대시보드 크림 배경과 어울림(#FFF8F0)", manifest.theme_color === "#FFF8F0" && manifest.background_color === "#FFF8F0",
    manifest.theme_color + " / " + manifest.background_color);
  check("언어 ko-KR", manifest.lang === "ko-KR", String(manifest.lang));

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const sizes = icons.map((i) => (i.sizes || "").toLowerCase());
  const purposes = icons.map((i) => (i.purpose || "any").toLowerCase());
  check("icons 배열", icons.length >= 3, String(icons.length));
  check("192×192 포함", sizes.includes("192x192"));
  check("512×512 포함", sizes.includes("512x512"));
  check("maskable 아이콘 포함", purposes.some((p) => p.includes("maskable")));
  check("모든 icon.type = image/png", icons.every((i) => i.type === "image/png"));
  check("아이콘 경로가 상대 경로(서브패스 안전)", icons.every((i) => !/^\.?\//.test(i.src)), icons.map((i) => i.src).join(", "));

  // 선언한 크기와 실제 파일 크기가 같아야 한다
  icons.forEach((icon) => {
    if (!exists("assets/" + path.basename(icon.src))) { check(icon.src + " 파일 존재", false); return; }
    const size = pngSize("assets/" + path.basename(icon.src));
    check(icon.src + " 실제 크기 " + icon.sizes,
      !!size && icon.sizes.toLowerCase() === size.width + "x" + size.height,
      size ? size.width + "x" + size.height : "PNG 아님");
  });
}

console.log("\n[2] 아이콘 파일");
["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"].forEach((name) => {
  check("assets/" + name + " 존재", exists("assets/" + name));
});
{
  const s192 = pngSize("assets/icon-192.png");
  const s512 = pngSize("assets/icon-512.png");
  const sMask = pngSize("assets/icon-maskable-512.png");
  const sApple = pngSize("assets/apple-touch-icon.png");
  check("icon-192.png = 192×192", !!s192 && s192.width === 192 && s192.height === 192, JSON.stringify(s192));
  check("icon-512.png = 512×512", !!s512 && s512.width === 512 && s512.height === 512, JSON.stringify(s512));
  check("icon-maskable-512.png = 512×512", !!sMask && sMask.width === 512 && sMask.height === 512, JSON.stringify(sMask));
  check("apple-touch-icon.png = 180×180", !!sApple && sApple.width === 180 && sApple.height === 180, JSON.stringify(sApple));
}

console.log("\n[3] index.html 메타 태그");
{
  check("manifest 링크", /<link rel="manifest" href="manifest\.webmanifest">/.test(html));
  check("theme-color 메타", /<meta name="theme-color" content="#FFF8F0">/.test(html));
  check("mobile-web-app-capable", /<meta name="mobile-web-app-capable" content="yes">/.test(html));
  check("apple-mobile-web-app-capable", /<meta name="apple-mobile-web-app-capable" content="yes">/.test(html));
  check("apple-touch-icon 연결(180)", /<link rel="apple-touch-icon" sizes="180x180" href="assets\/apple-touch-icon\.png">/.test(html));
  check("manifest 태그가 </head> 안에 있음", html.indexOf('rel="manifest"') < html.indexOf("</head>"));
  check("앱 이름(title) 유지", /<title>우리 가족 기록장<\/title>/.test(html));
}

console.log("\n[4] 서비스 워커 (sw.js)");
{
  try {
    execFileSync(process.execPath, ["--check", path.join(ROOT, "sw.js")]);
    check("문법", true);
  } catch (e) {
    check("문법", false, String(e.message).slice(0, 200));
  }
  check("설치 시 skipWaiting", /self\.skipWaiting\(\)/.test(sw));
  check("활성화 시 clients.claim", /self\.clients\.claim\(\)/.test(sw));
  check("옛 버전 캐시 삭제", /caches\.delete\(/.test(sw));
  check("버전 기반 캐시 이름", /var VERSION = "/.test(sw) && /family-dashboard-"? \+ VERSION|"family-dashboard-" \+ VERSION/.test(sw));

  // 외부 API 는 절대 캐시·가로채기 하지 않는다
  check("다른 origin 은 건드리지 않음", /url\.origin !== self\.location\.origin\) return false/.test(sw));
  check("응답을 하지 않고 그대로 통과(외부 API)", /if \(!isOwnAsset\(request\)\) return;/.test(sw));
  check("GET 이 아닌 요청 제외", /request\.method !== "GET"\) return false/.test(sw));
  check("부분 요청(range) 제외", /has\("range"\)\) return false/.test(sw));
  check("precache 는 이 사이트 파일만", /var PRECACHE = \[([\s\S]*?)\];/.test(sw) &&
    (sw.match(/var PRECACHE = \[([\s\S]*?)\];/) || ["", ""])[1].split(",").filter((s) => s.trim() && s.trim().startsWith("\"")).every((s) => s.trim().startsWith("\"./")),
    "PRECACHE 에 외부 주소가 있으면 안 됨");

  // Network-First: 네트워크를 먼저 시도하고, 실패했을 때만 캐시를 본다
  const fetchAt = sw.indexOf("fetch(request).then");
  const cacheAt = sw.indexOf("caches.match(request");
  check("Network-First 순서", fetchAt >= 0 && cacheAt > fetchAt, "fetch=" + fetchAt + ", cache=" + cacheAt);
  check("네트워크 응답을 캐시에 갱신", /cache\.put\(request, copy\)/.test(sw));
  check("오프라인이면 index.html 로 대체", /request\.mode === "navigate"/.test(sw) && /match\("\.\/index\.html"\)/.test(sw));
}

console.log("\n[5] app.js 등록 코드");
{
  check("navigator.serviceWorker 지원 확인", /"serviceWorker" in navigator/.test(app));
  check("상대 경로로 등록(서브패스)", /register\("\.\/sw\.js", \{ scope: "\.\/" \}\)/.test(app));
  check("등록 실패해도 앱은 계속", /catch\(function \(err\)/.test(app) && /서비스 워커를 등록하지 못했어요/.test(app));
  check("boot() 에서 등록 호출", /function boot\(\)[\s\S]*registerServiceWorker\(\);\n  \}/.test(app));
  check("업데이트 시 SKIP_WAITING 전송", /postMessage\("SKIP_WAITING"\)/.test(app));
  check("index.html 이 app.js 를 v= 로 불러옴(캐시 무효화)", /<script src="app\.js\?v=\d+[a-z]?"><\/script>/.test(html));
  check("config.js 는 그대로", /sb_publishable_OJHJjHENxITeZVor5C9PiA_-9QMxUaC/.test(read("config.js")));
}

console.log("\n==========================================");
if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
console.log("ALL PWA CHECKS PASSED ✅");
