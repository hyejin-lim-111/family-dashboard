/* 다인이 저녁 루틴 · 용돈(항목당 100원 + 모두 완료 보너스 500원) · 홈 큰 시계 · 태블릿 끄기 타이머(알람) 테스트
   - 기존 기록(저녁 루틴·용돈 필드가 없던 저장 데이터)도 그대로 살아나야 한다. */
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

/* KST 날짜 키 도우미 */
function kstKey(offsetDays) {
  const kst = new Date(Date.now() + 9 * 3600 * 1000 + (offsetDays || 0) * 86400000);
  return kst.getUTCFullYear() + "-" + String(kst.getUTCMonth() + 1).padStart(2, "0") + "-" + String(kst.getUTCDate()).padStart(2, "0");
}
const TODAY = kstKey(0);
const YESTERDAY = kstKey(-1);

const SAMPLE_NAMES = ["목욕하기", "숙제하기", "밥먹기", "양치하기"];
const SAMPLE_IDS = ["r-bath", "r-homework", "r-meal", "r-brush"];

function boot(payload) {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, {
    url: "http://localhost/family-dashboard/index.html",
    pretendToBeVisual: true,
    runScripts: "outside-only",
  });
  const { window } = dom;
  const { document } = window;

  window.fetch = (url) => {
    const u = String(url);
    if (u.includes("air-quality")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: { pm10: 25, pm2_5: 10 } }) });
    if (u.includes("open-meteo")) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: { temperature_2m: 8, weather_code: 1 }, daily: { temperature_2m_max: [12], temperature_2m_min: [2] } }) });
    }
    return Promise.reject(new Error("offline (test)"));
  };
  const errors = [];
  window.addEventListener("error", (e) => errors.push(e.message));

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

/* 이전 버전 저장 데이터 — 저녁 루틴(routine) 필드가 전혀 없다 */
function legacyPayload() {
  const p = {
    version: 1,
    updatedAt: new Date().toISOString(),
    study: { items: [{ id: "s-read", name: "책 읽기", minutes: 15, kind: "countdown", done: false }], dayKey: TODAY, rewarded: false },
    stamps: {}, badges: { streak3: true },
    dex: { unlocked: { f_star: TODAY }, seen: {} },
    mission: { todayKey: TODAY, index: 3, doneToday: false, doneTotal: 2, history: [] },
    todos: { dain: [{ id: "t1", text: "유치원 가방 정리", done: false }], mom: [], dad: [] },
    chat: [{ id: "m1", from: "mom", fromName: "엄마", text: "오늘도 사랑해", at: new Date().toISOString() }],
    calendar: { events: [] },
    checklists: { lists: [{ id: "l1", emoji: "🛒", title: "장보기", items: [{ id: "i1", text: "우유", done: false }] }] },
    settings: { weatherCache: null },
  };
  p.stamps[TODAY] = 3;
  return p;
}

