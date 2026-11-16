/* 홈 화면 태블릿 4단 배치 테스트 (jsdom)
   1줄 시간·용돈·타이머 → 2줄 일정달력·날씨 → 3줄 오늘할일·체크리스트 → 4줄 이후 오늘현황·인사 */
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
const pad = (n) => String(n).padStart(2, "0");
const y = kst.getUTCFullYear();
const m = kst.getUTCMonth() + 1;
const d = kst.getUTCDate();
const todayKey = y + "-" + pad(m) + "-" + pad(d);
const otherDay = d + 4 <= 28 ? d + 4 : d - 4;
const otherKey = y + "-" + pad(m) + "-" + pad(otherDay);

const payload = {
  version: 1,
  updatedAt: new Date().toISOString(),
  study: { items: [{ id: "s-read", name: "책 읽기", minutes: 15, kind: "countdown", done: false }], dayKey: todayKey, rewarded: false },
  stamps: {},
  badges: {},
  dex: { unlocked: {}, seen: {} },
  mission: { todayKey, index: 0, doneToday: false, doneTotal: 1, history: [] },
  todos: {
    dain: [{ id: "t1", text: "유치원 가방 정리", done: false }],
    mom: [{ id: "t2", text: "장보기 목록 쓰기", done: true }],
    dad: [],
  },
  chat: [],
  settings: { weatherCache: null },
  calendar: {
    events: [
      { id: "e1", date: todayKey, title: "다인이 유치원", allDay: true, time: "", who: "dain", by: "", note: "" },
      { id: "e2", date: otherKey, title: "가족 나들이", allDay: true, time: "", who: "all", by: "", note: "" },
    ],
  },
  checklists: {
    lists: [
      { id: "cl1", emoji: "🧺", title: "장보기", items: [{ id: "i1", text: "우유", done: false }, { id: "i2", text: "계란", done: true }], by: "", createdAt: "" },
      { id: "cl2", emoji: "🎒", title: "준비물", items: [], by: "", createdAt: "" },
    ],
  },
};

