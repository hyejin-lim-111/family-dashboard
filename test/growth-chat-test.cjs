/* 2026-11-16 추가 기능 테스트
   ① 홈: 다인이 태어난 지 N일째
   ② 📏 성장 탭: 2017 소아청소년 성장도표(여아) 백분위 · 차트 · 기록 입력/삭제
   ③ 채팅: 다인이 말판 14종 원탭 전송
   ④ 채팅: 사진 올리기(압축) + 크게 보기
   ⑤ 채팅 알림: 안 읽은 배지 · 상단 배너 */
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
const BIRTH = "2021-02-16";

// 테스트에서 독립적으로 다시 계산한다 (앱과 같은 날짜 규칙: 출생일 = 1일째)
function monthsBetween(birth, ref) {
  const b = birth.split("-").map(Number), r = ref.split("-").map(Number);
  return Math.max(0, (r[0] - b[0]) * 12 + (r[1] - b[1]) - (r[2] < b[2] ? 1 : 0));
}
function bornDay(birth, ref) {
  const b = birth.split("-").map(Number), r = ref.split("-").map(Number);
  return Math.round((Date.UTC(r[0], r[1] - 1, r[2]) - Date.UTC(b[0], b[1] - 1, b[2])) / 86400000) + 1;
}
function ageLabel(m) {
  const y = Math.floor(m / 12), mm = m % 12;
  return "만 " + y + "살" + (mm ? " " + mm + "개월" : "");
}