(async function main() {
  /* =========================================================
     1) 예전 기록 — 저녁 루틴이 없어도 샘플 4개가 생기고 기존 기록은 그대로
     ========================================================= */
  console.log("\n[1] 하위 호환 — 저녁 루틴 필드가 없던 기록");
  {
    const t = boot(legacyPayload());
    await sleep(700);
    check("부팅 오류 없음", t.errors.length === 0, t.errors.join(" / "));
    check("기기 프로필 기억", t.$("#deviceGate").hidden === true);

    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(60);
    check("미션 탭에 저녁 루틴 섹션", !!t.$("#eveningRoutine"));
    const names = t.$$(".routine-item .txt").map((e) => e.textContent);
    check("샘플 항목 4개 자동 생성", names.join(",") === SAMPLE_NAMES.join(","), names.join(","));
    check("샘플 항목 id 고정", t.$$(".routine-item").map((e) => e.getAttribute("data-routine")).join(",") === SAMPLE_IDS.join(","));
    check("오늘 0 / 4 완료", t.$("#routineToday").textContent === "0 / 4 완료", t.$("#routineToday").textContent);
    check("모은 용돈 0원", t.$("#routineTotal").textContent === "0원", t.$("#routineTotal").textContent);
    check("안내 문구 = 항목당 +100원 · 모두 완료 시 보너스 +500원!",
      t.$(".routine-hint").textContent.includes("항목당 +100원") && t.$(".routine-hint").textContent.includes("보너스 +500원"),
      t.$(".routine-hint").textContent);

    const st = t.saved();
    check("기존 도장 기록 보존(3개)", Object.values(st.stamps).reduce((a, b) => a + b, 0) === 3);
    check("기존 채팅·할 일·체크리스트 보존",
      st.chat.length === 1 && st.todos.dain.length === 1 && st.checklists.lists[0].items.length === 1);
    check("루틴이 저장 상태에 포함", !!st.routine && st.routine.items.length === 4);
  }

  /* =========================================================
     2) 항목당 100원 + 모두 완료 보너스 500원 (해제 시 회수, 재완료 시 다시)
     ========================================================= */
  console.log("\n[2] 용돈 적립 — 항목당 100원 · 올클리어 보너스 500원");
  {
    const t = boot(legacyPayload());
    await sleep(700);
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(60);

    const toggle = (id) => {
      const btn = t.$('.routine-item[data-routine="' + id + '"] .check-btn');
      if (btn) t.click(btn);
      return sleep(320);
    };

    await toggle("r-bath");
    check("1개 완료 → 100원", t.saved().routine.days[TODAY].checked["r-bath"] === true);
    check("화면 1 / 4 · 오늘 +100원",
      t.$("#routineToday").textContent === "1 / 4 완료" && t.$("#routineTotal").textContent === "100원",
      t.$("#routineToday").textContent + " / " + t.$("#routineTotal").textContent);

    await toggle("r-homework");
    await toggle("r-meal");
    check("3개 완료 → 300원 (보너스 아직 없음)", t.$("#routineTotal").textContent === "300원", t.$("#routineTotal").textContent);

    await toggle("r-brush");
    check("모두 완료 → 400 + 보너스 500 = 900원", t.$("#routineTotal").textContent === "900원", t.$("#routineTotal").textContent);
    check("보너스 안내 표시", !!t.$(".routine-bonus-on"), t.$("#eveningRoutine").textContent.slice(0, 80));

    await toggle("r-brush");
    check("체크 해제 → 항목 100원 + 보너스 500원 함께 회수 (300원)", t.$("#routineTotal").textContent === "300원", t.$("#routineTotal").textContent);
    check("보너스 안내 사라짐", !t.$(".routine-bonus-on"));

    await toggle("r-brush");
    check("다시 모두 완료 → 900원 (보너스는 하루 1회만)", t.$("#routineTotal").textContent === "900원", t.$("#routineTotal").textContent);
    await toggle("r-brush");
    await toggle("r-brush");
    await toggle("r-brush");
    await toggle("r-brush");
    check("여러 번 반복해도 하루 최대 900원 유지", t.$("#routineTotal").textContent === "900원", t.$("#routineTotal").textContent);

    // 항목 추가 → 오늘 계산이 다시 되어 보너스가 잠시 풀린다
    t.click(t.$('[data-action="add-routine"]'));
    await sleep(200);
    check("빈 입력은 추가되지 않음", t.$$(".routine-item").length === 4);
    t.$("#routineInput").value = "일기 쓰기";
    t.click(t.$('[data-action="add-routine"]'));
    await sleep(350);
    check("항목 추가 (5개)", t.$$(".routine-item").length === 5, String(t.$$(".routine-item").length));
    check("새 항목 이름 반영", t.$$(".routine-item .txt").map((e) => e.textContent).join(",").includes("일기 쓰기"));
    check("항목이 늘면 보너스 잠시 풀림 → 400원", t.$("#routineTotal").textContent === "400원", t.$("#routineTotal").textContent);

    const newId = t.$$(".routine-item")[4].getAttribute("data-routine");
    await toggle(newId);
    check("새 항목까지 모두 완료 → 500 + 500 = 1,000원 (천 단위 쉼표)",
      t.$("#routineTotal").textContent === "1,000원", t.$("#routineTotal").textContent);

    // 항목 삭제 (확인 모달)
    t.click(t.$('.routine-item[data-routine="' + newId + '"] [data-action="delete-routine"]'));
    await sleep(100);
    check("삭제 확인 모달", t.$("#modalBox").textContent.includes("저녁 루틴에서 지울까요"));
    t.click(t.$("#confirmOkBtn"));
    await sleep(350);
    check("항목 삭제 후 4개", t.$$(".routine-item").length === 4, String(t.$$(".routine-item").length));
    check("지운 항목 체크도 정리 → 900원", t.$("#routineTotal").textContent === "900원", t.$("#routineTotal").textContent);
    check("삭제해도 기록은 저장됨", t.saved().routine.items.length === 4);

    // 용돈 쓰기 / 초기화
    t.click(t.$('[data-action="allowance-spend"]'));
    await sleep(120);
    check("용돈 쓰기 모달", !!t.$("#spendAmount"));
    t.$("#spendAmount").value = "2000";
    t.click(t.$("#spendOkBtn"));
    await sleep(150);
    check("모은 금액보다 많이 쓰지 못함", t.$("#routineTotal") && t.$("#routineTotal").textContent === "900원", t.$("#routineTotal") && t.$("#routineTotal").textContent);
    t.$("#spendAmount").value = "300";
    t.click(t.$("#spendOkBtn"));
    await sleep(300);
    check("용돈 300원 차감 → 600원", t.$("#routineTotal").textContent === "600원", t.$("#routineTotal").textContent);
    check("차감액 저장", t.saved().routine.spent === 300, String(t.saved().routine.spent));

    t.click(t.$('[data-action="allowance-reset"]'));
    await sleep(120);
    check("초기화 확인 모달", t.$("#modalBox").textContent.includes("0원부터"));
    t.click(t.$("#confirmOkBtn"));
    await sleep(350);
    check("초기화 → 0원", t.$("#routineTotal").textContent === "0원", t.$("#routineTotal").textContent);
    check("초기화 후 항목 목록은 유지", t.$$(".routine-item").length === 4);
  }

  /* =========================================================
     3) 날짜별 독립 계산 — 어제 모은 돈은 오늘과 따로 쌓인다
     ========================================================= */
  console.log("\n[3] 날짜별 독립 계산");
  {
    const payload = legacyPayload();
    const allChecked = {};
    SAMPLE_IDS.forEach((id) => { allChecked[id] = true; });
    payload.routine = {
      items: SAMPLE_NAMES.map((name, i) => ({ id: SAMPLE_IDS[i], name })),
      days: { [YESTERDAY]: { checked: allChecked } },
      spent: 0,
    };
    const t = boot(payload);
    await sleep(700);
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(60);
    check("어제 900원은 그대로 남음", t.$("#routineTotal").textContent === "900원", t.$("#routineTotal").textContent);
    check("오늘은 0 / 4 (새 날은 빈 체크로 시작)", t.$("#routineToday").textContent === "0 / 4 완료", t.$("#routineToday").textContent);
    check("어제 기록 유지", t.saved().routine.days[YESTERDAY].checked["r-bath"] === true);

    const btn = t.$('.routine-item[data-routine="r-meal"] .check-btn');
    t.click(btn);
    await sleep(320);
    check("오늘 1개 = 100원, 어제 900원과 합산 1,000원", t.$("#routineTotal").textContent === "1,000원", t.$("#routineTotal").textContent);
    check("어제 기록은 손대지 않음", t.saved().routine.days[YESTERDAY].checked["r-meal"] === true && Object.keys(t.saved().routine.days[YESTERDAY].checked).length === 4);
  }

  /* =========================================================
     4) 홈 — 모은 용돈 카드 + 루틴 바로가기
     ========================================================= */
  console.log("\n[4] 홈 — 모은 용돈 현황 카드");
  {
    const payload = legacyPayload();
    const allChecked = {};
    SAMPLE_IDS.forEach((id) => { allChecked[id] = true; });
    payload.routine = {
      items: SAMPLE_NAMES.map((name, i) => ({ id: SAMPLE_IDS[i], name })),
      days: { [YESTERDAY]: { checked: allChecked }, [TODAY]: { checked: { "r-bath": true, "r-meal": true } } },
      spent: 0,
    };
    const t = boot(payload);
    await sleep(700);
    check("홈에 용돈 카드", !!t.$("#allowanceCard"));
    check("총액 = 어제 900 + 오늘 200 = 1,100원", t.$("#allowanceTotal").textContent === "1,100원", t.$("#allowanceTotal").textContent);
    check("오늘 진행 = 2 / 4 완료 · 오늘 +200원",
      t.$("#allowanceToday").textContent === "2 / 4 완료 · 오늘 +200원", t.$("#allowanceToday").textContent);
    check("홈 안내 문구도 새 규칙", t.$(".allowance-hint").textContent.includes("항목당 +100원") && t.$(".allowance-hint").textContent.includes("보너스 +500원"));
    check("진행률 바", !!t.$("#allowanceCard .progress > i"));

    t.click(t.$('[data-action="open-routine"]'));
    await sleep(200);
    check("카드 누르면 미션 탭으로 이동", t.$(".view.is-active").getAttribute("data-view") === "mission");
    check("저녁 루틴 섹션 도착", !!t.$("#eveningRoutine"));
  }

  /* =========================================================
     5) 홈 큰 시계
     ========================================================= */
  console.log("\n[5] 홈 큰 시계");
  {
    const t = boot(legacyPayload());
    await sleep(700);
    check("시계 요소", !!t.$("#bigClock") && !!t.$("#bigClockAmpm") && !!t.$("#bigClockDate"));
    const pattern = /^(0[1-9]|1[0-2]):[0-5]\d:[0-5]\d$/;
    check("오전/오후 + 12시간제 시:분:초", pattern.test(t.$("#bigClock").textContent) && /^(오전|오후)$/.test(t.$("#bigClockAmpm").textContent),
      t.$("#bigClockAmpm").textContent + " " + t.$("#bigClock").textContent);
    check("오늘 날짜 표시", t.$("#bigClockDate").textContent.includes(TODAY.slice(0, 4) + "년") && t.$("#bigClockDate").textContent.includes("요일"),
      t.$("#bigClockDate").textContent);

    const before = t.$("#bigClock").textContent;
    await sleep(1300);
    check("1초마다 갱신", t.$("#bigClock").textContent !== before, before + " → " + t.$("#bigClock").textContent);

    // 시계 값이 실제 현재 시각(12시간제)과 맞는지
    const now = new Date();
    const hh = now.getHours() % 12 === 0 ? 12 : now.getHours() % 12;
    const expect = String(hh).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    check("현재 시각과 일치", t.$("#bigClock").textContent.startsWith(expect), expect + " vs " + t.$("#bigClock").textContent);
  }

  /* =========================================================
     6) 홈 상단 1줄 3열 — 시간 · 용돈 · 컴팩트 타이머(누르면 확대)
     ========================================================= */
  console.log("\n[6] 홈 상단 — 시간 · 용돈 · 컴팩트 타이머");
  {
    const t = boot(legacyPayload());
    await sleep(700);
    const row = t.$("#homeContent .home-top");
    check("홈 맨 윗줄 .home-top", !!row);
    const kidNames = row ? Array.from(row.children).map((c) => c.id || "").join(",") : "";
    check("한 줄에 시간 · 용돈 · 타이머 3개", kidNames === "homeClockCard,allowanceCard,tabletTimerCard", kidNames);
    check("시계 카드 안에 큰 시계", !!t.$("#homeClockCard #bigClock") && !!t.$("#homeClockCard #bigClockAmpm") && !!t.$("#homeClockCard #bigClockDate"));
    check("용돈 카드가 같은 줄", !!t.$(".home-top #allowanceCard #allowanceTotal"));

    const card = t.$("#tabletTimerCard");
    check("타이머는 컴팩트 카드", !!card);
    check("카드 자체가 버튼(누르면 확대)", card && card.tagName === "BUTTON" && card.getAttribute("data-action") === "open-timer");
    check("컴팩트 카드 남은 시간", t.$("#tabTimerFace").textContent === "0:00", t.$("#tabTimerFace").textContent);
    check("카드 안에 안내 문구(눌러서 설정·크게 보기)", card.textContent.includes("눌러서 설정") && card.textContent.includes("크게 보기"));
    check("평소엔 세부 조작 버튼이 홈에 없음", !t.$("#homeContent [data-action='tab-timer-toggle']") && !t.$("#homeContent .tbl-preset"));
  }

  /* =========================================================
     7) 확대 타이머 — 누르면 커지고, 큰 숫자·빠른 시간·시작/일시정지/초기화
     ========================================================= */
  console.log("\n[7] 확대 타이머 · 알람");
  {
    const t = boot(legacyPayload());
    await sleep(700);

    check("처음엔 모달 닫힘", t.$("#modalRoot").hidden === true);
    t.click(t.$("#tabletTimerCard"));
    await sleep(150);
    check("카드 누르면 확대 타이머 열림", t.$("#modalRoot").hidden === false);
    check("확대 타이머 제목", t.$("#modalBox").textContent.includes("태블릿 끄기 타이머"));
    check("큰 숫자 MM:SS", t.$("#expTimerFace").textContent === "0:00", t.$("#expTimerFace") && t.$("#expTimerFace").textContent);
    check("닫기(✕) 버튼", !!t.$("#modalBox .modal-close"));

    const presets = t.$$("#modalBox .tbl-preset").map((b) => b.getAttribute("data-min")).join(",");
    check("빠른 시간 버튼 10·20·30·60분", presets === "10,20,30,60", presets);

    // ESC 로 닫기 → 다시 열기
    t.document.dispatchEvent(new t.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await sleep(80);
    check("ESC로 닫힘", t.$("#modalRoot").hidden === true);

    t.click(t.$("#tabletTimerCard"));
    await sleep(120);
    check("다시 열림 · 숫자 유지", t.$("#modalRoot").hidden === false && t.$("#expTimerFace").textContent === "0:00");

    t.click(t.$('#modalBox .tbl-preset[data-min="20"]'));
    await sleep(120);
    check("20분 선택 → 확대 20:00", t.$("#expTimerFace").textContent === "20:00", t.$("#expTimerFace").textContent);
    check("홈 컴팩트 카드도 20:00", t.$("#tabTimerFace").textContent === "20:00", t.$("#tabTimerFace").textContent);
    check("선택된 프리셋 표시", !!t.$('#modalBox .tbl-preset[data-min="20"].is-active'));
    check("아직 시작 전이면 '시작' 버튼", t.$("#tabTimerToggle").textContent.includes("시작") && !t.$("#tabTimerToggle").textContent.includes("이어서"), t.$("#tabTimerToggle").textContent);

    t.click(t.$('[data-action="tab-timer-toggle"]'));
    await sleep(120);
    check("시작 → 일시정지 버튼", t.$("#tabTimerToggle").textContent.includes("일시정지"), t.$("#tabTimerToggle").textContent);

    // 확대 타이머가 열린 채로 남은 시간이 실시간으로 줄어든다 (카드 안에서도 보임)
    const realNow = t.window.Date.now;
    t.window.Date.now = () => realNow() + 65000;
    await sleep(450);
    const shrunk = t.$("#expTimerFace").textContent;
    check("확대 숫자 실시간 감소", /^18:5\d$/.test(shrunk), shrunk);
    check("컴팩트 카드 숫자도 같이 줄어듦", t.$("#tabTimerFace").textContent === shrunk, t.$("#tabTimerFace").textContent);
    t.window.Date.now = realNow;

    t.click(t.$('[data-action="tab-timer-toggle"]'));
    await sleep(120);
    check("일시정지 반영", t.$("#tabTimerToggle").textContent.includes("이어서"), t.$("#tabTimerToggle").textContent);
    check("일시정지 안내 문구", t.$("#tabTimerSub").textContent.includes("멈췄어요"), t.$("#tabTimerSub").textContent);

    t.click(t.$('[data-action="tab-timer-reset"]'));
    await sleep(150);
    check("초기화 → 확대·카드 모두 0:00 · 시작 버튼",
      t.$("#expTimerFace").textContent === "0:00" && t.$("#tabTimerFace").textContent === "0:00" && t.$("#tabTimerToggle").textContent.includes("시작"),
      t.$("#expTimerFace").textContent + " / " + t.$("#tabTimerToggle").textContent);

    // 직접 입력
    t.$("#tabTimerMin").value = "45";
    t.click(t.$('[data-action="tab-timer-custom"]'));
    await sleep(150);
    check("직접 입력 45분 → 45:00", t.$("#expTimerFace").textContent === "45:00" && t.$("#tabTimerFace").textContent === "45:00", t.$("#expTimerFace").textContent);
    t.click(t.$('[data-action="tab-timer-reset"]'));
    await sleep(150);

    // 알람: 확대 타이머가 열린 상태에서 00:00 도달
    check("알람 오버레이는 처음엔 숨김", t.$("#alarmOverlay").hidden === true);
    t.click(t.$('#modalBox .tbl-preset[data-min="10"]'));
    await sleep(80);
    t.click(t.$('[data-action="tab-timer-toggle"]'));
    await sleep(80);
    check("확대 타이머가 열린 채 도는 중", t.$("#modalRoot").hidden === false);

    const realNow2 = t.window.Date.now;
    const skew = 10 * 60 * 1000 + 2000;
    t.window.Date.now = () => realNow2() + skew;
    await sleep(700);
    check("00:00 도달 → 알람 오버레이 표시", t.$("#alarmOverlay").hidden === false);
    check("알람이 확대 타이머를 대신함", t.$("#modalRoot").hidden === true);
    const alarmTxt = t.$("#alarmOverlay").textContent;
    check("알람 문구: 시간이 다 됐어요", alarmTxt.includes("시간이 다 됐어요"), alarmTxt.slice(0, 60));
    check("알람 문구: 이제 태블릿을 꺼 주세요", alarmTxt.includes("이제 태블릿을 꺼 주세요"), alarmTxt.slice(0, 80));
    check("타이머 0:00 표시", t.$("#tabTimerFace").textContent === "0:00", t.$("#tabTimerFace").textContent);

    t.window.Date.now = realNow2;
    t.click(t.$('[data-action="dismiss-alarm"]'));
    await sleep(200);
    check("확인했어요 → 알람 닫힘", t.$("#alarmOverlay").hidden === true);
    check("알람 닫으면 타이머도 0:00 초기화", t.$("#tabTimerFace").textContent === "0:00", t.$("#tabTimerFace").textContent);

    // 다시 크게 보기 → 0:00 · 시작 상태
    t.click(t.$("#tabletTimerCard"));
    await sleep(120);
    check("알람 뒤 다시 크게 보기", t.$("#expTimerFace").textContent === "0:00" && t.$("#tabTimerToggle").textContent.includes("시작"), t.$("#tabTimerToggle").textContent);
  }

  console.log("\n================================");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL EVENING ROUTINE / CLOCK / TABLET TIMER CHECKS PASSED ✅");
  process.exit(0);
})().catch((e) => { console.error("TEST CRASH:", e); process.exit(2); });
