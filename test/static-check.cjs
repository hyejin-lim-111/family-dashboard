/* 정적 점검 — 문법·태그·CSS·data-action 연결·로컬 자산 경로 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = __dirname + "/..";
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.log("  ✗ FAIL: " + name + (extra ? " — " + extra : "")); }
}

const html = read("index.html");
const css = read("styles.css");
const app = read("app.js");

console.log("\n[1] JS 문법");
["app.js", "store.js", "config.js", "growth-data.js"].forEach((f) => {
  try {
    execFileSync(process.execPath, ["--check", path.join(ROOT, f)]);
    check(f + " 문법", true);
  } catch (e) {
    check(f + " 문법", false, String(e.message).slice(0, 200));
  }
});

console.log("\n[2] HTML 태그 균형");
const VOID = new Set(["meta", "link", "img", "br", "hr", "input", "source", "area", "base", "col", "embed", "param", "track", "wbr"]);
{
  const stack = [];
  let ok = true, msg = "";
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
  let m;
  while ((m = re.exec(html))) {
    const closing = m[1] === "/";
    const tag = m[2].toLowerCase();
    const selfClose = /\/\s*$/.test(m[3]);
    if (VOID.has(tag) || selfClose) continue;
    if (!closing) stack.push(tag);
    else {
      const top = stack.pop();
      if (top !== tag) { ok = false; msg = "닫는 태그 불일치: <" + tag + "> vs <" + top + ">"; break; }
    }
  }
  if (stack.length) { ok = false; msg = msg || "닫히지 않은 태그: " + stack.join(","); }
  check("index.html 태그 균형", ok, msg);
}

console.log("\n[3] CSS 중괄호");
{
  let depth = 0, minDepth = 0;
  for (const ch of css) {
    if (ch === "{") depth++;
    else if (ch === "}") { depth--; if (depth < minDepth) minDepth = depth; }
  }
  check("중괄호 짝", depth === 0 && minDepth === 0, "depth=" + depth);
}

console.log("\n[4] data-action 연결");
{
  const used = new Set();
  const addAll = (text) => {
    let m;
    const re1 = /data-action="([a-z0-9-]+)"/g;
    while ((m = re1.exec(text))) used.add(m[1]);
    const re2 = /setAttribute\(\s*"data-action"\s*,\s*"([a-z0-9-]+)"\s*\)/g;
    while ((m = re2.exec(text))) used.add(m[1]);
  };
  addAll(html);
  addAll(app);
  const handled = new Set();
  let m;
  const re3 = /case\s+"([a-z0-9-]+)"\s*:/g;
  while ((m = re3.exec(app))) handled.add(m[1]);

  const missing = [...used].filter((a) => !handled.has(a));
  check("모든 data-action에 처리기 있음", missing.length === 0, missing.join(", "));
  const orphan = [...handled].filter((a) => !used.has(a));
  check("처리기만 있고 쓰이지 않는 동작 없음", orphan.length === 0, orphan.join(", "));
  console.log("    (동작 " + used.size + "종 / 처리기 " + handled.size + "종)");
}

console.log("\n[5] 로컬 자산 경로");
{
  const files = new Set();
  const addAll = (text) => {
    let m;
    const re = /(?:src|href)="(assets\/[^"]+)"/g;
    while ((m = re.exec(text))) files.add(m[1]);
    // 캐시 무효화 쿼리(?v=...)가 붙은 경로도 파일 존재를 확인한다
    const re2 = /["'](assets\/[a-z_]+\.png)(?:\?[^"']*)?["']/g;
    while ((m = re2.exec(text))) files.add(m[1]);
  };
  addAll(html);
  addAll(app);
  const missing = [...files].filter((f) => !fs.existsSync(path.join(ROOT, f)));
  check("모든 자산 파일 존재", missing.length === 0, missing.join(", "));
  console.log("    (자산 " + files.size + "종 확인)");
}

console.log("\n[6] 화면 골격");
{
  check("탭 7개", (html.match(/class="tab-btn/g) || []).length === 7, String((html.match(/class="tab-btn/g) || []).length));
  check("뷰 7개", (html.match(/data-view="/g) || []).length === 7, String((html.match(/data-view="/g) || []).length));
  check("함께 뷰 존재", /data-view="together"/.test(html));
  check("성장 뷰 존재", /data-view="growth"/.test(html));
  check("config.js 키 보존", /sb_publishable_OJHJjHENxITeZVor5C9PiA_-9QMxUaC/.test(read("config.js")));
}

console.log("\n[7] 홈 상단 1줄 3열 · 확대 타이머");
{
  // 태블릿(720px~)에서 맨 윗줄이 3열 한 줄
  const wide = css.slice(css.indexOf("@media (min-width: 720px)"));
  const topRule = (wide.match(/\.home-top\s*\{[^}]*\}/) || [""])[0];
  check(".home-top 3열 그리드", /grid-template-columns:\s*(repeat\(3|minmax\([^;]*minmax\([^;]*minmax\()/.test(topRule), topRule.replace(/\s+/g, " "));
  check("좁은 폰에서 세로로 접힘", /\.home-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(css));
  check("컴팩트 타이머 카드 스타일", /\.tbl-card\s*\{/.test(css) && /\.tbl-card-face\s*\{/.test(css));
  check("확대 타이머 스타일", /\.te-face\s*\{/.test(css) && /\.te-presets\s*\.tbl-preset\s*\{/.test(css));
  check("접힌 옛 히어로 스타일 정리", !/\.dl-hero\s*\{/.test(css) && !/\.tbl-timer\s*\{/.test(css));

  check("홈 맨 윗줄에 시간·용돈·타이머 묶음", /function buildHomeTopRow\(\)/.test(app) &&
    /buildClockCard\(\)\s*\+\s*buildAllowanceCard\(\)\s*\+\s*buildTimerCard\(\)/.test(app.replace(/row\.innerHTML\s*=\s*/, "")));
  check("컴팩트 카드가 열기 동작을 가짐", /id="tabletTimerCard"/.test(app) && /data-action="open-timer"/.test(app));
  check("확대 타이머 열기/큰 숫자", /function openTimerExpand\(\)/.test(app) && /id="expTimerFace"/.test(app));
  check("알람이 확대 타이머를 대신함", /function onTabletFinish\(\)[\s\S]{0,400}closeModal\(\)/.test(app));
}

