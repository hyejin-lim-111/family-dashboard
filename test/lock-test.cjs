/* 🔒 입장 비밀번호 잠금 테스트 (jsdom)
   · 인증 전에는 대시보드 본문을 감추고 잠금 화면을 먼저 보여 주는지
   · SHA-256 해시로만 비교하는지 (평문 비밀번호가 파일에 없는지)
   · 한 번 들어온 기기는 다시 묻지 않는지
   · 설정에서 비밀번호 변경 · 이 기기 잠그기가 되는지
   · 3-way 병합에서 다른 기기가 lockHash 를 덮어쓰지 않는지
   사용: node test/lock-test.cjs */
const { JSDOM } = require("/workspace/.cache/famdash-test/node_modules/jsdom");
const nodeCrypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname + "/..";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.log("  ✗ FAIL: " + name + (extra ? " — " + extra : "")); }
}

const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const TEMP_PASSWORD = "261103";          // 배포용 임시 비밀번호 (보고서에 적는 값)
const NEW_PASSWORD = "482913";           // 테스트에서 바꿔 볼 비밀번호
const AUTH_KEY = "family-dashboard.lock.v1";
const STATE_KEY = "family-dashboard.state.v1";
const DEVICE_KEY = "family-dashboard.device.v1";
const sha256 = (t) => nodeCrypto.createHash("sha256").update(String(t), "utf8").digest("hex");

const kst = new Date(Date.now() + 9 * 3600 * 1000);
const pad = (n) => String(n).padStart(2, "0");
const todayKey = kst.getUTCFullYear() + "-" + pad(kst.getUTCMonth() + 1) + "-" + pad(kst.getUTCDate());

function basePayload() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    study: { items: [{ id: "s-read", name: "책 읽기", minutes: 15, kind: "countdown", done: false }], dayKey: todayKey, rewarded: false },
    stamps: {}, badges: {}, dex: { unlocked: {}, seen: {} },
    mission: { todayKey, index: 0, doneToday: false, doneTotal: 0, history: [] },
    todos: { dain: [], mom: [], dad: [] },
    chat: [],
    settings: { weatherCache: null },
    calendar: { events: [] },
    checklists: { lists: [{ id: "cl1", emoji: "🧺", title: "장보기", items: [{ id: "i1", text: "우유", done: false }], by: "", createdAt: "" }] }
  };
}

/* JSDOM 하나를 띄우고 앱을 부팅한다.
   seed: { state, hash(인증 기록), device } */
async function boot(seed) {
  seed = seed || {};
  const html = read("index.html");
  const dom = new JSDOM(html, { url: "http://localhost/family-dashboard/index.html", pretendToBeVisual: true, runScripts: "outside-only" });
  const { window } = dom;
  const { document } = window;
  window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  window.fetch = (url) => {
    const u = String(url);
    if (u.includes("air-quality")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: { pm10: 20, pm2_5: 9 } }) });
    if (u.includes("open-meteo")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ current: { temperature_2m: 6, weather_code: 1 }, daily: { temperature_2m_max: [9], temperature_2m_min: [1] } }) });
    return Promise.reject(new Error("offline (test)"));
  };
  const errors = [];
  window.addEventListener("error", (e) => errors.push(String(e.message || e)));

  if (seed.state !== undefined) {
    window.localStorage.setItem(STATE_KEY, JSON.stringify({ payload: seed.state, updatedAt: seed.state.updatedAt }));
  }
  if (seed.hash) {
    window.localStorage.setItem(AUTH_KEY, JSON.stringify({ hash: seed.hash, at: new Date().toISOString() }));
  }
  if (seed.device) window.localStorage.setItem(DEVICE_KEY, seed.device);

  const load = (f) => window.eval(read(f));
  load("config.js");
  window.FAMILY_CONFIG.supabase = { url: "", anonKey: "", table: "family_state", rowId: "main", realtime: false };
  load("store.js");
  load("lock.js");
  load("app.js");
  await sleep(250);

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const submit = (form) => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  const lockOn = () => document.body.classList.contains("lock-on");
  const lockVisible = () => { const s = $("#lockScreen"); return !!s && s.hidden === false; };

  return { dom, window, document, $, $$, click, submit, lockOn, lockVisible, errors };
}

