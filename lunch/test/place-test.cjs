/* lunch/ 주변 맛집 탭 — 가짜 카카오맵 SDK 로 검색·필터·추첨 검증 */
const { JSDOM } = require("/workspace/.cache/famdash-test/node_modules/jsdom");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname + "/..";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.log("  ✗ FAIL: " + name + (extra ? " — " + extra : "")); }
}

const FOOD = [
  { id: "f1", place_name: "분당 김치찌개집", category_name: "음식점 > 한식 > 찌개", distance: "120", road_address_name: "성남시 분당구 판교로 1", phone: "031-111-2222", place_url: "https://place.map.kakao.com/1", x: "127.10", y: "37.39" },
  { id: "f2", place_name: "판교 짬뽕관", category_name: "음식점 > 중식 > 짬뽕", distance: "340", road_address_name: "성남시 분당구 판교로 2", phone: "031-222-3333", place_url: "https://place.map.kakao.com/2", x: "127.11", y: "37.39" },
  { id: "f3", place_name: "초밥야", category_name: "음식점 > 일식 > 초밥", distance: "480", road_address_name: "성남시 분당구 판교로 3", phone: "", place_url: "https://place.map.kakao.com/3", x: "127.12", y: "37.40" },
  { id: "f4", place_name: "판교 파스타", category_name: "음식점 > 양식 > 이탈리안", distance: "900", road_address_name: "성남시 분당구 판교로 4", phone: "031-444-5555", place_url: "https://place.map.kakao.com/4", x: "127.13", y: "37.41" },
];
const CAFES = [
  { id: "c1", place_name: "카페 어딘가", category_name: "음식점 > 카페,디저트 > 카페", distance: "200", road_address_name: "성남시 분당구 판교로 9", phone: "", place_url: "https://place.map.kakao.com/9", x: "127.14", y: "37.39" },
];

(async function main() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, {
    url: "http://localhost/family-dashboard/lunch/index.html",
    pretendToBeVisual: true,
    runScripts: "outside-only",
  });
  const { window } = dom;
  const { document } = window;

  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  window.fetch = () => Promise.reject(new Error("offline (test)"));
  window.scrollTo = () => {};

  const searches = [];
  window.kakao = {
    maps: {
      load(cb) { cb(); },
      LatLng: function (y, x) { this.y = y; this.x = x; },
      LatLngBounds: function () { this.extend = function () {}; },
      Map: function () { return { setCenter() {}, setBounds() {} }; },
      Marker: function () { return { setMap() {} }; },
      services: {
        Status: { OK: "OK", ZERO_RESULT: "ZERO_RESULT", ERROR: "ERROR" },
        SortBy: { DISTANCE: "distance" },
        Places: function () {
          this.categorySearch = function (code, cb, opts) {
            searches.push({ type: "category", code, radius: opts && opts.radius });
            const data = code === "CE7" ? CAFES : FOOD;
            setTimeout(() => cb(data, "OK"), 5);
          };
          this.keywordSearch = function (q, cb) {
            searches.push({ type: "keyword", q });
            setTimeout(() => cb([{ place_name: q, road_address_name: "성남시 분당구 정자동", address_name: "성남시 분당구 정자동", x: "127.11", y: "37.37" }], "OK"), 5);
          };
        }
      }
    }
  };
  Object.defineProperty(window.navigator, "geolocation", {
    configurable: true,
    value: {
      getCurrentPosition(ok) {
        setTimeout(() => ok({ coords: { latitude: 37.39, longitude: 127.10 } }), 5);
      }
    }
  });

  const load = (f) => window.eval(fs.readFileSync(path.join(ROOT, f), "utf8"));
  load("config.js");
  window.LUNCH_CONFIG.supabase = { url: "", anonKey: "", table: "lunch_state", rowId: "company-lunch", pollMs: 5000, realtime: false };
  load("store.js");
  load("app.js");
  await sleep(400);

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const restRows = () => $$("#restList .rest-row");

  console.log("\n[1] 위치 잡기 → 주변 음식점 검색");
  click($("#tabPlaces"));
  await sleep(30);
  click($("[data-action='locate']"));
  await sleep(200);
  check("FD6 + CE7 둘 다 검색(전체)", searches.some((s) => s.code === "FD6") && searches.some((s) => s.code === "CE7"), JSON.stringify(searches));
  check("기본 반경 500m", searches[0] && searches[0].radius === 500, String(searches[0] && searches[0].radius));
  check("목록에 음식점 + 카페", restRows().length === FOOD.length + CAFES.length, String(restRows().length));
  check("상태 줄에 '현재 위치'", $("#placeStatus").textContent.includes("현재 위치"), $("#placeStatus").textContent);
  check("가까운 순 정렬", restRows()[0].textContent.includes("김치찌개집"), restRows()[0].textContent);
  check("거리 표시", restRows()[0].textContent.includes("120m"), restRows()[0].textContent);
  check("전화 링크", !!restRows()[0].querySelector("a[href^='tel:']"));
  check("카카오맵 링크", !!restRows()[0].querySelector("a[href*='place.map.kakao.com']"));
  check("주소 표시", restRows()[0].textContent.includes("판교로 1"));

  console.log("\n[2] 분류 필터 · 반경 변경");
  click($$("#placeFilter .chip").find((c) => c.getAttribute("data-cat") === "cafe"));
  await sleep(150);
  check("카페는 CE7 로만 검색", searches[searches.length - 1].code === "CE7", searches[searches.length - 1].code);
  check("카페만 목록에", restRows().length === CAFES.length && restRows()[0].textContent.includes("카페 어딘가"), String(restRows().length));

  click($$("#placeFilter .chip").find((c) => c.getAttribute("data-cat") === "all"));
  await sleep(150);
  click($$("#radiusChips .chip").find((c) => c.getAttribute("data-radius") === "1000"));
  await sleep(150);
  check("반경 1000m 로 재검색", searches[searches.length - 1].radius === 1000, String(searches[searches.length - 1].radius));

  console.log("\n[3] '빼기' 토글 → 추첨에서 제외");
  const check1 = $("#restList input[data-action='toggle-place']");
  const pickId = check1.getAttribute("data-id");
  click(check1);
  await sleep(30);
  const picked = $("#restList .rest-row[data-id='" + pickId + "']");
  check("행이 흐려짐", picked.classList.contains("is-excluded"));
  click($("[data-action='draw-place']"));
  await sleep(120);
  const rest = $("#restResult");
  check("추첨 결과 카드", rest && rest.hidden === false);
  check("뺀 곳은 뽑히지 않음", !rest.textContent.includes("김치찌개집") || pickId !== "f1", rest.textContent.slice(0, 80));

  console.log("\n[4] 주소 검색 fallback");
  $("#placeQuery").value = "분당 정자동";
  click($("[data-action='search-address']"));
  await sleep(200);
  check("키워드 검색 호출", searches.some((s) => s.type === "keyword" && s.q === "분당 정자동"), JSON.stringify(searches.slice(-2)));
  check("검색한 주소가 상태 줄에", $("#placeStatus").textContent.includes("정자동"), $("#placeStatus").textContent);
  check("그 위치로 다시 음식점 검색", searches.filter((s) => s.type === "category").length >= 6);

  console.log("\n[5] 결과는 기기에 저장");
  check("localStorage 에 맛집 저장", !!window.localStorage.getItem("lunch-app.places.v1"));

  console.log("\n========================================");
  if (failures) { console.log("실패 " + failures + "개"); process.exit(1); }
  console.log("주변 맛집 탭 테스트 통과 ✅");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
