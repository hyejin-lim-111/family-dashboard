/* 💰 다인이 용돈 누적 · 용돈 달력 테스트
   ① 날짜가 바뀌어도 어제 모은 돈이 그대로 누적되는지
   ② 루틴 항목을 넣거나 지워도 그날 모은 돈이 사라지지 않는지
   ③ 용돈 쓰기만큼만 줄고, 쓴 날짜가 장부(spends)에 남는지
   ④ 미션 탭 용돈 달력 — 날짜 칸 금액·월 합계·누적 잔액이 보이는지
   ⑤ 여러 기기 병합에서 날짜별 적립 기록이 유지되는지 */
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
const YESTERDAY = kstKey(-1);
const clone = (v) => JSON.parse(JSON.stringify(v));

const SAMPLE = [
  { id: "r-bath", name: "목욕하기" },
  { id: "r-homework", name: "숙제하기" },
  { id: "r-meal", name: "밥먹기" },
  { id: "r-brush", name: "양치하기" },
];

function payload(over) {
  const p = {
    version: 1,
    updatedAt: new Date().toISOString(),
    deleted: {},
    members: [{ id: "dain", name: "다인이" }, { id: "mom", name: "엄마" }, { id: "dad", name: "아빠" }],
    study: { items: [], dayKey: TODAY, rewarded: false },
    stamps: { [YESTERDAY]: 1 },
    badges: {},
    dex: { unlocked: { f_star: YESTERDAY }, seen: {} },
    mission: { todayKey: TODAY, index: 1, doneToday: false, doneTotal: 1, history: [] },
    todos: { dain: [], mom: [], dad: [] },
    chat: [],
    quickPhrases: { custom: [], hidden: [] },
    calendar: { events: [] },
    checklists: { lists: [] },
    routine: { items: clone(SAMPLE), days: {}, spent: 0, spends: [] },
    growth: { birthDate: "2021-02-16", sex: "F", records: [] },
    pet: { name: "몽실이", xp: 0, moneyXp: 0, day: TODAY, bonusDay: "", seenLevel: 1, care: { fed: 0, played: 0, petted: 0, full: 50, mood: 50, bond: 30 }, ledger: {} },
    settings: { weatherCache: null, notify: false },
  };
  if (over) Object.keys(over).forEach((k) => { p[k] = over[k]; });
  return p;
}

function boot(state) {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/family-dashboard/index.html", pretendToBeVisual: true, runScripts: "outside-only" });
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

  if (state) window.localStorage.setItem("family-dashboard.state.v1", JSON.stringify({ payload: state, updatedAt: state.updatedAt }));
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

function makeMergeWindow() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true, runScripts: "outside-only" });
  const { window } = dom;
  window.eval(fs.readFileSync(path.join(ROOT, "store.js"), "utf8"));
  return window;
}

/* 어제 4개 모두 체크한 상태 (지금까지 저장된 모양: checked 만 있고 earned 는 아직 없음) */
function yesterdayAllChecked(extra) {
  const all = {};
  SAMPLE.forEach((it) => { all[it.id] = true; });
  const days = {};
  days[YESTERDAY] = { checked: all };
  return payload(Object.assign({ routine: { items: clone(SAMPLE), days: days, spent: 0, spends: [] } }, extra || {}));
}

