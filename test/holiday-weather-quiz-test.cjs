/* 📅 공휴일 빨간 날 · 🌤️ 주간 날씨 · 🎈 오늘의 퀴즈 테스트 (jsdom)
   ① 공휴일 데이터(holidays.js) — 2026·2027 주요 날짜
   ② 홈 미니 달력 / 함께 가족 달력 / 용돈 달력에 빨간 날 + 공휴일 이름
   ③ 날씨 카드에 7일 주간 예보(요일·아이콘·최고/최저·강수 확률) — 예전 캐시는 새로 받기
   ④ 공부 탭 「오늘의 퀴즈」 3문제 — 같은 날엔 기기마다 같은 문제
   ⑤ 보기 채점(정답/오답)·힌트·3문제 완료 시 도장 1개(하루 한 번)
   ⑥ 퀴즈 기록 저장·복원 · 기기 병합(합집합) · 예전 기록 하위 호환
   ⑦ 기존 '+ 공부 추가' 버튼과 공부 항목은 그대로
*/
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
const TODAY = kst.getUTCFullYear() + "-" + pad(kst.getUTCMonth() + 1) + "-" + pad(kst.getUTCDate());
const clone = (v) => JSON.parse(JSON.stringify(v));

const STUDY = [
  { id: "s-read", name: "책 읽기", minutes: 15, kind: "countdown", done: false },
  { id: "s-hangul", name: "한글 · 숫자 놀이", minutes: 10, kind: "countdown", done: false },
];

function payload(over) {
  const p = {
    version: 1,
    updatedAt: new Date().toISOString(),
    deleted: {},
    members: [{ id: "dain", name: "다인이" }, { id: "mom", name: "엄마" }, { id: "dad", name: "아빠" }],
    study: { items: clone(STUDY), dayKey: TODAY, rewarded: false },
    stamps: {},
    badges: {},
    dex: { unlocked: {}, seen: {} },
    mission: { todayKey: TODAY, index: 1, doneToday: false, doneTotal: 0, history: [] },
    todos: { dain: [], mom: [], dad: [] },
    chat: [],
    quickPhrases: { custom: [], hidden: [] },
    calendar: { events: [{ id: "e1", date: TODAY, title: "다인이 유치원", allDay: true, time: "", who: "dain", by: "", note: "" }] },
    checklists: { lists: [] },
    routine: {
      items: [{ id: "r-bath", name: "목욕하기" }],
      days: {}, spent: 0, spends: []
    },
    growth: { birthDate: "2021-02-16", sex: "F", records: [] },
    pet: { name: "몽실이", xp: 0, moneyXp: 0, day: TODAY, bonusDay: "", seenLevel: 1, care: { fed: 0, played: 0, petted: 0, full: 50, mood: 50, bond: 30 }, ledger: {} },
    quiz: { answered: {}, rewarded: {} },
    settings: { weatherCache: null, notify: false },
  };
  if (over) Object.keys(over).forEach((k) => { p[k] = over[k]; });
  return p;
}

// 7일치 주간 예보를 주는 가짜 Open-Meteo 응답
function weekJson() {
  const time = [], code = [], max = [], min = [], pop = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() + 9 * 3600 * 1000 + i * 86400000);
    time.push(d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()));
    code.push(i === 2 ? 61 : 1);
    max.push(12 + i);
    min.push(2 + i);
    pop.push(i === 2 ? 70 : 10);
  }
  return { current: { temperature_2m: 7, weather_code: 1, relative_humidity_2m: 55 }, daily: { time, weather_code: code, temperature_2m_max: max, temperature_2m_min: min, precipitation_probability_max: pop } };
}