(async function main() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/family-dashboard/index.html", pretendToBeVisual: true, runScripts: "outside-only" });
  const { window } = dom;
  const { document } = window;

  window.fetch = (url) => {
    const u = String(url);
    if (u.includes("air-quality")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: { pm10: 28, pm2_5: 11 } }) });
    if (u.includes("open-meteo")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: { temperature_2m: 7, weather_code: 1 }, daily: { temperature_2m_max: [11], temperature_2m_min: [2] } }) });
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
  await sleep(700);

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const activeView = () => $(".view.is-active").getAttribute("data-view");

  console.log("\n[1] 부팅");
  check("부팅 오류 없음", errors.length === 0, errors.join(" / "));
  check("홈 탭 활성", activeView() === "home");

  console.log("\n[2] 홈 그리드 4단 순서");
  const grid = $("#homeContent .home-grid");
  check(".home-grid 존재", !!grid);
  const kids = Array.from(grid.children);
  check("그리드 자리 7개", kids.length === 7, "got " + kids.length);

  const row1 = kids[0];
  const row1Ids = Array.from(row1.children).map((c) => c.id).join(",");
  check("1번째 줄 = 시간·용돈·타이머 (3열 묶음)", row1.classList.contains("home-top") && row1.classList.contains("span-2"), row1.className);
  check("1번째 줄 카드 순서 유지", row1Ids === "homeClockCard,allowanceCard,tabletTimerCard", row1Ids);

  const calCell = kids[1];
  check("2번째 줄 왼쪽 = 일정 · 달력", calCell.classList.contains("home-cell-cal") && !!calCell.querySelector(".home-cal"), calCell.className);
  check("2번째 줄 오른쪽 = 날씨", kids[2].classList.contains("home-cell-weather") && !!kids[2].querySelector("#weatherCard"), kids[2].className);
  check("3번째 줄 왼쪽 = 오늘 할 일", kids[3].classList.contains("home-cell-todo") && kids[3].textContent.includes("오늘 할 일"), kids[3].className);
  check("3번째 줄 오른쪽 = 함께 체크리스트", kids[4].classList.contains("home-cell-check") && kids[4].textContent.includes("함께 체크리스트"), kids[4].className);
  check("4번째 줄 = 오늘 현황(전체 폭)", kids[5].classList.contains("span-2") && kids[5].textContent.includes("오늘 현황"), kids[5].className);
  check("마지막 = 인사 카드", kids[6].textContent.includes("힘차게"), kids[6].textContent.slice(0, 40));

  console.log("\n[3] 홈 미니 달력");
  const calCard = calCell.querySelector(".home-cal");
  check("월 제목", $("#hcalMonth") && $("#hcalMonth").textContent === m + "월", $("#hcalMonth") && $("#hcalMonth").textContent);
  check("요일 머리 7칸", calCard.querySelectorAll(".hcal-dow span").length === 7);
  const cells = $$("#homeCalGrid .hcal-cell");
  check("날짜 칸이 7의 배수", cells.length > 0 && cells.length % 7 === 0, "got " + cells.length);
  check("이번 달 칸 수 28~31", cells.filter((c) => !c.classList.contains("is-out")).length >= 28 && cells.filter((c) => !c.classList.contains("is-out")).length <= 31);
  const todayCell = $("#homeCalGrid .hcal-cell.is-today");
  check("오늘 날짜 강조", !!todayCell && Number(todayCell.querySelector(".hcal-num").textContent) === d, todayCell ? todayCell.textContent : "없음");
  const todayDots = todayCell ? todayCell.querySelectorAll(".hcal-dot").length : 0;
  check("일정 있는 날 점 표시", todayDots === 1 && todayCell.classList.contains("has-events"), "dots=" + todayDots);
  check("일정 점 색 구분(who-dain)", !!todayCell.querySelector(".hcal-dot.who-dain"));
  check("누르면 가족 달력 동작", cells.every((c) => c.getAttribute("data-action") === "home-cal-day" && /^\d{4}-\d{2}-\d{2}$/.test(c.getAttribute("data-date"))));
  check("다가오는 일정 목록", calCard.textContent.includes("다가오는 일정") && calCard.textContent.includes("가족 나들이"));
  check("달력 열기 버튼", !!calCard.querySelector('[data-action="tab"][data-tab="together"][data-sub="calendar"]'));

  console.log("\n[4] 3번째 줄 내용");
  check("오늘 할 일에 남은 할 일 표시", kids[3].textContent.includes("유치원 가방 정리"));
  check("오늘 할 일 사람별 완료 수", kids[3].querySelectorAll(".stat-num").length === 3);
  check("체크리스트 목록·남은 개수", kids[4].textContent.includes("장보기") && kids[4].textContent.includes("1개 남음"));

  console.log("\n[5] 날짜를 누르면 함께 → 가족 달력");
  const targetDate = y + "-" + pad(m) + "-15";
  const targetCell = cells.find((c) => c.getAttribute("data-date") === targetDate);
  check("15일 칸 찾음", !!targetCell);
  click(targetCell);
  await sleep(200);
  check("함께 탭으로 이동", activeView() === "together", activeView());
  check("가족 달력 하위 탭 활성", !!$('#togetherSeg .seg-btn.is-active[data-sub="calendar"]'));
  const selected = $("#calGrid .cal-cell.is-selected");
  check("고른 날짜가 달력에 선택됨", !!selected && selected.getAttribute("data-date") === targetDate, selected && selected.getAttribute("data-date"));
  check("달력 월도 이번 달", ($("#calMonthLabel") || {}).textContent === m + "월 " + y, ($("#calMonthLabel") || {}).textContent);

  // 홈으로 돌아와 '달력 열기' 버튼도 확인
  click($('.tab-btn[data-tab="home"]'));
  await sleep(150);
  click($('#homeContent [data-action="tab"][data-tab="together"][data-sub="calendar"]'));
  await sleep(150);
  check("달력 열기 버튼도 함께 탭으로", activeView() === "together");

  console.log("\n[6] 날씨 카드 (성남시 분당구)");
  check("지역 이름 표시", $("#weatherCard").textContent.includes("성남시 분당구"), $("#weatherCard").textContent.slice(0, 50));
  check("기온 표시", /7/.test(($(".weather-temp") || {}).textContent || ""));

  console.log("\n================================");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL HOME LAYOUT CHECKS PASSED ✅");
  process.exit(0);
})();
