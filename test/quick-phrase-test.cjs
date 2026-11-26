/* 다인이 말판 문구 추가 · 직접 편집 테스트
   ① 기본 말판 17종 (배고파요 · 쉬마려워요 · 졸려요 추가)
   ② ＋추가 : 이모지 칩/직접 입력 + 문구 → 말판에 저장·한 번 눌러 전송
   ③ 편집 : ✕ 로 직접 추가한 문구·기본 문구 지우기(숨김), 편집 중엔 전송 안 됨
   ④ 기본값으로 되돌리기
   ⑤ 세 기기 동기화(원격 state 수신) · 예전 기록 하위 호환 · 이상한 데이터 방어 */
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
const todayKey = kst.getUTCFullYear() + "-" + pad(kst.getUTCMonth() + 1) + "-" + pad(kst.getUTCDate());

function basePayload() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    members: [
      { id: "dain", name: "다인이", role: "6살 · 우리 딸", avatar: "assets/avatar_daini.png", photo: "", color: "#F58FB2" },
      { id: "mom", name: "엄마", role: "엄마", avatar: "assets/avatar_mom.png", photo: "", color: "#A98BE8" },
      { id: "dad", name: "아빠", role: "아빠", avatar: "assets/avatar_dad.png", photo: "", color: "#1BA1E2" },
    ],
    study: { items: [{ id: "s-read", name: "책 읽기", minutes: 15, kind: "countdown", done: false }], dayKey: todayKey, rewarded: false },
    stamps: {}, badges: {}, dex: { unlocked: {}, seen: {} },
    mission: { todayKey, index: 0, doneToday: false, doneTotal: 0, history: [] },
    todos: { dain: [], mom: [], dad: [] },
    chat: [],
    settings: { weatherCache: null, notify: false },
    calendar: { events: [] },
    checklists: { lists: [] },
  };
}

async function boot(payload) {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/family-dashboard/index.html", pretendToBeVisual: true, runScripts: "outside-only" });
  const { window } = dom;
  const { document } = window;
  window.fetch = () => Promise.reject(new Error("offline (test)"));
  window.HTMLCanvasElement.prototype.getContext = function () { return { drawImage() {} }; };
  window.HTMLCanvasElement.prototype.toDataURL = function () { return "data:image/jpeg;base64,AAA"; };
  const errors = [];
  window.addEventListener("error", (e) => errors.push(e.message));
  window.localStorage.setItem("family-dashboard.state.v1", JSON.stringify({ payload, updatedAt: payload.updatedAt }));
  window.localStorage.setItem("family-dashboard.device.v1", "dain");
  const load = (f) => window.eval(fs.readFileSync(path.join(ROOT, f), "utf8"));
  load("config.js");
  window.FAMILY_CONFIG.supabase = { url: "", anonKey: "", table: "family_state", rowId: "main", realtime: false };
  load("growth-data.js");
  load("store.js");
  load("lock.js");
  // 잠금 해제된 기기로 시작 (입장 비밀번호 동작은 lock-test.cjs 에서 따로 검증)
  window.localStorage.setItem(window.FamilyLock.AUTH_KEY, JSON.stringify({ hash: window.FamilyLock.DEFAULT_HASH, at: new Date().toISOString() }));
  load("app.js");
  await sleep(600);

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const saved = () => JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  const labels = () => $$("#quickGrid .quick-btn").map((b) => b.getAttribute("data-label"));
  const btnByLabel = (t) => $$("#quickGrid .quick-btn").find((b) => b.getAttribute("data-label") === t);
  return { window, document, $, $$, click, saved, labels, btnByLabel, errors };
}

