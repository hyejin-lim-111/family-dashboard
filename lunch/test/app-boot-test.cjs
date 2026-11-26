/* lunch/ 앱 부트 + 인터랙션 스모크 테스트 (jsdom, 이 기기 저장 모드) */
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

(async function main() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, {
    url: "http://localhost/family-dashboard/lunch/index.html",
    pretendToBeVisual: true,
    runScripts: "outside-only",
  });
  const { window } = dom;
  const { document } = window;

  // 애니메이션 없이 바로 결과가 나오게 (테스트 속도)
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  window.fetch = () => Promise.reject(new Error("offline (test)"));
  window.scrollTo = () => {};

  const load = (f) => window.eval(fs.readFileSync(path.join(ROOT, f), "utf8"));
  load("config.js");
  // 이 테스트는 이 기기 저장(local) 모드만 검증한다.
  window.LUNCH_CONFIG.supabase = { url: "", anonKey: "", table: "lunch_state", rowId: "company-lunch", pollMs: 5000, realtime: false };
  load("store.js");
  load("app.js");

  await sleep(500);

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const rows = () => $$("#menuList .menu-row");
  const app = window.LunchApp._test;

  console.log("\n[1] 부트 · 기본 메뉴");
  check("메뉴판이 그려짐", rows().length > 0, "rows=" + rows().length);
  check("기본 메뉴 36종 이상", app.DEFAULT_MENUS.length >= 36, String(app.DEFAULT_MENUS.length));
  check("기본 메뉴가 모두 목록에 있음", rows().length === app.DEFAULT_MENUS.length, rows().length + "/" + app.DEFAULT_MENUS.length);
  check("동기화 배지 = 이 기기 저장", $("#syncBadge").textContent === "이 기기 저장", $("#syncBadge").textContent);
  check("뽑기 힌트에 개수 표시", /메뉴 \d+개/.test($("#drawHint").textContent), $("#drawHint").textContent);
  check("6개 분류 칩 + 전체", $$("#menuFilter .chip").length === 7, String($$("#menuFilter .chip").length));

  console.log("\n[2] 메뉴 추가 → 저장 · 다른 화면에도 반영");
  $("#menuName").value = "순두부찌개";
  $("#menuCategory").value = "korean";
  $("#menuMemo").value = "2층 8,000원";
  $("#addMenuForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await sleep(60);
  const added = app.getState().menus.find((m) => m.name === "순두부찌개");
  check("상태에 추가됨", !!added && added.custom === true);
  check("메모 저장", added && added.memo === "2층 8,000원", added && added.memo);
  check("목록에 보임", rows().some((r) => r.textContent.includes("순두부찌개")));
  check("추가 후 입력칸 비움", $("#menuName").value === "");
  check("localStorage 에 저장", !!window.localStorage.getItem("lunch-app.state.v1"));

  console.log("\n[3] 오늘 빼기 토글");
  const firstCheck = $("#menuList input[data-action='toggle-exclude']");
  const firstId = firstCheck.getAttribute("data-id");
  click(firstCheck);
  await sleep(30);
  check("제외 목록에 들어감", app.getState().excluded.indexOf(firstId) >= 0, app.getState().excluded.join(","));
  check("힌트에 '오늘 빼기 1개'", $("#drawHint").textContent.includes("오늘 빼기 1개"), $("#drawHint").textContent);
  check("행이 흐려짐", !!$("#menuList .menu-row[data-id='" + firstId + "'].is-excluded"));
  const pool = app.drawPool();
  check("제외한 메뉴는 추첨 풀에서 빠짐", !pool.some((m) => m.id === firstId));

  console.log("\n[4] 메뉴 뽑기 → 결과 카드 · 공유 기록");
  const before = app.getState().history.length;
  $("#drawBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await sleep(120);
  const res = $("#drawResult");
  check("결과 카드가 보임", res && res.hidden === false);
  const winner = app.getState().history[0];
  check("기록이 1개 늘어남", app.getState().history.length === before + 1, String(app.getState().history.length));
  check("결과 이름이 기록과 같음", res.textContent.includes(winner.name), winner.name);
  check("기록 목록에 표시", $("#historyList").textContent.includes(winner.name));
  check("뽑은 사람 '익명' (닉네임 없음)", winner.by === "익명", winner.by);
  check("제외한 메뉴가 뽑히지 않음", winner.menuId !== firstId);

  $("#nickname").value = "혜진";
  $("#nickname").dispatchEvent(new window.Event("input", { bubbles: true }));
  $("#drawBtn").dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  await sleep(120);
  check("닉네임이 기록에 남음", app.getState().history[0].by === "혜진", app.getState().history[0].by);
  check("닉네임 기기 저장", window.localStorage.getItem("lunch-app.nickname.v1") === "혜진");

  console.log("\n[5] 숨기기 · 삭제 · 복원");
  const beforeCount = rows().length;
  const eye = $("#menuList .menu-row .icon-btn[data-action='toggle-hide']");
  const eyeId = eye.getAttribute("data-id");
  click(eye);
  await sleep(30);
  check("숨긴 메뉴는 목록에서 빠짐", rows().length === beforeCount - 1, rows().length + "/" + beforeCount);
  check("숨김 안내가 보임", $("#hiddenNote").hidden === false);

  const delBtn = $("#menuList .menu-row .icon-btn[data-action='delete-menu']");
  const delId = delBtn.getAttribute("data-id");
  click(delBtn);
  await sleep(30);
  const confirmBtn = $("#menuList .icon-btn[data-action='delete-menu-confirm'][data-id='" + delId + "']");
  check("삭제 확인 버튼이 나옴", !!confirmBtn);
  click(confirmBtn);
  await sleep(30);
  check("메뉴가 삭제됨", !app.getState().menus.some((m) => m.id === delId));
  check("tombstone 기록", !!(app.getState().deleted.menus || {})[delId]);

  click($("[data-action='restore-defaults']"));
  await sleep(30);
  check("기본 메뉴 복원", app.getState().menus.some((m) => m.id === delId), delId);
  check("복원 후 tombstone 정리", !(app.getState().deleted.menus || {})[delId]);
  check("숨긴 메뉴도 다시 보임", app.getState().menus.find((m) => m.id === eyeId).hidden === false);

  console.log("\n[6] 분류 필터");
  const koreanChip = $$("#menuFilter .chip").find((c) => c.getAttribute("data-cat") === "korean");
  click(koreanChip);
  await sleep(30);
  const cats = rows().map((r) => app.getState().menus.find((m) => m.id === r.getAttribute("data-id")).category);
  check("한식만 보임", cats.every((c) => c === "korean"), cats.join(","));
  const activeChip = $$("#menuFilter .chip").find((c) => c.getAttribute("data-cat") === "korean");
  check("필터 칩 활성", activeChip && activeChip.classList.contains("is-active"));
  const poolBefore = app.drawPool().length;
  app.addMenu("테스트중식", "chinese", "");
  check("필터 중 새 메뉴는 풀에 안 들어감", app.drawPool().length === poolBefore + 0, String(app.drawPool().length));
  click($$("#menuFilter .chip").find((c) => c.getAttribute("data-cat") === "all"));
  await sleep(20);

  console.log("\n[7] 기록 지우기");
  click($("[data-action='clear-history']"));
  await sleep(30);
  check("기록 비워짐", app.getState().history.length === 0);
  check("tombstone 남음", Object.keys(app.getState().deleted.history).length > 0);
  check("기록 목록 안내", $("#historyList").textContent.includes("아직 뽑기 기록이 없어요"));

  console.log("\n[8] 주변 맛집 탭");
  click($("#tabPlaces"));
  await sleep(30);
  check("탭 전환", $("#viewPlaces").classList.contains("is-active") && !$("#viewMenu").classList.contains("is-active"));
  check("카카오 키 상태 표시", $("#kakaoKeyState").textContent.includes("연결됨"), $("#kakaoKeyState").textContent);
  check("카카오 키 있으면 안내 숨김", $("#kakaoNotice").hidden === true);
  check("반경 칩 4개", $$("#radiusChips .chip").length === 4);
  check("분류 칩 6개", $$("#placeFilter .chip").length === 6);
  click($("[data-action='locate']"));
  await sleep(30);
  check("위치 없을 때 안내 토스트", $("#toast").hidden === false && /위치/.test($("#toast").textContent), $("#toast").textContent);
  click($("[data-action='draw-place']"));
  await sleep(30);
  check("맛집 없을 때 추첨 안내", /불러와 주세요|뽑을 맛집/.test($("#toast").textContent), $("#toast").textContent);

  console.log("\n[9] 데이터 모양 점검");
  const st = app.getState();
  check("state 필드", Array.isArray(st.menus) && Array.isArray(st.excluded) && Array.isArray(st.history) && !!st.deleted);
  check("메뉴 id 중복 없음", new Set(st.menus.map((m) => m.id)).size === st.menus.length);
  check("기록 최대 40", st.history.length <= 40);

  console.log("\n========================================");
  if (failures) { console.log("실패 " + failures + "개"); process.exit(1); }
  console.log("앱 부트/인터랙션 테스트 통과 ✅");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