(async function main() {
  /* =========================================================
     1) 날짜가 바뀌어도 어제 모은 돈이 그대로
     ========================================================= */
  console.log("\n[1] 날짜가 바뀌어도 어제 900원이 그대로 누적");
  {
    const t = boot(yesterdayAllChecked());
    await sleep(1300);
    check("부팅 오류 없음", t.errors.length === 0, t.errors.join(" / "));
    check("홈 카드에 900원", t.$("#allowanceTotal").textContent === "900원", t.$("#allowanceTotal").textContent);
    check("홈 카드 오늘 줄은 0 / 4", t.$("#allowanceToday").textContent.includes("0 / 4"), t.$("#allowanceToday").textContent);

    const st = t.saved();
    check("어제 적립액이 기록으로 굳음(900)", st.routine.days[YESTERDAY] && st.routine.days[YESTERDAY].earned === 900,
      JSON.stringify(st.routine.days[YESTERDAY]));
    check("어제 보너스 표시", !!(st.routine.days[YESTERDAY] && st.routine.days[YESTERDAY].bonus));

    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(80);
    check("미션 탭 모은 용돈 900원", t.$("#routineTotal").textContent === "900원", t.$("#routineTotal").textContent);
  }

  /* =========================================================
     2) 용돈 달력 — 날짜 칸 금액·월 합계·누적
     ========================================================= */
  console.log("\n[2] 용돈 달력");
  {
    const t = boot(yesterdayAllChecked());
    await sleep(1300);
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(80);
    check("용돈 달력 카드 있음", !!t.$("#allowanceCalendar"));
    const yCell = t.$('#allowGrid [data-date="' + YESTERDAY + '"]');
    check("어제 칸에 +900", !!yCell && yCell.textContent.includes("+900"), yCell ? yCell.textContent : "(칸 없음)");
    check("어제 칸에 보너스 표시", !!yCell && !!yCell.querySelector(".acal-bonus"));
    check("이번 달 적립 합계 900원", t.$(".acal-sum").textContent.includes("+900원"), t.$(".acal-sum").textContent);
    check("지금 누적 900원", t.$(".acal-sum").textContent.includes("900원"), t.$(".acal-sum").textContent);
    check("달력 안내에 적립한 날 수", t.$(".acal-foot").textContent.includes("1일 적립"), t.$(".acal-foot").textContent);

    // 날짜를 눌러 그날 내역 보기
    t.click(yCell);
    await sleep(80);
    check("고른 날 상세에 적립·보너스", t.$("#allowDetail").textContent.includes("적립 900원") && t.$("#allowDetail").textContent.includes("보너스"),
      t.$("#allowDetail").textContent);
    check("고른 날 한 항목 이름", t.$("#allowDetail").textContent.includes("목욕하기"), t.$("#allowDetail").textContent);

    // 이전 달로 이동 후 오늘로 돌아오기
    t.click(t.$('[data-action="allow-month"][data-delta="-1"]'));
    await sleep(80);
    check("이전 달로 이동", !t.$('#allowGrid [data-date="' + YESTERDAY + '"]'));
    t.click(t.$('[data-action="allow-today"]'));
    await sleep(80);
    check("오늘 버튼으로 이번 달 복귀", !!t.$('#allowGrid [data-date="' + TODAY + '"]'));
    check("오늘 칸 강조", !!t.$('#allowGrid .acal-cell.is-today'));
  }

  /* =========================================================
     3) 루틴 항목을 지워도 그날 모은 돈은 사라지지 않는다
     ========================================================= */
  console.log("\n[3] 루틴 항목 삭제·추가와 용돈");
  {
    const all = {};
    SAMPLE.forEach((it) => { all[it.id] = true; });
    const days = {};
    days[TODAY] = { checked: all };
    days[YESTERDAY] = { checked: clone(all) };
    const t = boot(payload({ routine: { items: clone(SAMPLE), days: days, spent: 0, spends: [] } }));
    await sleep(1300);
    check("오늘+어제 1,800원", t.$("#allowanceTotal").textContent === "1,800원", t.$("#allowanceTotal").textContent);

    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(80);
    t.click(t.$('.routine-item[data-routine="r-bath"] [data-action="delete-routine"]'));
    await sleep(120);
    t.click(t.$("#confirmOkBtn"));
    await sleep(350);
    check("항목을 지워도 오늘+어제 1,800원 그대로", t.$("#allowanceTotal").textContent === "1,800원", t.$("#allowanceTotal").textContent);
    check("어제 칸도 900원 그대로", t.$('#allowGrid [data-date="' + YESTERDAY + '"]').textContent.includes("+900"));

    // 항목 추가해도 오늘 돈은 그대로
    t.$("#routineInput").value = "일기 쓰기";
    t.click(t.$('[data-action="add-routine"]'));
    await sleep(350);
    check("항목을 넣어도 1,800원 그대로", t.$("#allowanceTotal").textContent === "1,800원", t.$("#allowanceTotal").textContent);

    // 오늘 체크를 풀면 오늘 몫은 회수 (지난 날은 그대로)
    const brush = t.$('.routine-item[data-routine="r-brush"] .check-btn');
    if (brush) t.click(brush);
    await sleep(350);
    check("체크를 풀어도 모은 돈은 그대로 1,800원", t.$("#allowanceTotal").textContent === "1,800원", t.$("#allowanceTotal").textContent);
    const st = t.saved();
    check("어제 기록은 그대로 900", st.routine.days[YESTERDAY].earned === 900, JSON.stringify(st.routine.days[YESTERDAY]));
  }

  /* =========================================================
     4) 용돈 쓰기 — 쓴 만큼만 줄고, 쓴 날짜가 남는다
     ========================================================= */
  console.log("\n[4] 용돈 쓰기");
  {
    const t = boot(yesterdayAllChecked());
    await sleep(1300);
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(80);
    t.click(t.$('[data-action="allowance-spend"]'));
    await sleep(120);
    t.$("#spendAmount").value = "300";
    t.click(t.$("#spendOkBtn"));
    await sleep(350);
    check("900 - 300 = 600원", t.$("#routineTotal").textContent === "600원", t.$("#routineTotal").textContent);
    check("홈 카드도 600원", t.$("#allowanceTotal").textContent === "600원", t.$("#allowanceTotal").textContent);

    const st = t.saved();
    check("사용 장부 1건·300원·오늘 날짜", Array.isArray(st.routine.spends) && st.routine.spends.length === 1 &&
      st.routine.spends[0].amount === 300 && st.routine.spends[0].date === TODAY,
      JSON.stringify(st.routine.spends));
    check("spent 합계도 300", st.routine.spent === 300, String(st.routine.spent));

    const cell = t.$('#allowGrid [data-date="' + TODAY + '"]');
    check("달력 오늘 칸에 -300", !!cell && cell.textContent.includes("-300"), cell ? cell.textContent : "(칸 없음)");
    check("월 사용 합계 표시", t.$(".acal-sum").textContent.includes("-300원"), t.$(".acal-sum").textContent);
    check("어제 칸은 900원 그대로", t.$('#allowGrid [data-date="' + YESTERDAY + '"]').textContent.includes("+900"));

    // 하루 지나도 쓴 돈은 유지
    const t2 = boot(t.saved());
    await sleep(600);
    check("다시 열어도 600원 유지", t2.$("#allowanceTotal").textContent === "600원", t2.$("#allowanceTotal").textContent);
  }

  /* =========================================================
     5) 예전 기록(적립액 필드 없음)도 그대로 살아난다
     ========================================================= */
  console.log("\n[5] 예전 기록 하위 호환");
  {
    const legacy = yesterdayAllChecked();
    delete legacy.routine.spends;
    legacy.routine.spent = 200;      // 장부 없이 숫자만 있던 시절의 사용액
    const t = boot(legacy);
    await sleep(1300);
    check("어제 900 - 예전 사용 200 = 700원", t.$("#allowanceTotal").textContent === "700원", t.$("#allowanceTotal").textContent);
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(80);
    check("달력 어제 칸 900원", t.$('#allowGrid [data-date="' + YESTERDAY + '"]').textContent.includes("+900"));

    t.click(t.$('[data-action="allowance-spend"]'));
    await sleep(120);
    t.$("#spendAmount").value = "100";
    t.click(t.$("#spendOkBtn"));
    await sleep(350);
    check("예전 사용액도 장부로 옮겨 합산 (700 - 100 = 600)", t.$("#routineTotal").textContent === "600원", t.$("#routineTotal").textContent);
    const st = t.saved();
    check("장부에 예전 사용 + 새 사용", Array.isArray(st.routine.spends) && st.routine.spends.length === 2,
      JSON.stringify(st.routine.spends));
  }

  /* =========================================================
     6) 기기 사이 병합 — 날짜별 적립·사용 기록이 사라지지 않는다
     ========================================================= */
  console.log("\n[6] 기기 병합");
  {
    const window = makeMergeWindow();
    const merge = (base, local, remote) => window.FamilyStore.mergeStates(base, local, remote, { maxChat: 200 });

    // A(태블릿)는 어제 900 을 모았고, B(폰)는 그 사실을 모른 채 오늘 화면만 열어 저장
    const base = payload();
    const remote = clone(base);
    remote.routine.days[YESTERDAY] = { checked: { "r-bath": true, "r-homework": true, "r-meal": true, "r-brush": true }, earned: 900, bonus: true };
    remote.updatedAt = "2026-11-16T13:00:00.000Z";
    const local = clone(base);
    local.routine.days[TODAY] = { checked: {} };
    local.updatedAt = "2026-11-16T13:05:00.000Z";
    const res = merge(base, local, remote);
    check("모르는 기기가 저장해도 어제 900 유지", res.payload.routine.days[YESTERDAY] && res.payload.routine.days[YESTERDAY].earned === 900,
      JSON.stringify(res.payload.routine.days[YESTERDAY]));
    check("오늘 기록도 함께 유지", !!res.payload.routine.days[TODAY]);

    // 두 기기가 같은 날 각각 체크 → 체크가 합쳐진다
    const base2 = payload();
    base2.routine.days[YESTERDAY] = { checked: {}, earned: 0 };
    const a = clone(base2);
    a.routine.days[YESTERDAY] = { checked: { "r-bath": true }, earned: 100 };
    a.updatedAt = "2026-11-16T13:00:00.000Z";
    const b = clone(base2);
    b.routine.days[YESTERDAY] = { checked: { "r-meal": true }, earned: 100 };
    b.updatedAt = "2026-11-16T13:01:00.000Z";
    const res2 = merge(base2, a, b);
    const ch = res2.payload.routine.days[YESTERDAY].checked;
    check("두 기기의 체크가 합쳐짐", ch["r-bath"] === true && ch["r-meal"] === true, JSON.stringify(ch));

    // 한쪽이 체크를 풀면 풀린 채로 (되살아나지 않음)
    const base3 = clone(base2);
    base3.routine.days[YESTERDAY] = { checked: { "r-bath": true }, earned: 100 };
    const un = clone(base3);
    un.routine.days[YESTERDAY] = { checked: {}, earned: 0 };
    un.updatedAt = "2026-11-16T13:10:00.000Z";
    const res3 = merge(base3, un, clone(base3));
    check("체크를 푼 기기의 상태를 따른다", !res3.payload.routine.days[YESTERDAY].checked["r-bath"],
      JSON.stringify(res3.payload.routine.days[YESTERDAY]));

    // 사용 내역은 합쳐지고, 적립액은 줄지 않는다
    const base4 = payload();
    base4.routine.days[YESTERDAY] = { checked: { "r-bath": true }, earned: 900, bonus: true };
    const la = clone(base4);
    la.routine.spends = [{ id: "sp-a", amount: 300, at: "2026-11-16T13:00:00.000Z", date: YESTERDAY }];
    la.routine.spent = 300;
    la.updatedAt = "2026-11-16T13:00:00.000Z";
    const ra = clone(base4);
    ra.routine.spends = [{ id: "sp-b", amount: 200, at: "2026-11-16T13:02:00.000Z", date: YESTERDAY }];
    ra.routine.spent = 200;
    ra.updatedAt = "2026-11-16T13:02:00.000Z";
    const res4 = merge(base4, la, ra);
    const spendIds = (res4.payload.routine.spends || []).map((x) => x.id).sort().join(",");
    check("두 기기의 사용 내역 모두 남음", spendIds === "sp-a,sp-b", spendIds);
    check("어제 적립액은 줄지 않음", res4.payload.routine.days[YESTERDAY].earned === 900,
      JSON.stringify(res4.payload.routine.days[YESTERDAY]));

    // 적립액이 없던 옛 서버 기록 + 새 적립액 → 적립액 채택
    const base5 = payload();
    base5.routine.days[YESTERDAY] = { checked: { "r-bath": true, "r-homework": true, "r-meal": true, "r-brush": true } };
    const newLocal = clone(base5);
    newLocal.routine.days[YESTERDAY] = { checked: clone(base5.routine.days[YESTERDAY].checked), earned: 900, bonus: true };
    newLocal.updatedAt = "2026-11-16T13:20:00.000Z";
    const res5 = merge(base5, newLocal, clone(base5));
    check("적립액 기록이 병합에서 살아남음", res5.payload.routine.days[YESTERDAY].earned === 900,
      JSON.stringify(res5.payload.routine.days[YESTERDAY]));
  }

  console.log("\n================================");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL ALLOWANCE (용돈 누적·달력) CHECKS PASSED ✅");
  process.exit(0);
})();
