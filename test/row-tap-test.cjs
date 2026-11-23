/* 목록 행 전체 누르기 — 작은 동그라미(.check-btn)를 정확히 겨냥하지 않아도
   행(카드) 아무 곳이나 누르면 완료/해제가 되고, 안쪽 삭제·수정 버튼과는 겹치지 않는지 확인한다.
   대상: 🌙 다인이 저녁 루틴 · 🗒️ 각자 오늘 할 일 · 🧺 함께 체크리스트 · 📖 공부 */
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

function kstKey(offsetDays) {
  const kst = new Date(Date.now() + 9 * 3600 * 1000 + (offsetDays || 0) * 86400000);
  return kst.getUTCFullYear() + "-" + String(kst.getUTCMonth() + 1).padStart(2, "0") + "-" + String(kst.getUTCDate()).padStart(2, "0");
}
const TODAY = kstKey(0);

function boot(payload) {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, {
    url: "http://localhost/family-dashboard/index.html",
    pretendToBeVisual: true,
    runScripts: "outside-only",
  });
  const { window } = dom;
  const { document } = window;

  window.fetch = () => Promise.reject(new Error("offline (test)"));
  const errors = [];
  window.addEventListener("error", (e) => errors.push(e.message));
  window.addEventListener("unhandledrejection", (e) => errors.push("rejection: " + (e.reason && e.reason.message)));

  if (payload) {
    window.localStorage.setItem("family-dashboard.state.v1", JSON.stringify({ payload, updatedAt: payload.updatedAt }));
  }
  window.localStorage.setItem("family-dashboard.device.v1", "dain");

  const load = (f) => window.eval(fs.readFileSync(path.join(ROOT, f), "utf8"));
  load("config.js");
  window.FAMILY_CONFIG.supabase = { url: "", anonKey: "", table: "family_state", rowId: "main", realtime: false };
  load("store.js");
  load("app.js");

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const saved = () => JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  return { window, document, $, $$, click, saved, errors };
}

/* 저녁 루틴·할 일·체크리스트·공부가 모두 들어 있는 기록 */
function basePayload() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    study: { items: [{ id: "s-read", name: "책 읽기", minutes: 15, kind: "countdown", done: false }], dayKey: TODAY, rewarded: false },
    stamps: {}, badges: {},
    mission: { todayKey: TODAY, index: 1, doneToday: false, doneTotal: 0, history: [] },
    todos: { dain: [{ id: "t1", text: "유치원 가방 정리", done: false }], mom: [], dad: [] },
    chat: [],
    calendar: { events: [] },
    checklists: { lists: [{ id: "l1", emoji: "🛒", title: "장보기", items: [{ id: "i1", text: "우유", done: false }] }] },
    settings: { weatherCache: null },
  };
}

