/* 🎒 등원준비 탭 테스트
   ① 이전 저장 데이터(등원준비 없음) 하위 호환 — 기본 07:10 시작 · 08:00 출발, 4단계 순서
   ② 화면 — 탭·큰 시계·4단계 카드·첫 단계 '같이 하자!' 강조·진행 막대
   ③ 카드 선택 완료/해제 — 순서와 상관없이 누른 단계만, 모두 완료하면 축하 배너
   ④ 시간 설정·단계 문구 편집·오늘 초기화
   ⑤ 시각별 안내 문구(시작 전·준비 중·출발 이후·주말)
   ⑥ 기기 사이 3-way 병합 — 한 기기의 완료·시간 변경이 다른 기기의 저장으로 사라지지 않는다 */
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

const STEP_NAMES = ["세수·양치", "옷 입기", "아침 먹기", "가방 챙기기"];
const STEP_IDS = ["p-wash", "p-dress", "p-meal", "p-bag"];

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
    if (u.includes("air-quality")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: { pm10: 22, pm2_5: 9 } }) });
    if (u.includes("open-meteo")) {
      const times = [];
      for (let h = 0; h < 24; h++) times.push(TODAY + "T" + String(h).padStart(2, "0") + ":00");
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          current: { temperature_2m: 8, weather_code: 3, relative_humidity_2m: 55 },
          daily: { temperature_2m_max: [13], temperature_2m_min: [3], weather_code: [3], precipitation_probability_max: [30] },
          hourly: {
            time: times,
            temperature_2m: times.map((t, i) => 8 + (i % 5)),
            precipitation_probability: times.map((t, i) => (i === 8 ? 30 : 10)),
          },
        }),
      });
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

/* 등원준비 필드가 없던 이전 저장 데이터 */
function legacyPayload() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    study: { items: [{ id: "s-read", name: "책 읽기", minutes: 15, kind: "countdown", done: false }], dayKey: TODAY, rewarded: false },
    stamps: { [TODAY]: 2 },
    badges: {},
    dex: { unlocked: { f_star: TODAY }, seen: {} },
    mission: { todayKey: TODAY, index: 3, doneToday: false, doneTotal: 2, history: [] },
    todos: { dain: [{ id: "t1", text: "유치원 가방 정리", done: false }], mom: [], dad: [] },
    chat: [{ id: "m1", from: "mom", fromName: "엄마", text: "오늘도 사랑해", at: new Date().toISOString() }],
    quickPhrases: { custom: [], hidden: [] },
    calendar: { events: [] },
    checklists: { lists: [{ id: "l1", emoji: "🎒", title: "외출 준비물", items: [] }] },
    routine: { items: [{ id: "r-bath", name: "목욕하기" }], days: { [TODAY]: { checked: { "r-bath": true }, earned: 100 } }, spent: 0, spends: [] },
    growth: { birthDate: "2021-02-16", sex: "F", records: [] },
    pet: { name: "몽실이", xp: 60, moneyXp: 0, day: TODAY, bonusDay: "", seenLevel: 2, care: { fed: 0, played: 0, petted: 0, full: 50, mood: 50, bond: 30 }, ledger: {} },
    quiz: { answered: {}, rewarded: {} },
    settings: { weatherCache: null, notify: false },
  };
}

