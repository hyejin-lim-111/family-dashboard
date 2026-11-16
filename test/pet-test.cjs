/* 🐣 내 캐릭터 키우기 — 용돈·할 일 연동 레벨업, 돌보기(밥·놀기·쓰다듬기), 올클리어 간식, 단계별 성장
   - 예전 '도감' 탭 자리를 캐릭터 키우기로 바꾸면서, 기존 기록(도장·채팅·루틴·성장)은 그대로 살아나야 한다. */
const { JSDOM } = require("/workspace/.cache/famdash-test/node_modules/jsdom");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname + "/..";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.log("  ✗ FAIL: " + name + (extra !== undefined ? " — " + extra : "")); }
}

function kstKey(offsetDays) {
  const kst = new Date(Date.now() + 9 * 3600 * 1000 + (offsetDays || 0) * 86400000);
  return kst.getUTCFullYear() + "-" + String(kst.getUTCMonth() + 1).padStart(2, "0") + "-" + String(kst.getUTCDate()).padStart(2, "0");
}
const TODAY = kstKey(0);
const YESTERDAY = kstKey(-1);

const ROUTINE_IDS = ["r-bath", "r-homework", "r-meal", "r-brush"];
const ROUTINE_NAMES = ["목욕하기", "숙제하기", "밥먹기", "양치하기"];
const STAGE_IMAGES = ["pet_stage1", "pet_stage2", "pet_stage3", "pet_stage4", "pet_stage5", "pet_stage6"];

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

  if (payload) window.localStorage.setItem("family-dashboard.state.v1", JSON.stringify({ payload, updatedAt: payload.updatedAt }));
  window.localStorage.setItem("family-dashboard.device.v1", "dain");

  const load = (f) => window.eval(fs.readFileSync(path.join(ROOT, f), "utf8"));
  load("config.js");
  window.FAMILY_CONFIG.supabase = { url: "", anonKey: "", table: "family_state", rowId: "main", realtime: false };
  load("store.js");
  load("app.js");

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const click = (e) => e.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const saved = () => {
    const raw = window.localStorage.getItem("family-dashboard.state.v1");
    return raw ? JSON.parse(raw).payload : null;
  };
  const view = () => $(".view.is-active") && $(".view.is-active").getAttribute("data-view");
  const gauge = (k) => Number($("#petGauge-" + k + " .pg-num").textContent);
  // 모달이 떠 있으면 닫는다 (요정 해금·레벨업 안내)
  const closeModal = () => { const b = $('[data-action="close-modal"]'); if (b) click(b); };
  return { window, document, $, $$, click, saved, errors, view, gauge, closeModal };
}

function payload(extra) {
  const p = {
    version: 1,
    updatedAt: new Date().toISOString(),
    study: {
      items: [
        { id: "s-read", name: "책 읽기", minutes: 15, kind: "countdown", done: false },
        { id: "s-hangul", name: "한글 · 숫자 놀이", minutes: 10, kind: "countdown", done: false },
        { id: "s-draw", name: "그림 그리기", minutes: 20, kind: "countdown", done: false }
      ],
      dayKey: TODAY
    },
    stamps: {},
    badges: {},
    dex: { unlocked: {}, seen: {} },
    mission: { todayKey: TODAY, index: 0, doneToday: false, doneTotal: 0, history: [] },
    todos: { dain: [], mom: [], dad: [] },
    chat: [],
    calendar: { events: [] },
    checklists: { lists: [{ id: "l1", emoji: "🛒", title: "장보기", items: [] }] },
    routine: {
      items: ROUTINE_NAMES.map((name, i) => ({ id: ROUTINE_IDS[i], name })),
      days: {},
      spent: 0
    },
    settings: { weatherCache: null, notify: false }
  };
  Object.keys(extra || {}).forEach((k) => { p[k] = extra[k]; });
  return p;
}

