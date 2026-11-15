/* 부트 + 인터랙션 스모크 테스트 (jsdom) */
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

(async function main() {
  const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const dom = new JSDOM(html, {
    url: "http://localhost/family-dashboard/index.html",
    pretendToBeVisual: true,
    runScripts: "outside-only",
  });
  const { window } = dom;
  const { document } = window;

  // localStorage sanity
  check("localStorage available", !!window.localStorage);

  // give window a fetch passthrough (Node 24 has global fetch) so weather path can be exercised
  window.fetch = (url, opts) => global.fetch(url, opts);

  const load = (f) => window.eval(fs.readFileSync(path.join(ROOT, f), "utf8"));
  load("config.js");
  load("store.js");
  load("app.js");

  await sleep(400); // let boot promise settle

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const click = (elm) => elm.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));

  console.log("\n[1] 기기 게이트");
  const gate = $("#deviceGate");
  check("게이트가 보임", gate && gate.hidden === false);
  const gatePeople = $$("#gateList .gate-person");
  check("게이트에 가족 3명", gatePeople.length === 3, "got " + gatePeople.length);

  // pick 다인이
  const dainBtn = gatePeople.find((b) => b.textContent.includes("다인이"));
  click(dainBtn);
  await sleep(200);
  check("게이트 숨겨짐", $("#deviceGate").hidden === true);
  check("기기 칩에 다인이", $("#deviceChipName").textContent === "다인이");
  check("게이트 선택이 localStorage에 저장", window.localStorage.getItem("family-dashboard.device.v1") === "dain");

  console.log("\n[2] 홈");
  const active = () => $(".view.is-active").getAttribute("data-view");
  check("홈 탭 활성", active() === "home");
  check("오늘 날짜 표시", /2026년 11월 16일/.test($("#todayLabel").textContent), $("#todayLabel").textContent);
  check("날씨 카드 존재", !!$("#weatherCard"));
  const stats = $$(".stat-num");
  check("오늘 현황 통계 3개+", stats.length >= 3, "got " + stats.length);

  // weather: wait for live fetch (or failure UI)
  await sleep(3500);
  const wtxt = $("#weatherCard").textContent;
  const weatherOk = /[0-9]/.test($(".weather-temp") ? $(".weather-temp").textContent : "") || wtxt.includes("못 불러왔어요");
  check("날씨 카드가 데이터 또는 실패 UI로 채워짐", weatherOk, wtxt.slice(0, 60));
  if (!$(".weather-temp")) console.log("    (live weather fetch failed in sandbox — failure UI shown)");

  console.log("\n[3] 공부 탭");
  click($('.tab-btn[data-tab="study"]'));
  check("공부 탭 활성", active() === "study");
  check("기본 공부 3개", $$("#studyList .study-item").length === 3, "got " + $$("#studyList .study-item").length);
  check("타이머 페이스 0:00", $("#timerFace").textContent === "0:00");

  // preset 20분
  click($('.preset[data-min="20"]'));
  await sleep(50);
  check("20분 프리셋 적용", $("#timerFace").textContent === "20:00", $("#timerFace").textContent);
  check("프리셋 활성 표시", !!$('.preset[data-min="20"].is-active'));

  // stopwatch 탭 전환
  click($('.timer-tab[data-mode="stopwatch"]'));
  await sleep(50);
  check("스톱워치 전환", $("#timerPresets") === null || $("#timerFace").textContent === "0:00");

  // 다시 카운트다운 + 공부 추가
  click($('.timer-tab[data-mode="countdown"]'));
  click($('[data-action="add-study"]'));
  await sleep(50);
  check("공부 추가 모달 열림", $("#modalRoot").hidden === false && !!$("#studyName"));
  $("#studyName").value = "알파벳 노래";
  $("#studyMin").value = "5";
  click($("#studySaveBtn"));
  await sleep(450);
  check("공부 4개로 증가", $$("#studyList .study-item").length === 4);
  const savedState1 = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  check("localStorage에 공부 저장", savedState1.study.items.length === 4);

  console.log("\n[4] 도장·도감");
  // 모든 공부 완료 → 도장 +1 + 요정 해금 (렌더마다 DOM이 다시 그려지므로 한 번씩 다시 찾아 누름)
  for (let i = 0; i < 4; i++) {
    const btn = $('.study-item:not(.done) [data-action="toggle-study"]');
    if (!btn) break;
    click(btn);
    await sleep(350);
  }
  await sleep(700);
  let modalTxt = $("#modalBox").textContent;
  check("완주 해금 모달 (NEW 요정)", modalTxt.includes("NEW 요정") || modalTxt.includes("별별"), modalTxt.slice(0, 40));
  const st1 = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  const total1 = Object.values(st1.stamps).reduce((a, b) => a + b, 0);
  check("도장 1개 적립", total1 === 1, "got " + total1);
  check("요정 1종 해금", Object.keys(st1.dex.unlocked).length === 1);
  check("하루 보상 1회 제한 플래그", st1.study.rewarded === true);
  click($('.celebrate [data-action="close-modal"], #modalBox [data-action="close-modal"]'));
  await sleep(100);

  console.log("\n[5] 미션");
  click($('.tab-btn[data-tab="mission"]'));
  check("미션 탭 활성", active() === "mission");
  check("미션 카드 렌더", !!$(".mission-text"));
  const missionText = $(".mission-text").textContent;
  click($('[data-action="mission-done"]'));
  await sleep(500);
  const st2 = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  check("미션 완료 → 도장 총 2개", Object.values(st2.stamps).reduce((a, b) => a + b, 0) === 2);
  check("미션 카운트 1", st2.mission.doneTotal === 1);
  check("완료 도장 UI", !!$(".mission-done-stamp"));
  // 랜덤 뽑기 버튼은 완료 후 사라짐
  check("완료 후 뽑기 버튼 숨김", !$('[data-action="mission-reroll"]'));

  console.log("\n[6] 할 일");
  click($('[data-who="dain"][data-action="add-todo"]'));
  await sleep(50);
  check("할 일 모달", !!$("#todoText"));
  $("#todoText").value = "유치원 가방 정리";
  click($("#todoSaveBtn"));
  await sleep(400);
  const st3 = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  check("다인이 할 일 저장", st3.todos.dain.length === 1 && st3.todos.dain[0].text === "유치원 가방 정리");
  // 완료 → 다인이 할 일 전부 완료 → 도장 +1
  click($('[data-action="toggle-todo"][data-who="dain"]'));
  await sleep(500);
  const st4 = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  check("할 일 완료 → 도장 총 3개", Object.values(st4.stamps).reduce((a, b) => a + b, 0) === 3);
  check("할 일 체크 UI", !!$(".todo-item.done"));

  console.log("\n[7] 도감 탭");
  click($('.tab-btn[data-tab="dex"]'));
  check("도감 탭 활성", active() === "dex");
  check("도감 카드 8장", $$(".dex-card").length === 8, "got " + $$(".dex-card").length);
  check("해금 수 = 도장 3개 구간 (별별+꽃송이)", $$(".dex-card:not(.is-locked)").length === 2, "got " + $$(".dex-card:not(.is-locked)").length);
  check("도장판 7칸", $$(".stamp-day").length === 7);
  check("오늘 칸 강조", !!$(".stamp-day.is-today"));
  // 해금 카드 상세
  click($('.dex-card:not(.is-locked)'));
  await sleep(100);
  check("해금 요정 상세 모달", $("#modalBox").textContent.includes("별별 요정") || $("#modalBox").textContent.includes("획득일"));
  click($('[data-action="close-modal"]'));
  // 잠긴 카드 상세
  click($('.dex-card.is-locked'));
  await sleep(100);
  check("잠긴 요정 안내 모달", $("#modalBox").textContent.includes("아직 만나지 못한"));
  click($('[data-action="close-modal"]'));
  await sleep(600); // debounced save flush
  const st5 = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  check("상세 연 후 seen 처리", st5.dex.seen && Object.keys(st5.dex.seen).length >= 1, JSON.stringify(st5.dex.seen));

  console.log("\n[8] 채팅");
  click($('.tab-btn[data-tab="chat"]'));
  check("채팅 탭 활성", active() === "chat");
  $("#chatInput").value = "오늘도 사랑해 다인아";
  $("#chatForm").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await sleep(400);
  check("메시지 전송·렌더", $("#chatList").textContent.includes("오늘도 사랑해 다인아"));
  // 하트
  click($('.heart-btn'));
  await sleep(300);
  check("하트 반응 토글", !!$(".heart-btn.is-on"));
  // 스티커
  click($('[data-action="toggle-stickers"]'));
  check("스티커 시트 열림", $("#stickerSheet").hidden === false);
  click($('[data-action="send-sticker"]'));
  await sleep(300);
  check("스티커 전송", !!$(".sticker-bubble"));
  const st6 = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  check("채팅 2건 저장(텍스트+스티커, 하트는 반응)", st6.chat.length === 2, "got " + st6.chat.length);

  console.log("\n[9] 설정·잠금·동기화 모드");
  click($('[data-action="open-settings"]'));
  await sleep(100);
  check("설정 모달", $("#modalBox").textContent.includes("가족 프로필"));
  check("local 모드 안내 문구", $("#modalBox").textContent.includes("localStorage") || $("#modalBox").textContent.includes("이 기기"));
  click($('[data-action="close-modal"]'));

  // 기기 잠금 → 게이트 재등장
  click($("#lockBtn"));
  await sleep(100);
  click($('[data-action="close-modal"]')); // confirm modal 취소
  await sleep(50);
  click($("#lockBtn"));
  await sleep(100);
  const okBtn = $("#confirmOkBtn");
  click(okBtn);
  await sleep(100);
  check("잠금 후 게이트 재등장", $("#deviceGate").hidden === false);
  check("잠금 버튼 상태", $("#lockBtn").textContent === "🔒");

  console.log("\n================================");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL BOOT/INTERACTION CHECKS PASSED ✅");
  process.exit(0);
})().catch((e) => { console.error("TEST CRASH:", e); process.exit(2); });