(async function main() {
  console.log("\n[1] 파일에 평문 비밀번호가 없는지 · 기본 해시");
  {
    const files = ["index.html", "app.js", "store.js", "sw.js", "config.js", "lock.js", "manifest.webmanifest"];
    const leaks = files.filter((f) => read(f).includes(TEMP_PASSWORD));
    check("평문 임시 비밀번호가 코드·HTML에 없음", leaks.length === 0, leaks.join(", "));
    check("lock.js 에 64자 SHA-256 기본 해시", /var TEMP_PASSWORD_HASH = "[0-9a-f]{64}"/.test(read("lock.js")));
    check("app.js 가 비밀번호를 해시로만 비교(Lock.verify)", /Lock\.verify\(/.test(read("app.js")));
    check("index.html 에 lock.js 로드", /<script src="lock\.js\?v=\d{8}[a-z]?"><\/script>/.test(read("index.html")));
    check("다시 열 때 바로 반영되도록 버전 올림", /styles\.css\?v=20261126a/.test(read("index.html")) && /var VERSION = "20261126-1"/.test(read("sw.js")));
  }

  console.log("\n[2] SHA-256 계산 (앱 구현 = Node crypto)");
  {
    const b = await boot({});
    const L = b.window.FamilyLock;
    ["", "abc", TEMP_PASSWORD, NEW_PASSWORD, "한글 비밀번호", "a".repeat(130)].forEach((t) => {
      check("sha256(" + (t.length > 12 ? t.slice(0, 8) + "…" : t || "빈 값") + ")", L.sha256(t) === sha256(t), L.sha256(t));
    });
    check("기본 해시 = 임시 비밀번호의 해시", L.DEFAULT_HASH === sha256(TEMP_PASSWORD));
    check("기본 해시로 임시 비밀번호 통과", L.verify(TEMP_PASSWORD, L.DEFAULT_HASH));
    check("틀린 비밀번호는 거절", !L.verify("261104", L.DEFAULT_HASH));
    check("앞뒤 공백은 무시", L.verify("  " + TEMP_PASSWORD + " ", L.DEFAULT_HASH));
  }

  console.log("\n[3] 인증 없는 기기 → 잠금 화면 먼저, 본문 감춤");
  {
    const b = await boot({ state: basePayload() });
    check("부팅 오류 없음", b.errors.length === 0, b.errors.join(" / "));
    check("body 에 lock-on", b.lockOn());
    check("잠금 화면이 보임", b.lockVisible());
    check("가족 화면이 그려지지 않음", b.$("#homeContent").innerHTML === "", b.$("#homeContent").innerHTML.slice(0, 60));
    check("기기 프로필 게이트도 숨김", b.$("#deviceGate").hidden === true);
    check("다음에 열 때 다시 묻지 않도록 '들어가기' 버튼 활성", b.$("#lockSubmit").disabled === false);
    check("안내 문구", b.$("#lockNote").textContent.includes("비밀번호"));
    check("인증 기록 없음", b.window.localStorage.getItem(AUTH_KEY) === null);
  }

  console.log("\n[4] 틀린 비밀번호 → 잠금 유지 · 맞는 비밀번호 → 입장");
  {
    const b = await boot({ state: basePayload(), device: "dain" });
    const inp = b.$("#lockInput");
    inp.value = "000000";
    b.submit(b.$("#lockForm"));
    await sleep(80);
    check("틀리면 잠금 유지", b.lockOn() && b.lockVisible());
    check("오류 문구 표시", b.$("#lockError").hidden === false && b.$("#lockError").textContent.includes("맞지 않아요"), b.$("#lockError").textContent);
    check("틀리면 인증 기록을 만들지 않음", b.window.localStorage.getItem(AUTH_KEY) === null);
    check("본문은 여전히 비어 있음", b.$("#homeContent").innerHTML === "");

    inp.value = TEMP_PASSWORD;
    b.submit(b.$("#lockForm"));
    await sleep(250);
    check("맞히면 잠금 해제", !b.lockOn() && !b.lockVisible());
    check("가족 화면이 그려짐", b.$("#homeContent").innerHTML.length > 500, String(b.$("#homeContent").innerHTML.length));
    check("기기에 인증 저장(해시)", JSON.parse(b.window.localStorage.getItem(AUTH_KEY)).hash === sha256(TEMP_PASSWORD));
    check("입력창 비움", b.$("#lockInput").value === "");
    check("오류 문구 사라짐", b.$("#lockError").hidden === true);
    check("저장된 기기 프로필로 입장(게이트 안 뜸)", b.$("#deviceGate").hidden === true && b.$("#deviceChipName").textContent === "다인이");
  }

  console.log("\n[5] 한 번 들어온 기기는 다음에 바로 열림");
  {
    const hash = sha256(TEMP_PASSWORD);
    const b = await boot({ state: basePayload(), hash: hash, device: "dain" });
    check("잠금 화면 안 뜸", !b.lockOn() && !b.lockVisible());
    check("바로 홈 화면", b.$("#homeContent").innerHTML.length > 500);
    check("프로필도 기억", b.$("#deviceChipName").textContent === "다인이");
  }

  console.log("\n[6] 다른 비밀번호로 인증된 기기(비밀번호가 바뀐 뒤) → 다시 물어봄");
  {
    const b = await boot({ state: basePayload(), hash: sha256("482913"), device: "dain" });
    check("예전 인증은 통하지 않음", b.lockOn() && b.lockVisible());
    check("본문 감춤", b.$("#homeContent").innerHTML === "");
  }

  console.log("\n[7] 설정 → 🔑 비밀번호 변경");
  {
    const b = await boot({ state: basePayload(), hash: sha256(TEMP_PASSWORD), device: "dain" });
    b.click(b.$('[data-action="open-settings"]'));
    await sleep(50);
    check("설정에 비밀번호 변경 버튼", !!b.$('[data-action="lock-change"]'));
    check("설정에 이 기기 잠그기 버튼", !!b.$('[data-action="lock-now"]'));
    b.click(b.$('[data-action="lock-change"]'));
    await sleep(50);
    check("변경 창이 열림", !!b.$("#lockChangeForm") && !!b.$("#lockCur") && !!b.$("#lockNew") && !!b.$("#lockNew2"));

    b.$("#lockCur").value = "999999";
    b.$("#lockNew").value = NEW_PASSWORD;
    b.$("#lockNew2").value = NEW_PASSWORD;
    b.submit(b.$("#lockChangeForm"));
    await sleep(50);
    check("현재 비밀번호가 틀리면 거절", b.$("#lockChangeError").hidden === false && b.$("#lockChangeError").textContent.includes("현재 비밀번호"));
    check("거절되면 저장 안 됨", !readState(b.window).security);

    b.$("#lockCur").value = TEMP_PASSWORD;
    b.$("#lockNew").value = "12";
    b.$("#lockNew2").value = "12";
    b.submit(b.$("#lockChangeForm"));
    await sleep(50);
    check("4자 미만 새 비밀번호 거절", b.$("#lockChangeError").textContent.includes("4자"));

    b.$("#lockCur").value = TEMP_PASSWORD;
    b.$("#lockNew").value = NEW_PASSWORD;
    b.$("#lockNew2").value = "482914";
    b.submit(b.$("#lockChangeForm"));
    await sleep(50);
    check("확인 입력이 다르면 거절", b.$("#lockChangeError").textContent.includes("똑같이"));

    b.$("#lockCur").value = TEMP_PASSWORD;
    b.$("#lockNew").value = NEW_PASSWORD;
    b.$("#lockNew2").value = NEW_PASSWORD;
    b.submit(b.$("#lockChangeForm"));
    await sleep(150);
    const saved = readState(b.window);
    check("변경 창 닫힘", b.$("#modalRoot").hidden === true);
    check("state.security.lockHash = 새 비밀번호 해시", saved.security && saved.security.lockHash === sha256(NEW_PASSWORD), JSON.stringify(saved.security));
    check("바꾼 시각 기록", !!saved.security.updatedAt);
    check("이 기기 인증도 새 해시로", JSON.parse(b.window.localStorage.getItem(AUTH_KEY)).hash === sha256(NEW_PASSWORD));
    check("이 기기는 계속 열려 있음", !b.lockOn());

    b.window.FamilyLockGate.lockNow();
    await sleep(60);
    check("잠그면 잠금 화면", b.lockOn() && b.lockVisible());
    check("잠그면 인증 삭제", b.window.localStorage.getItem(AUTH_KEY) === null);
    check("잠그면 그려 둔 가족 기록도 비움", b.$("#homeContent").innerHTML === "" && b.$("#chatList").innerHTML === "");

    b.$("#lockInput").value = TEMP_PASSWORD;
    b.submit(b.$("#lockForm"));
    await sleep(100);
    check("예전 임시 비밀번호로는 못 들어감", b.lockOn());

    b.$("#lockInput").value = NEW_PASSWORD;
    b.submit(b.$("#lockForm"));
    await sleep(250);
    check("새 비밀번호로 들어감", !b.lockOn() && b.$("#homeContent").innerHTML.length > 500);
  }

  console.log("\n[8] 🔒 이 기기 잠그기 버튼(설정)");
  {
    const b = await boot({ state: basePayload(), hash: sha256(TEMP_PASSWORD), device: "dain" });
    b.click(b.$('[data-action="open-settings"]'));
    await sleep(50);
    b.click(b.$('[data-action="lock-now"]'));
    await sleep(50);
    check("확인 창", !!b.$("#confirmOkBtn"));
    b.click(b.$("#confirmOkBtn"));
    await sleep(80);
    check("화면이 잠금으로 바뀜", b.lockOn() && b.lockVisible());
    check("본문 비움", b.$("#homeContent").innerHTML === "" && b.$("#missionContent").innerHTML === "");
    check("기기 프로필도 잊음", b.window.localStorage.getItem(DEVICE_KEY) === null);
  }

  console.log("\n[9] 3-way 병합 — 다른 기기가 lockHash 를 덮어쓰지 않음");
  {
    const b = await boot({});
    const S = b.window.FamilyStore;
    const hashNew = sha256(NEW_PASSWORD);
    const hashOld = sha256(TEMP_PASSWORD);
    const base = { version: 1, updatedAt: "2026-11-26T01:00:00.000Z" };

    // 1) 이 기기에 security 가 없고 서버에만 있음 → 서버 해시 유지 (옛 기기가 저장해도 안 지워짐)
    let m = S.mergeStates(base, { version: 1, updatedAt: "2026-11-26T02:00:00.000Z" },
      { version: 1, updatedAt: "2026-11-26T03:00:00.000Z", security: { lockHash: hashNew, updatedAt: "2026-11-26T03:00:00.000Z" } });
    check("서버에만 있는 비밀번호 해시 유지", m.payload.security && m.payload.security.lockHash === hashNew, JSON.stringify(m.payload.security));

    // 2) 이 기기 해시는 옛것(base 와 같음), 서버가 새것 → 서버 것
    m = S.mergeStates(
      { security: { lockHash: hashOld, updatedAt: "2026-11-26T00:00:00.000Z" } },
      { security: { lockHash: hashOld, updatedAt: "2026-11-26T00:00:00.000Z" } },
      { security: { lockHash: hashNew, updatedAt: "2026-11-26T05:00:00.000Z" } }
    );
    check("오래된 기기 저장으로 새 비밀번호가 되돌아가지 않음", m.payload.security.lockHash === hashNew, JSON.stringify(m.payload.security));

    // 3) 이 기기에서 방금 바꿈(더 늦은 시각), 서버는 옛것 → 이 기기 것
    m = S.mergeStates(
      { security: { lockHash: hashOld, updatedAt: "2026-11-26T00:00:00.000Z" } },
      { security: { lockHash: hashNew, updatedAt: "2026-11-26T09:00:00.000Z" } },
      { security: { lockHash: hashOld, updatedAt: "2026-11-26T00:00:00.000Z" } }
    );
    check("이 기기에서 바꾼 새 비밀번호가 남음", m.payload.security.lockHash === hashNew, JSON.stringify(m.payload.security));

    // 4) 양쪽 같은 해시 → 그대로
    m = S.mergeStates({}, { security: { lockHash: hashNew, updatedAt: "2026-11-26T09:00:00.000Z" } },
      { security: { lockHash: hashNew, updatedAt: "2026-11-26T09:00:00.000Z" } });
    check("같은 해시는 그대로", m.payload.security && m.payload.security.lockHash === hashNew);
  }

  console.log("\n========================================");
  if (failures) { console.log("실패 " + failures + "개"); process.exit(1); }
  console.log("입장 비밀번호 잠금 테스트 통과 ✅");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });

function readState(window) {
  try {
    const rec = JSON.parse(window.localStorage.getItem(STATE_KEY) || "null");
    return (rec && rec.payload) || {};
  } catch (e) {
    return {};
  }
}