(async function main() {
  /* =========================================================
     1) 🌙 다인이 저녁 루틴 — 행 아무 곳이나 눌러도 체크
     ========================================================= */
  console.log("\n[1] 저녁 루틴 행 전체 누르기");
  {
    const t = boot(basePayload());
    await sleep(700);
    check("부팅 오류 없음", t.errors.length === 0, t.errors.join(" / "));
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(80);

    const row = t.$('.routine-item[data-routine="r-bath"]');
    check("루틴 행이 눌러지는 카드(.row-tap + toggle-routine)", !!row &&
      row.classList.contains("row-tap") && row.getAttribute("data-action") === "toggle-routine");
    check("안쪽 동그라미 버튼도 그대로 있음", !!row.querySelector("button.check-btn[data-action='toggle-routine']"));

    // ① 글자(.txt)를 눌러도 체크
    t.click(row.querySelector(".txt"));
    await sleep(320);
    check("글자를 누르면 체크됨(저장)", t.saved().routine.days[TODAY].checked["r-bath"] === true);
    check("화면 1 / 4 완료", t.$("#routineToday").textContent === "1 / 4 완료", t.$("#routineToday").textContent);
    check("행이 완료 표시(.done)", !!t.$('.routine-item[data-routine="r-bath"]').classList.contains("done"));

    // ② 여백(행 자체)을 눌러도 해제
    t.click(t.$('.routine-item[data-routine="r-bath"]'));
    await sleep(320);
    check("행 여백을 다시 누르면 해제됨", !t.saved().routine.days[TODAY].checked["r-bath"]);
    check("해제 후 0 / 4 완료", t.$("#routineToday").textContent === "0 / 4 완료", t.$("#routineToday").textContent);

    // ③ 보상 배지(+100원 글자)를 눌러도 체크
    t.click(t.$('.routine-item[data-routine="r-homework"] .rt-reward'));
    await sleep(320);
    check("+100원 배지를 눌러도 체크됨", t.saved().routine.days[TODAY].checked["r-homework"] === true);

    // ④ 동그라미 버튼은 예전처럼 한 번만 토글
    t.click(t.$('.routine-item[data-routine="r-meal"] .check-btn'));
    await sleep(320);
    check("동그라미 클릭도 한 번만 체크", t.saved().routine.days[TODAY].checked["r-meal"] === true &&
      t.$("#routineToday").textContent === "2 / 4 완료", t.$("#routineToday").textContent);

    // ⑤ 🗑️ 삭제 버튼은 체크와 겹치지 않는다 (확인 창이 뜨고 체크 상태는 그대로)
    const before = JSON.stringify(t.saved().routine.days[TODAY].checked);
    t.click(t.$('.routine-item[data-routine="r-meal"] [data-action="delete-routine"]'));
    await sleep(150);
    check("삭제 버튼 → 확인 모달", t.$("#modalBox").textContent.includes("저녁 루틴에서 지울까요"));
    check("삭제 버튼을 눌러도 체크 상태는 그대로", JSON.stringify(t.saved().routine.days[TODAY].checked) === before);
    t.click(t.$('[data-action="close-modal"]'));
    await sleep(120);
    check("모달 닫기 후 루틴 4개 그대로", t.$$(".routine-item").length === 4, String(t.$$(".routine-item").length));
    check("저장 구조 유지(체크 2개)", Object.keys(t.saved().routine.days[TODAY].checked).length === 2);
  }

  /* =========================================================
     2) 🗒️ 각자 오늘 할 일 — 행 전체 누르기
     ========================================================= */
  console.log("\n[2] 할 일 행 전체 누르기");
  {
    const t = boot(basePayload());
    await sleep(700);
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(80);

    const row = t.$('.todo-item');
    check("할 일 행이 눌러지는 카드", !!row && row.classList.contains("row-tap") &&
      row.getAttribute("data-action") === "toggle-todo", row && row.getAttribute("data-action"));

    t.click(row.querySelector(".txt"));
    await sleep(320);
    check("글자를 누르면 완료", t.saved().todos.dain[0].done === true);
    check("화면에 완료 표시", !!t.$(".todo-item.done"));

    t.click(t.$(".todo-item"));
    await sleep(320);
    check("행을 다시 누르면 해제", t.saved().todos.dain[0].done === false);

    const before = t.saved().todos.dain.length;
    t.click(t.$('.todo-item [data-action="delete-todo"]'));
    await sleep(500);
    check("삭제 버튼은 완료 토글이 아니라 삭제만", t.saved().todos.dain.length === before - 1,
      JSON.stringify(t.saved().todos.dain));
  }

  /* =========================================================
     3) 🧺 함께 체크리스트 — 행 전체 누르기
     ========================================================= */
  console.log("\n[3] 체크리스트 행 전체 누르기");
  {
    const t = boot(basePayload());
    await sleep(700);
    t.click(t.$('.tab-btn[data-tab="together"]'));
    await sleep(80);
    const seg = t.$('.seg-btn[data-sub="checklist"]');
    if (seg) { t.click(seg); await sleep(80); }

    const row = t.$(".cl-item");
    check("체크리스트 행이 눌러지는 카드", !!row && row.classList.contains("row-tap") &&
      row.getAttribute("data-action") === "toggle-cl-item", row && row.getAttribute("data-action"));

    t.click(row.querySelector(".txt"));
    await sleep(320);
    check("글자를 누르면 체크", t.saved().checklists.lists[0].items[0].done === true);
    check("진행 문구 1 / 1", t.$(".cl-sub").textContent.includes("1 / 1"), t.$(".cl-sub").textContent);

    t.click(t.$(".cl-item"));
    await sleep(320);
    check("행을 다시 누르면 해제", t.saved().checklists.lists[0].items[0].done === false);

    const before = t.saved().checklists.lists[0].items.length;
    t.click(t.$('.cl-item [data-action="delete-cl-item"]'));
    await sleep(500);
    check("삭제 버튼은 체크와 겹치지 않고 항목만 지움",
      t.saved().checklists.lists[0].items.length === before - 1, JSON.stringify(t.saved().checklists.lists[0].items));
  }

  /* =========================================================
     4) 📖 공부 — 행 전체 누르기 (수정 버튼은 겹치지 않음)
     ========================================================= */
  console.log("\n[4] 공부 행 전체 누르기");
  {
    const t = boot(basePayload());
    await sleep(700);
    t.click(t.$('.tab-btn[data-tab="study"]'));
    await sleep(120);

    const row = t.$(".study-item");
    check("공부 행이 눌러지는 카드", !!row && row.classList.contains("row-tap") &&
      row.getAttribute("data-action") === "toggle-study", row && row.getAttribute("data-action"));

    t.click(row.querySelector(".study-name"));
    await sleep(320);
    check("이름을 누르면 완료", !!t.$(".study-item.done"));
    check("완료 표시(.done)", !!t.$(".study-item.done"));

    t.click(t.$(".study-item"));
    await sleep(500);
    check("행을 다시 누르면 해제", t.saved().study.items[0].done === false, String(t.saved().study.items[0].done));

    t.click(t.$('.study-item [data-action="edit-study"]'));
    await sleep(150);
    check("✏️ 수정 버튼은 체크되지 않고 수정 창만", t.saved().study.items[0].done === false && !!t.$("#modalBox") &&
      t.$("#modalBox").textContent.includes("공부"));
    t.click(t.$('[data-action="close-modal"]'));
    await sleep(100);
  }

  /* =========================================================
     5) 예전 기록(새 필드 없음) 하위 호환 + 콘솔 오류 없음
     ========================================================= */
  console.log("\n[5] 예전 기록에서도 행 누르기");
  {
    const legacy = { version: 1, updatedAt: new Date().toISOString(), stamps: {}, badges: {}, todos: { dain: [], mom: [], dad: [] }, chat: [], calendar: { events: [] }, settings: {} };
    const t = boot(legacy);
    await sleep(700);
    check("부팅 오류 없음", t.errors.length === 0, t.errors.join(" / "));
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(80);
    const row = t.$(".routine-item");
    check("샘플 루틴이 눌러지는 카드로 그려짐", !!row && row.classList.contains("row-tap"), row && row.className);
    t.click(row);
    await sleep(320);
    const id = row.getAttribute("data-routine");
    check("행을 누르면 체크 저장", t.saved().routine.days[TODAY].checked[id] === true);
    check("콘솔 오류 없음", t.errors.length === 0, t.errors.join(" / "));
  }

  console.log("\n================================");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL ROW TAP CHECKS PASSED ✅");
  process.exit(0);
})().catch((e) => { console.error("TEST CRASH:", e); process.exit(2); });