(async function main() {
  /* ---------- ① 기본 말판 ---------- */
  console.log("\n[1] 기본 말판 — 새 문구 3개");
  let app = await boot(basePayload());
  let { window, $, $$, click, saved, labels, btnByLabel } = app;
  check("부팅 오류 없음", app.errors.length === 0, app.errors.join(" / "));
  click($('.tab-btn[data-tab="chat"]'));
  await sleep(150);
  check("말판 버튼 17개", $$("#quickGrid .quick-btn").length === 17, "got " + labels().join(","));
  ["배고파요", "쉬마려워요", "졸려요"].forEach((t) => check("새 문구 있음: " + t, labels().includes(t), labels().join(",")));
  check("배고파요 이모지 🍽️", btnByLabel("배고파요").getAttribute("data-emoji") === "🍽️", btnByLabel("배고파요").getAttribute("data-emoji"));
  check("쉬마려워요 이모지 🚽", btnByLabel("쉬마려워요").getAttribute("data-emoji") === "🚽");
  check("졸려요 이모지 😴", btnByLabel("졸려요").getAttribute("data-emoji") === "😴");
  check("＋추가 버튼 있음", !!$("#quickAddBtn") && $("#quickAddBtn").textContent.includes("추가"));
  check("편집 버튼 있음", !!$("#quickEditBtn") && $("#quickEditBtn").getAttribute("aria-pressed") === "false");
  check("편집 안내 줄은 처음엔 숨김", $("#quickEditBar").hidden === true);
  click(btnByLabel("배고파요"));
  await sleep(150);
  let last = saved().chat.slice(-1)[0];
  check("배고파요 한 번 눌러 전송", last.kind === "quick" && last.text === "배고파요" && last.emoji === "🍽️", JSON.stringify(last));
  let qp0 = saved().quickPhrases;
  check("처음엔 직접 추가·숨김 없음", qp0 && qp0.custom.length === 0 && qp0.hidden.length === 0, JSON.stringify(qp0));

  /* ---------- ② ＋추가 ---------- */
  console.log("\n[2] ＋추가 — 이모지 칩 + 문구");
  click($("#quickAddBtn"));
  await sleep(120);
  check("추가 모달 열림", $("#modalRoot").hidden === false && $("#modalBox").textContent.includes("다인이 말판에 더하기"), $("#modalBox").textContent.slice(0, 30));
  const chips = $$("#qpChips .qp-chip");
  check("자주 쓰는 이모지 칩", chips.length >= 12, "got " + chips.length);
  const gameChip = chips.find((c) => c.getAttribute("data-emoji") === "🎮");
  click(gameChip);
  check("칩을 누르면 이모지 칸에 들어감", $("#qpEmoji").value === "🎮", $("#qpEmoji").value);
  check("고른 칩 강조", gameChip.classList.contains("is-on") && $$("#qpChips .qp-chip.is-on").length === 1);

  $("#qpLabel").value = "  놀아줘요  ";
  click($("#qpSaveBtn"));
  await sleep(150);
  check("저장 후 모달 닫힘", $("#modalRoot").hidden === true);
  check("말판 18개", $$("#quickGrid .quick-btn").length === 18, labels().join(","));
  check("새 버튼 표시", !!btnByLabel("놀아줘요") && btnByLabel("놀아줘요").getAttribute("data-emoji") === "🎮");
  let qp = saved().quickPhrases;
  check("state.quickPhrases.custom 저장(앞뒤 공백 정리)", qp.custom.length === 1 && qp.custom[0].label === "놀아줘요" && qp.custom[0].emoji === "🎮" && /^qp/.test(qp.custom[0].id), JSON.stringify(qp));

  click(btnByLabel("놀아줘요"));
  await sleep(150);
  last = saved().chat.slice(-1)[0];
  check("직접 추가한 문구도 한 번 눌러 전송", last.kind === "quick" && last.text === "놀아줘요" && last.from === "dain", JSON.stringify(last));
  const bubbles = $$(".quick-bubble");
  check("말풍선에 🎮", bubbles[bubbles.length - 1].textContent.includes("놀아줘요") && bubbles[bubbles.length - 1].textContent.includes("🎮"), bubbles[bubbles.length - 1].textContent);

  console.log("\n[3] ＋추가 — 빈 문구·중복 문구 방어");
  click($("#quickAddBtn"));
  await sleep(100);
  $("#qpLabel").value = "   ";
  click($("#qpSaveBtn"));
  await sleep(120);
  check("빈 문구는 저장 안 됨", $("#modalRoot").hidden === false && saved().quickPhrases.custom.length === 1);
  $("#qpLabel").value = "배고파요";
  click($("#qpSaveBtn"));
  await sleep(120);
  check("이미 있는 문구는 거절", saved().quickPhrases.custom.length === 1, JSON.stringify(saved().quickPhrases.custom));
  click($("#modalBox [data-action='close-modal']"));
  await sleep(100);
  check("모달 닫기", $("#modalRoot").hidden === true);

  /* ---------- ③ 편집 ---------- */
  console.log("\n[4] 편집 — ✕ 로 지우기");
  click($("#quickEditBtn"));
  await sleep(120);
  check("편집 모드 표시", $("#quickGrid").classList.contains("is-editing") && $("#quickEditBtn").getAttribute("aria-pressed") === "true" && $("#quickEditBtn").textContent === "완료");
  check("편집 안내 줄 보임", $("#quickEditBar").hidden === false);
  check("버튼마다 ✕ 18개", $$("#quickGrid .quick-del").length === 18, "got " + $$("#quickGrid .quick-del").length);
  const chatLen = saved().chat.length;
  click(btnByLabel("졸려요"));
  await sleep(120);
  check("편집 중엔 눌러도 전송 안 됨", saved().chat.length === chatLen, saved().chat.length + " vs " + chatLen);

  const customDel = $$("#quickGrid .quick-cell").find((c) => c.querySelector(".quick-btn").getAttribute("data-label") === "놀아줘요").querySelector(".quick-del");
  click(customDel);
  await sleep(150);
  check("직접 추가한 문구 삭제", saved().quickPhrases.custom.length === 0 && !labels().includes("놀아줘요"));
  check("말판 17개로", $$("#quickGrid .quick-btn").length === 17, labels().join(","));

  const hungryDel = $$("#quickGrid .quick-cell").find((c) => c.querySelector(".quick-btn").getAttribute("data-label") === "배고파요").querySelector(".quick-del");
  click(hungryDel);
  await sleep(150);
  qp = saved().quickPhrases;
  check("기본 문구는 숨김으로 기록", qp.hidden.includes("q-hungry"), JSON.stringify(qp));
  check("배고파요 말판에서 사라짐", !labels().includes("배고파요") && $$("#quickGrid .quick-btn").length === 16, labels().join(","));

  console.log("\n[5] 완료 — 전송 다시 됨");
  click($("#quickEditBtn"));
  await sleep(120);
  check("편집 끝", $("#quickGrid").classList.contains("is-editing") === false && $("#quickEditBtn").textContent === "편집" && $("#quickEditBar").hidden === true);
  const before = saved().chat.length;
  click(btnByLabel("졸려요"));
  await sleep(150);
  check("완료 후 원탭 전송", saved().chat.length === before + 1 && saved().chat.slice(-1)[0].text === "졸려요");

  /* ---------- ④ 기본값으로 ---------- */
  console.log("\n[6] 기본값으로 되돌리기");
  click($("#quickEditBtn"));
  await sleep(100);
  click($('[data-action="quick-reset"]'));
  await sleep(120);
  check("되돌리기 확인 창", $("#modalRoot").hidden === false && $("#modalBox").textContent.includes("기본으로"), $("#modalBox").textContent.slice(0, 40));
  click($("#confirmOkBtn"));
  await sleep(150);
  qp = saved().quickPhrases;
  check("말판 기록 초기화", qp.custom.length === 0 && qp.hidden.length === 0, JSON.stringify(qp));
  check("기본 17개 복귀 · 배고파요 다시 보임", $$("#quickGrid .quick-btn").length === 17 && labels().includes("배고파요"), labels().join(","));
  check("되돌린 뒤엔 편집 모드도 끝", $("#quickEditBtn").textContent === "편집" && $("#quickGrid").classList.contains("is-editing") === false);

  /* ---------- ⑤ 동기화 · 하위 호환 · 방어 ---------- */
  console.log("\n[7] 세 기기 동기화 — 다른 기기에서 더하고 지운 말판");
  const remote = JSON.parse(JSON.stringify(saved()));
  remote.quickPhrases = { custom: [{ id: "qp-mom-1", emoji: "🍚", label: "밥 줘요" }], hidden: ["q-tv"] };
  remote.updatedAt = new Date(Date.now() + 1000).toISOString();
  window.dispatchEvent(new window.StorageEvent("storage", {
    key: "family-dashboard.state.v1",
    newValue: JSON.stringify({ payload: remote, updatedAt: remote.updatedAt }),
  }));
  await sleep(300);
  check("원격에서 더한 문구가 보임", labels().includes("밥 줘요"), labels().join(","));
  check("원격에서 숨긴 기본 문구가 사라짐", !labels().includes("TV 봐도 돼요?") && labels().length === 17, labels().join(","));
  click(btnByLabel("밥 줘요"));
  await sleep(200);
  check("원격 말판이 저장에 반영", saved().quickPhrases.custom.length === 1 && saved().quickPhrases.hidden.includes("q-tv"), JSON.stringify(saved().quickPhrases));

  console.log("\n[8] 예전 기록(quickPhrases 없음) 하위 호환");
  const old = basePayload();
  delete old.quickPhrases;
  app = await boot(old);
  ({ window, $, $$, click, saved, labels, btnByLabel } = app);
  click($('.tab-btn[data-tab="chat"]'));
  await sleep(150);
  check("예전 기록도 오류 없이 부팅", app.errors.length === 0, app.errors.join(" / "));
  check("기본 17개로 시작", $$("#quickGrid .quick-btn").length === 17 && labels().includes("졸려요"), labels().join(","));

  console.log("\n[9] 이상한 말판 데이터 방어");
  const weird = basePayload();
  weird.quickPhrases = {
    custom: [
      null, { label: "   " }, { id: "qp-a", label: "  테스트 문구  ", emoji: "" },
      { id: "qp-b", label: "테스트 문구", emoji: "😍" }, { label: "x".repeat(30), emoji: "🎈" },
    ],
    hidden: ["nope", "q-sleepy", "q-sleepy"],
  };
  app = await boot(weird);
  ({ window, $, $$, click, saved, labels, btnByLabel } = app);
  click($('.tab-btn[data-tab="chat"]'));
  await sleep(150);
  click(btnByLabel("사랑해요"));
  await sleep(200);
  const fixed = saved().quickPhrases;
  check("빈 문구·중복 문구 걸러짐", fixed.custom.length === 2, JSON.stringify(fixed.custom));
  check("이모지 없으면 💬", fixed.custom[0].emoji === "💬", fixed.custom[0].emoji);
  check("문구는 12자로 자름", fixed.custom[1].label.length === 12, fixed.custom[1].label);
  check("모르는 id·중복 숨김 정리", fixed.hidden.length === 1 && fixed.hidden[0] === "q-sleepy", JSON.stringify(fixed.hidden));
  check("숨긴 문구 반영 · 개수 16+2=18", $$("#quickGrid .quick-btn").length === 18 && !labels().includes("졸려요"), labels().join(","));

  console.log("\n================================ ");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL QUICK PHRASE CHECKS PASSED ✅");
  process.exit(0);
})().catch((e) => { console.error("TEST CRASH:", e); process.exit(2); });
