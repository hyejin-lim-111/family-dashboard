/* ☀️ 화면 켜짐 유지(Screen Wake Lock) 테스트
   ① 지원 기기에서 처음에는 꺼짐 (버튼·저장값)
   ② 헤더 버튼으로 켜기 — navigator.wakeLock.request('screen') 호출·기기별 localStorage 저장
   ③ OS·배터리 절전으로 풀리면 화면이 보이는 동안 다시 잡기
   ④ 화면이 숨겨졌다 돌아오면(visibilitychange) 다시 잡기
   ⑤ 설정 모달의 같은 토글 — 끄면 release
   ⑥ 앱을 다시 열어도 기억(자동 재획득)
   ⑦ 지원하지 않는 기기 — 오류 없이 안내, 켠 척하지 않음
   사용: node test/wake-lock-test.cjs */
const { JSDOM } = require("/workspace/.cache/famdash-test/node_modules/jsdom");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname + "/..";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const WAKE_KEY = "family-dashboard.wakelock.v1";

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.log("  ✗ FAIL: " + name + (extra ? " — " + extra : "")); }
}

/* 가짜 Screen Wake Lock API — 브라우저가 해 주는 일을 흉내 낸다 */
function fakeWake() {
  const log = { requests: 0, types: [], releases: 0, sentinels: [] };
  const api = {
    request(type) {
      log.requests++;
      log.types.push(type);
      return new Promise((resolve) => {
        const listeners = [];
        const sentinel = {
          released: false,
          addEventListener(ev, fn) { if (ev === "release") listeners.push(fn); },
          release() {
            if (sentinel.released) return Promise.resolve();
            sentinel.released = true;
            log.releases++;
            listeners.forEach((fn) => fn());
            return Promise.resolve();
          },
          // OS·배터리 절전이 잠금을 풀어 버린 상황
          fireRelease() {
            sentinel.released = true;
            listeners.forEach((fn) => fn());
          },
        };
        log.sentinels.push(sentinel);
        resolve(sentinel);
      });
    },
  };
  return { api, log };
}

function boot(opts) {
  opts = opts || {};
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, {
    url: "http://localhost/family-dashboard/index.html",
    pretendToBeVisual: true,
    runScripts: "outside-only",
  });
  const { window } = dom;
  const { document } = window;

  window.fetch = () => Promise.reject(new Error("offline (test)"));

  const wake = opts.withWake === false ? null : fakeWake();
  if (wake) {
    try {
      Object.defineProperty(window.navigator, "wakeLock", { value: wake.api, configurable: true });
    } catch (e) {
      window.navigator.wakeLock = wake.api;
    }
  }

  const errors = [];
  window.addEventListener("error", (e) => errors.push(e.message));

  if (opts.state) {
    window.localStorage.setItem("family-dashboard.state.v1", JSON.stringify({ payload: opts.state, updatedAt: new Date().toISOString() }));
  }
  if (opts.pref != null) window.localStorage.setItem(WAKE_KEY, opts.pref);
  window.localStorage.setItem("family-dashboard.device.v1", "dain");

  const load = (f) => window.eval(fs.readFileSync(path.join(ROOT, f), "utf8"));
  load("config.js");
  window.FAMILY_CONFIG.supabase = { url: "", anonKey: "", table: "family_state", rowId: "main", realtime: false };
  load("store.js");
  load("app.js");

  const $ = (s) => document.querySelector(s);
  const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));

  // 테스트에서 화면 보임/숨김을 바꾼다
  const setVisible = (v) => {
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => v });
    document.dispatchEvent(new window.Event("visibilitychange"));
  };

  return { window, document, $, click, setVisible, log: wake ? wake.log : null, errors };
}

