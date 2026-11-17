/* 🖐️ 등원준비 완료 하이파이브 테스트
   ① 4단계를 모두 끝내면 가운데 큰 손바닥 + "다인아, 하이파이브!"
   ② 손바닥을 누르면 "다인아! 유치원 잘 갔다와♡" + 오늘 완료 저장(hi5) + 잠시 뒤 스스로 닫힘
   ③ 오늘 이미 했으면 계속 덮지 않고, 완료 배너의 '다시 하이파이브' 로 다시 볼 수 있음
   ④ 앱을 다시 열어도(기기 동기화) 오늘 것이면 자동으로 뜨지 않음
   ⑤ 3/4 처럼 다 끝내지 않았으면 뜨지 않음 · 오늘 초기화하면 다시 뜸
   ⑥ 기기 사이 병합 — 한 기기의 하이파이브 완료가 다른 기기의 저장으로 풀리지 않음
   사용: node test/highfive-test.cjs */
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

  window.fetch = () => Promise.reject(new Error("offline (test)"));
  const errors = [];
  window.addEventListener("error", (e) => errors.push(e.message));

  if (payload) {
    window.localStorage.setItem("family-dashboard.state.v1", JSON.stringify({ payload, updatedAt: new Date().toISOString() }));
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

(async function main() {
  /* ---------------- ① 4/4 → 하이파이브 ---------------- */
  console.log("\n[1] 4단계를 모두 끝내면 하이파이브가 떠요");
  const t = boot();
  await sleep(500);
  t.click(t.$('.tab-btn[data-tab="prep"]'));
  await sleep(400);

  // 3개만 완료 → 아직 안 떠요
  for (let i = 0; i < 3; i++) {
    t.click(t.$$("#prepCards .prep-card")[i]);
    await sleep(320);
  }
  check("3/4 에서는 하이파이브가 뜨지 않음", t.$("#hi5Overlay").hidden === true);

  t.click(t.$$("#prepCards .prep-card")[3]);
  await sleep(450);
  check("4/4 가 되면 화면 가운데 손바닥", t.$("#hi5Overlay").hidden === false && !!t.$("#hi5Hand"));
  check("손바닥 그림(SVG)", !!t.$("#hi5Hand svg.hi5-svg"));
  check("'다인아, 하이파이브!' 안내", t.$("#hi5Title").textContent === "다인아, 하이파이브!", t.$("#hi5Title").textContent);
  check("4 / 4 완료 표시", /4 \/ 4/.test(t.$("#hi5Ask").textContent), t.$("#hi5Ask").textContent.slice(0, 40));
  check("누르기 전에는 완료가 아님", t.window.FamilyPrep.hi5().done === false);
  check("잠금(모달)이 아니라 전체 화면 덮개", t.$("#hi5Overlay").getAttribute("role") === "dialog" && t.$("#hi5Overlay").getAttribute("aria-modal") === "true");

  /* ---------------- ② 손바닥 터치 ---------------- */
  console.log("\n[2] 손바닥을 누르면 축하 문구");
  t.click(t.$("#hi5Hand"));
  await sleep(250);
  check("축하 화면으로 바뀜", t.$("#hi5Cheer").hidden === false && t.$("#hi5Ask").hidden === true);
  check("'다인아! 유치원 잘 갔다와♡'", t.$("#hi5CheerMsg").textContent === "다인아! 유치원 잘 갔다와♡", t.$("#hi5CheerMsg").textContent);
  check("반짝이 효과", t.$$("#hi5Cheer .hi5-sparks span").length >= 3);
  const saved1 = t.saved();
  check("오늘 하이파이브 완료 저장(hi5)", saved1.morningPrep.days[TODAY].hi5 === true, JSON.stringify(saved1.morningPrep.days[TODAY]));
  check("4단계 완료 기록은 그대로", STEP_IDS.every((id) => saved1.morningPrep.days[TODAY].done[id]));
  check("오류 없음", t.errors.length === 0, t.errors.join(" / "));

  await sleep(4400);
  check("잠시 뒤 스스로 닫힘", t.$("#hi5Overlay").hidden === true, String(t.$("#hi5Overlay").hidden));
  check("완료 배너가 보임", t.$("#prepDone").hidden === false);
  check("배너에 '하이파이브 완료' 표시", /하이파이브 완료/.test(t.$("#prepDone").textContent), t.$("#prepDone").textContent);

  /* ---------------- ③ 다시 덮지 않기 ---------------- */
  console.log("\n[3] 오늘 이미 했으면 계속 덮지 않아요");
  t.click(t.$('.tab-btn[data-tab="home"]'));
  await sleep(150);
  t.click(t.$('.tab-btn[data-tab="prep"]'));
  await sleep(350);
  check("탭을 오가도 다시 뜨지 않음", t.$("#hi5Overlay").hidden === true);
  const again = t.$('[data-action="prep-highfive"]');
  check("배너에 '다시 하이파이브' 버튼", !!again);
  t.click(again);
  await sleep(200);
  check("다시 보기 — 손바닥 화면부터", t.$("#hi5Overlay").hidden === false && t.$("#hi5Cheer").hidden === true);
  t.click(t.$("#hi5Ask [data-action='hi5-close']"));
  await sleep(250);
  check("닫으면 조용히 사라짐", t.$("#hi5Overlay").hidden === true);
  check("닫아도 오늘 완료는 유지", t.saved().morningPrep.days[TODAY].hi5 === true);

  /* ---------------- ④ 다시 열기 ---------------- */
  console.log("\n[4] 앱을 다시 열어도 오늘 것은 자동으로 뜨지 않음");
  const t2 = boot(t.saved());
  await sleep(500);
  t2.click(t2.$('.tab-btn[data-tab="prep"]'));
  await sleep(350);
  check("저장된 hi5 유지", t2.saved().morningPrep.days[TODAY].hi5 === true);
  check("재접속해도 자동으로 덮지 않음", t2.$("#hi5Overlay").hidden === true);
  check("완료 배너는 그대로", t2.$("#prepDone").hidden === false && !!t2.$('[data-action="prep-highfive"]'));

  /* ---------------- ⑤ 초기화하면 다시 ---------------- */
  console.log("\n[5] 오늘 초기화하면 다시 준비 → 다시 하이파이브");
  t2.click(t2.$('[data-action="prep-reset"]'));
  await sleep(200);
  t2.click(t2.$("#confirmOkBtn"));
  await sleep(400);
  check("초기화하면 하이파이브 기록도 지움", !t2.saved().morningPrep.days[TODAY].hi5,
    JSON.stringify(t2.saved().morningPrep.days[TODAY]));
  check("초기화 직후엔 0/4 라 뜨지 않음", t2.$("#hi5Overlay").hidden === true);
  for (let i = 0; i < 4; i++) {
    t2.click(t2.$$("#prepCards .prep-card")[i]);
    await sleep(320);
  }
  check("다시 4/4 면 하이파이브", t2.$("#hi5Overlay").hidden === false);

  /* ---------------- ⑥ 병합 ---------------- */
  console.log("\n[6] 기기 사이 3-way 병합");
  {
    const w = t2.window;
    const clone = (v) => JSON.parse(JSON.stringify(v));
    const base = {
      version: 1, updatedAt: "2026-11-18T07:00:00.000Z", deleted: {},
      morningPrep: {
        startTime: "07:10", departureTime: "08:00",
        steps: STEP_IDS.map((id) => ({ id, name: id, img: "assets/prep_x.png" })),
        days: { [TODAY]: { done: { "p-wash": true }, updatedAt: "2026-11-18T07:20:00.000Z" } },
      },
      routine: { items: [], days: {}, spent: 0 },
    };
    const local = clone(base);
    local.updatedAt = "2026-11-18T07:40:00.000Z";
    local.morningPrep.days[TODAY].hi5 = true;
    const remote = clone(base);
    remote.updatedAt = "2026-11-18T07:30:00.000Z";
    remote.morningPrep.days[TODAY].done = { "p-wash": true, "p-bag": true };
    const r1 = w.FamilyStore.mergeStates(base, local, remote).payload;
    check("한 기기의 하이파이브 완료 유지", r1.morningPrep.days[TODAY].hi5 === true, JSON.stringify(r1.morningPrep.days[TODAY]));
    check("다른 기기의 단계 완료도 유지", !!r1.morningPrep.days[TODAY].done["p-bag"] && !!r1.morningPrep.days[TODAY].done["p-wash"]);

    // 반대쪽이 완료한 경우
    const local2 = clone(base);
    local2.updatedAt = "2026-11-18T07:50:00.000Z";
    const remote2 = clone(base);
    remote2.updatedAt = "2026-11-18T07:45:00.000Z";
    remote2.morningPrep.days[TODAY].hi5 = true;
    const r2 = w.FamilyStore.mergeStates(base, local2, remote2).payload;
    check("서버 쪽 완료도 유지", r2.morningPrep.days[TODAY].hi5 === true);

    // 옛 저장(하이파이브 없음)이 저장해도 지워지지 않음
    const oldLocal = { version: 1, updatedAt: "2026-11-18T08:00:00.000Z", deleted: {}, routine: { items: [], days: {}, spent: 0 } };
    const r3 = w.FamilyStore.mergeStates(null, oldLocal, clone(local)).payload;
    check("하이파이브 없는 기기가 저장해도 유지", !!r3.morningPrep && r3.morningPrep.days[TODAY].hi5 === true);
    check("병합 후 다른 기록도 그대로", !!r3.routine);
  }

  console.log("\n================================\n");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL HIGH FIVE CHECKS PASSED ✅");
  process.exit(0);
})();
