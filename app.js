/* =========================================================
   우리 가족 기록장 — app.js
   홈(날씨) · 공부 플랜+타이머 · 도장판+요정 도감 · 가족 미션 · 할 일 · 가족 채팅
   ========================================================= */

(function () {
  "use strict";

  var CFG = window.FAMILY_CONFIG;
  var Store = window.FamilyStore;

  /* ---------- 상수 ---------- */
  var DAY_MS = 24 * 60 * 60 * 1000;
  var KST_OFFSET_MS = 9 * 60 * 60 * 1000;

  var WEATHER_CODES = {
    0:  { label: "맑음",            icon: "☀️" },
    1:  { label: "대체로 맑음",     icon: "🌤️" },
    2:  { label: "구름 조금",       icon: "⛅" },
    3:  { label: "흐림",            icon: "☁️" },
    45: { label: "안개",            icon: "🌫️" },
    48: { label: "착빙 안개",       icon: "🌫️" },
    51: { label: "보슬비",          icon: "🌦️" },
    53: { label: "보슬비",          icon: "🌦️" },
    55: { label: "쨍한 보슬비",     icon: "🌧️" },
    56: { label: "얼어붙는 비",     icon: "🌧️" },
    57: { label: "얼어붙는 비",     icon: "🌧️" },
    61: { label: "비",              icon: "🌧️" },
    63: { label: "비",              icon: "🌧️" },
    65: { label: "많은 비",         icon: "⛈️" },
    66: { label: "얼어붙는 비",     icon: "🌧️" },
    67: { label: "얼어붙는 비",     icon: "🌧️" },
    71: { label: "눈",              icon: "🌨️" },
    73: { label: "눈",              icon: "🌨️" },
    75: { label: "많은 눈",         icon: "❄️" },
    77: { label: "싸락눈",          icon: "🌨️" },
    80: { label: "소나기",          icon: "🌦️" },
    81: { label: "소나기",          icon: "🌦️" },
    82: { label: "큰 소나기",       icon: "⛈️" },
    85: { label: "소낙눈",          icon: "🌨️" },
    86: { label: "소낙눈",          icon: "🌨️" },
    95: { label: "천둥번개",        icon: "⛈️" },
    96: { label: "천둥번개",        icon: "⛈️" },
    99: { label: "천둥번개",        icon: "⛈️" }
  };

  var AQI_LEVELS = {
    1: { key: "good",  label: "좋음" },
    2: { key: "normal", label: "보통" },
    3: { key: "warn",  label: "나쁨" },
    4: { key: "bad",   label: "매우 나쁨" },
    5: { key: "worst", label: "최악" }
  };

  var DEFAULT_STUDY_ITEMS = [
    { id: "s-read",  name: "책 읽기",       minutes: 15, kind: "countdown", done: false },
    { id: "s-hangul", name: "한글 · 숫자 놀이", minutes: 10, kind: "countdown", done: false },
    { id: "s-draw",  name: "그림 그리기",    minutes: 20, kind: "countdown", done: false }
  ];

  var MISSION_POOL = [
    { emoji: "🍽️", text: "저녁 준비 같이 돕기",       sub: "알 씨개 주기나 채소 씻기도 최고예요!" },
    { emoji: "🤗", text: "가족 다 같이 안아주기",      sub: "꽉 안아 주면 하루가 달콤해져요." },
    { emoji: "💬", text: "오늘 고마웠던 일 말하기",    sub: "한 사람씩 돌아가며 말해요." },
    { emoji: "🧹", text: "방바닦 함께 쓸기",          sub: "노래하면서 쓸면 금방 끝나요!" },
    { emoji: "📖", text: "다인이가 책 읽어 주기",     sub: "엄마 아빠는 듣는 사람이 되어요." },
    { emoji: "🧺", text: "빨래 개기 도와드리기",      sub: "양말 짝 맞추기는 다인이 특기!" },
    { emoji: "🦷", text: "이 닦고 예쁜 미소 인증",    sub: "다들 깜빡이 흔들면서 인증!" },
    { emoji: "🚿", text: "스스로 씻기 도전",         sub: "다 끝나면 기운 칭찬해 주기." },
    { emoji: "🌡️", text: "아침 저녁 물 마시기",      sub: "가족마다 한 잔씩, 건강해요." },
    { emoji: "🥕", text: "편식 없이 한 접시 비우기",   sub: "채소 한 조각도 훌륭해요." },
    { emoji: "🧸", text: "장난감 정리 미션",         sub: "5분 안에 상자에 쏙쏙!" },
    { emoji: "🎨", text: "가족 그림 함께 그리기",     sub: "너른 종이에 우리 얼굴을 그려요." },
    { emoji: "🎶", text: "좋아하는 노래 같이 부르기",  sub: "마이크는 빗자루 대신 쓰면 돼요." },
    { emoji: "🚶", text: "가까운 공원 함께 산책",     sub: "나뭇잎 3개 주워 오기도 해요." },
    { emoji: "💌", text: "가족에게 짧은 편지 쓰기",   sub: "그림 편지도 좋아요." },
    { emoji: "🛏️", text: "내일 입을 옷 미리 꺼내기",  sub: "아침이 한결 편해져요." },
    { emoji: "😊", text: "오늘 하루 칭찬 3번 하기",   sub: "스스로에게도 칭찬 한 번!" },
    { emoji: "🪴", text: "식물에 물 주기",           sub: "우리 집 초록이들도 목말라요." }
  ];

  var FAIRIES = [
    {
      id: "f_star",
      name: "별별 요정",
      eng: "Star",
      img: "assets/fairy_star.png",
      desc: "반짝이는 별가루를 뿌리는 첫 친구예요. 다인이가 처음 도장을 받으면 나타나요.",
      personality: "씩씩하고 밝음",
      need: 1,
      how: "도장 1개"
    },
    {
      id: "f_flower",
      name: "꽃송이 요정",
      eng: "Flower",
      img: "assets/fairy_flower.png",
      desc: "데이지 화관을 쓴 소심한 친구. 열심히 노력하는 마음을 알아봐요.",
      personality: "수줍음 · 다정함",
      need: 3,
      how: "도장 3개"
    },
    {
      id: "f_berry",
      name: "딸기맛 요정",
      eng: "Berry",
      img: "assets/fairy_berry.png",
      desc: "새콤달콤한 딸기 냄새가 나요. 완성을 좋아하는 친구예요.",
      personality: "호기심 많음",
      need: 6,
      how: "도장 6개"
    },
    {
      id: "f_cloud",
      name: "구름솜 요정",
      eng: "Cloud",
      img: "assets/fairy_cloud.png",
      desc: "폭신한 구름을 키우는 친구. 포근한 마음으로 하루를 마무리하게 도와줘요.",
      personality: "느긋함 · 포근함",
      need: 10,
      how: "도장 10개"
    },
    {
      id: "f_moon",
      name: "자장가 요정",
      eng: "Moon",
      img: "assets/fairy_moon.png",
      desc: "달베개를 안고 잠자리를 지켜 주는 친구. 밤에 쌓인 기록도 소중하다고 말해요.",
      personality: "차분함 · 사랑스러움",
      need: 15,
      how: "도장 15개"
    },
    {
      id: "f_forest",
      name: "도토리 요정",
      eng: "Forest",
      img: "assets/fairy_forest.png",
      desc: "도토리 모자를 쓴 호기심 왕. 매일 조금씩 쌓는 습관을 응원해요.",
      personality: "호기심 · 성실함",
      need: 21,
      how: "도장 21개"
    },
    {
      id: "f_ocean",
      name: "물방울 요정",
      eng: "Ocean",
      img: "assets/fairy_ocean.png",
      desc: "반짝이는 물방울을 타고 다니는 친구. 마음이 넓고 깊어요.",
      personality: "차분함 · 넓은 마음",
      need: 28,
      how: "도장 28개"
    },
    {
      id: "f_rainbow",
      name: "무지개 요정",
      eng: "Rainbow",
      img: "assets/fairy_rainbow.png",
      desc: "도장판을 가득 채운 우리 가족에게 축하를 전하려 온 손님이에요.",
      personality: "명랑 · 축하 담당",
      need: 36,
      how: "도장 36개 (만렙!)"
    }
  ];

  var STICKERS = [
    { id: "st_daini",  label: "다인이",   img: "assets/avatar_daini.png" },
    { id: "st_mom",    label: "엄마",     img: "assets/avatar_mom.png" },
    { id: "st_dad",    label: "아빠",     img: "assets/avatar_dad.png" },
    { id: "st_star",   label: "별별",     img: "assets/fairy_star.png" },
    { id: "st_flower", label: "꽃송이",   img: "assets/fairy_flower.png" },
    { id: "st_cloud",  label: "구름솜",   img: "assets/fairy_cloud.png" },
    { id: "st_berry",  label: "딸기맛",   img: "assets/fairy_berry.png" },
    { id: "st_rainbow", label: "무지개",  img: "assets/fairy_rainbow.png" }
  ];

  var DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
  var DEFAULT_NAMES = { dain: "다인이", mom: "엄마", dad: "아빠" };

  /* ---------- 작은 도구 ---------- */
  function qs(sel, root) { return (root || document).querySelector(sel); }
  function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function uid(prefix) {
    return (prefix || "id") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function todayKey(d) {
    // KST(UTC+9) 기준 날짜를 호스트 시간대와 무관하게 계산
    var t = d ? new Date(d) : new Date();
    var kst = new Date(t.getTime() + KST_OFFSET_MS);
    return kst.getUTCFullYear() + "-" + pad2(kst.getUTCMonth() + 1) + "-" + pad2(kst.getUTCDate());
  }

  function dowOfKey(key) {
    try {
      return new Date(key + "T12:00:00+09:00").getUTCDay(); // 0=일
    } catch (e) {
      return new Date().getDay();
    }
  }

  function pad2(n) { return (n < 10 ? "0" : "") + n; }

  function mmss(totalSec) {
    var s = Math.max(0, Math.floor(totalSec));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ":" + pad2(r);
  }

  function fmtTime(iso) {
    try {
      var d = new Date(iso);
      var h = d.getHours();
      var ampm = h < 12 ? "오전" : "오후";
      var hh = h % 12; if (hh === 0) hh = 12;
      return ampm + " " + hh + ":" + pad2(d.getMinutes());
    } catch (e) { return ""; }
  }

  function fmtDateKo(key) {
    try {
      var parts = String(key).split("-");
      return Number(parts[0]) + "년 " + Number(parts[1]) + "월 " + Number(parts[2]) + "일";
    } catch (e) { return key; }
  }

  function toast(msg, ico) {
    var t = qs("#toast");
    if (!t) return;
    t.innerHTML = '<span>' + (ico || "💗") + '</span><span>' + esc(msg) + '</span>';
    t.hidden = false;
    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () { t.hidden = true; }, 2400);
  }

  /* ---------- 상태 ---------- */
  var state = null;
  var store = null;
  var unsubStore = null;
  var saveTimer = null;
  var meId = null;
  var timer = { mode: "countdown", running: false, remaining: 0, elapsed: 0, itemId: null, intId: null };
  var lastStampTotal = null;

  function freshState() {
    return {
      version: 1,
      updatedAt: new Date().toISOString(),
      members: JSON.parse(JSON.stringify(CFG.defaultMembers)),
      study: {
        items: JSON.parse(JSON.stringify(DEFAULT_STUDY_ITEMS)),
        dayKey: todayKey()
      },
      stamps: {},                 // "YYYY-MM-DD": 도장 수
      badges: {},                 // id -> true
      dex: { unlocked: {}, seen: {} },
      mission: {
        todayKey: todayKey(),
        index: Math.floor(Math.random() * MISSION_POOL.length),
        doneToday: false,
        doneTotal: 0,
        history: []
      },
      todos: { dain: [], mom: [], dad: [] },
      chat: [],
      settings: { weatherCache: null }
    };
  }

  function rollDailyState(s) {
    var today = todayKey();
    var changed = false;
    if (!s.study) { s.study = { items: JSON.parse(JSON.stringify(DEFAULT_STUDY_ITEMS)), dayKey: today }; changed = true; }
    if (s.study.dayKey !== today) {
      s.study.dayKey = today;
      s.study.rewarded = false;
      (s.study.items || []).forEach(function (it) { it.done = false; });
      changed = true;
    }
    if (!s.mission) { s.mission = freshState().mission; changed = true; }
    if (s.mission.todayKey !== today) {
      s.mission.todayKey = today;
      s.mission.doneToday = false;
      s.mission.index = Math.floor(Math.random() * MISSION_POOL.length);
      changed = true;
    }
    if (!s.stamps) { s.stamps = {}; changed = true; }
    if (!s.badges) { s.badges = {}; changed = true; }
    if (!s.dex) { s.dex = { unlocked: {}, seen: {} }; changed = true; }
    if (!s.todos) { s.todos = { dain: [], mom: [], dad: [] }; changed = true; }
    if (!s.chat) { s.chat = []; changed = true; }
    if (!s.members || !s.members.length) { s.members = JSON.parse(JSON.stringify(CFG.defaultMembers)); changed = true; }
    return changed;
  }

  function normalizeState(raw) {
    var s = raw && typeof raw === "object" ? raw : null;
    if (!s) s = freshState();
    // 알려진 필드만 유지 (이상한 데이터 방어)
    var out = freshState();
    ["members", "study", "stamps", "badges", "dex", "mission", "todos", "chat", "settings"].forEach(function (k) {
      if (s[k] !== undefined) out[k] = s[k];
    });
    rollDailyState(out);
    return out;
  }

  function persist(immediate) {
    if (!state) return;
    state.updatedAt = new Date().toISOString();
    if (immediate) {
      if (store) store.save(state).catch(function (err) { toast(err.message || "저장에 실패했어요", "⚠️"); });
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      if (store) store.save(state).catch(function (err) { toast(err.message || "저장에 실패했어요", "⚠️"); });
    }, 350);
  }

  function memberById(id) {
    return (state.members || []).find(function (m) { return m.id === id; }) || null;
  }

  function memberName(id) {
    var m = memberById(id);
    return m ? m.name : (DEFAULT_NAMES[id] || id);
  }

  function memberAvatar(id) {
    var m = memberById(id);
    if (m && m.photo) return m.photo;
    if (m && m.avatar) return m.avatar;
    return "assets/avatar_daini.png";
  }

  function avatarOf(m) { return m ? (m.photo || m.avatar || "") : ""; }

  /* ---------- 도장 / 배지 / 도감 ---------- */
  function stampTotal() {
    var n = 0;
    Object.keys(state.stamps || {}).forEach(function (k) { n += Number(state.stamps[k] || 0); });
    return n;
  }

  function addStamps(n, reason) {
    var key = todayKey();
    state.stamps[key] = Number(state.stamps[key] || 0) + n;
    var total = stampTotal();
    var newly = [];
    FAIRIES.forEach(function (f) {
      if (total >= f.need && !state.dex.unlocked[f.id]) {
        state.dex.unlocked[f.id] = todayKey();
        newly.push(f);
      }
    });
    var streak = computeStreak();
    if (streak >= 3 && !state.badges.streak3) state.badges.streak3 = true;
    if (streak >= 7 && !state.badges.streak7) state.badges.streak7 = true;
    if (state.mission.doneTotal >= 5 && !state.badges.mission5) state.badges.mission5 = true;
    if (state.mission.doneTotal >= 10 && !state.badges.mission10) state.badges.mission10 = true;

    persist();
    renderAll();
    if (newly.length) {
      newly.forEach(function (f, i) {
        setTimeout(function () { openUnlockModal(f, reason); }, i * 900);
      });
    } else {
      toast("도장 " + n + "개 적립! (" + total + "개)", "🌸");
    }
    return total;
  }

  function computeStreak() {
    var streak = 0;
    var d = new Date();
    // 오늘 도장이 아직 없으면 어제부터 연속 계산
    if (!state.stamps[todayKey()]) d = new Date(d.getTime() - DAY_MS);
    for (;;) {
      var key = todayKey(d);
      if (Number(state.stamps[key] || 0) > 0) {
        streak++;
        d = new Date(d.getTime() - DAY_MS);
      } else break;
    }
    return streak;
  }

  function openUnlockModal(fairy, reason) {
    openModal(
      '<div class="celebrate">' +
        '<div class="confetti" id="confettiBox"></div>' +
        '<span class="new-label">NEW 요정 등장!</span>' +
        '<img src="' + esc(fairy.img) + '" alt="' + esc(fairy.name) + '">' +
        '<h3 class="title-font">' + esc(fairy.name) + '</h3>' +
        '<p class="tag">' + esc(fairy.personality) + '</p>' +
        '<p class="desc">' + esc(fairy.desc) + '</p>' +
        (reason ? '<p class="muted" style="margin-top:6px">' + esc(reason) + '</p>' : "") +
        '<div class="modal-actions" style="margin-top:14px"><button class="btn btn-primary btn-block" type="button" data-action="close-modal">만나서 반가워! 💕</button></div>' +
      '</div>',
      { center: true }
    );
    var box = qs("#confettiBox");
    if (box) {
      var icons = ["✨", "🌟", "💖", "🌸", "🩷", "⭐"];
      for (var i = 0; i < 24; i++) {
        var bit = el("i", "", icons[i % icons.length]);
        bit.style.left = (Math.random() * 96) + "%";
        bit.style.animationDuration = (2 + Math.random() * 2.2) + "s";
        bit.style.animationDelay = (Math.random() * 0.9) + "s";
        bit.style.fontSize = (11 + Math.random() * 12) + "px";
        box.appendChild(bit);
      }
    }
  }

  /* ---------- 모달 ---------- */
  function openModal(html, opts) {
    opts = opts || {};
    var root = qs("#modalRoot");
    var box = qs("#modalBox");
    box.className = "modal" + (opts.center ? " center" : "");
    if (opts.title != null) {
      box.innerHTML =
        '<div class="modal-head"><h2 class="modal-title" id="modalTitle">' + esc(opts.title) + '</h2>' +
        '<button class="modal-close" type="button" data-action="close-modal" aria-label="닫기">✕</button></div>' +
        '<div class="modal-body">' + html + '</div>';
    } else {
      box.innerHTML = '<div class="modal-body">' + html + '</div>';
    }
    root.hidden = false;
    document.body.style.overflow = "hidden";
    var first = box.querySelector("input, button, select, textarea");
    if (first) first.focus();
  }

  function closeModal() {
    var root = qs("#modalRoot");
    root.hidden = true;
    qs("#modalBox").innerHTML = "";
    document.body.style.overflow = "";
  }

  function confirmModal(title, message, okLabel, onOk) {
    openModal(
      '<p style="font-size:14px;color:var(--ink-soft);line-height:1.6">' + esc(message) + '</p>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" type="button" data-action="close-modal">취소</button>' +
        '<button class="btn btn-danger" type="button" id="confirmOkBtn">' + esc(okLabel || "삭제") + '</button>' +
      '</div>',
      { title: title }
    );
    qs("#confirmOkBtn").addEventListener("click", function () {
      closeModal();
      onOk();
    });
  }

  /* =========================================================
     홈
     ========================================================= */
  function weatherCodeInfo(code) {
    return WEATHER_CODES[code] || { label: "날씨 정보 없음", icon: "🌡️" };
  }

  function pmLevelInfo(pm10, pm25) {
    // 한국 기준(µg/m³): PM10 좋음~좋음(30)/보통(80)/나쁨(150), PM2.5 좋음(15)/보통(35)/나쁨(75)
    function lvl(v, t1, t2, t3) {
      if (v == null || isNaN(v)) return { key: "normal", label: "정보없음" };
      if (v <= t1) return AQI_LEVELS[1];
      if (v <= t2) return AQI_LEVELS[2];
      if (v <= t3) return AQI_LEVELS[3];
      return AQI_LEVELS[4];
    }
    var a = lvl(pm10, 30, 80, 150);
    var b = lvl(pm25, 15, 35, 75);
    // 더 나쁜 쪽을 대표로
    var rank = { good: 0, normal: 1, warn: 2, bad: 3, worst: 4 };
    var rep = rank[a.key] >= rank[b.key] ? a : b;
    return { pm10: a, pm25: b, rep: rep };
  }

  function buildTips(code, temp, pm) {
    var tips = [];
    var info = weatherCodeInfo(code);
    if (code >= 51 && code <= 67 || code >= 80 && code <= 82 || code >= 95) tips.push({ ico: "☂️", txt: "우산 챙겨요 — " + info.label + "이에요" });
    if (code >= 71 && code <= 77 || code >= 85) tips.push({ ico: "🧤", txt: "따뜻하게 입고, 장갑도 챙겨요 — 눈이 와요" });
    if (temp != null && temp <= 0) tips.push({ ico: "🧣", txt: "몸시 추워요 — 목도리와 장갑 필수!" });
    else if (temp != null && temp <= 8) tips.push({ ico: "🧥", txt: "쌀쌀해요 — 따뜻한 겉옷 챙겨요" });
    else if (temp != null && temp >= 28) tips.push({ ico: "💧", txt: "무척 더워요 — 물 자주 마시고 그늘에서 쉬어요" });
    else if (temp != null && temp >= 20) tips.push({ ico: "🧴", txt: "화창한 날엔 선크림 바르기!" });
    var rep = pm && pm.rep;
    if (rep) {
      if (rep.key === "warn" || rep.key === "bad" || rep.key === "worst") tips.push({ ico: "😷", txt: "미세먼지가 많아요 — 마스크 챙겨요" });
      else if (rep.key === "normal") tips.push({ ico: "😊", txt: "미세먼지는 보통이에요 — 산책하기 좋아요" });
      else tips.push({ ico: "🌳", txt: "공기가 깨끗해요 — 밖에서 신나게 놀아요!" });
    }
    if (!tips.length) tips.push({ ico: "💛", txt: "오늘 하루도 사랑스럽게 보내요!" });
    return tips.slice(0, 3);
  }

  function renderHomeWeather() {
    var box = qs("#weatherCard");
    if (!box) return;
    var cache = state.settings && state.settings.weatherCache;
    var w = CFG.weather;
    var place = '<span>📍 <strong>' + esc(w.name) + '</strong></span>';

    if (!cache || !cache.current) {
      box.innerHTML =
        '<div class="weather-top">' + place + '<span class="muted">불러오는 중…</span></div>' +
        '<div class="weather-loading">' +
          '<div class="weather-main"><span class="weather-emoji">🌡️</span><div><div class="weather-temp">--<sup>°</sup></div>' +
          '<div class="weather-cond">날씨를 확인하고 있어요</div></div></div>' +
        '</div>';
      return;
    }

    var cur = cache.current;
    var info = weatherCodeInfo(cur.code);
    var pm = cache.air ? pmLevelInfo(cache.air.pm10, cache.air.pm25) : null;
    var tips = buildTips(cur.code, cur.temp, pm);

    var badges = "";
    if (pm) {
      badges += '<span class="badge ' + pm.pm10.key + '"><span class="dot"></span>미세먼지 <b>' + esc(pm.pm10.label) + '</b>' +
        (cache.air.pm10 != null ? ' <span class="muted" style="font-size:10px">' + cache.air.pm10 + '㎍/㎥</span>' : "") + '</span>';
      badges += '<span class="badge ' + pm.pm25.key + '"><span class="dot"></span>초미세먼지 <b>' + esc(pm.pm25.label) + '</b>' +
        (cache.air.pm25 != null ? ' <span class="muted" style="font-size:10px">' + cache.air.pm25 + '㎍/㎥</span>' : "") + '</span>';
    } else {
      badges += '<span class="badge normal"><span class="dot"></span>미세먼지 정보 없음</span>';
    }

    box.innerHTML =
      '<div class="weather-top">' + place +
        '<button class="icon-btn" type="button" data-action="refresh-weather" aria-label="새로고침" title="새로고침">↻</button>' +
      '</div>' +
      '<div class="weather-main">' +
        '<span class="weather-emoji">' + info.icon + '</span>' +
        '<div>' +
          '<div class="weather-temp">' + Math.round(cur.temp) + '<sup>°C</sup></div>' +
          '<div class="weather-cond">' + esc(info.label) + '</div>' +
          '<div class="weather-range">최저 ' + (cache.min != null ? Math.round(cache.min) + "°" : "--") +
            ' / 최고 ' + (cache.max != null ? Math.round(cache.max) + "°" : "--") + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="weather-badges">' + badges + '</div>' +
      '<div class="tips">' +
        tips.map(function (t) { return '<div class="tip"><span class="tip-ico">' + t.ico + '</span><span>' + esc(t.txt) + '</span></div>'; }).join("") +
      '</div>' +
      '<div class="weather-foot"><span>' + esc(cache.fetchedLabel || "") + ' 기준</span>' +
        '<span>출처: Open-Meteo</span></div>';
  }

  function weatherUnavailable(msg) {
    var box = qs("#weatherCard");
    if (!box || (state.settings && state.settings.weatherCache)) return;
    box.innerHTML =
      '<div class="weather-top"><span>📍 <strong>' + esc(CFG.weather.name) + '</strong></span></div>' +
      '<div class="weather-main"><span class="weather-emoji">🛜</span><div>' +
      '<div class="weather-cond">' + esc(msg || "날씨를 못 불러왔어요") + '</div>' +
      '<div class="weather-range">인터넷 연결을 확인하고 ↻ 을 눌러주세요</div></div></div>';
  }

  function fetchWeather(force) {
    if (typeof fetch !== "function") { weatherUnavailable(); return; }
    var w = CFG.weather;
    var cache = state.settings && state.settings.weatherCache;
    var fresh = cache && cache.fetchedAt && (Date.now() - cache.fetchedAt < w.refreshMinutes * 60 * 1000);
    if (!force && fresh) return;

    var wUrl = w.forecastUrl +
      "?latitude=" + w.lat + "&longitude=" + w.lon +
      "&current=temperature_2m,weather_code,relative_humidity_2m" +
      "&daily=temperature_2m_max,temperature_2m_min" +
      "&timezone=" + encodeURIComponent(w.timezone) +
      "&forecast_days=1";
    var aUrl = w.airUrl +
      "?latitude=" + w.lat + "&longitude=" + w.lon +
      "&current=pm10,pm2_5" +
      "&timezone=" + encodeURIComponent(w.timezone);

    fetch(wUrl).then(function (r) {
      if (!r.ok) throw new Error("weather HTTP " + r.status);
      return r.json();
    }).then(function (j) {
      var c = j.current || {};
      var d = (j.daily || {});
      return {
        current: {
          temp: c.temperature_2m,
          code: c.weather_code,
          humidity: c.relative_humidity_2m
        },
        min: d.temperature_2m_min && d.temperature_2m_min[0],
        max: d.temperature_2m_max && d.temperature_2m_max[0],
        fetchedAt: Date.now(),
        fetchedLabel: fmtTime(new Date().toISOString())
      };
    }).then(function (weatherData) {
      return fetch(aUrl).then(function (r) {
        if (!r.ok) throw new Error("air HTTP " + r.status);
        return r.json();
      }).then(function (aj) {
        var ac = (aj.current || {});
        weatherData.air = { pm10: (ac.pm10 == null ? null : Math.round(ac.pm10)), pm25: (ac.pm2_5 == null ? null : Math.round(ac.pm2_5)) };
        return weatherData;
      }).catch(function () {
        weatherData.air = null;
        return weatherData;
      });
    }).then(function (weatherData) {
      if (!state.settings) state.settings = {};
      state.settings.weatherCache = weatherData;
      renderHomeWeather();
      persist();
    }).catch(function () {
      weatherUnavailable();
    });
  }

  function renderHome() {
    var home = qs("#homeContent");
    if (!home) return;
    var total = stampTotal();
    var streak = computeStreak();
    var items = state.study.items || [];
    var doneCount = items.filter(function (i) { return i.done; }).length;
    var todayStamps = Number(state.stamps[todayKey()] || 0);

    // 오늘 할 일 요약
    var todoRows = [];
    ["dain", "mom", "dad"].forEach(function (pid) {
      var list = state.todos[pid] || [];
      var done = list.filter(function (t) { return t.done; }).length;
      todoRows.push({ who: pid, label: memberName(pid), done: done, total: list.length });
    });

    var mission = MISSION_POOL[state.mission.index % MISSION_POOL.length];

    home.innerHTML = "";
    home.appendChild(el("div", "home-grid"));

    var grid = qs(".home-grid", home);

    // 날씨 카드
    var wWrap = el("div");
    wWrap.innerHTML = '<div class="card weather" id="weatherCard"></div>';
    grid.appendChild(wWrap);

    // 오늘 요약
    var sumWrap = el("div");
    sumWrap.innerHTML =
      '<div class="card">' +
        '<div class="section-head"><div class="section-title"><span class="ico">📌</span>오늘 현황</div>' +
          '<span class="section-note">' + esc(fmtDateKo(todayKey())) + '</span></div>' +
        '<div class="stat-grid" style="margin-top:12px">' +
          '<div class="stat"><div class="stat-num">' + total + '<span class="unit">개</span></div><div class="stat-label">모은 도장</div></div>' +
          '<div class="stat"><div class="stat-num">' + streak + '<span class="unit">일</span></div><div class="stat-label">연속 기록</div></div>' +
          '<div class="stat"><div class="stat-num">' + state.mission.doneTotal + '<span class="unit">번</span></div><div class="stat-label">가족 미션</div></div>' +
        '</div>' +
        '<div class="progress-wrap" style="margin-top:14px">' +
          '<div class="progress-head"><span>다인이의 오늘 공부</span><b>' + doneCount + ' / ' + items.length + ' 완료</b></div>' +
          '<div class="progress"><i style="width:' + (items.length ? Math.round(doneCount / items.length * 100) : 0) + '%"></i></div>' +
        '</div>' +
        '<div style="margin-top:12px" class="mini-list">' +
          '<div class="mini-row"><span class="check">🧚</span><span class="txt">오늘 받은 도장 <b class="title-font">' + todayStamps + '</b>개</span></div>' +
          '<div class="mini-row"><span class="check">🌈</span><span class="txt">가족 미션 — ' + esc(mission.text) + '</span></div>' +
        '</div>' +
        '<div class="row" style="margin-top:12px;gap:8px">' +
          '<button class="btn btn-sm btn-soft grow" type="button" data-action="tab" data-tab="study">공부하러 가요 →</button>' +
          '<button class="btn btn-sm btn-yellow grow" type="button" data-action="tab" data-tab="dex">도감 보기 🧚</button>' +
        '</div>' +
      '</div>';
    grid.appendChild(sumWrap);

    // 오늘 할 일 스냅샷
    var todoSnap = el("div", "span-2");
    todoSnap.innerHTML =
      '<div class="card tight">' +
        '<div class="section-head"><div class="section-title"><span class="ico">🗒️</span>오늘 할 일 한눈에</div>' +
          '<button class="btn btn-xs btn-ghost" type="button" data-action="tab" data-tab="mission">전체 보기</button></div>' +
        '<div class="stat-grid" style="margin-top:10px">' +
          todoRows.map(function (r) {
            return '<div class="stat"><div class="stat-num">' + (r.total ? r.done + '/' + r.total : '-') + '</div><div class="stat-label">' + esc(r.label) + '</div></div>';
          }).join("") +
        '</div>' +
      '</div>';
    grid.appendChild(todoSnap);

    // 히어로 인사말 (상단)
    var me = memberById(meId);
    var greet = el("div");
    greet.innerHTML =
      '<div class="card tight" style="display:flex;align-items:center;gap:12px">' +
        '<img src="' + esc(me ? avatarOf(me) : "assets/avatar_daini.png") + '" alt="" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:var(--shadow-tiny)">' +
        '<div class="grow"><p class="title-font" style="font-size:16px">' + esc(me ? me.name : "") + '의 하루, 힘차게! ✨</p>' +
        '<p class="muted">공부하고 도장 모아서 요정 친구들을 만나요</p></div>' +
      '</div>';
    grid.insertBefore(greet, grid.firstChild);

    renderHomeWeather();
    fetchWeather(false);
  }

  /* =========================================================
     공부 플랜 + 타이머
     ========================================================= */
  function renderStudy() {
    var root = qs("#studyContent");
    if (!root) return;
    var items = state.study.items || [];
    var doneCount = items.filter(function (i) { return i.done; }).length;

    root.innerHTML = "";

    // 진행률 + 타이머
    var top = el("div");
    top.innerHTML =
      '<div class="timer-card">' +
        '<div class="row between wrap" style="gap:10px">' +
          '<div class="timer-tabs" role="tablist">' +
            '<button type="button" class="timer-tab' + (timer.mode === "countdown" ? " is-active" : "") + '" data-action="timer-mode" data-mode="countdown">남은 시간</button>' +
            '<button type="button" class="timer-tab' + (timer.mode === "stopwatch" ? " is-active" : "") + '" data-action="timer-mode" data-mode="stopwatch">재는 시간</button>' +
          '</div>' +
        '</div>' +
        '<div class="timer-face">' +
          '<div class="timer-time' + (timer.mode === "countdown" && timer.remaining <= 10 && timer.running ? " is-warn" : "") + '" id="timerFace">' +
            (timer.mode === "countdown" ? mmss(timer.remaining) : mmss(timer.elapsed)) +
          '</div>' +
          '<div class="timer-sub" id="timerSub">' + esc(timerSubText()) + '</div>' +
          '<div class="timer-presets" id="timerPresets"' + (timer.mode === "countdown" ? "" : ' style="display:none"') + '>' +
            CFG.app.countdownPresets.map(function (m) {
              return '<button type="button" class="preset' + (timer.mode === "countdown" && !timer.running && timer.presetMin === m ? " is-active" : "") + '" data-action="preset" data-min="' + m + '">' + m + '분</button>';
            }).join("") +
          '</div>' +
          '<div class="custom-min" id="customMinWrap"' + (timer.mode === "countdown" ? "" : ' style="display:none"') + '>' +
            '<input type="number" id="customMin" min="1" max="180" placeholder="직접 입력" aria-label="직접 입력(분)">' +
            '<button type="button" class="btn btn-xs btn-ghost" data-action="custom-min">설정</button>' +
          '</div>' +
        '</div>' +
        '<div class="timer-btns">' +
          '<button class="btn btn-purple" type="button" data-action="timer-toggle" id="timerToggleBtn">' + (timer.running ? "⏸ 잠깐 멈춤" : (timer.remaining > 0 || timer.elapsed > 0 ? "▶ 이어서" : "▶ 시작")) + '</button>' +
          '<button class="btn btn-ghost" type="button" data-action="timer-reset">↺ 초기화</button>' +
        '</div>' +
      '</div>';
    root.appendChild(top);

    // 진행률 바
    var prog = el("div", "card tight");
    prog.innerHTML =
      '<div class="progress-wrap">' +
        '<div class="progress-head"><span>오늘의 공부 플랜</span><b>' + doneCount + ' / ' + items.length + '</b></div>' +
        '<div class="progress"><i style="width:' + (items.length ? Math.round(doneCount / items.length * 100) : 0) + '%"></i></div>' +
      '</div>';
    root.appendChild(prog);

    // 리스트
    var listCard = el("div", "card");
    listCard.innerHTML =
      '<div class="section-head"><div class="section-title"><span class="ico">📚</span>오늘의 공부</div>' +
        '<button class="btn btn-sm btn-primary" type="button" data-action="add-study">+ 공부 추가</button></div>' +
      '<div class="study-list" id="studyList" style="margin-top:12px">' +
        (items.length ? items.map(function (it) {
          return '<div class="study-item' + (it.done ? " done" : "") + '">' +
            '<button class="check-btn" type="button" data-action="toggle-study" data-id="' + esc(it.id) + '" aria-label="완료 체크">✓</button>' +
            '<div class="study-body"><div class="study-name">' + esc(it.name) + '</div>' +
              '<div class="study-meta">' +
                '<span class="pill-tiny">' + esc(minutesLabel(it)) + '</span>' +
                (it.kind === "stopwatch" ? '<span>⏱ 스톱워치로 재요</span>' : '<span>⏳ ' + it.minutes + '분 타이머</span>') +
              '</div></div>' +
            '<div class="item-actions">' +
              '<button class="mini-icon" type="button" data-action="start-study-timer" data-id="' + esc(it.id) + '" aria-label="이 항목 타이머 켜기">▶️</button>' +
              '<button class="mini-icon" type="button" data-action="edit-study" data-id="' + esc(it.id) + '" aria-label="수정">✏️</button>' +
              '<button class="mini-icon" type="button" data-action="delete-study" data-id="' + esc(it.id) + '" aria-label="삭제">🗑️</button>' +
            '</div>' +
          '</div>';
        }).join("") : '<p class="muted" style="padding:6px 2px">아직 공부 계획이 없어요. + 공부 추가 로 첫 계획을 세워요!</p>') +
      '</div>';
    root.appendChild(listCard);

    var note = el("p", "muted center", "공부를 완료하면 체크 버튼을 눌러요 — 도장이 쏙쏙 쌓여요 🌸");
    note.style.fontSize = "12px";
    root.appendChild(note);
  }

  function minutesLabel(it) {
    if (it.kind === "stopwatch") return "재는 중";
    return it.minutes + "분";
  }

  function timerSubText() {
    if (timer.mode === "stopwatch") {
      return timer.running ? "재고 있어요… 파이팅!" : "스톱워치로 공부 시간을 재요";
    }
    if (timer.running) {
      var it = timer.itemId ? (state.study.items || []).find(function (x) { return x.id === timer.itemId; }) : null;
      return (it ? "『" + it.name + "』 " : "") + "타이머 가는 중… 마칠 때 체크!";
    }
    if (timer.remaining > 0) return "준비됐어요 — 시작을 눌러요";
    return "10분 · 20분 · 30분 또는 직접 입력";
  }

  function stopTimerInt() {
    if (timer.intId) { clearInterval(timer.intId); timer.intId = null; }
    timer.running = false;
  }

  function startTimerInt() {
    stopTimerInt();
    timer.running = true;
    timer.intId = setInterval(function () {
      if (timer.mode === "countdown") {
        timer.remaining--;
        if (timer.remaining <= 0) {
          timer.remaining = 0;
          stopTimerInt();
          onTimerFinish();
          return;
        }
      } else {
        timer.elapsed++;
      }
      updateTimerFace();
    }, 1000);
  }

  function onTimerFinish() {
    updateTimerFace();
    var it = timer.itemId ? (state.study.items || []).find(function (x) { return x.id === timer.itemId; }) : null;
    toast("타이머 끝! 잘했어요 🎉", "⏰");
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        var ctx = new Ctx();
        var notes = [523.25, 659.25, 783.99];
        notes.forEach(function (f, i) {
          var o = ctx.createOscillator();
          var g = ctx.createGain();
          o.frequency.value = f;
          o.connect(g); g.connect(ctx.destination);
          var t0 = ctx.currentTime + i * 0.18;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
          o.start(t0); o.stop(t0 + 0.32);
        });
        setTimeout(function () { ctx.close(); }, 1400);
      }
    } catch (e) { /* 소리는 선택 */ }
    if (it && !it.done) {
      it.done = true;
      checkStudyCompletion();
    }
    persist();
    renderAll();
  }

  function checkStudyCompletion() {
    var items = state.study.items || [];
    if (!items.length || !items.every(function (i) { return i.done; })) return;
    if (state.study.rewarded) return;   // 하루 한 번만 보상
    state.study.rewarded = true;
    setTimeout(function () { addStamps(1, "오늘의 공부 플랜을 모두 끝냈어요!"); }, 250);
  }

  function updateTimerFace() {
    var face = qs("#timerFace");
    if (!face) return;
    if (timer.mode === "countdown") {
      face.textContent = mmss(timer.remaining);
      face.classList.toggle("is-warn", timer.running && timer.remaining <= 10);
    } else {
      face.textContent = mmss(timer.elapsed);
      face.classList.remove("is-warn");
    }
    var sub = qs("#timerSub");
    if (sub) sub.textContent = timerSubText();
    var toggle = qs("#timerToggleBtn");
    if (toggle) {
      toggle.textContent = timer.running ? "⏸ 잠깐 멈춤" : (timer.remaining > 0 || timer.elapsed > 0 ? "▶ 이어서" : "▶ 시작");
    }
  }

  function openStudyModal(existing) {
    var isEdit = !!existing;
    openModal(
      '<div class="field"><label for="studyName">공부 이름</label>' +
        '<input type="text" id="studyName" maxlength="30" placeholder="예: 알파벳 노래 부르기" value="' + (isEdit ? esc(existing.name) : "") + '"></div>' +
      '<div class="field"><label for="studyMin">시간 (분)</label>' +
        '<input type="number" id="studyMin" min="1" max="180" value="' + (isEdit ? (existing.minutes || 10) : 10) + '"></div>' +
      '<div class="field"><label for="studyKind">재는 방법</label>' +
        '<select id="studyKind" class="text-input" style="border-radius:14px">' +
          '<option value="countdown"' + (!isEdit || existing.kind !== "stopwatch" ? " selected" : "") + '>남은 시간 (카운트다운)</option>' +
          '<option value="stopwatch"' + (isEdit && existing.kind === "stopwatch" ? " selected" : "") + '>재는 시간 (스톱워치)</option>' +
        '</select></div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" type="button" data-action="close-modal">취소</button>' +
        '<button class="btn btn-primary" type="button" id="studySaveBtn">' + (isEdit ? "저장" : "추가") + '</button>' +
      '</div>',
      { title: isEdit ? "공부 수정" : "공부 추가" }
    );
    qs("#studySaveBtn").addEventListener("click", function () {
      var name = qs("#studyName").value.trim();
      var min = Math.max(1, Math.min(180, Number(qs("#studyMin").value) || 10));
      var kind = qs("#studyKind").value === "stopwatch" ? "stopwatch" : "countdown";
      if (!name) { toast("공부 이름을 넣어 주세요", "✏️"); return; }
      if (isEdit) {
        existing.name = name; existing.minutes = min; existing.kind = kind;
      } else {
        state.study.items.push({ id: uid("s"), name: name, minutes: min, kind: kind, done: false });
      }
      closeModal();
      persist();
      renderAll();
      toast(isEdit ? "수정했어요" : "공부를 추가했어요!", "📚");
    });
  }

  /* =========================================================
     도장판 + 도감
     ========================================================= */
  function renderDex() {
    var root = qs("#dexContent");
    if (!root) return;
    root.innerHTML = "";

    var total = stampTotal();
    var streak = computeStreak();
    var today = todayKey();

    // 이번 주 (월요일 시작)
    var now = new Date();
    var dow = now.getDay(); // 0=일
    var monOffset = (dow === 0 ? -6 : 1 - dow);
    var monday = new Date(now.getTime() + monOffset * DAY_MS);

    var days = [];
    for (var i = 0; i < 7; i++) {
      var d = new Date(monday.getTime() + i * DAY_MS);
      var key = todayKey(d);
      days.push({ key: key, dow: DOW_KO[(i + 1) % 7], n: Number(state.stamps[key] || 0), future: key > today });
    }

    var unlockedCount = Object.keys(state.dex.unlocked || {}).length;

    var top = el("div");
    top.innerHTML =
      '<div class="card">' +
        '<div class="stamp-head">' +
          '<div class="section-title"><span class="ico">🌸</span>다인이 도장판</div>' +
          '<span class="section-note">모은 도장 ' + total + '개</span>' +
        '</div>' +
        '<div class="stamp-board" style="margin-top:12px">' +
          days.map(function (d) {
            var cls = "stamp-day" + (d.key === today ? " is-today" : "") + (d.future ? " is-future" : "");
            var dots = "";
            var shown = Math.min(d.n, 6);
            for (var k = 0; k < 6; k++) dots += '<span class="stamp-dot' + (k < shown ? "" : " empty") + '"></span>';
            return '<div class="' + cls + '"><span class="stamp-dow">' + d.dow + '</span>' +
              '<span class="stamp-count">' + (d.future ? "" : d.n) + '</span>' +
              '<span class="stamp-dots">' + dots + '</span></div>';
          }).join("") +
        '</div>' +
        '<div style="margin-top:12px" class="badges">' +
          (streak >= 3 ? '<span class="badge-item">🔥 ' + streak + '일 연속 기록!</span>' : "") +
          (state.badges.streak3 ? '<span class="badge-item">🏅 3일 연속 달성</span>' : '<span class="badge-item locked">🔒 3일 연속</span>') +
          (state.badges.streak7 ? '<span class="badge-item">🏆 7일 연속 달성</span>' : '<span class="badge-item locked">🔒 7일 연속</span>') +
          (state.badges.mission5 ? '<span class="badge-item">💖 가족 미션 5회</span>' : '<span class="badge-item locked">🔒 미션 5회</span>') +
          (state.badges.mission10 ? '<span class="badge-item">💖 가족 미션 10회</span>' : '<span class="badge-item locked">🔒 미션 10회</span>') +
        '</div>' +
        '<p class="muted" style="margin-top:10px;font-size:11.5px">공부 · 미션 · 할 일을 끝내면 도장이 쌓여요. 도장마다 요정 친구가 한 명씩 찾아와요!</p>' +
      '</div>';
    root.appendChild(top);

    // 도감
    var dexCard = el("div", "card");
    dexCard.innerHTML =
      '<div class="section-head"><div class="section-title"><span class="ico">🧚</span>요정 도감</div>' +
        '<span class="section-note">' + unlockedCount + ' / ' + FAIRIES.length + ' 친구</span></div>' +
      '<div class="dex-grid" style="margin-top:12px" id="dexGrid">' +
        FAIRIES.map(function (f) {
          var unlocked = !!state.dex.unlocked[f.id];
          var isNew = unlocked && !state.dex.seen[f.id];
          var cls = "dex-card" + (unlocked ? "" : " is-locked") + (isNew ? " is-new" : "");
          return '<button type="button" class="' + cls + '" data-action="dex-open" data-id="' + f.id + '">' +
            '<span class="dex-thumb">' +
              '<img src="' + esc(f.img) + '" alt="' + esc(unlocked ? f.name : "잠긴 요정") + '" loading="lazy">' +
              (unlocked ? "" : '<span class="dex-lock">🔒</span>') +
            '</span>' +
            '<span class="dex-info">' +
              '<span class="dex-name">' + esc(unlocked ? f.name : " ? ? ?") + '</span>' +
              '<span class="dex-tag">' + esc(unlocked ? f.eng + " · " + f.personality : "아직 만나지 못한 친구") + '</span>' +
              (unlocked ? "" : '<span class="dex-need">' + esc(f.how) + '에 만나요</span>') +
            '</span>' +
          '</button>';
        }).join("") +
      '</div>';
    root.appendChild(dexCard);
  }

  function openDexDetail(f) {
    var unlocked = !!state.dex.unlocked[f.id];
    if (unlocked) {
      state.dex.seen[f.id] = true;
      persist();
      openModal(
        '<div class="dex-hero">' +
          '<img src="' + esc(f.img) + '" alt="' + esc(f.name) + '">' +
          '<div class="grow">' +
            '<h3 class="title-font" style="font-size:20px;color:#4A3B34">' + esc(f.name) + '</h3>' +
            '<p class="muted">' + esc(f.eng) + ' · ' + esc(f.personality) + '</p>' +
            '<p class="chip" style="margin-top:6px">획득일 ' + esc(fmtDateKo(state.dex.unlocked[f.id])) + '</p>' +
          '</div>' +
        '</div>' +
        '<p style="font-size:13.5px;color:var(--ink-soft);line-height:1.6">' + esc(f.desc) + '</p>',
        { title: "요정 친구" }
      );
      renderDex();
    } else {
      openModal(
        '<div class="center" style="padding:6px 0">' +
          '<p style="font-size:34px">🔒</p>' +
          '<h3 class="title-font" style="font-size:18px;color:#4A3B34;margin-top:4px">아직 만나지 못한 친구</h3>' +
          '<p class="muted" style="margin-top:6px">' + esc(f.how) + '면 만날 수 있어요.</p>' +
          '<p class="muted">지금까지 모은 도장: <b class="title-font">' + stampTotal() + '</b>개</p>' +
        '</div>',
        { title: "? ? ?" }
      );
    }
  }

  /* =========================================================
     미션 + 할 일
     ========================================================= */
  function renderMission() {
    var root = qs("#missionContent");
    if (!root) return;
    var m = MISSION_POOL[state.mission.index % MISSION_POOL.length];
    var doneToday = state.mission.doneToday;

    root.innerHTML = "";

    var mCard = el("div");
    mCard.innerHTML =
      '<div class="card tight" style="background:linear-gradient(175deg,#FFFDFB,#FFF5EC);border-color:#FFE0CB">' +
        '<div class="section-head"><div class="section-title"><span class="ico">🌈</span>오늘의 가족 미션</div>' +
          '<span class="section-note">함께 ' + state.mission.doneTotal + '번 달성</span></div>' +
        '<div class="mission-card' + (doneToday ? " is-done" : "") + '" style="margin-top:10px">' +
          '<div class="mission-emoji">' + m.emoji + '</div>' +
          '<div class="mission-text">' + esc(m.text) + '</div>' +
          '<div class="mission-sub">' + esc(m.sub) + '</div>' +
          (doneToday
            ? '<div class="mission-done-stamp">🌼</div><p class="muted" style="margin-top:6px">오늘 미션 달성! 도장 +1</p>'
            : '<div class="mission-actions">' +
                '<button class="btn btn-primary" type="button" data-action="mission-done">🌿 다 같이 했어요!</button>' +
                '<button class="btn btn-ghost" type="button" data-action="mission-reroll">🎲 다른 미션 뽑기</button>' +
              '</div>') +
        '</div>' +
      '</div>';
    root.appendChild(mCard);

    // 할 일
    var todos = el("div", "todo-people");
    ["dain", "mom", "dad"].forEach(function (pid) {
      var list = state.todos[pid] || [];
      var done = list.filter(function (t) { return t.done; }).length;
      var person = el("div", "todo-person");
      person.innerHTML =
        '<div class="person-head">' +
          '<img class="person-avatar" src="' + esc(memberAvatar(pid)) + '" alt="">' +
          '<div><div class="person-name">' + esc(memberName(pid)) + '</div>' +
          '<div class="person-sub">' + (list.length ? done + ' / ' + list.length + ' 완료' : '할 일을 추가해 주세요') + '</div></div>' +
          '<button class="btn btn-xs btn-soft" type="button" data-action="add-todo" data-who="' + pid + '" style="margin-left:auto">+ 추가</button>' +
        '</div>' +
        '<div class="todo-list">' +
          (list.length ? list.map(function (t) {
            return '<div class="todo-item' + (t.done ? " done" : "") + '">' +
              '<button class="check-btn" style="width:24px;height:24px;font-size:12px" type="button" data-action="toggle-todo" data-who="' + pid + '" data-id="' + esc(t.id) + '">✓</button>' +
              '<span class="txt">' + esc(t.text) + '</span>' +
              '<button class="mini-icon" type="button" data-action="delete-todo" data-who="' + pid + '" data-id="' + esc(t.id) + '" aria-label="삭제">🗑️</button>' +
            '</div>';
          }).join("") : '<p class="todo-empty">아직 없어요</p>') +
        '</div>';
      todos.appendChild(person);
    });
    root.appendChild(todos);
  }

  function openAddTodo(who) {
    openModal(
      '<div class="field"><label for="todoText">할 일</label>' +
        '<input type="text" id="todoText" maxlength="40" placeholder="예: 유치원 가방 정리">' +
      '</div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" type="button" data-action="close-modal">취소</button>' +
        '<button class="btn btn-primary" type="button" id="todoSaveBtn">추가</button>' +
      '</div>',
      { title: memberName(who) + "의 할 일" }
    );
    var input = qs("#todoText");
    input.focus();
    qs("#todoSaveBtn").addEventListener("click", function () {
      var text = input.value.trim();
      if (!text) { toast("할 일을 적어 주세요", "🗒️"); return; }
      state.todos[who].push({ id: uid("t"), text: text, done: false });
      closeModal();
      persist();
      renderAll();
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") qs("#todoSaveBtn").click();
    });
  }

  /* =========================================================
     채팅
     ========================================================= */
  function renderChat() {
    var list = qs("#chatList");
    if (!list) return;
    list.innerHTML = "";
    var msgs = state.chat || [];
    if (!msgs.length) {
      list.innerHTML = '<p class="typing-note" style="padding:18px 8px">가족에게 첫 메시지를 남겨요 💬</p>';
      return;
    }
    msgs.forEach(function (msg) {
      list.appendChild(buildMsg(msg));
    });
    list.scrollTop = list.scrollHeight;
  }

  function buildMsg(msg) {
    var mine = msg.from === meId;
    var wrap = el("div", "msg" + (mine ? " mine" : ""));
    wrap.innerHTML =
      '<img class="msg-avatar" src="' + esc(msg.avatar || memberAvatar(msg.from)) + '" alt="">' +
      '<div class="msg-main">' +
        '<span class="msg-name">' + esc(msg.fromName || memberName(msg.from)) + '</span>' +
        (msg.kind === "voice"
          ? '<span class="bubble"><span class="voice-bubble">🎙️ <span>' + esc(msg.durationLabel || "음성") + '</span></span><audio controls src="' + esc(msg.audio) + '"></audio></span>'
          : msg.kind === "sticker"
            ? '<span class="bubble sticker-bubble"><img src="' + esc(msg.img) + '" alt="스티커"></span>'
            : '<span class="bubble">' + esc(msg.text) + '</span>') +
        '<span class="msg-time">' + esc(fmtTime(msg.at)) + '</span>' +
        '<span class="heart-row"><button type="button" class="heart-btn' + (msg.heart ? " is-on" : "") + '" data-action="heart" data-id="' + esc(msg.id) + '">💗' +
          (msg.heart ? '<b>1</b>' : "") + '</button></span>' +
      '</div>';
    return wrap;
  }

  function sendChat(payload) {
    var msg = Object.assign({
      id: uid("m"),
      from: meId,
      fromName: memberName(meId),
      avatar: memberAvatar(meId),
      at: new Date().toISOString(),
      heart: false
    }, payload);
    state.chat.push(msg);
    if (state.chat.length > CFG.app.maxChatMessages) {
      state.chat = state.chat.slice(-CFG.app.maxChatMessages);
    }
    persist(true);
    renderChat();
  }

  function renderStickerSheet() {
    var sheet = qs("#stickerSheet");
    if (!sheet || sheet.childElementCount) return;
    STICKERS.forEach(function (st) {
      var b = el("button", "sticker-btn");
      b.type = "button";
      b.setAttribute("data-action", "send-sticker");
      b.setAttribute("data-img", st.img);
      b.setAttribute("data-label", st.label);
      b.innerHTML = '<img src="' + esc(st.img) + '" alt="' + esc(st.label) + '"><span>' + esc(st.label) + '</span>';
      sheet.appendChild(b);
    });
  }

  /* ---------- 음성 메모 ---------- */
  var voice = { rec: null, chunks: [], startAt: 0, timerId: null, mime: null };

  function voiceSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  }

  function startVoice() {
    if (!voiceSupported()) {
      toast("이 브라우저에서는 음성 메모를 쓸 수 없어요", "🎙️");
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var opts = {};
      if (MediaRecorder.isTypeSupported("audio/webm")) opts.mimeType = "audio/webm";
      else if (MediaRecorder.isTypeSupported("audio/mp4")) opts.mimeType = "audio/mp4";
      voice.rec = new MediaRecorder(stream, opts);
      voice.mime = opts.mimeType || "";
      voice.chunks = [];
      voice.startAt = Date.now();
      voice.rec.ondataavailable = function (e) {
        if (e.data && e.data.size) voice.chunks.push(e.data);
      };
      voice.rec.onstop = onVoiceStop;
      voice.rec.start(250);
      qs("#recBar").hidden = false;
      qs("#micBtn").classList.add("is-recording");
      voice.timerId = setInterval(function () {
        qs("#recTime").textContent = mmss((Date.now() - voice.startAt) / 1000);
        if ((Date.now() - voice.startAt) / 1000 >= CFG.app.maxVoiceSeconds) stopVoice();
      }, 250);
    }).catch(function () {
      toast("마이크 사용이 거부되었어요. 설정에서 허용해 주세요", "🎤");
    });
  }

  function stopVoice() {
    if (voice.rec && voice.rec.state !== "inactive") voice.rec.stop();
    else resetVoiceUi();
  }

  function cancelVoice() {
    if (voice.rec && voice.rec.state !== "inactive") {
      voice.rec.onstop = function () { resetVoiceUi(); cleanupVoiceStream(); };
      voice.rec.stop();
    } else resetVoiceUi();
  }

  function resetVoiceUi() {
    qs("#recBar").hidden = true;
    qs("#micBtn").classList.remove("is-recording");
    if (voice.timerId) clearInterval(voice.timerId);
    voice.timerId = null;
  }

  function cleanupVoiceStream() {
    try {
      if (voice.rec && voice.rec.stream) voice.rec.stream.getTracks().forEach(function (t) { t.stop(); });
    } catch (e) { /* 무시 */ }
  }

  function onVoiceStop() {
    cleanupVoiceStream();
    var dur = (Date.now() - voice.startAt) / 1000;
    var blob = new Blob(voice.chunks, { type: voice.mime || "audio/webm" });
    resetVoiceUi();
    if (!blob.size) { toast("녹음이 비어 있어요", "🎙️"); return; }
    if (blob.size > CFG.app.voiceMaxBytes) { toast("녹음이 너무 길어요 (최대 " + CFG.app.maxVoiceSeconds + "초)", "🎙️"); return; }
    var reader = new FileReader();
    reader.onload = function () {
      sendChat({ kind: "voice", audio: reader.result, durationLabel: mmss(dur) + " 음성" });
      toast("음성 메모를 보냈어요", "🎙️");
    };
    reader.readAsDataURL(blob);
  }

  /* =========================================================
     게이트 (기기 프로필)
     ========================================================= */
  function readDeviceLock() {
    try { return localStorage.getItem(CFG.app.deviceKey); } catch (e) { return null; }
  }

  function writeDeviceLock(id) {
    try { localStorage.setItem(CFG.app.deviceKey, id); } catch (e) { /* 무시 */ }
  }

  function renderGate() {
    var gate = qs("#deviceGate");
    var list = qs("#gateList");
    list.innerHTML = "";
    (state.members || []).forEach(function (m) {
      var b = el("button", "gate-person");
      b.type = "button";
      b.setAttribute("data-action", "pick-device");
      b.setAttribute("data-id", m.id);
      b.innerHTML =
        '<img src="' + esc(avatarOf(m)) + '" alt="">' +
        '<span class="grow"><span class="gp-name">' + esc(m.name) + '</span><br><span class="gp-sub">' + esc(m.role || "") + '</span></span>' +
        '<span class="gp-arrow">›</span>';
      list.appendChild(b);
    });
    gate.hidden = false;
  }

  function applyDevice(id) {
    meId = id;
    writeDeviceLock(id);
    qs("#deviceGate").hidden = true;
    var m = memberById(id);
    qs("#deviceChipImg").src = avatarOf(m);
    qs("#deviceChipName").textContent = m ? m.name : "";
    updateLockBtn();
    renderAll();
  }

  function lockDevice() {
    meId = null;
    try { localStorage.removeItem(CFG.app.deviceKey); } catch (e) { /* 무시 */ }
    renderGate();
    updateLockBtn();
  }

  function updateLockBtn() {
    var btn = qs("#lockBtn");
    if (!btn) return;
    var locked = !meId;
    btn.textContent = locked ? "🔒" : "🔓";
    btn.setAttribute("aria-label", locked ? "기기 잠김 — 눌러서 해제" : "이 기기 잠금");
    btn.title = locked ? "기기 잠김 — 눌러서 다시 고르기" : "이 기기 잠금";
  }

  /* =========================================================
     설정
     ========================================================= */
  function renderSettings() {
    var rows = (state.members || []).map(function (m, idx) {
      return '<div class="member-edit">' +
        '<img id="mpImg-' + idx + '" src="' + esc(avatarOf(m)) + '" alt="">' +
        '<div class="grow">' +
          '<input type="text" id="mpName-' + idx + '" maxlength="12" value="' + esc(m.name) + '" aria-label="이름">' +
          '<p class="muted" style="margin-top:3px">' + esc(m.role || "") + '</p>' +
        '</div>' +
        '<label class="btn btn-xs btn-ghost" style="flex-direction:column">' +
          '<input type="file" id="mpFile-' + idx + '" accept="image/*" class="hidden" data-idx="' + idx + '">사진 바꾸기</label>' +
      '</div>';
    }).join("");

    openModal(
      '<h4 class="title-font" style="font-size:14px;color:#5A463C">가족 프로필</h4>' +
      '<div>' + rows + '</div>' +
      '<p class="muted" style="font-size:11.5px">사진은 이 기기(또는 가족 저장소)에만 저장돼요. 원본 그림도 언제든 다시 고를 수 있어요.</p>' +
      '<div class="row" style="gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-xs btn-ghost" type="button" data-action="reset-avatars">기본 그림으로 되돌리기</button>' +
      '</div>' +
      '<h4 class="title-font" style="font-size:14px;color:#5A463C;margin-top:10px">이 기기</h4>' +
      '<div class="setting-row"><div class="sr-main"><div class="sr-title">' + esc(memberById(meId) ? memberName(meId) : "") + ' 로 사용 중</div>' +
        '<div class="sr-sub">' + esc(store.describe()) + '</div></div>' +
        '<button class="btn btn-xs btn-ghost" type="button" data-action="open-device">기기 바꾸기</button></div>' +
      '<div class="setting-row"><div class="sr-main"><div class="sr-title">데이터 백업 / 복구</div>' +
        '<div class="sr-sub">기록을 파일로 내려받거나, 파일로 되살릴 수 있어요</div></div>' +
        '<span><button class="btn btn-xs btn-ghost" type="button" data-action="export-data">내보내기</button> ' +
        '<button class="btn btn-xs btn-ghost" type="button" data-action="import-data">불러오기</button></span></div>' +
      '<h4 class="title-font" style="font-size:14px;color:#5A463C;margin-top:10px">도장 초기화</h4>' +
      '<p class="muted" style="font-size:11.5px">도장·배지·도감을 모두 지우고 새로 시작해요. (채팅·할 일은 그대로)</p>' +
      '<button class="btn btn-xs btn-danger" type="button" data-action="reset-stamps">도장판 비우기</button>',
      { title: "설정" }
    );

    // 파일 선택 → data URL
    qsa("input[id^='mpFile']").forEach(function (inp) {
      inp.addEventListener("change", function () {
        var idx = Number(inp.getAttribute("data-idx"));
        var file = inp.files && inp.files[0];
        if (!file) return;
        if (file.size > 1200000) { toast("이미지가 너무 커요 (1.2MB 이하로 골라 주세요)", "🖼️"); return; }
        var reader = new FileReader();
        reader.onload = function () {
          state.members[idx].photo = reader.result;
          persist();
          var imgEl = qs("#mpImg-" + idx);
          if (imgEl) imgEl.src = reader.result;
          toast("프로필 사진을 바꿨어요", "🖼️");
          renderAll();
        };
        reader.readAsDataURL(file);
      });
    });
  }

  function exportData() {
    try {
      var blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "우리가족기록장-백업-" + todayKey() + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 600);
      toast("백업 파일을 내려드렸어요", "💾");
    } catch (e) {
      toast("내보내기 실패", "⚠️");
    }
  }

  function importData() {
    var inp = document.createElement("input");
    inp.type = "file";
    inp.accept = "application/json";
    inp.onchange = function () {
      var f = inp.files && inp.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        var parsed = null;
        try { parsed = JSON.parse(reader.result); } catch (e) { parsed = null; }
        if (!parsed) { toast("파일을 읽지 못했어요", "⚠️"); return; }
        state = normalizeState(parsed);
        persist(true);
        renderAll();
        toast("기록을 되살렸어요!", "✨");
      };
      reader.readAsText(f);
    };
    inp.click();
  }

  /* =========================================================
     렌더 / 이벤트
     ========================================================= */
  var CURRENT_TAB = "home";

  function switchTab(tab) {
    CURRENT_TAB = tab;
    qsa(".view").forEach(function (v) {
      v.classList.toggle("is-active", v.getAttribute("data-view") === tab);
    });
    qsa(".tab-btn").forEach(function (b) {
      var on = b.getAttribute("data-tab") === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (tab === "chat") renderChat();
    if (tab === "home") { renderHomeWeather(); fetchWeather(false); }
  }

  function renderAll() {
    renderHome();
    renderStudy();
    renderDex();
    renderMission();
    renderChat();
    renderStickerSheet();
    renderTodayLabel();
  }

  function renderTodayLabel() {
    var lbl = qs("#todayLabel");
    var key = todayKey();
    lbl.textContent = fmtDateKo(key) + " " + DOW_KO[dowOfKey(key)] + "요일";
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action]");
    if (!btn) return;
    var act = btn.getAttribute("data-action");
    var id = btn.getAttribute("data-id");
    var who = btn.getAttribute("data-who");

    switch (act) {
      case "tab": switchTab(btn.getAttribute("data-tab")); break;

      /* weather */
      case "refresh-weather": fetchWeather(true); toast("날씨를 새로 받아왔어요", "🌦️"); break;

      /* study */
      case "add-study": openStudyModal(null); break;
      case "edit-study":
        openStudyModal((state.study.items || []).find(function (x) { return x.id === id; }));
        break;
      case "delete-study": {
        var it = state.study.items.find(function (x) { return x.id === id; });
        if (!it) return;
        confirmModal("공부 삭제", "『" + it.name + "』을(를) 지울까요?", "삭제", function () {
          state.study.items = state.study.items.filter(function (x) { return x.id !== id; });
          persist(); renderAll();
        });
        break;
      }
      case "toggle-study": {
        var it2 = state.study.items.find(function (x) { return x.id === id; });
        if (!it2) return;
        it2.done = !it2.done;
        if (it2.done) {
          toast("『" + it2.name + "』 완료! 대단해요 🎉", "⭐");
          checkStudyCompletion();
        }
        persist(); renderAll();
        break;
      }
      case "start-study-timer": {
        var it3 = state.study.items.find(function (x) { return x.id === id; });
        if (!it3) return;
        if (it3.kind === "stopwatch") {
          timer.mode = "stopwatch";
          timer.elapsed = 0;
          timer.itemId = it3.id;
          startTimerInt();
        } else {
          timer.mode = "countdown";
          timer.remaining = (it3.minutes || 10) * 60;
          timer.itemId = it3.id;
          startTimerInt();
        }
        switchTab("study");
        updateTimerFace();
        toast("『" + it3.name + "』 타이머 시작!", "⏱");
        break;
      }
      case "timer-mode": {
        var mode = btn.getAttribute("data-mode");
        if (timer.mode === mode) return;
        stopTimerInt();
        timer.mode = mode;
        timer.remaining = 0;
        timer.elapsed = 0;
        timer.itemId = null;
        renderStudy();
        break;
      }
      case "preset": {
        if (timer.running) { toast("타이머가 도는 중엔 못 바꿔요", "⏳"); return; }
        var min = Number(btn.getAttribute("data-min"));
        timer.mode = "countdown";
        timer.remaining = min * 60;
        timer.presetMin = min;
        timer.itemId = null;
        renderStudy();
        break;
      }
      case "custom-min": {
        if (timer.running) { toast("타이머가 도는 중엔 못 바꿔요", "⏳"); return; }
        var v = Number(qs("#customMin").value);
        if (!v || v < 1) { toast("분을 넣어 주세요", "⏳"); return; }
        timer.mode = "countdown";
        timer.remaining = Math.min(180, v) * 60;
        timer.itemId = null;
        renderStudy();
        break;
      }
      case "timer-toggle":
        if (timer.running) { stopTimerInt(); updateTimerFace(); }
        else {
          if (timer.mode === "countdown" && timer.remaining <= 0) { toast("먼저 시간을 골라 주세요", "⏳"); return; }
          startTimerInt();
          updateTimerFace();
        }
        break;
      case "timer-reset":
        stopTimerInt();
        timer.remaining = 0;
        timer.elapsed = 0;
        timer.itemId = null;
        renderStudy();
        break;

      /* dex */
      case "dex-open": {
        var f = FAIRIES.find(function (x) { return x.id === id; });
        if (f) openDexDetail(f);
        break;
      }

      /* mission */
      case "mission-done": {
        if (state.mission.doneToday) return;
        state.mission.doneToday = true;
        state.mission.doneTotal += 1;
        addStamps(1, "가족 미션 『" + MISSION_POOL[state.mission.index % MISSION_POOL.length].text + "』 완료!");
        break;
      }
      case "mission-reroll": {
        if (state.mission.doneToday) return;
        var old = state.mission.index;
        var next = old;
        while (next === old) next = Math.floor(Math.random() * MISSION_POOL.length);
        state.mission.index = next;
        persist(); renderMission();
        break;
      }

      /* todos */
      case "add-todo": openAddTodo(who); break;
      case "toggle-todo": {
        var t = (state.todos[who] || []).find(function (x) { return x.id === id; });
        if (!t) return;
        t.done = !t.done;
        if (t.done && who === "dain" && t.done) {
          // 다인이의 할 일이 모두 끝나면 도장
          var list2 = state.todos.dain;
          if (list2.length && list2.every(function (x) { return x.done; })) {
            addStamps(1, memberName("dain") + "의 오늘 할 일을 모두 끝냈어요!");
          } else {
            toast("할 일 완료! 👏", "✅");
          }
        } else if (t.done) {
          toast("할 일 완료! 👏", "✅");
        }
        persist(); renderAll();
        break;
      }
      case "delete-todo": {
        state.todos[who] = (state.todos[who] || []).filter(function (x) { return x.id !== id; });
        persist(); renderMission();
        break;
      }

      /* chat */
      case "toggle-stickers": {
        var sheet = qs("#stickerSheet");
        sheet.hidden = !sheet.hidden;
        break;
      }
      case "send-sticker":
        sendChat({ kind: "sticker", img: btn.getAttribute("data-img"), label: btn.getAttribute("data-label") });
        qs("#stickerSheet").hidden = true;
        toast("스티커를 보냈어요", "🎀");
        break;
      case "heart": {
        var msg = (state.chat || []).find(function (m) { return m.id === id; });
        if (!msg) return;
        msg.heart = !msg.heart;
        persist(); renderChat();
        break;
      }
      case "start-voice": startVoice(); break;
      case "stop-voice": stopVoice(); break;
      case "cancel-voice": cancelVoice(); break;

      /* device / lock */
      case "open-device": closeModal(); renderGate(); break;
      case "pick-device": applyDevice(btn.getAttribute("data-id")); break;
      case "toggle-lock":
        if (meId) {
          confirmModal("기기 잠금", "이 기기를 잠그면 화면을 켤 때마다 프로필을 다시 골라요. 잠글까요?", "잠글래요", function () {
            lockDevice();
            toast("이 기기를 잠갔어요", "🔒");
          });
        } else {
          renderGate();
        }
        break;

      /* settings */
      case "open-settings": renderSettings(); break;
      case "reset-avatars":
        state.members.forEach(function (m) { m.photo = ""; });
        persist(); renderAll(); renderSettings();
        toast("기본 그림으로 되돌렸어요", "🧚");
        break;
      case "export-data": exportData(); break;
      case "import-data": importData(); break;
      case "reset-stamps":
        confirmModal("도장판 비우기", "모든 도장·배지·도감을 지우고 새로 시작해요. 계속할까요?", "비울래요", function () {
          state.stamps = {};
          state.badges = {};
          state.dex = { unlocked: {}, seen: {} };
          lastStampTotal = null;
          persist(); renderAll(); closeModal();
          toast("도장판을 새로 시작해요", "🌱");
        });
        break;

      case "close-modal": closeModal(); break;
    }
  });

  qs("#modalRoot").addEventListener("click", function (e) {
    if (e.target === qs("#modalRoot")) closeModal();
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !qs("#modalRoot").hidden) closeModal();
  });

  qs("#chatForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var input = qs("#chatInput");
    var text = input.value.trim();
    if (!text) return;
    sendChat({ kind: "text", text: text });
    input.value = "";
    qs("#stickerSheet").hidden = true;
  });

  /* ---------- 시작 ---------- */
  function boot() {
    store = Store.create(CFG);
    unsubStore = store.subscribe(function (payload, updatedAt) {
      // 다른 기기의 변경 반영 (내가 방금 저장한 것은 무시)
      if (!payload) return;
      if (state && payload.updatedAt === state.updatedAt) return;
      state = normalizeState(payload);
      renderAll();
    });

    store.load().then(function (rec) {
      state = normalizeState(rec ? rec.payload : null);
      // 도장 변화 추적용 초기화
      lastStampTotal = stampTotal();

      var saved = readDeviceLock();
      if (saved && memberById(saved)) {
        applyDevice(saved);
      } else {
        meId = null;
        renderGate();
        updateLockBtn();
        renderAll();
      }
      // 첫 렌더에서 날씨 카드 먼저 그려두기
      renderAll();
    });
  }

  boot();

})();