function allChecked() {
  const o = {};
  ROUTINE_IDS.forEach((id) => { o[id] = true; });
  return o;
}

(async function main() {
  /* =========================================================
     1) 화면 골격 — 도감 자리에 키우기 탭
     ========================================================= */
  console.log("\n[1] 키우기 탭 화면");
  {
    const t = boot(payload());
    await sleep(650);
    check("부팅 오류 없음", t.errors.length === 0, t.errors.join(" / "));
    check("하단 탭 7개 · 세 번째가 키우기", t.$$(".tab-btn").map((b) => b.getAttribute("data-tab")).join(",") === "home,study,pet,mission,together,growth,chat",
      t.$$(".tab-btn").map((b) => b.getAttribute("data-tab")).join(","));
    check("탭 이름 = 키우기", t.$('.tab-btn[data-tab="pet"]').textContent.includes("키우기"));
    check("도감 탭은 없어짐", !t.$('.tab-btn[data-tab="dex"]') && !t.$("#view-dex"));

    t.click(t.$('.tab-btn[data-tab="pet"]'));
    await sleep(120);
    check("키우기 탭 열림", t.view() === "pet", t.view());
    check("내 캐릭터 그림", !!t.$("#petHero") && t.$("#petImg").getAttribute("src").includes(STAGE_IMAGES[0]));
    check("처음 이름은 몽실이", t.$("#petName").textContent === "몽실이", t.$("#petName").textContent);
    check("Lv.1 알에서 시작", t.$(".pet-stage-line").textContent.includes("Lv.1 알"), t.$(".pet-stage-line").textContent);
    check("경험치 0 / 50", t.$("#petXpLabel").textContent === "0 / 50", t.$("#petXpLabel").textContent);
    check("경험치 바", !!t.$("#petXpBar") && t.$("#petXpBar").getAttribute("style").includes("width:0%"), t.$("#petXpBar").getAttribute("style"));
    check("돌보기 버튼 = 밥 주기·놀아주기·쓰다듬기",
      t.$$(".pet-care-btn").map((b) => b.getAttribute("data-care")).join(",") === "feed,play,pet",
      t.$$(".pet-care-btn").map((b) => b.getAttribute("data-care")).join(","));
    check("게이지 = 포만감·기분·친밀도", !!t.$("#petGauge-full") && !!t.$("#petGauge-mood") && !!t.$("#petGauge-bond"));
    check("처음 게이지 50 · 50 · 30", t.gauge("full") === 50 && t.gauge("mood") === 50 && t.gauge("bond") === 30,
      [t.gauge("full"), t.gauge("mood"), t.gauge("bond")].join("/"));
    check("오늘 할 일 = 경험치 4줄", t.$$(".pet-quest").length === 4);
    check("올클리어 간식 상자", !!t.$("#petBonusBox") && !t.$("#petBonusBox").classList.contains("is-on"));
    check("성장 단계 6칸", t.$$(".pet-stage").length === 6, String(t.$$(".pet-stage").length));
    check("지금은 Lv.1만 열림", t.$$(".pet-stage:not(.is-locked)").length === 1 && t.$$(".pet-stage.is-locked").length === 5,
      t.$$(".pet-stage:not(.is-locked)").length + " / " + t.$$(".pet-stage.is-locked").length);
    check("잠긴 단계는 이름을 가림", t.$$(".pet-stage.is-locked .ps-name").every((e) => e.textContent === "? ? ?"));
    check("도장판은 키우기 탭에 남음", t.$$(".stamp-day").length === 7 && !!t.$(".stamp-day.is-today"));
    check("새 레벨 배지는 처음엔 숨김", t.$("#petBadge").hidden === true);
  }

  /* =========================================================
     2) 용돈을 모으면 자라요 — 누적 적립 100원 = 경험치 1
     ========================================================= */
  console.log("\n[2] 용돈 연동 레벨업");
  {
    const days = {};
    for (let i = 1; i <= 4; i++) days[kstKey(-i)] = { checked: allChecked() };  // 지난 4일 = 3,600원
    const t = boot(payload({ routine: { items: ROUTINE_NAMES.map((name, i) => ({ id: ROUTINE_IDS[i], name })), days, spent: 0 } }));
    await sleep(650);
    t.click(t.$('.tab-btn[data-tab="pet"]'));
    await sleep(100);
    check("모은 용돈 3,600원 → 경험치 36", t.$("#petXpLabel").textContent === "36 / 50", t.$("#petXpLabel").textContent);
    check("돈 경험치 칩 +36", t.$$(".pet-chip")[0].textContent.includes("+36"), t.$$(".pet-chip")[0].textContent);
    check("할 일·돌보기 칩 +0", t.$$(".pet-chip")[1].textContent.includes("+0"), t.$$(".pet-chip")[1].textContent);

    // 오늘 저녁 루틴도 모두 완료 → +900원(45 XP) + 올클리어 8 XP = 53 → Lv.2
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(100);
    for (const id of ROUTINE_IDS) {
      t.click(t.$('.routine-item[data-routine="' + id + '"] .check-btn'));
      await sleep(360);
    }
    await sleep(400);
    t.click(t.$('.tab-btn[data-tab="pet"]'));
    await sleep(150);
    check("용돈 4,500원 = 45 XP + 올클리어 8 XP", t.$("#petXpLabel").textContent === "53 / 140", t.$("#petXpLabel").textContent);
    check("Lv.2 아기 요정으로 성장", t.$(".pet-stage-line").textContent.includes("Lv.2 아기 요정"), t.$(".pet-stage-line").textContent);
    check("그림도 2단계로 바뀜", t.$("#petImg").getAttribute("src").includes(STAGE_IMAGES[1]), t.$("#petImg").getAttribute("src"));
    check("레벨업 배지 표시", t.$("#petBadge").hidden === false);
    check("새 모습 리본", t.$("#petHero").classList.contains("is-newlook") && !!t.$(".pet-newlook-ribbon"));
    check("저장: seenLevel 2 · moneyXp 45", t.saved().pet.seenLevel === 2 && t.saved().pet.moneyXp === 45,
      JSON.stringify({ seenLevel: t.saved().pet.seenLevel, moneyXp: t.saved().pet.moneyXp }));
    check("저장: 이벤트 경험치 8 (루틴 올클리어)", t.saved().pet.xp === 8, String(t.saved().pet.xp));

    // 돈을 써도(차감) 경험치는 줄지 않는다
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(100);
    t.click(t.$('[data-action="allowance-spend"]'));
    await sleep(120);
    t.$("#spendAmount").value = "1000";
    t.click(t.$("#spendOkBtn"));
    await sleep(450);
    t.click(t.$('.tab-btn[data-tab="pet"]'));
    await sleep(120);
    check("용돈을 써도 경험치는 그대로 53", t.$("#petXpLabel").textContent === "53 / 140", t.$("#petXpLabel").textContent);
    check("쓴 뒤에도 Lv.2 유지", t.$(".pet-stage-line").textContent.includes("Lv.2"));
  }

  /* =========================================================
     3) 공부 · 할 일 · 미션 완료 = 경험치 (같은 일에 두 번 주지 않음)
     ========================================================= */
  console.log("\n[3] 할 일·공부·미션 경험치");
  {
    const t = boot(payload());
    await sleep(650);
    t.click(t.$('.tab-btn[data-tab="study"]'));
    await sleep(80);
    for (let i = 0; i < 3; i++) {
      const b = t.$('.study-item:not(.done) [data-action="toggle-study"]');
      if (!b) break;
      t.click(b);
      await sleep(500);
    }
    await sleep(700);
    check("공부 3개 = 4×3 + 올클리어 8 = 20 XP", t.saved().pet.xp === 20, String(t.saved().pet.xp));
    check("항목별 경험치도 기록됨", !!t.saved().pet.ledger["study:s-read"] && !!t.saved().pet.ledger["study:s-hangul"] && !!t.saved().pet.ledger["study:s-draw"]);
    check("공부 올클리어 +8 XP", !!t.saved().pet.ledger["study-all"]);

    // 체크를 풀었다 다시 해도 또 주지 않음
    t.click(t.$('[data-action="toggle-study"]'));
    await sleep(500);
    t.click(t.$('[data-action="toggle-study"]'));
    await sleep(700);
    check("껐다 켜도 경험치는 그대로 20", t.saved().pet.xp === 20, String(t.saved().pet.xp));

    // 다인 할 일 2개
    t.click(t.$('.tab-btn[data-tab="mission"]'));
    await sleep(100);
    for (const txt of ["가방 정리", "그림 그리기"]) {
      t.click(t.$('[data-who="dain"][data-action="add-todo"]'));
      await sleep(80);
      t.$("#todoText").value = txt;
      t.click(t.$("#todoSaveBtn"));
      await sleep(360);
    }
    for (let i = 0; i < 2; i++) {
      const b = t.$$('[data-action="toggle-todo"][data-who="dain"]').find((x) => !x.closest(".todo-item").classList.contains("done"));
      if (!b) break;
      t.click(b);
      await sleep(500);
    }
    t.closeModal();          // 요정 해금 모달이 떠 있으면 닫기
    await sleep(700);
    check("할 일 2개(3 XP씩) + 올클리어 8 = +14 (합 34)", t.saved().pet.xp === 34, String(t.saved().pet.xp));

    // 가족 미션 +10
    const mb = t.$('[data-action="mission-done"]');
    if (mb) { t.click(mb); await sleep(500); }
    t.closeModal();
    await sleep(700);
    check("가족 미션 +10 → 합 44", t.saved().pet.xp === 44, String(t.saved().pet.xp));
    check("미션 완료 표시", t.saved().mission.doneToday === true);

    t.click(t.$('.tab-btn[data-tab="pet"]'));
    await sleep(150);
    check("공부·할 일·미션 3개 완료 표시 (루틴은 아직)", t.$$(".pet-quest.is-done").length === 3, String(t.$$(".pet-quest.is-done").length));
    check("완료 개수 안내 3 / 4", t.$("#petQuestNote").textContent === "3 / 4 완료", t.$("#petQuestNote").textContent);
  }

  /* =========================================================
     4) 돌보기 — 밥 주기 · 놀아주기 · 쓰다듬기
     ========================================================= */
  console.log("\n[4] 돌보기 상호작용");
  {
    const t = boot(payload());
    await sleep(650);
    t.click(t.$('.tab-btn[data-tab="pet"]'));
    await sleep(100);

    t.click(t.$('.pet-care-btn[data-care="feed"]'));
    await sleep(420);
    check("밥 주기 → 포만감 +26 (76)", t.gauge("full") === 76, String(t.gauge("full")));
    check("밥 주기 → 기분 +6 · 친밀도 +4", t.gauge("mood") === 56 && t.gauge("bond") === 34, t.gauge("mood") + "/" + t.gauge("bond"));
    check("밥 주기 → 경험치 +2", t.$("#petXpLabel").textContent === "2 / 50", t.$("#petXpLabel").textContent);
    check("말풍선 반응", /냠냠|밥|고마워|배불러/.test(t.$("#petBubble").textContent), t.$("#petBubble").textContent);
    check("점프 애니메이션", t.$("#petImg").className.includes("is-jump"), t.$("#petImg").className);
    check("오늘 남은 횟수 2번", t.$('.pet-care-btn[data-care="feed"] .pc-left').textContent.includes("2번"),
      t.$('.pet-care-btn[data-care="feed"] .pc-left').textContent);

    t.click(t.$('.pet-care-btn[data-care="feed"]'));
    await sleep(160);
    t.click(t.$('.pet-care-btn[data-care="feed"]'));
    await sleep(420);
    check("3번 먹이면 포만감 100에서 멈춤", t.gauge("full") === 100, String(t.gauge("full")));
    check("3번째까지 경험치 +6", t.saved().pet.xp === 6, String(t.saved().pet.xp));

    t.click(t.$('.pet-care-btn[data-care="feed"]'));
    await sleep(300);
    check("4번째는 배불러서 그만", t.$("#petBubble").textContent.includes("배불러요"), t.$("#petBubble").textContent);
    check("4번째는 경험치 없음", t.saved().pet.xp === 6, String(t.saved().pet.xp));
    check("버튼에 '다음에 또!' 표시", t.$('.pet-care-btn[data-care="feed"]').classList.contains("is-full"));

    t.click(t.$('.pet-care-btn[data-care="play"]'));
    await sleep(420);
    check("놀아주기 → 기분 +26 (94)", t.gauge("mood") === 94, String(t.gauge("mood")));
    check("놀아주기 → 포만감 -6 (94)", t.gauge("full") === 94, String(t.gauge("full")));
    check("놀아주기 경험치 +2 (합 8)", t.saved().pet.xp === 8, String(t.saved().pet.xp));

    t.click(t.$('.pet-care-btn[data-care="pet"]'));
    await sleep(420);
    check("쓰다듬기 → 친밀도 +18 (66)", t.gauge("bond") === 66, String(t.gauge("bond")));
    check("쓰다듬기 반짝 애니메이션", t.$("#petImg").className.includes("is-sparkle"), t.$("#petImg").className);
    check("쓰다듬기 경험치 +1 (합 9)", t.saved().pet.xp === 9, String(t.saved().pet.xp));

    for (let i = 0; i < 5; i++) { t.click(t.$('.pet-care-btn[data-care="pet"]')); await sleep(90); }
    await sleep(400);
    check("게이지는 100을 넘지 않음", t.gauge("bond") <= 100 && t.gauge("mood") <= 100 && t.gauge("full") <= 100,
      t.gauge("full") + "/" + t.gauge("mood") + "/" + t.gauge("bond"));
    check("쓰다듬기 하루 5번까지만 경험치 (합 13)", t.saved().pet.xp === 13, String(t.saved().pet.xp));
    check("저장된 돌보기 횟수", t.saved().pet.care.fed === 3 && t.saved().pet.care.played === 1 && t.saved().pet.care.petted === 5,
      JSON.stringify(t.saved().pet.care));
    check("오늘 날짜로 저장", t.saved().pet.day === TODAY, t.saved().pet.day);
  }

  /* =========================================================
     5) 오늘 할 일 올클리어 → 특별 간식
     ========================================================= */
  console.log("\n[5] 올클리어 특별 간식");
  {
    const t = boot(payload());
    await sleep(650);
    t.click(t.$('.tab-btn[data-tab="pet"]'));
    await sleep(100);
    t.click(t.$('[data-action="pet-bonus"]'));
    await sleep(300);
    const pet0 = (t.saved() && t.saved().pet) || {};
    check("다 끝내기 전엔 간식을 주지 않음", !pet0.bonusDay && !pet0.xp, JSON.stringify({ bonusDay: pet0.bonusDay, xp: pet0.xp }));
    check("남은 할 일을 알려 줌", t.$("#petBonusSub").textContent.includes("남은 할 일"), t.$("#petBonusSub").textContent);
    check("말풍선도 격려", t.$("#petBubble").textContent.includes("힘내"), t.$("#petBubble").textContent);
  }
  {
    // 공부·할 일·루틴·미션 모두 끝난 상태
    const done = payload();
    done.study.items.forEach((it) => { it.done = true; });
    done.todos.dain = [{ id: "t1", text: "가방 정리", done: true }];
    done.mission.doneToday = true;
    done.routine.days[TODAY] = { checked: allChecked() };
    const t = boot(done);
    await sleep(650);
    t.click(t.$('.tab-btn[data-tab="pet"]'));
    await sleep(150);
    check("전부 끝내면 간식 상자가 켜짐", t.$("#petBonusBox").classList.contains("is-on"));
    check("안내 문구 = 전부 끝냈어요", t.$("#petBonusSub").textContent.includes("전부 끝냈어요"), t.$("#petBonusSub").textContent);
    check("간식 버튼 사용 가능", t.$("#petBonusBox .btn").disabled === false);
    check("4 / 4 완료", t.$("#petQuestNote").textContent === "4 / 4 완료", t.$("#petQuestNote").textContent);

    const before = t.saved().pet ? t.saved().pet.xp : 0;
    t.click(t.$('[data-action="pet-bonus"]'));
    await sleep(450);
    check("특별 간식 +15 XP", t.saved().pet.xp === before + 15, String(t.saved().pet.xp));
    check("오늘 간식 받음 표시", t.saved().pet.bonusDay === TODAY, t.saved().pet.bonusDay);
    check("포만감·기분이 올라감", t.gauge("full") === 95 && t.gauge("mood") === 95, t.gauge("full") + "/" + t.gauge("mood"));
    check("간식 뒤 버튼 잠김", t.$("#petBonusBox .btn").disabled === true);
    check("안내가 '받았어요'로 바뀜", t.$("#petBonusSub").textContent.includes("받았어요"), t.$("#petBonusSub").textContent);
    check("간식 말풍선", t.$("#petBubble").textContent.includes("케이크"), t.$("#petBubble").textContent);
    t.click(t.$('[data-action="pet-bonus"]'));
    await sleep(300);
    check("하루 한 번만 (두 번 누르면 경험치 그대로)", t.saved().pet.xp === before + 15, String(t.saved().pet.xp));
  }

  /* =========================================================
     6) 단계별 성장 — 모습과 크기가 점점 커짐
     ========================================================= */
  console.log("\n[6] 단계별 성장 (Lv.1~6)");
  {
    const heights = [];
    const levels = [0, 50, 140, 280, 460, 700];
    for (let i = 0; i < levels.length; i++) {
      const t = boot(payload({ pet: { name: "몽실이", xp: levels[i], seenLevel: 6, day: TODAY, care: { fed: 0, played: 0, petted: 0, full: 50, mood: 50, bond: 30 }, ledger: {}, bonusDay: "" } }));
      await sleep(600);
      t.click(t.$('.tab-btn[data-tab="pet"]'));
      await sleep(90);
      const line = t.$(".pet-stage-line").textContent;
      check("경험치 " + levels[i] + " → Lv." + (i + 1) + " " + ["알", "아기 요정", "꼬마 요정", "어린이 요정", "반짝 요정", "왕관 마스터"][i],
        line.includes("Lv." + (i + 1) + " " + ["알", "아기 요정", "꼬마 요정", "어린이 요정", "반짝 요정", "왕관 마스터"][i]), line);
      check("  그림 = " + STAGE_IMAGES[i], t.$("#petImg").getAttribute("src").includes(STAGE_IMAGES[i]), t.$("#petImg").getAttribute("src"));
      check("  열린 단계 " + (i + 1) + "칸", t.$$(".pet-stage:not(.is-locked)").length === i + 1, String(t.$$(".pet-stage:not(.is-locked)").length));
      heights.push(Number((t.$("#petImg").getAttribute("style").match(/height:\s*([\d.]+)%/) || [0, 0])[1]));
    }
    check("단계가 오를수록 그림이 점점 커짐", heights.every((h, i) => i === 0 || h > heights[i - 1]), heights.join(" → "));
    check("마지막 단계가 가장 큼 (98%)", heights[5] >= 95, String(heights[5]));
  }
  {
    const t = boot(payload({ pet: { name: "몽실이", xp: 700, seenLevel: 6, day: TODAY, care: { fed: 0, played: 0, petted: 0, full: 50, mood: 50, bond: 30 }, ledger: {}, bonusDay: "" } }));
    await sleep(600);
    t.click(t.$('.tab-btn[data-tab="pet"]'));
    await sleep(90);
    check("최고 레벨이면 경험치 라벨이 '최고 레벨'", t.$("#petXpLabel").textContent.includes("최고 레벨"), t.$("#petXpLabel").textContent);
    check("다음 레벨 안내도 '최고 레벨'", t.$("#petToNext").textContent.includes("최고 레벨"), t.$("#petToNext").textContent);
    check("지금 단계 강조", t.$$(".pet-stage.is-now").length === 1 && t.$$(".pet-stage.is-now")[0].getAttribute("data-lv") === "6");
    t.click(t.$$(".pet-stage")[2]);
    await sleep(150);
    check("단계 미리보기 모달", t.$("#modalBox").textContent.includes("Lv.3 꼬마 요정"), t.$("#modalBox").textContent.slice(0, 60));
    check("이미 지난 단계 안내", t.$("#modalBox").textContent.includes("자라온 모습"), t.$("#modalBox").textContent.slice(0, 90));
  }

  /* =========================================================
     7) 홈 화면 연동 — 4단 배치를 그대로 두고 미니 카드만
     ========================================================= */
  console.log("\n[7] 홈 연동");
  {
    const t = boot(payload({ pet: { name: "몽실이", xp: 300, seenLevel: 4, day: TODAY, care: { fed: 0, played: 0, petted: 0, full: 50, mood: 50, bond: 30 }, ledger: {}, bonusDay: "" } }));
    await sleep(650);
    check("홈에 내 캐릭터 미니 카드", !!t.$("#homeContent .home-pet"));
    check("미니 카드에 레벨·단계", t.$("#homeContent .home-pet").textContent.includes("Lv.4") && t.$("#homeContent .home-pet").textContent.includes("어린이 요정"),
      t.$("#homeContent .home-pet").textContent);
    check("미니 카드 그림 = 4단계", t.$("#homeContent .home-pet img").getAttribute("src").includes(STAGE_IMAGES[3]));
    check("오늘 현황의 캐릭터 보기 버튼", !!t.$('#homeContent [data-action="tab"][data-tab="pet"]'));

    // 홈 4단 배치 순서는 그대로
    const cells = Array.from(t.$("#homeContent .home-grid").children).map((c) => c.className);
    check("홈 1번째 줄 = 시간·용돈·타이머", cells[0].includes("home-top"), cells[0]);
    check("홈 2번째 줄 = 달력·날씨", cells[1].includes("home-cell-cal") && cells[2].includes("home-cell-weather"), cells.slice(1, 3).join(" | "));
    check("홈 3번째 줄 = 할 일·체크리스트", cells[3].includes("home-cell-todo") && cells[4].includes("home-cell-check"), cells.slice(3, 5).join(" | "));
    check("홈 마지막 줄 = 오늘 현황·인사", cells[5].includes("home-cell-today") && cells[6].includes("home-cell-greet") && cells.length === 7, cells.join(" | "));

    t.click(t.$("#homeContent .home-pet"));
    await sleep(150);
    check("미니 카드를 누르면 키우기 탭", t.view() === "pet", t.view());
  }

  /* =========================================================
     8) 하위 호환 · 저장 · 이름 짓기
     ========================================================= */
  console.log("\n[8] 하위 호환 · 저장");
  {
    const old = payload();   // pet 필드가 아예 없는 예전 기록
    const t = boot(old);
    await sleep(650);
    check("예전 기록도 오류 없이 부팅", t.errors.length === 0, t.errors.join(" / "));
    t.click(t.$('.tab-btn[data-tab="pet"]'));
    await sleep(100);
    check("캐릭터가 기본값으로 생김", t.$("#petName").textContent === "몽실이" && t.$(".pet-stage-line").textContent.includes("Lv.1"));
    t.click(t.$('.pet-care-btn[data-care="feed"]'));
    await sleep(430);
    check("예전 기록에 pet 이 저장됨", !!t.saved().pet && t.saved().pet.xp === 2, JSON.stringify(t.saved().pet));
    check("기존 기록은 그대로 (공부·루틴)", t.saved().study.items.length === 3 && t.saved().routine.items.length === 4);
  }
  {
    const t = boot(payload({ pet: { name: "콩이", xp: 160, moneyXp: 0, seenLevel: 3, day: TODAY, care: { fed: 1, played: 0, petted: 0, full: 60, mood: 55, bond: 40 }, ledger: {}, bonusDay: "" } }));
    await sleep(650);
    t.click(t.$('.tab-btn[data-tab="pet"]'));
    await sleep(100);
    check("저장된 이름·경험치로 시작", t.$("#petName").textContent === "콩이" && t.$(".pet-stage-line").textContent.includes("Lv.3"), t.$("#petName").textContent + " / " + t.$(".pet-stage-line").textContent);
    check("저장된 게이지 복원", t.gauge("full") === 60 && t.gauge("mood") === 55 && t.gauge("bond") === 40,
      t.gauge("full") + "/" + t.gauge("mood") + "/" + t.gauge("bond"));

    t.click(t.$('[data-action="pet-rename"]'));
    await sleep(120);
    check("이름 짓기 모달", !!t.$("#petNameInput") && t.$("#petNameInput").value === "콩이");
    t.$("#petNameInput").value = "뽀미";
    t.click(t.$("#petNameSave"));
    await sleep(450);
    check("이름 바꾸기 반영", t.$(".pet-name b").textContent === "뽀미" && t.saved().pet.name === "뽀미", t.$(".pet-name b").textContent);
    check("돌보기 제목도 새 이름", t.$("#petCareCard").textContent.includes("뽀미 돌보기"), t.$("#petCareCard").textContent.slice(0, 30));
  }

  /* =========================================================
     9) 날짜가 바뀌면 돌보기 횟수는 새로, 친밀도는 그대로
     ========================================================= */
  console.log("\n[9] 날짜 바뀜");
  {
    const t = boot(payload({ pet: { name: "몽실이", xp: 40, seenLevel: 2, day: YESTERDAY, care: { fed: 3, played: 2, petted: 4, full: 90, mood: 80, bond: 70 }, ledger: { "study:s-read": true }, bonusDay: YESTERDAY } }));
    await sleep(650);
    t.click(t.$('.tab-btn[data-tab="pet"]'));
    await sleep(100);
    check("오늘 돌보기 횟수는 0부터", t.$('.pet-care-btn[data-care="feed"] .pc-left').textContent.includes("3번"), t.$('.pet-care-btn[data-care="feed"] .pc-left').textContent);
    check("하루 지나 배고픔·심심함이 조금 쌓임 (90→55, 80→60)", t.gauge("full") === 55 && t.gauge("mood") === 60, t.gauge("full") + "/" + t.gauge("mood"));
    check("친밀도는 그대로", t.gauge("bond") === 70, String(t.gauge("bond")));
    check("어제 받은 간식은 오늘 다시 받을 수 있음", t.$("#petBonusBox .btn").disabled === false);
    t.click(t.$('.pet-care-btn[data-care="feed"]'));
    await sleep(430);
    check("오늘 1번 먹임으로 저장", t.saved().pet.care.fed === 1 && t.saved().pet.day === TODAY, JSON.stringify(t.saved().pet.care) + " / " + t.saved().pet.day);
  }

  console.log("\n================================");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL PET (캐릭터 키우기) CHECKS PASSED ✅");
  process.exit(0);
})().catch((e) => { console.error("TEST CRASH:", e); process.exit(2); });
