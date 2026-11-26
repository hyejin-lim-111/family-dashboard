/* lunch/ 🆕 새로 생긴 식당 — 가짜 카카오맵 SDK 로 키워드 보강 · 최신 등록 추정 정렬 · NEW 스냅샷 · 추첨 검증 */
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

// 중심: 37.39, 127.10 (내 위치) — 위도 0.001도 ≈ 111m, 0.001도(경도) ≈ 88m
const FOOD = [
  { id: "1000001", place_name: "판교 옛날국밥", category_name: "음식점 > 한식 > 국밥", road_address_name: "성남시 분당구 판교로 1", phone: "031-111-2222", place_url: "https://place.map.kakao.com/1000001", x: "127.10", y: "37.39108" },
  { id: "1000009", place_name: "새로 연 파스타", category_name: "음식점 > 양식 > 이탈리안", road_address_name: "성남시 분당구 판교로 2", phone: "", place_url: "https://place.map.kakao.com/1000009", x: "127.10", y: "37.39306" },
  { id: "1000005", place_name: "초밥야", category_name: "음식점 > 일식 > 초밥", road_address_name: "성남시 분당구 판교로 3", phone: "", place_url: "https://place.map.kakao.com/1000005", x: "127.10", y: "37.39431" },
];
const CAFES = [
  { id: "1000020", place_name: "카페 어딘가", category_name: "음식점 > 카페,디저트 > 카페", road_address_name: "성남시 분당구 판교로 9", phone: "", place_url: "https://place.map.kakao.com/1000020", x: "127.10", y: "37.39180" },
];
// 신규 키워드로만 잡히는 결과들
const KEYWORD_HITS = [
  { id: "1000050", place_name: "신규오픈 국수집", category_name: "음식점 > 한식 > 국수", road_address_name: "성남시 분당구 판교로 50", phone: "", place_url: "https://place.map.kakao.com/1000050", x: "127.10", y: "37.39225" },
  { id: "1000009", place_name: "새로 연 파스타", category_name: "음식점 > 양식 > 이탈리안", road_address_name: "성남시 분당구 판교로 2", phone: "", place_url: "https://place.map.kakao.com/1000009", x: "127.10", y: "37.39306" }, // 중복
  { id: "1000060", place_name: "멀리 오픈한 집", category_name: "음식점 > 중식", road_address_name: "성남시 분당구 어딘가로 60", phone: "", place_url: "https://place.map.kakao.com/1000060", x: "127.10", y: "37.45" }, // 반경 밖
  { id: "1000070", place_name: "오픈 카페", category_name: "음식점 > 카페,디저트 > 카페", road_address_name: "성남시 분당구 판교로 70", phone: "", place_url: "https://place.map.kakao.com/1000070", x: "127.101", y: "37.39225" },
  { id: "1000080", place_name: "오픈 부동산", category_name: "부동산 > 부동산중개", road_address_name: "성남시 분당구 판교로 80", phone: "", place_url: "", x: "127.10", y: "37.39200" }, // 음식점 아님
];
const LATER = { id: "1000100", place_name: "따끈한 신상 백반", category_name: "음식점 > 한식 > 백반", road_address_name: "성남시 분당구 판교로 100", phone: "", place_url: "https://place.map.kakao.com/1000100", x: "127.099", y: "37.39306" };

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
  const markers = [];
  let foodList = FOOD.slice();
  let keywordHits = KEYWORD_HITS.slice();

  window.kakao = {
    maps: {
      load(cb) { cb(); },
      LatLng: function (y, x) { this.y = y; this.x = x; },
      LatLngBounds: function () { this.extend = function () {}; },
      Map: function () { return { setCenter() {}, setBounds() {} }; },
      Marker: function (opts) { markers.push(opts && opts.title); return { setMap() {} }; },
      services: {
        Status: { OK: "OK", ZERO_RESULT: "ZERO_RESULT", ERROR: "ERROR" },
        SortBy: { DISTANCE: "distance", ACCURACY: "accuracy" },
        Places: function () {
          this.categorySearch = function (code, cb, opts) {
            searches.push({ type: "category", code, radius: opts && opts.radius });
            setTimeout(() => cb(code === "CE7" ? CAFES : foodList, "OK"), 5);
          };
          this.keywordSearch = function (q, cb, opts) {
            searches.push({ type: "keyword", q, radius: opts && opts.radius, hasLocation: !!(opts && opts.location) });
            if (q === "신규오픈" || q === "오픈") setTimeout(() => cb(keywordHits, "OK"), 5);
            else setTimeout(() => cb([{ place_name: q, road_address_name: "성남시 분당구 정자동", address_name: "성남시 분당구 정자동", x: "127.11", y: "37.37" }], "OK"), 5);
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
  const rows = () => $$("#restList .rest-row");
  const names = () => rows().map((r) => (r.querySelector(".rest-name") || {}).textContent);
  const kwCalls = () => searches.filter((s) => s.type === "keyword" && (s.q === "신규오픈" || s.q === "오픈"));
  const chip = (sel, attr, val) => $$(sel + " .chip").find((c) => c.getAttribute(attr) === val);
  const snapKey = "lunch-app.newplaces.v1";
  const snaps = () => JSON.parse(window.localStorage.getItem(snapKey) || "null");

  console.log("\n[1] 전체 맛집(기존 동작) — 신규 키워드 검색은 하지 않는다");
  click($("#tabPlaces"));
  await sleep(30);
  click($("[data-action='locate']"));
  await sleep(300);
  check("FD6 로 주변 음식점 검색", searches.some((s) => s.code === "FD6"));
  check("전체 모드에서는 신규 키워드 검색 없음", kwCalls().length === 0, String(kwCalls().length));
  check("목록은 가까운 순", names()[0] === "판교 옛날국밥", names().join(" / "));
  check("보기 칩 2개 (전체 맛집 / 새로 생긴 식당)", $$("#viewChips .chip").length === 2 && $$("#viewChips .chip").map((c) => c.textContent.trim()).join("|").indexOf("새로 생긴 식당") > 0, $$("#viewChips .chip").map((c) => c.textContent.trim()).join("|"));
  check("전체 모드에서는 안내 줄 숨김", $("#newNote").hidden === true);
  check("NEW 뱃지 없음", $$("#restList .new-badge").length === 0);

  console.log("\n[2] 🆕 새로 생긴 식당 모드 — 키워드 보강 · 반경 · 중복 제거 · 최신 등록 추정순");
  const kwBefore = kwCalls().length;
  markers.length = 0;                       // 이 지도 그리기 한 번만 센다
  click(chip("#viewChips", "data-view", "new"));
  await sleep(320);
  const kwNew = kwCalls().slice(kwBefore);
  check("'신규오픈' 키워드 검색", kwNew.some((s) => s.q === "신규오픈"), JSON.stringify(kwNew.slice(0, 2)));
  check("'오픈' 키워드 검색", kwNew.some((s) => s.q === "오픈"));
  check("키워드도 반경·중심 좌표로 검색", kwNew.length > 0 && kwNew.every((s) => s.radius === 500 && s.hasLocation), JSON.stringify(kwNew[0]));
  check("신규 키워드로만 잡힌 가게가 목록에", names().indexOf("신규오픈 국수집") >= 0, names().join(" / "));
  check("중복 가게는 한 번만", names().filter((n) => n === "새로 연 파스타").length === 1, names().join(" / "));
  check("반경 밖(6.7km) 결과는 빠짐", names().indexOf("멀리 오픈한 집") < 0);
  check("음식점 아닌 키워드 결과는 빠짐", names().indexOf("오픈 부동산") < 0);
  check("'전체'에서는 카페 빠짐", names().indexOf("오픈 카페") < 0 && names().indexOf("카페 어딘가") < 0, names().join(" / "));
  check("장소 id 큰 순(최신 등록 추정) 정렬", names().join("|") === "신규오픈 국수집|새로 연 파스타|초밥야|판교 옛날국밥", names().join("|"));
  check("제목이 '새로 생긴 식당'", $("#restTitle").textContent.trim() === "새로 생긴 식당", $("#restTitle").textContent);
  check("추첨 버튼 이름도 모드에 맞춤", $("#restDrawLabel").textContent === "새로 생긴 식당", $("#restDrawLabel").textContent);
  check("안내 줄 표시(정확한 개업일 미제공 문구)", $("#newNote").hidden === false && $("#newNote").textContent.indexOf("카카오맵 최신 등록 추정순·신규 키워드 기반 (정확한 개업일은 미제공)") >= 0, $("#newNote").textContent.trim());
  check("카드에 카카오맵 링크·주소·거리", !!rows()[0].querySelector("a[href*='place.map.kakao.com']") && rows()[0].textContent.indexOf("판교로 50") >= 0 && /\d+m/.test(rows()[0].textContent), rows()[0].textContent.slice(0, 90));
  check("카드마다 '빼기' 토글", rows().every((r) => !!r.querySelector("input[data-action='toggle-place']")));
  check("지도 마커 = 목록 + 내 위치", markers.length === names().length + 1, String(markers.length) + " / " + names().length);
  check("첫 조회에는 NEW 뱃지 없음(비교할 과거 없음)", $$("#restList .new-badge").length === 0, String($$("#restList .new-badge").length));
  {
    const snap = snaps();
    const key = Object.keys(snap || {})[0];
    const ids = (snap && snap[key] && snap[key].ids) || [];
    check("이번에 본 id 를 기기 스냅샷에 저장", !!key && ids.indexOf("1000050") >= 0 && ids.indexOf("1000001") >= 0, key + " " + ids.join(","));
    check("반경 밖 id 는 스냅샷에 없음", ids.indexOf("1000060") < 0, ids.join(","));
  }

  console.log("\n[3] 재조회 — 이전에 없던 가게에만 NEW 뱃지");
  foodList = FOOD.concat([LATER]);
  keywordHits = KEYWORD_HITS.concat([LATER]);
  click($("[data-action='find-places']"));
  await sleep(320);
  const newRows = rows().filter((r) => !!r.querySelector(".new-badge"));
  check("새로 등장한 1곳만 NEW", newRows.length === 1 && newRows[0].textContent.indexOf("따끈한 신상 백반") >= 0, newRows.map((r) => r.textContent.slice(0, 30)).join(" / "));
  check("NEW 개수 표시", $("#restCount").textContent.indexOf("NEW 1") >= 0, $("#restCount").textContent);
  check("NEW 가게가 목록 맨 앞(가장 큰 id)", names()[0] === "따끈한 신상 백반", names().join("|"));
  {
    const snap = snaps() || {};
    const ids = (snap[Object.keys(snap)[0]] || {}).ids || [];
    check("스냅샷에 새 가게 id 추가", ids.indexOf("1000100") >= 0, ids.join(","));
  }

  console.log("\n[4] 새로 생긴 식당 목록에서도 '빼기' 제외 랜덤 추첨");
  {
    const keepName = names()[names().length - 1];
    const ids = $$("#restList input[data-action='toggle-place']").map((b) => b.getAttribute("data-id"));
    ids.slice(0, -1).forEach((id) => {
      const box = $("#restList input[data-action='toggle-place'][data-id='" + id + "']");
      if (box) click(box);
    });
    await sleep(80);
    const pool = $$("#restList .rest-row").filter((r) => !r.classList.contains("is-excluded"));
    check("뺀 곳은 흐려짐", pool.length === 1, String(pool.length));
    click($("[data-action='draw-place']"));
    await sleep(200);
    check("뽑힌 곳은 빼지 않은 한 곳", $("#restResult").hidden === false && $("#restResult").textContent.indexOf(keepName) >= 0, $("#restResult").textContent.slice(0, 80));
  }

  console.log("\n[5] 🍽️ 전체 맛집으로 돌아오면 기존 동작 그대로");
  const kwBeforeAll = kwCalls().length;
  click(chip("#viewChips", "data-view", "all"));
  await sleep(320);
  check("전체 모드에서는 신규 키워드 다시 안 씀", kwCalls().length === kwBeforeAll, String(kwCalls().length - kwBeforeAll));
  check("가까운 순 정렬 복귀", names()[0] === "판교 옛날국밥", names().join("|"));
  check("안내 줄 다시 숨김", $("#newNote").hidden === true);
  check("NEW 뱃지 없음", $$("#restList .new-badge").length === 0);
  check("제목 '주변 음식점'", $("#restTitle").textContent.trim() === "주변 음식점", $("#restTitle").textContent);

  console.log("\n[6] 신규 모드 + 카페·디저트 분류");
  click(chip("#viewChips", "data-view", "new"));
  await sleep(320);
  click(chip("#placeFilter", "data-cat", "cafe"));
  await sleep(320);
  check("카페 분류에서는 CE7 로 검색", searches.slice(-30).some((s) => s.code === "CE7"));
  check("카페만 목록에(키워드로 잡힌 오픈 카페 포함)", names().indexOf("오픈 카페") >= 0 && names().indexOf("카페 어딘가") >= 0 && names().indexOf("판교 옛날국밥") < 0, names().join(" / "));
  check("제목 '새로 생긴 카페·디저트'", $("#restTitle").textContent.trim() === "새로 생긴 카페·디저트", $("#restTitle").textContent);

  console.log("\n[7] 순수 로직 (정렬 · 그리드 키 · NEW 판정)");
  {
    const T = window.LunchApp._test;
    check("숫자 id 값", T.placeIdValue("1000009") === 1000009);
    check("숫자 아닌 fallback id 는 맨 뒤", T.placeIdValue("이름|127,37") === -1);
    const sorted = T.sortByNewest([
      { id: "1000001", distance: 10 }, { id: "1000100", distance: 900 },
      { id: "1000009", distance: 100 }, { id: "abc|x,y", distance: 1 }
    ]);
    check("id 내림차순 정렬", sorted.map((p) => p.id).join(",") === "1000100,1000009,1000001,abc|x,y", sorted.map((p) => p.id).join(","));
    check("같은 동네는 같은 그리드 키", T.gridKey(37.3901, 127.1004) === T.gridKey(37.3902, 127.1003), T.gridKey(37.3901, 127.1004));
    check("다른 동네는 다른 그리드 키", T.gridKey(37.3901, 127.1004) !== T.gridKey(37.5, 127.2));
    check("좌표 없으면 빈 키", T.gridKey(NaN, NaN) === "");

    // 별도 좌표로 스냅샷 동작만 따로 확인 (본 테스트 그리드 오염 방지)
    const a = [{ id: "2000001" }, { id: "2000002" }];
    T.markNewPlaces(a, 33.111, 126.111);
    check("첫 조회는 NEW 아님", a.every((p) => p.isNew === false));
    const b = [{ id: "2000001" }, { id: "2000002" }, { id: "2000003" }];
    T.markNewPlaces(b, 33.111, 126.111);
    check("두 번째 조회에서 새 id 만 NEW", b.filter((p) => p.isNew).map((p) => p.id).join(",") === "2000003", b.map((p) => p.id + ":" + p.isNew).join(","));

    T.setPlaceCategory("all");
    check("분류 판정: 전체는 카페 제외", T.placeMatchesCategory({ category: "음식점 > 카페,디저트 > 카페", kind: "cafe" }) === false);
    check("분류 판정: 전체는 한식 포함", T.placeMatchesCategory({ category: "음식점 > 한식 > 국밥" }) === true);
    T.setPlaceCategory("korean");
    check("분류 판정: 한식 분류에서는 중식 빠짐", T.placeMatchesCategory({ category: "음식점 > 중식 > 짬뽕" }) === false);
    T.setPlaceCategory("all");
  }

  console.log("\n========================================");
  if (failures) { console.log("실패 " + failures + "개"); process.exit(1); }
  console.log("새로 생긴 식당 테스트 통과 ✅");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