(async function main() {
  /* ---------------- ① 처음 상태 ---------------- */
  console.log("\n[1] 지원 기기 — 처음에는 꺼짐");
  const t = boot();
  await sleep(500);
  const btn = t.$("#wakeBtn");
  check("헤더에 화면 켜짐 버튼", !!btn && !!btn.querySelector(".wk-ico") && !!btn.querySelector(".wk-txt"));
  check("처음엔 꺼짐 표시(🌙 자동 꺼짐)", btn.getAttribute("aria-pressed") === "false" &&
    btn.querySelector(".wk-ico").textContent === "🌙" && btn.querySelector(".wk-txt").textContent === "자동 꺼짐",
    btn.textContent);
  check("지원 기기로 인식", t.window.FamilyWake.isSupported() === true);
  check("부팅 때는 요청하지 않음", t.log.requests === 0, String(t.log.requests));
  check("저장값 없음", t.window.localStorage.getItem(WAKE_KEY) === null, String(t.window.localStorage.getItem(WAKE_KEY)));
  check("status 영역에 토글 동작", btn.getAttribute("data-action") === "toggle-wake");

  /* ---------------- ② 켜기 ---------------- */
  console.log("\n[2] 헤더 버튼으로 켜기");
  t.click(btn);
  await sleep(250);
  check("request('screen') 호출", t.log.requests === 1 && t.log.types[0] === "screen", JSON.stringify(t.log.types));
  check("켜짐 상태", t.window.FamilyWake.isOn() === true && t.window.FamilyWake.isActive() === true,
    JSON.stringify(t.window.FamilyWake.state()));
  check("기기에 저장(localStorage)", t.window.localStorage.getItem(WAKE_KEY) === "1", String(t.window.localStorage.getItem(WAKE_KEY)));
  check("버튼이 켜짐 표시(☀️ 화면 켜짐)", btn.getAttribute("aria-pressed") === "true" &&
    btn.querySelector(".wk-ico").textContent === "☀️" && btn.querySelector(".wk-txt").textContent === "화면 켜짐",
    btn.textContent);
  check("버튼 설명이 '눌러서 끄기'", /눌러서 끄기/.test(btn.getAttribute("aria-label")), btn.getAttribute("aria-label"));
  check("켰다는 안내", /켜져 있어요/.test(t.$("#toast").textContent), t.$("#toast").textContent);
  check("가족 저장소(state)에는 넣지 않음", !JSON.stringify(t.window.localStorage.getItem("family-dashboard.state.v1") || "").includes("wake"),
    "가족 기록에는 흔적 없음");

  /* ---------------- ③ OS가 풀면 다시 ---------------- */
  console.log("\n[3] OS·절전이 풀면 화면이 보이는 동안 다시 잡기");
  t.log.sentinels[0].fireRelease();
  await sleep(60);
  check("풀린 직후엔 꺼진 상태로 표시", t.window.FamilyWake.isActive() === false);
  check("사용자가 끈 게 아니므로 설정은 그대로", t.window.FamilyWake.isOn() === true);
  await sleep(600);
  check("스스로 다시 요청", t.log.requests === 2, String(t.log.requests));
  check("다시 켜짐", t.window.FamilyWake.isActive() === true && !!t.log.sentinels[1] && t.log.sentinels[1].released === false);

  /* ---------------- ④ 화면 숨김 → 복귀 ---------------- */
  console.log("\n[4] 화면이 숨겨졌다 돌아오면 다시 잡기");
  t.setVisible("hidden");
  t.log.sentinels[1].fireRelease();
  await sleep(500);
  const hiddenRequests = t.log.requests;
  check("숨김 상태에서는 다시 요청하지 않음", hiddenRequests === 2 && t.window.FamilyWake.isActive() === false,
    "requests=" + hiddenRequests);
  t.setVisible("visible");
  await sleep(300);
  check("돌아오면 다시 요청", t.log.requests === 3, String(t.log.requests));
  check("복귀 후 켜짐", t.window.FamilyWake.isActive() === true);

  /* ---------------- ⑤ 설정 모달 ---------------- */
  console.log("\n[5] 설정 모달의 같은 토글");
  t.click(t.$("#settingsBtn"));
  await sleep(200);
  check("설정에 화면 켜짐 유지 줄", !!t.$("#wakeSettingRow") && !!t.$("#wakeSetTitle") && !!t.$("#wakeSetBtn"));
  check("제목이 '켜짐'", t.$("#wakeSetTitle").textContent === "화면 켜짐 유지 켜짐", t.$("#wakeSetTitle").textContent);
  check("설명 문구", /화면이 꺼지지 않아요/.test(t.$("#wakeSetSub").textContent), t.$("#wakeSetSub").textContent);
  check("버튼은 '끄기'", t.$("#wakeSetBtn").textContent === "끄기", t.$("#wakeSetBtn").textContent);

  t.click(t.$("#wakeSetBtn"));
  await sleep(250);
  check("설정에서 끄면 release", t.log.releases >= 1 && t.window.FamilyWake.isOn() === false && t.window.FamilyWake.isActive() === false,
    JSON.stringify({ releases: t.log.releases, state: t.window.FamilyWake.state() }));
  check("끈 값도 기기에 저장", t.window.localStorage.getItem(WAKE_KEY) === "0", String(t.window.localStorage.getItem(WAKE_KEY)));
  check("설정 줄이 '꺼짐'·'켜기'로 바뀜", t.$("#wakeSetTitle").textContent === "화면 켜짐 유지 꺼짐" && t.$("#wakeSetBtn").textContent === "켜기",
    t.$("#wakeSetTitle").textContent + " / " + t.$("#wakeSetBtn").textContent);
  check("헤더 버튼도 꺼짐", t.$("#wakeBtn").getAttribute("aria-pressed") === "false" &&
    t.$("#wakeBtn").querySelector(".wk-txt").textContent === "자동 꺼짐");
  check("풀린 잠금은 release 로 정리", t.log.sentinels[2].released === true, String(t.log.sentinels[2].released));
  t.click(t.$("#modalBox .modal-close"));
  await sleep(60);

  /* ---------------- ⑥ 다시 열어도 기억 ---------------- */
  console.log("\n[6] 앱을 다시 열어도 기억");
  const t2 = boot({ pref: "1" });
  await sleep(500);
  check("부팅하자마자 자동으로 켜기", t2.log.requests === 1 && t2.window.FamilyWake.isActive() === true,
    JSON.stringify({ requests: t2.log.requests, state: t2.window.FamilyWake.state() }));
  check("버튼도 켜짐으로 표시", t2.$("#wakeBtn").getAttribute("aria-pressed") === "true" &&
    t2.$("#wakeBtn").querySelector(".wk-ico").textContent === "☀️");
  check("부팅 때 안내 토스트는 띄우지 않음", t2.$("#toast").hidden === true);

  /* ---------------- ⑦ 지원하지 않는 기기 ---------------- */
  console.log("\n[7] 지원하지 않는 기기 — 솔직한 안내");
  const t3 = boot({ withWake: false, pref: "1" });
  await sleep(500);
  check("미지원 인식", t3.window.FamilyWake.isSupported() === false);
  check("부팅 오류 없음", t3.errors.length === 0, t3.errors.join(" / "));
  check("버튼 설명이 안내", /지원하지 않아요/.test(t3.$("#wakeBtn").getAttribute("aria-label")), t3.$("#wakeBtn").getAttribute("aria-label"));
  t3.click(t3.$("#wakeBtn"));
  await sleep(150);
  check("눌러도 켠 척하지 않음", t3.window.FamilyWake.isOn() === false && t3.$("#wakeBtn").getAttribute("aria-pressed") === "false");
  check("설정값도 꺼짐", t3.window.localStorage.getItem(WAKE_KEY) === "0", String(t3.window.localStorage.getItem(WAKE_KEY)));
  check("태블릿 설정을 늘리라고 안내", /지원하지 않아요/.test(t3.$("#toast").textContent) && /자동 꺼짐 시간/.test(t3.$("#toast").textContent),
    t3.$("#toast").textContent);
  check("클릭 후에도 오류 없음", t3.errors.length === 0, t3.errors.join(" / "));
  t3.click(t3.$("#settingsBtn"));
  await sleep(150);
  check("설정 버튼은 눌리지 않게(disabled)", t3.$("#wakeSetBtn").disabled === true);
  check("설정 설명에 대안 안내", /자동 꺼짐 시간/.test(t3.$("#wakeSetSub").textContent), t3.$("#wakeSetSub").textContent);

  console.log("\n================================\n");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL WAKE LOCK CHECKS PASSED ✅");
  process.exit(0);
})();