console.log("\n[8] 홈 4단 배치 (태블릿 2열 · 미니 달력)");
{
  const wide = css.slice(css.indexOf("@media (min-width: 720px)"));
  const gridRule = (wide.match(/\.home-grid\s*\{[^}]*\}/) || [""])[0];
  check("넓은 화면 2열 그리드", /grid-template-columns:\s*1[^;]*fr\s+[^;]*fr/.test(gridRule), gridRule.replace(/\s+/g, " "));
  check("한 줄 안 카드 높이 맞춤", /\.home-grid > \.home-cell\s*\{[^}]*display:\s*grid/.test(wide));
  check("좌우 카드가 같은 높이", /\.home-grid\s*\{[^}]*align-items:\s*stretch/.test(wide));
  check("날씨 카드는 내용 높이만큼", /\.home-grid > \.home-cell-weather\s*\{[^}]*align-self:\s*start/.test(wide));
  check("미니 달력 7열", /\.hcal-grid\s*\{[^}]*repeat\(7/.test(css));
  check("미니 달력 오늘 강조", /\.hcal-cell\.is-today\s*\{/.test(css));
  check("미니 달력 일정 점", /\.hcal-dot\s*\{/.test(css) && /\.hcal-dot\.who-dain\s*\{/.test(css) && /\.hcal-dot\.who-all\s*\{/.test(css));
  check("미니 달력이 좁은 버튼 줄을 만들지 않음", /\.hcal-cell\s*\{[^}]*min-height/.test(css));

  // 홈 그리드에 들어가는 순서: 1) 상단 3열 2) 달력 3) 날씨 4) 오늘 할 일 5) 체크리스트 6) 오늘 현황 7) 인사
  const homeFn = app.slice(app.indexOf("function renderHome()"), app.indexOf("function renderStudy()"));
  const order = [
    "buildHomeTopRow()",
    "homeCalendarCardHtml()",
    'id="weatherCard"',
    "오늘 할 일</div>",
    "checklistSummaryHtml()",
    "📌</span>오늘 현황",
    "힘차게",
  ];
  const at = order.map((s) => homeFn.indexOf(s));
  check("4단 순서대로 그려짐", at.every((v, i) => v >= 0 && (i === 0 || v > at[i - 1])), at.join(","));
  check("미니 달력 카드는 2번째 줄 왼쪽", /home-cell-cal"\)/.test(homeFn) && /el\("div", "home-cell home-cell-cal"\)/.test(homeFn));
  check("오늘 할 일·체크리스트가 3번째 줄", /home-cell-todo/.test(homeFn) && /home-cell-check/.test(homeFn));
  check("인사 카드가 맨 아래", /grid\.appendChild\(greet\)/.test(homeFn) && !/insertBefore\(greet/.test(homeFn));
}

console.log("\n[9] 2026-11-16 추가 (말판 · 사진 · 성장도표 · 태어난 지 · 알림)");
{
  const growth = read("growth-data.js");
  check("성장도표 LMS 파일이 2017 도표 기준", /2017 소아청소년 성장도표/.test(growth) && /fromMonth: 12/.test(growth) && /toMonth: 84/.test(growth));
  check("성장도표 여아 12~84개월 모두 있음", (growth.match(/^    "\d+": \[/gm) || []).length === (84 - 12 + 1) * 2, String((growth.match(/^    "\d+": \[/gm) || []).length));
  check("올바른 50백분위(60개월 108.3714 / 18.3616)", /"60": \[-0.1404, 108\.3714, 0\.039\]/.test(growth) && /"60": \[-0.876, 18\.3616, 0\.122\]/.test(growth));
  check("성장 뷰 스타일", /\.growth-hero\s*\{/.test(css) && /\.gc-svg\s*\{/.test(css) && /\.gt-table\s*\{/.test(css));
  check("7탭 반응형(360px) 규칙", /\.tabbar\s*\{[^}]*gap: 1px/.test(css) && /@media \(max-width: 380px\)[\s\S]*\.tab-btn \.tab-badge/.test(css));
  check("말판·사진·배너 스타일", /\.quick-grid\s*\{/.test(css) && /\.msg-photo\s*\{/.test(css) && /\.chat-banner\s*\{/.test(css) && /\.born-banner\s*\{/.test(css));
  check("말판 14종 데이터", (app.match(/label: "/g) || []).length >= 14);
  check("사진 압축(720px · JPEG)", /PHOTO_MAX_SIDE = 720/.test(app) && /toDataURL\("image\/jpeg"/.test(app));
  check("알림 배지·배너·알림음 연결", /setUnread\(/.test(app) && /showChatBanner\(/.test(app) && /playNotiSound\(/.test(app) && /Notification\.requestPermission/.test(app));
  check("홈 태어난 지 배너", /bornDays\(/.test(app) && /homeBornBannerHtml/.test(app));
}

console.log("\n[10] 🐣 내 캐릭터 키우기 (도감 탭 교체)");
{
  check("도감 탭이 키우기 탭으로 바뀜", !/data-tab="dex"/.test(html) && /data-tab="pet"/.test(html) && /id="view-pet"/.test(html));
  check("탭 이름·아이콘", /data-tab="pet"[\s\S]{0,120}🐣<\/span><span>키우기/.test(html));
  check("레벨 배지 자리", /id="petBadge"/.test(html));
  check("단계별 그림 6장 파일 존재", [1, 2, 3, 4, 5, 6].every((n) => fs.existsSync(path.join(ROOT, "assets/pet_stage" + n + ".png"))));
  check("성장 단계 정의 6단계", /var PET_STAGES = \[/.test(app) && (app.match(/pet_stage\d\.png/g) || []).length === 6);
  check("용돈 연동 경험치(100원당 1)", /PET_MONEY_PER_XP = 100/.test(app) && /function petMoneyXp\(\)/.test(app));
  check("레벨업 판정", /function petInfo\(\)/.test(app) && /function petCheckLevel\(\)/.test(app));
  check("돌보기 3종(밥·놀기·쓰다듬기)", /var PET_CARE = \{/.test(app) && /label: "밥 주기"/.test(app) && /label: "놀아주기"/.test(app) && /label: "쓰다듬기"/.test(app));
  check("게이지 3종(포만감·기분·친밀도)", /포만감/.test(app) && /친밀도/.test(app) && /function renderPet\(\)/.test(app));
  check("올클리어 간식", /function petClaimBonus\(\)/.test(app) && /올클리어/.test(app));
  check("state.pet 저장·정규화", /pet: normalizePet\(null\)/.test(app) && /out\.pet = normalizePet\(out\.pet\)/.test(app) && /"pet", "settings"/.test(app));
  check("홈 미니 카드", /class="home-pet"/.test(app) && /class="hg-avatar"/.test(app));
  check("키우기 탭 스타일", /\.pet-hero-card\s*\{/.test(css) && /\.pet-care-btn\s*\{/.test(css) && /\.pet-quest\s*\{/.test(css) && /\.pet-stage\s*\{/.test(css) && /\.home-pet\s*\{/.test(css));
  check("단계별 반응 애니메이션", /@keyframes petJump/.test(css) && /@keyframes petSparkle/.test(css));
  check("태블릿 2열 배치", /#petContent\s*\{[^}]*grid-template-columns/.test(css) && /#petHero \{ grid-column: 1; grid-row: 1/.test(css) && /#petStageCard \{ grid-column: 1 \/ -1/.test(css));
}

console.log("\n================================");
if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
console.log("ALL STATIC CHECKS PASSED ✅");