(async function main() {
  /* ---------------- ① 하위 호환 + 화면 ---------------- */
  console.log("\n[1] 이전 저장 데이터 — 등원준비 기본값");
  const t = boot(legacyPayload());
  await sleep(500);
  // 저장은 화면에서 무언가 바뀔 때 일어나므로, 시간 설정을 그대로 한 번 저장해 정규화된 상태를 남긴다
  t.click(t.$('.tab-btn[data-tab="prep"]'));
  await sleep(300);
  t.click(t.$('[data-action="prep-time"]'));
  await sleep(150);
  t.click(t.$("#prepTimeSaveBtn"));
  await sleep(450);
  const s1 = t.saved();
  check("morningPrep 기본값 생성", !!s1.morningPrep, JSON.stringify(s1.morningPrep && Object.keys(s1.morningPrep)));
  check("시작 07:10 · 출발 08:00", s1.morningPrep.startTime === "07:10" && s1.morningPrep.departureTime === "08:00",
    s1.morningPrep.startTime + "~" + s1.morningPrep.departureTime);
  check("4단계 순서(세수·양치 → 옷 입기 → 아침 먹기 → 가방 챙기기)",
    s1.morningPrep.steps.map((x) => x.name).join(",") === STEP_NAMES.join(","),
    s1.morningPrep.steps.map((x) => x.name).join(","));
  check("단계 id 유지", s1.morningPrep.steps.map((x) => x.id).join(",") === STEP_IDS.join(","));
  check("기존 기록 보존(공부·채팅·루틴)", s1.study.items.length === 1 && s1.chat.length === 1 && s1.routine.days[TODAY].earned === 100);
  check("오늘 완료는 비어 있음", Object.keys(s1.morningPrep.days[TODAY] ? s1.morningPrep.days[TODAY].done : {}).length === 0);
  check("부팅 오류 없음", t.errors.length === 0, t.errors.join(" / "));

  console.log("\n[2] 등원준비 탭 화면");
  check("하단에 등원 탭", !!t.$('.tab-btn[data-tab="prep"]'));
  t.click(t.$('.tab-btn[data-tab="prep"]'));
  await sleep(400);
  check("등원준비 뷰 활성", t.$(".view.is-active").getAttribute("data-view") === "prep", t.$(".view.is-active").getAttribute("data-view"));
  check("큰 시계·날짜", !!t.$("#prepClock") && /\d\d:\d\d/.test(t.$("#prepClock").textContent) && /\d+월 \d+일/.test(t.$("#prepDate").textContent),
    t.$("#prepClock") && t.$("#prepClock").textContent);
  check("날씨 영역 존재", !!t.$("#prepWeather"));
  await sleep(1000);
  check("분당구 날씨·시간대별 기온", /분당구/.test(t.$("#prepWeather").textContent) && /8시/.test(t.$("#prepWeather").textContent), t.$("#prepWeather").textContent.slice(0, 100));
  check("날씨에 나갈 때 팁", /나갈 때/.test(t.$("#prepWeather").textContent), t.$("#prepWeather").textContent.slice(0, 80));

  const cards = t.$$("#prepCards .prep-card");
  check("4단계 카드", cards.length === 4, "got " + cards.length);
  check("카드 순서·번호", cards.map((c) => c.querySelector(".prep-num").textContent).join(",") === "1,2,3,4" &&
    cards.map((c) => c.querySelector(".prep-name").textContent).join(",") === STEP_NAMES.join(","),
    cards.map((c) => c.querySelector(".prep-name").textContent).join(","));
  check("4장 일러스트 로드", cards.every((c) => /assets\/prep_/.test(c.querySelector(".prep-art").getAttribute("src"))));
  check("첫 카드에만 '같이 하자!' 배지", cards[0].querySelector(".prep-badge") && !cards[1].querySelector(".prep-badge") && !cards[2].querySelector(".prep-badge"));
  check("첫 카드가 현재 차례(강조)", cards[0].classList.contains("is-current") && !cards[1].classList.contains("is-current"));
  check("진행 막대·캐릭터·말풍선", !!t.$("#prepTrack") && !!t.$("#prepChar") && /같이 준비하자/.test(t.$("#prepBubble").textContent));
  check("0/4 완료 표시", t.$("#prepDoneCount").textContent === "0 / 4 완료", t.$("#prepDoneCount").textContent);
  check("출발 시각 표기", /오전 8:00/.test(t.$(".prep-meta").textContent), t.$(".prep-meta").textContent);
  check("축하 배너는 숨김", t.$("#prepDone").hidden === true);

  /* ---------------- ③ 카드 선택 ---------------- */
  console.log("\n[3] 카드 선택 — 순서와 상관없이 완료/해제");
  t.click(t.$$("#prepCards .prep-card")[2]);   // ③ 아침 먹기부터 눌러도
  await sleep(450);
  let saved = t.saved();
  check("아침 먹기만 완료로 저장", saved.morningPrep.days[TODAY].done["p-meal"] === true &&
    !saved.morningPrep.days[TODAY].done["p-wash"], JSON.stringify(saved.morningPrep.days[TODAY]));
  check("완료 카드 표시", t.$$("#prepCards .prep-card")[2].classList.contains("is-done") &&
    t.$$("#prepCards .prep-card")[2].getAttribute("aria-pressed") === "true");
  check("'같이 하자!'는 아직 첫 단계", t.$$("#prepCards .prep-card")[0].classList.contains("is-current") &&
    !t.$$("#prepCards .prep-card")[2].classList.contains("is-current"));
  check("진행 막대 25%", t.$("#prepFill").style.width === "25%", t.$("#prepFill").style.width);

  t.click(t.$$("#prepCards .prep-card")[2]);   // 다시 눌러 해제
  await sleep(450);
  saved = t.saved();
  check("다시 누르면 해제", !saved.morningPrep.days[TODAY].done["p-meal"]);
  check("진행 막대 0%", t.$("#prepFill").style.width === "0%", t.$("#prepFill").style.width);

  // 순서대로 모두 완료
  for (let i = 0; i < 4; i++) {
    t.click(t.$$("#prepCards .prep-card")[i]);
    await sleep(380);
  }
  saved = t.saved();
  check("4단계 모두 완료 저장", STEP_IDS.every((id) => saved.morningPrep.days[TODAY].done[id]));
  check("진행 막대 100%", t.$("#prepFill").style.width === "100%", t.$("#prepFill").style.width);
  check("축하 배너 표시", t.$("#prepDone").hidden === false);
  check("말풍선이 축하로 바뀜", /최고야/.test(t.$("#prepBubble").textContent), t.$("#prepBubble").textContent);
  check("모두 완료 표시", t.$("#prepDoneCount").textContent === "4 / 4 완료");

  /* ---------------- ④ 설정 ---------------- */
  console.log("\n[4] 시간 설정 · 문구 편집 · 오늘 초기화");
  t.click(t.$('[data-action="prep-time"]'));
  await sleep(200);
  check("시간 설정 모달", !!t.$("#prepStart") && !!t.$("#prepDepart") && t.$("#prepStart").value === "07:10" && t.$("#prepDepart").value === "08:00");
  t.$("#prepStart").value = "07:20";
  t.$("#prepDepart").value = "08:10";
  t.click(t.$("#prepTimeSaveBtn"));
  await sleep(450);
  saved = t.saved();
  check("바꾼 시각 저장", saved.morningPrep.startTime === "07:20" && saved.morningPrep.departureTime === "08:10");
  check("화면에 바뀐 시각", /오전 7:20/.test(t.$(".prep-meta").textContent) && /오전 8:10/.test(t.$(".prep-meta").textContent), t.$(".prep-meta").textContent);

  t.click(t.$('[data-action="prep-edit"]'));
  await sleep(200);
  check("문구 편집 모달 4칸", !!t.$("#prepName0") && !!t.$("#prepName3") && t.$("#prepName0").value === "세수·양치");
  t.$("#prepName0").value = "씻고 닦기";
  t.click(t.$("#prepEditSaveBtn"));
  await sleep(450);
  saved = t.saved();
  check("바꾼 문구 저장", saved.morningPrep.steps[0].name === "씻고 닦기", saved.morningPrep.steps[0].name);
  check("카드에 바뀐 문구", t.$$("#prepCards .prep-name")[0].textContent === "씻고 닦기");

  t.click(t.$('[data-action="prep-reset"]'));
  await sleep(200);
  check("초기화 확인 창", t.$("#modalRoot").hidden === false && !!t.$("#confirmOkBtn"));
  t.click(t.$("#confirmOkBtn"));
  await sleep(450);
  saved = t.saved();
  check("오늘 완료 모두 지움", Object.keys(saved.morningPrep.days[TODAY].done).length === 0);
  check("문구·시간은 그대로", saved.morningPrep.steps[0].name === "씻고 닦기" && saved.morningPrep.startTime === "07:20");
  check("축하 배너 다시 숨김", t.$("#prepDone").hidden === true);

  /* ---------------- ⑤ 시각별 문구 ---------------- */
  console.log("\n[5] 시각별 안내 문구");
  const st = (iso, cfg) => t.window.FamilyPrep.status(new Date(iso), cfg);
  const before = st("2026-11-17T07:00:00+09:00");
  check("시작 전 — 7시 10분부터 시작 안내", before.phase === "before" && before.headline === "7시 10분부터 등원 준비 시작!", JSON.stringify(before));
  check("시작 전 — 남은 시간", /10분 뒤에 시작해요/.test(before.sub), before.sub);
  const ready = st("2026-11-17T07:10:00+09:00");
  check("준비 중 — 50분 남음", ready.phase === "ready" && ready.headline === "유치원 출발까지 50분 남았어요", ready.headline);
  const ready2 = st("2026-11-17T07:41:00+09:00");
  check("준비 중 — 19분 남음", ready2.headline === "유치원 출발까지 19분 남았어요", ready2.headline);
  const go = st("2026-11-17T08:00:00+09:00");
  check("출발 이후 — 출발 안내", go.phase === "go" && go.headline === "출발 시간이에요! 오늘도 잘 다녀와", go.headline);
  const sat = st("2026-11-21T08:00:00+09:00");
  check("주말 안내", sat.phase === "weekend" && /주말/.test(sat.headline), sat.headline);
  const custom = st("2026-11-17T07:30:00+09:00", { startTime: "07:20", departureTime: "08:10" });
  check("바꾼 시각 기준 40분", custom.headline === "유치원 출발까지 40분 남았어요", custom.headline);
  check("나갈 때 팁 — 비/기온", /우산|겉옷/.test(t.window.FamilyPrep.tip({ temp: 8, code: 61 }, null, [{ h: 8, pop: 60 }])),
    t.window.FamilyPrep.tip({ temp: 8, code: 61 }, null, [{ h: 8, pop: 60 }]));

  /* ---------------- ⑥ 병합 ---------------- */
  console.log("\n[6] 기기 사이 3-way 병합");
  {
    const w = t.window;
    const base = {
      version: 1, updatedAt: "2026-11-17T07:00:00.000Z", deleted: {},
      morningPrep: {
        startTime: "07:10", departureTime: "08:00",
        steps: STEP_IDS.map((id, i) => ({ id, name: STEP_NAMES[i], img: "assets/prep_x.png" })),
        days: { [TODAY]: { done: { "p-wash": true }, updatedAt: "2026-11-17T07:20:00.000Z" } },
      },
      routine: { items: [], days: {}, spent: 0 },
    };
    const clone = (v) => JSON.parse(JSON.stringify(v));

    // A: 세수 완료 / B(옛 복사본): 가방 완료 → 둘 다 살아야 한다
    const local = clone(base);
    local.updatedAt = "2026-11-17T07:30:00.000Z";
    const remote = clone(base);
    remote.updatedAt = "2026-11-17T07:22:00.000Z";
    remote.morningPrep.days[TODAY].done = { "p-wash": true, "p-bag": true };
    const r1 = w.FamilyStore.mergeStates(base, local, remote).payload;
    check("다른 기기의 완료 단계 보존", !!r1.morningPrep.days[TODAY].done["p-wash"] && !!r1.morningPrep.days[TODAY].done["p-bag"],
      JSON.stringify(r1.morningPrep.days[TODAY]));

    // 이 기기에서 해제한 단계는 풀린 채로 (다른 기기가 옛 체크를 들고 있어도)
    const base2 = clone(base);
    base2.morningPrep.days[TODAY].done = { "p-wash": true, "p-bag": true };
    const local2 = clone(base2);
    delete local2.morningPrep.days[TODAY].done["p-bag"];
    local2.updatedAt = "2026-11-17T07:40:00.000Z";
    const remote2 = clone(base2);
    remote2.updatedAt = "2026-11-17T07:35:00.000Z";
    const r2 = w.FamilyStore.mergeStates(base2, local2, remote2).payload;
    check("해제한 단계는 풀린 채로", !r2.morningPrep.days[TODAY].done["p-bag"] && !!r2.morningPrep.days[TODAY].done["p-wash"],
      JSON.stringify(r2.morningPrep.days[TODAY]));

    // 한 기기는 시작 시각, 다른 기기는 출발 시각을 바꿈 → 둘 다 남는다
    const local3 = clone(base);
    local3.morningPrep.startTime = "07:20";
    local3.morningPrep.steps[0].name = "씻고 닦기";
    local3.updatedAt = "2026-11-17T07:50:00.000Z";
    const remote3 = clone(base);
    remote3.morningPrep.departureTime = "08:10";
    remote3.updatedAt = "2026-11-17T07:45:00.000Z";
    const r3 = w.FamilyStore.mergeStates(base, local3, remote3).payload;
    check("시작·출발 시각 모두 반영", r3.morningPrep.startTime === "07:20" && r3.morningPrep.departureTime === "08:10",
      r3.morningPrep.startTime + "~" + r3.morningPrep.departureTime);
    check("바꾼 단계 문구 유지", r3.morningPrep.steps[0].name === "씻고 닦기", r3.morningPrep.steps[0].name);

    // 예전 저장(등원준비 없음)이 저장해도 다른 기기의 등원준비가 살아남는다
    const oldLocal = { version: 1, updatedAt: "2026-11-17T08:00:00.000Z", deleted: {}, routine: { items: [], days: {}, spent: 0 } };
    const r4 = w.FamilyStore.mergeStates(null, oldLocal, clone(base)).payload;
    check("등원준비 없는 기기가 저장해도 기록 유지", !!r4.morningPrep && r4.morningPrep.startTime === "07:10" && !!r4.morningPrep.days[TODAY].done["p-wash"],
      JSON.stringify(r4.morningPrep && r4.morningPrep.days));
    check("병합 후 다른 기록도 그대로", !!r4.routine);
  }

  console.log("\n================================\n");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL MORNING PREP CHECKS PASSED ✅");
  process.exit(0);
})();
