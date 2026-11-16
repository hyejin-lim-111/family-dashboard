/* 하위 호환 테스트 — 달력·체크리스트가 없던 예전 기록도 그대로 살아나야 한다. */
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

const kst = new Date(Date.now() + 9 * 3600 * 1000);
const todayKey = kst.getUTCFullYear() + "-" + String(kst.getUTCMonth() + 1).padStart(2, "0") + "-" + String(kst.getUTCDate()).padStart(2, "0");
const thisMonth = kst.getUTCMonth() + 1;
const thisYear = kst.getUTCFullYear();

// 달력·체크리스트 필드가 전혀 없는, 이전 버전의 저장 데이터
const legacyPayload = {
  version: 1,
  updatedAt: new Date().toISOString(),
  study: {
    items: [{ id: "s-read", name: "책 읽기", minutes: 15, kind: "countdown", done: true }],
    dayKey: todayKey,
    rewarded: true,
  },
  stamps: {},
  badges: { streak3: true },
  dex: { unlocked: { f_star: todayKey }, seen: {} },
  mission: { todayKey, index: 3, doneToday: false, doneTotal: 2, history: [] },
  todos: { dain: [{ id: "t1", text: "유치원 가방 정리", done: true }], mom: [], dad: [] },
  chat: [{ id: "m1", from: "mom", fromName: "엄마", text: "오늘도 사랑해", at: new Date().toISOString() }],
  settings: { weatherCache: null },
};
legacyPayload.stamps[todayKey] = 3;

function boot(payload, label) {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/family-dashboard/index.html", pretendToBeVisual: true, runScripts: "outside-only" });
  const { window } = dom;
  window.fetch = (url) => {
    const u = String(url);
    if (u.includes("air-quality")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: { pm10: 30, pm2_5: 12 } }) });
    if (u.includes("open-meteo")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: { temperature_2m: 6, weather_code: 1 }, daily: { temperature_2m_max: [10], temperature_2m_min: [1] } }) });
    }
    return Promise.reject(new Error("offline (test)"));
  };
  const errors = [];
  window.addEventListener("error", (e) => errors.push(e.message));
  window.localStorage.setItem("family-dashboard.state.v1", JSON.stringify({ payload: payload, updatedAt: payload.updatedAt }));
  window.localStorage.setItem("family-dashboard.device.v1", "dain");

  const load = (f) => window.eval(fs.readFileSync(path.join(ROOT, f), "utf8"));
  load("config.js");
  window.FAMILY_CONFIG.supabase = { url: "", anonKey: "", table: "family_state", rowId: "main", realtime: false };
  load("store.js");
  load("app.js");
  console.log("\n[" + label + "]");
  return { window, document: window.document, errors };
}

(async function main() {
  /* ---- 1) 예전 기록(새 필드 없음) ---- */
  {
    const { window, document, errors } = boot(legacyPayload, "1) 예전 기록 불러오기");
    await sleep(700);
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));
    const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));

    check("부팅 오류 없음", errors.length === 0, errors.join(" / "));
    check("기기 프로필 기억", $("#deviceGate").hidden === true);
    check("홈이 그려짐", $("#homeContent").textContent.includes("오늘 현황"));
    const stampStat = $$("#homeContent .stat").find((s) => s.textContent.includes("모은 도장"));
    check("도장 기록 유지(3개)", !!stampStat && stampStat.querySelector(".stat-num").textContent.startsWith("3"),
      stampStat ? stampStat.textContent : "모은 도장 칸 없음");

    click($('.tab-btn[data-tab="mission"]'));
    check("할 일 기록 유지", $(".todo-item .txt").textContent === "유치원 가방 정리");
    click($('.tab-btn[data-tab="chat"]'));
    check("채팅 기록 유지", $("#chatList").textContent.includes("오늘도 사랑해"));

    click($('.tab-btn[data-tab="together"]'));
    await sleep(60);
    check("달력은 빈 상태로 시작", $$(".cal-cell").length === 42 && $$(".event-row").length === 0);
    check("달력 안내 문구", $("#dayEvents").textContent.includes("아직 일정이 없어요"));

    click($('.seg-btn[data-sub="checklist"]'));
    await sleep(60);
    check("체크리스트 기본 리스트 2개 자동 생성", $$(".checklist").length === 2, "got " + $$(".checklist").length);

    // 새 필드가 실제로 저장되는지
    click($('.seg-btn[data-sub="calendar"]'));
    click($('[data-action="add-event"]'));
    await sleep(60);
    $("#evTitle").value = "가족 외식";
    click($("#evSaveBtn"));
    await sleep(400);
    const saved = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
    check("새 기록이 기존 기록 위에 저장됨", saved.calendar.events.length === 1 && saved.chat.length === 1 && saved.todos.dain.length === 1);
    check("예전 도장 기록 보존", Object.values(saved.stamps).reduce((a, b) => a + b, 0) === 3);
    check("해금 요정 보존", Object.keys(saved.dex.unlocked).length === 1);
  }

  /* ---- 2) 망가진/반쯤 채워진 새 필드 ---- */
  {
    const messy = JSON.parse(JSON.stringify(legacyPayload));
    messy.calendar = {
      events: [
        { id: "bad-1", title: "날짜 없는 일정" },
        { id: "e1", date: thisYear + "-" + String(thisMonth).padStart(2, "0") + "-20", title: "", who: "ghost", time: "9:00" },
        { id: "e2", date: "그냥 글자", title: "이상한 날짜" },
      ],
    };
    messy.checklists = { lists: [{ id: "l1", title: "장보기", items: [{ id: "i1", text: "우유", done: true }, { id: "i2" }] }] };

    const { window, document, errors } = boot(messy, "2) 반쯤 채워진 새 필드");
    await sleep(700);
    const $ = (s) => document.querySelector(s);
    const $$ = (s) => Array.from(document.querySelectorAll(s));
    const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));

    check("부팅 오류 없음", errors.length === 0, errors.join(" / "));
    click($('.tab-btn[data-tab="together"]'));
    await sleep(60);
    const cell = $('.cal-cell[data-date="' + thisYear + "-" + String(thisMonth).padStart(2, "0") + '-20"]');
    check("쓸 수 있는 일정만 남김", cell && cell.classList.contains("has-events"));
    click(cell);
    await sleep(60);
    check("제목 없는 일정은 기본 제목", $("#dayEvents").textContent.includes("(제목 없음)"));
    check("알 수 없는 대상은 가족 모두", $("#dayEvents").textContent.includes("가족 모두"));

    click($('.seg-btn[data-sub="checklist"]'));
    await sleep(60);
    check("빈 항목은 걸러짐", $$(".cl-item").length === 1 && $(".cl-item .txt").textContent === "우유");
    check("내가 만든 리스트는 그대로", $$(".checklist").length === 1, "got " + $$(".checklist").length);
  }

  console.log("\n================================");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL BACKWARD-COMPAT CHECKS PASSED ✅");
  process.exit(0);
})().catch((e) => { console.error("TEST CRASH:", e); process.exit(2); });
