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

  // 결정적 실행을 위해 네트워크를 대신한다 (날씨는 가짜 응답, 그 외는 오프라인)
  // → 테스트가 실제 Supabase·Open-Meteo 응답 시간에 흔들리지 않는다.
  const weatherMock = {
    current: { temperature_2m: 3.5, weather_code: 3, relative_humidity_2m: 55 },
    daily: { temperature_2m_max: [8], temperature_2m_min: [-1] },
  };
  const airMock = { current: { pm10: 46, pm2_5: 22 } };
  window.fetch = (url) => {
    const u = String(url);
    if (u.includes("air-quality")) return Promise.resolve({ ok: true, json: () => Promise.resolve(airMock) });
    if (u.includes("open-meteo")) return Promise.resolve({ ok: true, json: () => Promise.resolve(weatherMock) });
    return Promise.reject(new Error("offline (test): " + u));
  };

  const load = (f) => window.eval(fs.readFileSync(path.join(ROOT, f), "utf8"));
  load("config.js");
  // 이 테스트는 이 기기 저장(local) 모드만 검증한다. 실시간 동기화 어댑터는 store-sync-test.cjs에서 검증.
  window.FAMILY_CONFIG.supabase = { url: "", anonKey: "", table: "family_state", rowId: "main", realtime: false };
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
  const todayKst = new Date(Date.now() + 9 * 3600 * 1000);
  const TODAY_KO = todayKst.getUTCFullYear() + "년 " + (todayKst.getUTCMonth() + 1) + "월 " + todayKst.getUTCDate() + "일";
  check("오늘 날짜 표시", $("#todayLabel").textContent.includes(TODAY_KO), $("#todayLabel").textContent);
  check("날씨 카드 존재", !!$("#weatherCard"));
  const stats = $$(".stat-num");
  check("오늘 현황 통계 3개+", stats.length >= 3, "got " + stats.length);

  // weather: mock 응답으로 즉시 채워짐
  await sleep(900);
  const wtxt = $("#weatherCard").textContent;
  check("날씨 카드에 기온 표시", $(".weather-temp") && /4/.test($(".weather-temp").textContent), wtxt.slice(0, 60));
  check("미세먼지 배지 표시", wtxt.includes("미세먼지"), wtxt.slice(0, 60));

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

  console.log("\n[7] 🐣 키우기 탭");
  click($('.tab-btn[data-tab="pet"]'));
  await sleep(150);
  check("키우기 탭 활성", active() === "pet");
  check("하단 탭 7개 유지", $$(".tab-btn").length === 7, "got " + $$(".tab-btn").length);
  check("내 캐릭터가 보임", !!$("#petHero") && !!$("#petImg"));
  check("처음은 Lv.1 알 단계", $(".pet-stage-line").textContent.includes("Lv.1 알"), $(".pet-stage-line").textContent);
  check("단계 그림 6장", $$(".pet-stage").length === 6, "got " + $$(".pet-stage").length);
  check("돌보기 버튼 3개", $$(".pet-care-btn").length === 3, "got " + $$(".pet-care-btn").length);
  check("게이지 3개(포만감·기분·친밀도)", $$(".pet-gauge").length === 3);
  check("오늘 할 일 = 경험치 4줄", $$(".pet-quest").length === 4, "got " + $$(".pet-quest").length);
  check("올클리어 간식 상자", !!$("#petBonusBox"));
  check("도장판 7칸은 키우기 탭에 남아 있음", $$(".stamp-day").length === 7, "got " + $$(".stamp-day").length);
  check("오늘 칸 강조", !!$(".stamp-day.is-today"));
  // 공부 4개 + 올클리어 + 미션 + 할 일 = 45 XP (돈 경험치는 아직 0)
  check("지난 공부·할 일이 경험치로 쌓여 있음", $("#petXpLabel").textContent.indexOf("45") === 0, $("#petXpLabel").textContent);
  check("공부·할 일 칩도 45", $$(".pet-chip")[1] && $$(".pet-chip")[1].textContent.includes("45"), $$(".pet-chip").map((c) => c.textContent).join(" | "));
  check("캐릭터 상태가 저장됨", (function () {
    const st7 = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
    return !!st7.pet && st7.pet.xp === 45 && typeof st7.pet.care.full === "number";
  })());

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
  check("말판 버튼 17종", $$("#quickGrid .quick-btn").length === 17, "got " + $$("#quickGrid .quick-btn").length);
  check("말판을 누르면 바로 전송", (function () {
    const btn = $$("#quickGrid .quick-btn")[4];
    const label = btn.getAttribute("data-label");
    click(btn);
    const last = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload.chat.slice(-1)[0];
    return last.kind === "quick" && last.text === label && !!$(".quick-bubble");
  })(), $("#chatList").textContent.slice(0, 80));
  check("사진 올리기 버튼·파일 입력", !!$('[data-action="pick-photo"]') && !!$("#chatPhotoInput"));

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

  console.log("\n[10] 함께 탭 — 가족 달력");
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const yy = kstNow.getUTCFullYear();
  const mo = kstNow.getUTCMonth() + 1;
  const todayKey = yy + "-" + String(mo).padStart(2, "0") + "-" + String(kstNow.getUTCDate()).padStart(2, "0");
  if ($("#deviceGate").hidden === false) { click($("#gateList .gate-person")); await sleep(150); }

  click($('.tab-btn[data-tab="together"]'));
  await sleep(60);
  check("함께 탭 활성", active() === "together");
  check("하단 탭 7개", $$(".tab-btn").length === 7, "got " + $$(".tab-btn").length);
  check("기본 화면은 달력", $("#togetherContent").getAttribute("data-sub") === "calendar");
  check("달력 42칸", $$(".cal-cell").length === 42, "got " + $$(".cal-cell").length);
  check("요일 머리글 7개", $$("#togetherContent .cal-dow span").length === 7);
  check("이번 달 라벨", $("#calMonthLabel").textContent === mo + "월 " + yy, $("#calMonthLabel").textContent);
  check("오늘 칸 강조", !!$(".cal-cell.is-today"));
  check("기본 선택은 오늘", $(".cal-cell.is-selected").getAttribute("data-date") === todayKey, $(".cal-cell.is-selected").getAttribute("data-date"));

  click($('[data-action="cal-month"][data-delta="1"]'));
  await sleep(40);
  const nextLabel = mo === 12 ? "1월 " + (yy + 1) : (mo + 1) + "월 " + yy;
  check("다음 달로 이동", $("#calMonthLabel").textContent === nextLabel, $("#calMonthLabel").textContent);
  click($('[data-action="cal-month"][data-delta="-1"]'));
  click($('[data-action="cal-month"][data-delta="-1"]'));
  await sleep(40);
  const prevLabel = mo === 1 ? "12월 " + (yy - 1) : (mo - 1) + "월 " + yy;
  check("이전 달로 이동", $("#calMonthLabel").textContent === prevLabel, $("#calMonthLabel").textContent);
  click($('[data-action="cal-today"]'));
  await sleep(40);
  check("오늘 버튼으로 복귀", $("#calMonthLabel").textContent === mo + "월 " + yy);

  const day20 = yy + "-" + String(mo).padStart(2, "0") + "-20";
  const cell20 = $('.cal-cell[data-date="' + day20 + '"]');
  check("날짜 칸이 그려짐", !!cell20);
  click(cell20);
  await sleep(40);
  check("날짜 선택 반영", $(".cal-cell.is-selected").getAttribute("data-date") === day20);
  check("선택 날짜 패널", $("#dayEvents").textContent.includes("아직 일정이 없어요"));

  click($('[data-action="add-event"]'));
  await sleep(60);
  check("일정 추가 모달 · 선택 날짜 기본값", !!$("#evTitle") && $("#evDate").value === day20, $("#evDate") && $("#evDate").value);
  $("#evTitle").value = "다인이 소풍";
  $("#evTime").value = "10:30";
  $("#evWho").value = "dain";
  click($("#evSaveBtn"));
  await sleep(350);
  check("일정 추가 후 패널 표시", !!$(".event-title") && $(".event-title").textContent === "다인이 소풍");
  check("시간·대상 표시", $("#dayEvents").textContent.includes("오전 10:30") && $("#dayEvents").textContent.includes("다인이"));
  check("달력 칸에 일정 표시", $('.cal-cell[data-date="' + day20 + '"]').classList.contains("has-events"));
  let stCal = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  check("일정 저장", stCal.calendar.events.length === 1 && stCal.calendar.events[0].date === day20, JSON.stringify(stCal.calendar.events));

  click($('[data-action="edit-event"]'));
  await sleep(60);
  check("수정 모달에 기존 값", $("#evTitle").value === "다인이 소풍" && $("#evDate").value === day20);
  $("#evTitle").value = "다인이 소풍 (엄마 동행)";
  $("#evAllDay").checked = true;
  $("#evAllDay").dispatchEvent(new window.Event("change", { bubbles: true }));
  check("종일 체크 시 시간 입력 꺼짐", $("#evTime").disabled === true);
  click($("#evSaveBtn"));
  await sleep(350);
  check("수정 반영", $("#dayEvents").textContent.includes("엄마 동행") && $("#dayEvents").textContent.includes("종일"));
  stCal = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  check("수정 저장(종일·시간 비움)", stCal.calendar.events[0].allDay === true && stCal.calendar.events[0].time === "");

  click($('[data-action="delete-event"]'));
  await sleep(60);
  check("삭제 확인 모달", $("#modalBox").textContent.includes("지울까요"));
  click($("#confirmOkBtn"));
  await sleep(350);
  stCal = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  check("일정 삭제 저장", stCal.calendar.events.length === 0);
  check("삭제 후 빈 안내", $("#dayEvents").textContent.includes("아직 일정이 없어요"));

  console.log("\n[11] 함께 체크리스트");
  click($('.seg-btn[data-sub="checklist"]'));
  await sleep(60);
  check("체크리스트 화면", $("#togetherContent").getAttribute("data-sub") === "checklist");
  check("기본 리스트 2개", $$(".checklist").length === 2, "got " + $$(".checklist").length);
  check("기본 리스트 이름", $$(".cl-title").map((e) => e.textContent).join(",") === "장보기,외출 준비물", $$(".cl-title").map((e) => e.textContent).join(","));

  const clForm = () => $("form.cl-add");
  clForm().querySelector("input").value = "우유 2팩";
  clForm().dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await sleep(350);
  check("항목 추가", $$(".cl-item").length === 1 && $(".cl-item .txt").textContent === "우유 2팩");
  clForm().querySelector("input").value = "계란 한 판";
  clForm().dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  await sleep(350);
  check("항목 2개", $$(".cl-item").length === 2, "got " + $$(".cl-item").length);

  click($('[data-action="toggle-cl-item"]'));
  await sleep(350);
  check("체크 표시", !!$(".cl-item.done"));
  check("진행 문구", $(".cl-sub").textContent.includes("1 / 2"), $(".cl-sub").textContent);
  check("완료 정리 버튼", !!$('[data-action="clear-done"]'));

  click($('[data-action="add-list"]'));
  await sleep(60);
  check("새 리스트 모달", !!$("#clTitle") && !!$("#clEmojiPick"));
  $("#clTitle").value = "제주 여행 챙길 것";
  click($$("#clEmojiPick .emoji-opt")[3]);
  click($("#clSaveBtn"));
  await sleep(350);
  check("리스트 3개", $$(".checklist").length === 3, "got " + $$(".checklist").length);

  click($$('[data-action="rename-list"]')[2]);
  await sleep(60);
  $("#clTitle").value = "여행 가방";
  click($("#clSaveBtn"));
  await sleep(350);
  check("리스트 이름 바꾸기", $$(".cl-title")[2].textContent === "여행 가방", $$(".cl-title")[2].textContent);

  click($('[data-action="clear-done"]'));
  await sleep(60);
  check("완료 정리 확인", $("#modalBox").textContent.includes("체크한 1개"));
  click($("#confirmOkBtn"));
  await sleep(350);
  check("완료 항목만 지워짐", $$(".cl-item").length === 1 && !$(".cl-item.done"), "got " + $$(".cl-item").length);

  click($$('[data-action="delete-list"]')[2]);
  await sleep(60);
  click($("#confirmOkBtn"));
  await sleep(350);
  check("리스트 삭제", $$(".checklist").length === 2, "got " + $$(".checklist").length);
  const stCl = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  check("체크리스트 저장", stCl.checklists.lists.length === 2 && stCl.checklists.lists[0].items.length === 1, JSON.stringify(stCl.checklists.lists.map((l) => l.items.length)));

  console.log("\n[12] 홈 요약 · 저장 구조");
  click($('.tab-btn[data-tab="home"]'));
  await sleep(80);
  const homeTxt = $("#homeContent").textContent;
  check("홈 다가오는 일정 카드", homeTxt.includes("다가오는 일정"));
  check("홈 함께 체크리스트 카드", homeTxt.includes("함께 체크리스트"));
  check("홈에서 달력 바로가기", !!$('#homeContent [data-action="tab"][data-tab="together"][data-sub="calendar"]'));
  click($('#homeContent [data-action="tab"][data-tab="together"][data-sub="calendar"]'));
  await sleep(80);
  check("바로가기 동작", active() === "together" && $("#togetherContent").getAttribute("data-sub") === "calendar");
  const savedFinal = JSON.parse(window.localStorage.getItem("family-dashboard.state.v1")).payload;
  check("저장 상태에 calendar·checklists 포함", !!savedFinal.calendar && !!savedFinal.checklists);
  check("기존 필드 유지", Array.isArray(savedFinal.chat) && !!savedFinal.todos && !!savedFinal.study);

  console.log("\n================================");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL BOOT/INTERACTION CHECKS PASSED ✅");
  process.exit(0);
})().catch((e) => { console.error("TEST CRASH:", e); process.exit(2); });