function boot(state, opts) {
  opts = opts || {};
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/family-dashboard/index.html", pretendToBeVisual: true, runScripts: "outside-only" });
  const { window } = dom;
  const { document } = window;

  const calls = [];
  window.fetch = (url) => {
    const u = String(url);
    calls.push(u);
    if (u.includes("air-quality")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: { pm10: 22, pm2_5: 9 } }) });
    if (u.includes("open-meteo")) return Promise.resolve({ ok: true, json: () => Promise.resolve(opts.shortDaily ? { current: { temperature_2m: 7, weather_code: 1 }, daily: { temperature_2m_max: [11], temperature_2m_min: [2] } } : weekJson()) });
    if (u.includes("nager.at")) {
      if (opts.holidayApi === false) return Promise.reject(new Error("offline (test)"));
      return Promise.resolve({ ok: true, json: () => Promise.resolve([{ date: "2031-01-01", localName: "새해", types: ["Public"] }]) });
    }
    return Promise.reject(new Error("offline (test)"));
  };
  const errors = [];
  window.addEventListener("error", (e) => errors.push(e.message));

  if (state) window.localStorage.setItem("family-dashboard.state.v1", JSON.stringify({ payload: state, updatedAt: state.updatedAt }));
  window.localStorage.setItem("family-dashboard.device.v1", "dain");

  const load = (f) => window.eval(fs.readFileSync(path.join(ROOT, f), "utf8"));
  load("config.js");
  load("holidays.js");
  // 오늘 날짜에 '테스트 공휴일'을 하나 심어 날짜와 무관하게 빨간 날을 확인한다
  window.KR_HOLIDAYS = Object.assign({}, window.KR_HOLIDAYS);
  window.KR_HOLIDAYS[TODAY] = "테스트 공휴일";
  window.__realHolidays = Object.assign({}, window.KR_HOLIDAYS);
  load("quizzes.js");
  window.FAMILY_CONFIG.supabase = { url: "", anonKey: "", table: "family_state", rowId: "main", realtime: false };
  load("store.js");
  load("app.js");

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const saved = () => JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  return { window, document, $, $$, click, saved, errors, calls };
}

function makeMergeWindow() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true, runScripts: "outside-only" });
  const { window } = dom;
  window.eval(fs.readFileSync(path.join(ROOT, "store.js"), "utf8"));
  return window;
}