const basePayload = {
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

(async function main() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, { url: "http://localhost/family-dashboard/index.html", pretendToBeVisual: true, runScripts: "outside-only" });
  const { window } = dom;
  const { document } = window;

  window.fetch = (url) => {
    const u = String(url);
    if (u.includes("air-quality")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: { pm10: 20, pm2_5: 9 } }) });
    if (u.includes("open-meteo")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: { temperature_2m: 7, weather_code: 1 }, daily: { temperature_2m_max: [11], temperature_2m_min: [2] } }) });
    return Promise.reject(new Error("offline (test)"));
  };
  // 사진 압축 경로를 jsdom에서도 돌릴 수 있게 최소한만 대신한다
  window.Image = class FakeImage {
    constructor() { this.naturalWidth = 1200; this.naturalHeight = 900; this.width = 1200; this.height = 900; }
    set src(v) { this._src = v; setTimeout(() => { if (this.onload) this.onload(); }, 0); }
    get src() { return this._src; }
  };
  window.HTMLCanvasElement.prototype.getContext = function () { return { drawImage() {} }; };
  window.HTMLCanvasElement.prototype.toDataURL = function () { return "data:image/jpeg;base64," + "A".repeat(4000); };

  const errors = [];
  window.addEventListener("error", (e) => errors.push(e.message));

  window.localStorage.setItem("family-dashboard.state.v1", JSON.stringify({ payload: basePayload, updatedAt: basePayload.updatedAt }));
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
  await sleep(700);

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const activeView = () => $(".view.is-active").getAttribute("data-view");
  const saved = () => JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;

  console.log("\n[1] 부팅 · 하단 탭 8개");
  check("부팅 오류 없음", errors.length === 0, errors.join(" / "));
  check("탭 8개", $$(".tab-btn").length === 8, "got " + $$(".tab-btn").length);
  check("성장 탭이 채팅 앞", $$(".tab-btn").map((b) => b.getAttribute("data-tab")).join(",") === "home,prep,study,pet,mission,together,growth,chat",
    $$(".tab-btn").map((b) => b.getAttribute("data-tab")).join(","));
  check("성장 탭 아이콘 📏", $('.tab-btn[data-tab="growth"] .tab-ico').textContent === "📏");

  console.log("\n[2] 홈 — 다인이 태어난 지 N일째");
  const banner = $(".born-banner");
  check("홈 상단 배너 있음", !!banner, "없음");
  const wantDays = bornDay(BIRTH, todayKey);
  const wantAge = ageLabel(monthsBetween(BIRTH, todayKey));
  check("태어난 지 " + wantDays + "일째", banner.textContent.includes("태어난 지 " + String(wantDays).replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "일째"), banner.textContent);
  check("만 나이 표시", banner.textContent.includes(wantAge), banner.textContent);
  check("D+ 표시", banner.textContent.includes("D+" + String(wantDays - 1).replace(/\B(?=(\d{3})+(?!\d))/g, ",")), banner.textContent);
  check("4단 배치 그리드는 그대로", !!$("#homeContent .home-grid") && $("#homeContent .home-grid").children.length === 7);

  console.log("\n[3] 📏 성장 탭 — 나이와 성장도표");
  click($('.tab-btn[data-tab="growth"]'));
  await sleep(120);
  check("성장 탭 활성", activeView() === "growth");
  check("제목 「이만큼 자랐어요!」", $("#growthContent").textContent.includes("이만큼 자랐어요!"));
  check("다인이 만 나이 · 생일 표시", $("#growthContent").textContent.includes("2021.02.16생") && $("#growthContent").textContent.includes(wantAge));
  check("성장도표 SVG", !!$("#growthChart svg"));
  check("백분위선 7개(3·10·25·50·75·90·97)", $$("#growthChart .gc-pct").length === 7, "got " + $$("#growthChart .gc-pct").length);
  check("음영 밴드 3단", $$("#growthChart path[class^='gc-band']").length === 3, "got " + $$("#growthChart path[class^='gc-band']").length);
  check("가로축 1살~7살", $("#growthChart").textContent.includes("1살") && $("#growthChart").textContent.includes("7살"));
  check("기록 없음 안내", $("#growthContent").textContent.includes("아직 측정 기록이 없어요"));

  console.log("\n[4] 기록 입력 — 2017 성장도표 값 검증");
  async function addRecord(date, h, w) {
    click($(".growth-btn"));
    await sleep(120);
    $("#growthDate").value = date;
    $("#growthHeight").value = String(h);
    $("#growthWeight").value = String(w);
    click($("#growthSaveBtn"));
    await sleep(200);
  }
  // 만 5세 0개월(60개월) 여아: 키 3백분위 100.7 / 50백분위 108.4 / 97백분위 116.7
  await addRecord("2026-02-16", 108.4, 18.4);
  let st = saved();
  check("기록 1건 저장", st.growth && st.growth.records.length === 1, JSON.stringify(st.growth));
  check("생년월일 유지", st.growth.birthDate === BIRTH);
  check("키 108.4 표시", $("#growthContent").textContent.includes("108.4"));
  check("또래 50백분위", $("#growthHeadline").textContent.includes("키 백분위 50%") && $("#growthHeadline").textContent.includes("또래 100명 중 50명보다 커요"), $("#growthHeadline").textContent);
  check("차트에 측정점", $$("#growthChart .gc-dot").length === 1, "got " + $$("#growthChart .gc-dot").length);
  check("최신값 말풍선", $("#growthChart").textContent.includes("108.4cm"), $("#growthChart").textContent.slice(-40));

  click($('.gt-del'));
  await sleep(100);
  click($("#confirmOkBtn"));
  await sleep(200);
  check("기록 삭제", saved().growth.records.length === 0);

  await addRecord("2026-02-16", 116.7, 23.7);
  check("97백분위 값이 97%로 계산됨", $("#growthHeadline").textContent.includes("키 백분위 97%"), $("#growthHeadline").textContent);
  click($('.gt-del'));
  await sleep(100);
  click($("#confirmOkBtn"));
  await sleep(200);

  await addRecord("2026-02-16", 100.7, 14.9);
  check("3백분위 값이 3%로 계산됨", $("#growthHeadline").textContent.includes("키 백분위 3%"), $("#growthHeadline").textContent);

  console.log("\n[5] 기록 여러 개 · 몸무게 탭 · 표");
  await addRecord("2025-08-16", 105.2, 17.1);
  st = saved();
  check("기록 2건", st.growth.records.length === 2, "got " + st.growth.records.length);
  check("날짜 순 정렬", st.growth.records[0].date === "2025-08-16" && st.growth.records[1].date === "2026-02-16");
  check("측정 기록 표 2줄", $$(".gt-table tbody tr").length === 2, "got " + $$(".gt-table tbody tr").length);
  check("지난번 대비 증감", $("#growthContent").textContent.includes("지난번보다"), $("#growthContent").textContent.slice(0, 120));
  check("차트 연결선 · 점 2개", $$("#growthChart .gc-dot").length === 2 && !!$("#growthChart .gc-record-line"));

  click($('.gc-tab[data-metric="weight"]'));
  await sleep(120);
  check("몸무게 전환", $("#growthHeadline").textContent.includes("몸무게 백분위"), $("#growthHeadline").textContent);
  check("몸무게 축 단위 kg", $("#growthChart .gc-unit").textContent === "kg", $("#growthChart .gc-unit").textContent);
  check("몸무게 말풍선", $("#growthChart").textContent.includes("14.9kg"), $("#growthChart").textContent.slice(-30));
  click($('.gc-tab[data-metric="height"]'));
  await sleep(80);

  console.log("\n[6] 채팅 — 다인이 말판 17종");
  click($('.tab-btn[data-tab="chat"]'));
  await sleep(120);
  check("말판 버튼 17개", $$("#quickGrid .quick-btn").length === 17, "got " + $$("#quickGrid .quick-btn").length);
  const labels = $$("#quickGrid .quick-btn").map((b) => b.getAttribute("data-label"));
  ["잘 잤어요", "응가 했어요", "빨리 오세요", "어디에요?", "사랑해요", "보고 싶어요", "과자 먹고 싶어요",
    "배고파요", "쉬마려워요", "졸려요",
    "안녕히 주무세요", "TV 봐도 돼요?", "숙제 다 했어요", "아파요", "전화해 주세요", "도와주세요", "유치원 갔다올게요"]
    .forEach((t) => { if (!labels.includes(t)) check("말판 항목: " + t, false, labels.join(",")); });
  check("말판 17개 문구 모두 있음", labels.length === 17, labels.join(","));
  check("다인 프로필이면 강조", $("#quickPanel").classList.contains("is-dain"));
  const loveBtn = $$("#quickGrid .quick-btn").find((b) => b.getAttribute("data-label") === "사랑해요");
  click(loveBtn);
  await sleep(150);
  const quickMsg = saved().chat.slice(-1)[0];
  check("한 번 눌러 바로 전송", quickMsg.kind === "quick" && quickMsg.text === "사랑해요" && quickMsg.from === "dain", JSON.stringify(quickMsg));
  check("말판 말풍선 렌더", !!$(".quick-bubble") && $(".quick-bubble").textContent.includes("사랑해요"));
  click($("#quickToggle"));
  check("말판 접기", $("#quickGrid").hidden === true && $("#quickToggle").textContent === "말판 열기");
  click($("#quickToggle"));
  check("말판 다시 펼치기", $("#quickGrid").hidden === false && $("#quickToggle").textContent === "접기");

  console.log("\n[7] 채팅 — 사진 올리기 · 크게 보기");
  const file = new window.File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], "photo.png", { type: "image/png" });
  const input = $("#chatPhotoInput");
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  input.dispatchEvent(new window.Event("change", { bubbles: true }));
  await sleep(400);
  const photoMsg = saved().chat.slice(-1)[0];
  check("사진 메시지 저장", photoMsg.kind === "photo" && /^data:image\/jpeg/.test(photoMsg.imageData || ""), JSON.stringify({ kind: photoMsg.kind, len: (photoMsg.imageData || "").length }));
  check("긴 변 720px로 줄임", photoMsg.w === 720 && photoMsg.h === 540, photoMsg.w + "x" + photoMsg.h);
  check("사진 말풍선 렌더", !!$(".msg-photo") && $(".msg-photo").getAttribute("src").startsWith("data:image/jpeg"));
  click($('[data-action="view-photo"]'));
  await sleep(120);
  check("크게 보기 모달", $("#modalRoot").hidden === false && !!$(".photo-view"), $("#modalBox").textContent.slice(0, 30));
  click($("#modalBox [data-action='close-modal']"));
  await sleep(100);
  check("모달 닫기", $("#modalRoot").hidden === true);

  console.log("\n[8] 채팅 알림 — 안 읽은 배지 · 배너");
  check("처음엔 배지 숨김", $("#chatBadge").hidden === true);
  click($('.tab-btn[data-tab="home"]'));
  await sleep(100);
  check("홈으로 이동", activeView() === "home");

  function pushRemote(msgs) {
    const payload = JSON.parse(JSON.stringify(saved()));
    payload.chat = (payload.chat || []).concat(msgs);
    payload.updatedAt = new Date(Date.now() + 1000).toISOString();
    window.dispatchEvent(new window.StorageEvent("storage", {
      key: "family-dashboard.state.v1",
      newValue: JSON.stringify({ payload, updatedAt: payload.updatedAt }),
    }));
  }
  const momMsg = { id: "m-mom-1", from: "mom", fromName: "엄마", kind: "quick", text: "보고 싶어요", emoji: "🥺", at: new Date().toISOString(), heart: false };
  pushRemote([momMsg]);
  await sleep(250);
  check("다른 가족 메시지에 배지 1", $("#chatBadge").hidden === false && $("#chatBadge").textContent === "1", $("#chatBadge").textContent + "/" + $("#chatBadge").hidden);
  check("상단 알림 배너", $("#chatBanner").hidden === false && $("#chatBanner").textContent.includes("엄마") && $("#chatBanner").textContent.includes("보고 싶어요"), $("#chatBanner").textContent);
  check("배너 누르면 채팅으로", (function () { click($("#chatBanner")); return true; })());
  await sleep(120);
  check("채팅 탭 이동", activeView() === "chat");
  check("배지 초기화", $("#chatBadge").hidden === true && $("#chatBadge").textContent === "0", $("#chatBadge").textContent);
  check("배너 숨김", $("#chatBanner").hidden === true);

  click($('.tab-btn[data-tab="home"]'));
  await sleep(80);
  pushRemote([{ id: "m-dad-1", from: "dad", fromName: "아빠", kind: "photo", imageData: "data:image/jpeg;base64,AAA", w: 10, h: 10, at: new Date().toISOString(), heart: false }]);
  await sleep(250);
  check("사진 알림 문구", $("#chatBanner").textContent.includes("사진을 보냈어요"), $("#chatBanner").textContent);
  check("배지 1", $("#chatBadge").textContent === "1");
  pushRemote([{ id: "m-self-1", from: "dain", fromName: "다인이", kind: "text", text: "내가 보낸 말", at: new Date().toISOString(), heart: false }]);
  await sleep(250);
  check("내 메시지는 배지 증가 없음", $("#chatBadge").textContent === "1" && $("#chatBadge").hidden === false, $("#chatBadge").textContent);
  click($('.tab-btn[data-tab="chat"]'));
  await sleep(120);
  check("사진 메시지 렌더(수신)", !!$(".msg-photo"));
  check("설정에 알림 항목", (function () {
    click($('[data-action="open-settings"]'));
    const ok = $("#modalBox").textContent.includes("채팅 알림");
    click($("#modalBox [data-action='close-modal']"));
    return ok;
  })());

  console.log("\n[9] 채팅 — 메시지·사진 삭제 버튼");
  check("채팅 탭", activeView() === "chat");
  const msgEls = $$("#chatList .msg");
  check("메시지마다 삭제 버튼", msgEls.length > 0 && msgEls.every((m) => !!m.querySelector('.msg-del[data-action="del-chat"]')),
    msgEls.length + "개 중 " + $$('#chatList .msg-del[data-action="del-chat"]').length + "개");

  async function tryDelete(elm, confirm) {
    const id = elm.querySelector('.msg-del').getAttribute("data-id");
    click(elm.querySelector(".msg-del"));
    await sleep(150);
    const asked = $("#modalRoot").hidden === false && $("#modalBox").textContent.includes("지울까요");
    click(confirm ? $("#confirmOkBtn") : $("#modalBox [data-action='close-modal']"));
    await sleep(300);
    return { id, asked };
  }

  const photoEl = $$("#chatList .msg").find((m) => m.querySelector(".msg-photo"));
  check("사진 메시지 있음", !!photoEl);
  if (photoEl) {
    const first = await tryDelete(photoEl, false);
    check("삭제 전 확인 창", first.asked);
    check("취소하면 메시지 그대로", saved().chat.some((m) => m.id === first.id), first.id);
    const again = await tryDelete($$("#chatList .msg").find((m) => m.querySelector('.msg-del') && m.querySelector('.msg-del').getAttribute("data-id") === first.id), true);
    check("확인하면 사진 메시지 삭제", !saved().chat.some((m) => m.id === again.id), again.id);
    check("지운 사진 tombstone 기록", !!(saved().deleted && saved().deleted.chat && saved().deleted.chat[again.id]), JSON.stringify(saved().deleted));
    check("화면에서도 사라짐", !$('#chatList .msg-del[data-id="' + again.id + '"]'));
    check("사진 없이도 다른 메시지 유지", saved().chat.length > 0, String(saved().chat.length));
  }

  const textEl = $$("#chatList .msg").find((m) => m.querySelector(".quick-bubble"));
  if (textEl) {
    const res = await tryDelete(textEl, true);
    check("말판 메시지도 삭제", !saved().chat.some((m) => m.id === res.id), res.id);
    check("말판 메시지 tombstone", !!(saved().deleted.chat && saved().deleted.chat[res.id]));
  }

  console.log("\n================================ ");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL GROWTH/CHAT CHECKS PASSED ✅");
  process.exit(0);
})().catch((e) => { console.error("TEST CRASH:", e); process.exit(2); });