(async function main() {
  /* =========================================================
     1) 공휴일 내장 데이터
     ========================================================= */
  console.log("\n[1] 공휴일 내장 데이터(holidays.js)");
  {
    const t = boot(payload());
    await sleep(600);
    const H = t.window.__realHolidays;
    check("2026 크리스마스", H["2026-12-25"] === "기독탄신일", H["2026-12-25"]);
    check("2026 설날 연휴", H["2026-02-17"] === "설날" && H["2026-02-16"] === "설날 연휴");
    check("2026 대체공휴일(광복절)", H["2026-08-17"] === "광복절 대체휴일", H["2026-08-17"]);
    check("2027 설날은 2월 7일", H["2027-02-07"] === "설날", H["2027-02-07"]);
    check("2027 설날 대체휴일 2월 9일", H["2027-02-09"] === "설날 대체휴일", H["2027-02-09"]);
    check("2027 한글날 대체휴일 10월 11일", H["2027-10-11"] === "한글날 대체휴일", H["2027-10-11"]);
    check("2028 추석·개천절 같은 날", H["2028-10-03"] === "추석·개천절", H["2028-10-03"]);
    check("부팅 오류 없음", t.errors.length === 0, t.errors.join(" / "));
  }

  /* =========================================================
     2) 세 달력의 빨간 날 + 공휴일 이름
     ========================================================= */
  console.log("\n[2] 달력 빨간 날 표시");
  {
    const t = boot(payload());
    await sleep(700);

    // 홈 미니 달력
    const hCell = t.$('#homeCalGrid [data-date="' + TODAY + '"]');
    check("홈 미니 달력에 날짜 칸", !!hCell);
    check("홈 미니 달력 오늘 숫자 빨갛게", !!hCell && !!hCell.querySelector(".hcal-num.is-hol"), hCell ? hCell.innerHTML : "");
    check("홈 미니 달력 칸에 공휴일 이름(읽어주기)", !!hCell && hCell.getAttribute("aria-label").includes("테스트 공휴일"), hCell && hCell.getAttribute("aria-label"));
    check("홈 달력에 이번 달 빨간 날 줄", !!t.$(".hcal-hols") && t.$(".hcal-hols").textContent.includes("테스트 공휴일"), (t.$(".hcal-hols") || {}).textContent);
    check("다른 날은 빨갛지 않음", t.$$("#homeCalGrid .hcal-num.is-hol").length === 1, String(t.$$("#homeCalGrid .hcal-num.is-hol").length));

    // 함께 → 가족 달력
    t.click(t.$('.tab-btn[data-tab="together"]'));
    await sleep(120);
    const cCell = t.$('#calGrid [data-date="' + TODAY + '"]');
    check("가족 달력 오늘 숫자 빨갛게", !!cCell && !!cCell.querySelector(".cal-num.is-hol"), cCell ? cCell.innerHTML : "");
    t.click(cCell);
    await sleep(120);
    check("가족 달력 고른 날에 공휴일 이름", !!t.$(".day-holiday") && t.$(".day-holiday").textContent.includes("테스트 공휴일"), (t.$(".day-holiday") || {}).textContent);
    check("일정은 그대로 보임", t.$("#dayEvents").textContent.includes("다인이 유치원"));
    check("달력 범례에 빨간 날 설명", t.$(".cal-legend").textContent.includes("공휴일"));

    // 다음 달로 넘겨도 깨지지 않음
    t.click(t.$('[data-action="cal-month"][data-delta="1"]'));
    await sleep(120);
    check("다음 달 달력도 그려짐", !!t.$("#calGrid"));

    // 용돈 달력 (미션 탭)
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(150);
    const aCell = t.$('#allowGrid [data-date="' + TODAY + '"]');
    check("용돈 달력 오늘 숫자 빨갛게", !!aCell && !!aCell.querySelector(".acal-num.is-hol"), aCell ? aCell.innerHTML : "");
    t.click(aCell);
    await sleep(120);
    check("용돈 달력 상세에 공휴일 이름", t.$("#allowDetail").textContent.includes("테스트 공휴일"), t.$("#allowDetail").textContent);
    const st = t.saved();
    check("달력 표시가 데이터를 바꾸지 않음", st.calendar.events.length === 1 && st.study.items.length === 2);
  }

  /* =========================================================
     3) 주간 날씨
     ========================================================= */
  console.log("\n[3] 날씨 카드 주간 예보");
  {
    const t = boot(payload());
    await sleep(800);
    const days = t.$$("#weekStrip .wk-day");
    check("주간 예보 7일", days.length === 7, String(days.length));
    check("첫 칸은 오늘", days.length > 0 && days[0].textContent.includes("오늘"), days.length ? days[0].textContent : "");
    check("요일 표시", days.length > 1 && days[1].querySelector(".wk-dow").textContent.length === 1, days.length > 1 ? days[1].querySelector(".wk-dow").textContent : "");
    check("최고/최저 기온", days.length > 0 && days[0].querySelector(".wk-max").textContent === "12°" && days[0].querySelector(".wk-min").textContent === "2°",
      days.length ? days[0].querySelector(".wk-max").textContent + "/" + days[0].querySelector(".wk-min").textContent : "");
    check("비 소식(강수 확률) 표시", days.length > 2 && days[2].querySelector(".wk-pop").textContent.includes("70%"), days.length > 2 ? days[2].querySelector(".wk-pop").textContent : "");
    check("강수 확률 낮은 날은 숨김", days.length > 0 && days[0].querySelector(".wk-pop").classList.contains("is-none"));
    check("비 오는 날 아이콘", days.length > 2 && days[2].querySelector(".wk-ico").textContent === "🌧️", days.length > 2 ? days[2].querySelector(".wk-ico").textContent : "");
    check("지금 기온은 그대로", t.$(".weather-temp").textContent.includes("7"), t.$(".weather-temp").textContent);
    check("지역 이름 그대로", t.$("#weatherCard").textContent.includes("성남시 분당구"));
    check("일주일 예보를 요청", t.calls.some((u) => u.includes("forecast_days=7") && u.includes("precipitation_probability_max")), t.calls.filter((u) => u.includes("open-meteo")).join(" | ").slice(0, 160));
  }

  /* 예전 캐시(주간 예보 없음)는 바로 새로 받아온다 */
  console.log("\n[3-2] 예전 날씨 캐시 → 주간 예보 새로 받기");
  {
    const old = payload();
    old.settings = { weatherCache: { current: { temp: 5, code: 1, humidity: 40 }, min: 1, max: 9, fetchedAt: Date.now(), fetchedLabel: "방금" }, notify: false };
    const t = boot(old);
    await sleep(900);
    check("주간 예보가 채워짐", t.$$("#weekStrip .wk-day").length === 7, String(t.$$("#weekStrip .wk-day").length));
    check("캐시에 week 저장", Array.isArray(t.saved().settings.weatherCache.week) && t.saved().settings.weatherCache.week.length === 7);
  }

  /* 주간 데이터가 없는 응답(예전 서버)도 깨지지 않는다 */
  console.log("\n[3-3] 주간 데이터 없는 응답도 안전");
  {
    const t = boot(payload(), { shortDaily: true });
    await sleep(700);
    check("주간 칸 없음", t.$$("#weekStrip .wk-day").length === 0, String(t.$$("#weekStrip .wk-day").length));
    check("지금 기온은 보임", t.$(".weather-temp").textContent.includes("7"));
    check("오류 없음", t.errors.length === 0, t.errors.join(" / "));
  }

  /* =========================================================
     4) 오늘의 퀴즈 — 3문제 · 같은 날 같은 문제
     ========================================================= */
  console.log("\n[4] 공부 탭 오늘의 퀴즈");
  {
    const t = boot(payload());
    await sleep(700);
    t.click(t.$('.tab-btn[data-tab="study"]'));
    await sleep(150);
    const qs = t.$$("#quizList .quiz-q");
    check("퀴즈 3문제", qs.length === 3, String(qs.length));
    check("각 문제에 보기 3개", qs.every((q) => q.querySelectorAll(".quiz-opt").length === 3));
    check("카테고리가 서로 다름", new Set(qs.map((q) => q.querySelector(".quiz-cat").textContent)).size === 3, qs.map((q) => q.querySelector(".quiz-cat").textContent).join(","));
    check("진행 표시 0 / 3", t.$("#quizScore").textContent.includes("0 / 3"), t.$("#quizScore").textContent);
    check("매일 새 문제 안내", t.$("#quizFoot").textContent.includes("도장 1개"));
    check("기존 '+ 공부 추가' 버튼 유지", !!t.$('[data-action="add-study"]') && t.$('[data-action="add-study"]').textContent.includes("공부 추가"));
    check("기존 공부 항목 그대로", t.$$("#studyList .study-item").length === 2);

    const ids1 = qs.map((q) => q.getAttribute("data-qid")).join(",");
    const t2 = boot(payload());
    await sleep(700);
    t2.click(t2.$('.tab-btn[data-tab="study"]'));
    await sleep(150);
    const ids2 = t2.$$("#quizList .quiz-q").map((q) => q.getAttribute("data-qid")).join(",");
    check("같은 날은 기기마다 같은 문제", ids1 === ids2, ids1 + " vs " + ids2);

    const bank = t.window.KR_QUIZZES;
    check("퀴즈 데이터 30문제 이상", bank.length >= 30, String(bank.length));
    check("모든 문제에 정답·설명·힌트", bank.every((q) => typeof q.answer === "number" && q.options[q.answer] && q.why && q.hint));
  }

  /* =========================================================
     5) 채점 · 힌트 · 도장
     ========================================================= */
  console.log("\n[5] 보기 채점 · 힌트 · 도장");
  {
    const t = boot(payload());
    await sleep(700);
    t.click(t.$('.tab-btn[data-tab="study"]'));
    await sleep(150);

    const first = t.$("#quizList .quiz-q");
    const qid = first.getAttribute("data-qid");
    const item = t.window.KR_QUIZZES.filter((q) => q.id === qid)[0];
    const wrongIdx = item.answer === 0 ? 1 : 0;

    // 힌트
    t.click(first.querySelector('[data-action="quiz-hint"]'));
    await sleep(120);
    check("힌트가 보인다", t.$("#quizList .quiz-feed.is-hint").textContent.includes(item.hint.slice(0, 6)), (t.$("#quizList .quiz-feed.is-hint") || {}).textContent);
    t.click(t.$('#quizList [data-action="quiz-hint"][data-qid="' + qid + '"]'));
    await sleep(120);
    check("힌트를 닫을 수 있다", !t.$("#quizList .quiz-feed.is-hint"));

    // 틀린 보기
    t.click(t.$('#quizList [data-qid="' + qid + '"][data-idx="' + wrongIdx + '"]'));
    await sleep(150);
    check("틀린 보기 표시", !!t.$('#quizList .quiz-opt.is-wrong'), "");
    check("아직 안 맞힌 문제", t.$("#quizScore").textContent.includes("0 / 3"), t.$("#quizScore").textContent);
    check("틀려도 저장된 기록은 그대로", !t.saved().quiz || Object.keys(t.saved().quiz.answered || {}).length === 0);

    // 정답
    t.click(t.$('#quizList [data-qid="' + qid + '"][data-idx="' + item.answer + '"]'));
    await sleep(200);
    check("정답 보기 표시", !!t.$('#quizList .quiz-opt.is-right'));
    check("정답 설명이 보인다", t.$("#quizList .quiz-feed.is-good").textContent.includes(item.why.slice(0, 8)), (t.$("#quizList .quiz-feed.is-good") || {}).textContent);
    check("진행 1 / 3", t.$("#quizScore").textContent.includes("1 / 3"), t.$("#quizScore").textContent);

    // 나머지 두 문제도 맞히기
    const rest = t.window.KR_QUIZZES;
    for (const q of t.$$("#quizList .quiz-q:not(.is-solved)")) {
      const id = q.getAttribute("data-qid");
      const it2 = rest.filter((x) => x.id === id)[0];
      t.click(t.$('#quizList [data-qid="' + id + '"][data-idx="' + it2.answer + '"]'));
      await sleep(250);
    }
    await sleep(500);
    check("3문제 모두 완료", t.$$("#quizList .quiz-q.is-solved").length === 3, String(t.$$("#quizList .quiz-q.is-solved").length));
    check("별 3개", t.$$(".quiz-star.is-on").length === 3, String(t.$$(".quiz-star.is-on").length));
    check("완성 안내", t.$("#quizFoot").textContent.includes("도장"), t.$("#quizFoot").textContent);

    const st = t.saved();
    check("도장 1개 적립", Number(st.stamps[TODAY] || 0) === 1, JSON.stringify(st.stamps));
    check("퀴즈 보상 기록", !!(st.quiz.rewarded[TODAY]), JSON.stringify(st.quiz.rewarded));
    check("맞힌 문제 3개 저장", Object.keys(st.quiz.answered).length === 3, JSON.stringify(st.quiz.answered));

    // 다시 풀어도 도장이 더 쌓이지 않는다
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(120);
    t.click(t.$('.tab-btn[data-tab="study"]'));
    await sleep(200);
    check("다시 열어도 완료 상태 유지", t.$$("#quizList .quiz-q.is-solved").length === 3);
    check("도장은 그대로 1개", Number(t.saved().stamps[TODAY] || 0) === 1, JSON.stringify(t.saved().stamps));

    // 저장된 기록으로 다시 켜도 이어서 보인다
    const t3 = boot(t.saved());
    await sleep(700);
    t3.click(t3.$('.tab-btn[data-tab="study"]'));
    await sleep(150);
    check("새로 열어도 3문제 완료", t3.$$("#quizList .quiz-q.is-solved").length === 3, String(t3.$$("#quizList .quiz-q.is-solved").length));
    check("새로 열어도 도장 1개", Number(t3.saved().stamps[TODAY] || 0) === 1);
  }

  /* 공부 항목 추가와 퀴즈가 함께 동작 */
  console.log("\n[5-2] 공부 추가해도 퀴즈 그대로");
  {
    const t = boot(payload());
    await sleep(700);
    t.click(t.$('.tab-btn[data-tab="study"]'));
    await sleep(150);
    t.click(t.$('[data-action="add-study"]'));
    await sleep(150);
    t.$("#studyName").value = "알파벳 노래";
    t.$("#studyMin").value = "5";
    t.click(t.$("#studySaveBtn"));
    await sleep(400);
    check("공부 항목 3개로 늘어남", t.$$("#studyList .study-item").length === 3, String(t.$$("#studyList .study-item").length));
    check("퀴즈 3문제는 그대로", t.$$("#quizList .quiz-q").length === 3);
    check("퀴즈 상태는 건드리지 않음", Object.keys(t.saved().quiz.answered || {}).length === 0);
  }

  /* =========================================================
     6) 저장 · 병합 · 하위 호환
     ========================================================= */
  console.log("\n[6] 퀴즈 기록 병합·하위 호환");
  {
    const window = makeMergeWindow();
    const merge = (base, local, remote) => window.FamilyStore.mergeStates(base, local, remote, { maxChat: 200 });

    const base = payload();
    base.quiz = { answered: {}, rewarded: {} };
    const a = clone(base);
    a.quiz.answered[TODAY + "|q-an-01"] = true;
    a.updatedAt = "2026-11-17T00:00:00.000Z";
    const b = clone(base);
    b.quiz.answered[TODAY + "|q-sp-02"] = true;
    b.quiz.rewarded[TODAY] = true;
    b.updatedAt = "2026-11-17T00:01:00.000Z";
    const res = merge(base, a, b);
    const keys = Object.keys(res.payload.quiz.answered).sort().join(",");
    check("두 기기가 맞힌 문제가 합쳐짐", keys === TODAY + "|q-an-01," + TODAY + "|q-sp-02", keys);
    check("도장 받은 날도 유지", res.payload.quiz.rewarded[TODAY] === true, JSON.stringify(res.payload.quiz.rewarded));

    // 퀴즈 기능이 없던 기록(하위 호환)
    const legacy = payload();
    delete legacy.quiz;
    legacy.updatedAt = new Date().toISOString();
    const t = boot(legacy);
    await sleep(700);
    t.click(t.$('.tab-btn[data-tab="study"]'));
    await sleep(150);
    check("예전 기록에도 퀴즈 3문제", t.$$("#quizList .quiz-q").length === 3);
    check("예전 기록 보존(공부 2개)", t.$$("#studyList .study-item").length === 2);
    check("부팅 오류 없음", t.errors.length === 0, t.errors.join(" / "));

    // 퀴즈 기록이 깨져 있어도 안전
    const messy = payload();
    messy.quiz = { answered: "이상한 값", rewarded: [1, 2, 3] };
    const t2 = boot(messy);
    await sleep(700);
    t2.click(t2.$('.tab-btn[data-tab="study"]'));
    await sleep(150);
    check("깨진 퀴즈 기록도 3문제로 복구", t2.$$("#quizList .quiz-q").length === 3);
    check("깨진 기록 오류 없음", t2.errors.length === 0, t2.errors.join(" / "));
    check("저장 모양이 정리됨", t2.saved().quiz && typeof t2.saved().quiz.answered === "object" && !Array.isArray(t2.saved().quiz.answered));
  }

  /* 오래된 퀴즈 기록은 정리된다 (동기화 용량) */
  console.log("\n[6-2] 오래된 퀴즈 기록 정리");
  {
    const old = payload();
    old.quiz = { answered: { "2020-01-01|q-an-01": true }, rewarded: { "2020-01-01": true } };
    old.quiz.answered[TODAY + "|q-an-02"] = true;
    const t = boot(old);
    await sleep(700);
    const st = t.saved();
    check("오래된 기록은 지움", !st.quiz.answered["2020-01-01|q-an-01"], JSON.stringify(st.quiz.answered));
    check("최근 기록은 남김", !!st.quiz.answered[TODAY + "|q-an-02"], JSON.stringify(st.quiz.answered));
  }

  console.log("\n================================");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL HOLIDAY/WEATHER/QUIZ CHECKS PASSED ✅");
  process.exit(0);
})().catch((e) => { console.error("TEST CRASH:", e); process.exit(2); });
