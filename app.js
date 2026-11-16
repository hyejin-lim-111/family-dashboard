/* =========================================================
   우리 가족 기록장 — app.js
   홈(날씨) · 공부 플랜+타이머 · 도장판+요정 도감 · 가족 미션 · 할 일 · 가족 채팅
   ========================================================= */

(function () {
  "use strict";

  var CFG = window.FAMILY_CONFIG;
  var Store = window.FamilyStore;
  var GROWTH_LMS = window.GROWTH_LMS || null;

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
      img: "assets/fairy_star.png?v=20261116",
      desc: "반짝이는 별가루를 뿌리는 첫 친구예요. 다인이가 처음 도장을 받으면 나타나요.",
      personality: "씩씩하고 밝음",
      need: 1,
      how: "도장 1개"
    },
    {
      id: "f_flower",
      name: "꽃송이 요정",
      eng: "Flower",
      img: "assets/fairy_flower.png?v=20261116",
      desc: "데이지 화관을 쓴 소심한 친구. 열심히 노력하는 마음을 알아봐요.",
      personality: "수줍음 · 다정함",
      need: 3,
      how: "도장 3개"
    },
    {
      id: "f_berry",
      name: "딸기맛 요정",
      eng: "Berry",
      img: "assets/fairy_berry.png?v=20261116",
      desc: "새콤달콤한 딸기 냄새가 나요. 완성을 좋아하는 친구예요.",
      personality: "호기심 많음",
      need: 6,
      how: "도장 6개"
    },
    {
      id: "f_cloud",
      name: "구름솜 요정",
      eng: "Cloud",
      img: "assets/fairy_cloud.png?v=20261116",
      desc: "폭신한 구름을 키우는 친구. 포근한 마음으로 하루를 마무리하게 도와줘요.",
      personality: "느긋함 · 포근함",
      need: 10,
      how: "도장 10개"
    },
    {
      id: "f_moon",
      name: "자장가 요정",
      eng: "Moon",
      img: "assets/fairy_moon.png?v=20261116",
      desc: "달베개를 안고 잠자리를 지켜 주는 친구. 밤에 쌓인 기록도 소중하다고 말해요.",
      personality: "차분함 · 사랑스러움",
      need: 15,
      how: "도장 15개"
    },
    {
      id: "f_forest",
      name: "도토리 요정",
      eng: "Forest",
      img: "assets/fairy_forest.png?v=20261116",
      desc: "도토리 모자를 쓴 호기심 왕. 매일 조금씩 쌓는 습관을 응원해요.",
      personality: "호기심 · 성실함",
      need: 21,
      how: "도장 21개"
    },
    {
      id: "f_ocean",
      name: "물방울 요정",
      eng: "Ocean",
      img: "assets/fairy_ocean.png?v=20261116",
      desc: "반짝이는 물방울을 타고 다니는 친구. 마음이 넓고 깊어요.",
      personality: "차분함 · 넓은 마음",
      need: 28,
      how: "도장 28개"
    },
    {
      id: "f_rainbow",
      name: "무지개 요정",
      eng: "Rainbow",
      img: "assets/fairy_rainbow.png?v=20261116",
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
    { id: "st_star",   label: "별별",     img: "assets/fairy_star.png?v=20261116" },
    { id: "st_flower", label: "꽃송이",   img: "assets/fairy_flower.png?v=20261116" },
    { id: "st_cloud",  label: "구름솜",   img: "assets/fairy_cloud.png?v=20261116" },
    { id: "st_berry",  label: "딸기맛",   img: "assets/fairy_berry.png?v=20261116" },
    { id: "st_rainbow", label: "무지개",  img: "assets/fairy_rainbow.png?v=20261116" }
  ];

  /* ---------- 다인이 말판 (키보드 없이 한 번에 보내는 기본 메시지) ---------- */
  var QUICK_MESSAGES = [
    { id: "q-wake",  emoji: "🌞", label: "잘 잤어요" },
    { id: "q-poop",  emoji: "💩", label: "응가 했어요" },
    { id: "q-come",  emoji: "🏠", label: "빨리 오세요" },
    { id: "q-where", emoji: "📍", label: "어디에요?" },
    { id: "q-love",  emoji: "😍", label: "사랑해요" },
    { id: "q-miss",  emoji: "🥺", label: "보고 싶어요" },
    { id: "q-snack", emoji: "🍪", label: "과자 먹고 싶어요" },
    { id: "q-night", emoji: "🌙", label: "안녕히 주무세요" },
    { id: "q-tv",    emoji: "📺", label: "TV 봐도 돼요?" },
    { id: "q-home",  emoji: "📚", label: "숙제 다 했어요" },
    { id: "q-sick",  emoji: "🩹", label: "아파요" },
    { id: "q-call",  emoji: "📞", label: "전화해 주세요" },
    { id: "q-help",  emoji: "🙋", label: "도와주세요" },
    { id: "q-school", emoji: "🏫", label: "유치원 갔다올게요" }
  ];

  var DOW_KO = ["일", "월", "화", "수", "목", "금", "토"];
  var DEFAULT_NAMES = { dain: "다인이", mom: "엄마", dad: "아빠" };

  var EVENT_WHO = [
    { id: "all",  label: "가족 모두", emoji: "🏡" },
    { id: "dain", label: "다인이",    emoji: "🎀" },
    { id: "mom",  label: "엄마",      emoji: "💐" },
    { id: "dad",  label: "아빠",      emoji: "🧢" }
  ];

  var LIST_PRESETS = [
    { emoji: "🛒", title: "장보기" },
    { emoji: "🎒", title: "준비물" },
    { emoji: "🚗", title: "외출 준비물" },
    { emoji: "🧳", title: "여행 챙길 것" },
    { emoji: "🍳", title: "이번 주 집안일" }
  ];

  var DEFAULT_LISTS = [
    { emoji: "🛒", title: "장보기" },
    { emoji: "🎒", title: "외출 준비물" }
  ];

  /* ---------- 다인이 저녁 루틴 · 용돈 ---------- */
  var ROUTINE_PER_ITEM = 100;      // 항목 하나 완료할 때마다 100원
  var ROUTINE_ALL_BONUS = 500;     // 그날 항목을 모두 완료하면 보너스 500원
  var DEFAULT_ROUTINE_ITEMS = [
    { id: "r-bath",     name: "목욕하기" },
    { id: "r-homework", name: "숙제하기" },
    { id: "r-meal",     name: "밥먹기" },
    { id: "r-brush",    name: "양치하기" }
  ];

  /* ---------- 홈 태블릿 타이머 ---------- */
  var TABLET_PRESETS = [10, 20, 30, 60];

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
  /* ---------- 달력 날짜 도구 ---------- */
  function keyOfParts(y, m, d) { return y + "-" + pad2(m + 1) + "-" + pad2(d); }

  function splitKey(key) {
    var p = String(key || "").split("-");
    return { y: Number(p[0]), m: Number(p[1]) - 1, d: Number(p[2]) };
  }

  function isDateKey(key) { return /^\d{4}-\d{2}-\d{2}$/.test(String(key || "")); }

  // 일요일 시작 방식으로 6주(42칸) 달력 칸을 만든다
  function monthCells(y, m) {
    var lead = new Date(Date.UTC(y, m, 1)).getUTCDay();
    var startMs = Date.UTC(y, m, 1) - lead * DAY_MS;
    var cells = [];
    for (var i = 0; i < 42; i++) {
      var dt = new Date(startMs + i * DAY_MS);
      cells.push({
        key: keyOfParts(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()),
        day: dt.getUTCDate(),
        inMonth: dt.getUTCMonth() === m && dt.getUTCFullYear() === y,
        dow: i % 7
      });
    }
    return cells;
  }

  function fmtTime12(t) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(t || ""));
    if (!m) return "";
    var h = Number(m[1]);
    var ampm = h < 12 ? "오전" : "오후";
    var hh = h % 12; if (hh === 0) hh = 12;
    return ampm + " " + hh + ":" + m[2];
  }

  function fmtDayLabel(key) {
    var p = splitKey(key);
    if (!p.y || !p.d) return "";
    return (p.m + 1) + "월 " + p.d + "일 " + DOW_KO[dowOfKey(key)] + "요일";
  }

  function whoInfo(id) {
    return EVENT_WHO.find(function (w) { return w.id === id; }) || EVENT_WHO[0];
  }

  function defaultLists() {
    return DEFAULT_LISTS.map(function (p) {
      return { id: uid("cl"), emoji: p.emoji, title: p.title, items: [], by: "", createdAt: new Date().toISOString() };
    });
  }

  // 옛 기록(달력·체크리스트 필드 없음)도 안전하게 읽어 들인다
  function normalizeEvents(list) {
    return (Array.isArray(list) ? list : []).filter(function (ev) {
      return ev && ev.id && isDateKey(ev.date);
    }).map(function (ev) {
      var time = /^\d{1,2}:\d{2}$/.test(String(ev.time || "")) ? String(ev.time) : "";
      return {
        id: ev.id,
        date: ev.date,
        title: String(ev.title == null ? "" : ev.title).slice(0, 40) || "(제목 없음)",
        allDay: ev.allDay === undefined ? !time : !!ev.allDay,
        time: time,
        who: EVENT_WHO.some(function (w) { return w.id === ev.who; }) ? ev.who : "all",
        by: ev.by || "",
        note: String(ev.note == null ? "" : ev.note).slice(0, 60),
        createdAt: ev.createdAt || "",
        updatedAt: ev.updatedAt || ""
      };
    });
  }

  function normalizeLists(list) {
    return (Array.isArray(list) ? list : []).filter(function (l) {
      return l && l.id && l.title;
    }).map(function (l) {
      return {
        id: l.id,
        emoji: l.emoji || "📝",
        title: String(l.title).slice(0, 20),
        by: l.by || "",
        createdAt: l.createdAt || "",
        items: (Array.isArray(l.items) ? l.items : []).filter(function (it) {
          return it && it.id && String(it.text || "").trim();
        }).map(function (it) {
          return {
            id: it.id,
            text: String(it.text).slice(0, 40),
            done: !!it.done,
            doneAt: it.doneAt || "",
            by: it.by || "",
            createdAt: it.createdAt || ""
          };
        })
      };
    });
  }

  function fmtWon(n) {
    var v = Math.round(Number(n) || 0);
    var sign = v < 0 ? "-" : "";
    var s = String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return sign + s + "원";
  }

  // 저녁 루틴 기록(항목 목록 + 날짜별 체크)을 안전하게 다듬는다
  function normalizeRoutine(raw) {
    var out = { items: [], days: {}, spent: 0 };
    var src = (raw && typeof raw === "object") ? raw : null;
    if (!src || !Array.isArray(src.items)) {
      // 항목 정보가 아예 없던 기록 → 샘플 4개로 시작
      out.items = JSON.parse(JSON.stringify(DEFAULT_ROUTINE_ITEMS));
    } else {
      out.items = src.items.filter(function (it) {
        return it && it.id && String(it.name || "").trim();
      }).map(function (it) {
        return { id: String(it.id), name: String(it.name).trim().slice(0, 30) };
      });
    }
    var days = (src && src.days && typeof src.days === "object") ? src.days : {};
    Object.keys(days).forEach(function (k) {
      if (!isDateKey(k)) return;
      var rec = days[k] || {};
      var srcChecked = (rec.checked && typeof rec.checked === "object") ? rec.checked : {};
      var checked = {};
      Object.keys(srcChecked).forEach(function (id) {
        if (srcChecked[id]) checked[String(id)] = true;
      });
      out.days[k] = { checked: checked };
    });
    out.spent = Math.max(0, Math.round(Number(src && src.spent) || 0));
    return out;
  }

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

  /* =========================================================
     다인이 키·몸무게 (2017 소아청소년 성장도표 여아)
     ========================================================= */
  var GROWTH_BIRTH = "2021-02-16";       // 다인이 생일
  var GROWTH_LABEL = "다인이";
  var GROWTH_PCTS = [3, 10, 25, 50, 75, 90, 97];
  var GROWTH_Z = { 3: -1.880794, 10: -1.281552, 25: -0.674490, 50: 0, 75: 0.674490, 90: 1.281552, 97: 1.880794 };

  function dateParts(key) {
    var p = String(key || "").split("-");
    return { y: Number(p[0]), m: Number(p[1]), d: Number(p[2]) };
  }

  function dayNumber(key) {
    var p = dateParts(key);
    if (!p.y || !p.m || !p.d) return NaN;
    return Date.UTC(p.y, p.m - 1, p.d) / 86400000;
  }

  // 생일~기준일 만 개월 (기준일의 일이 생일의 일보다 작으면 1개월을 뺀다)
  function monthsBetween(birthKey, refKey) {
    var b = dateParts(birthKey), r = dateParts(refKey);
    if (!b.y || !r.y) return 0;
    var m = (r.y - b.y) * 12 + (r.m - b.m) - (r.d < b.d ? 1 : 0);
    return Math.max(0, m);
  }

  function ageText(months) {
    var y = Math.floor(months / 12), m = months % 12;
    return "만 " + y + "살" + (m ? " " + m + "개월" : "");
  }

  // 출생일을 1일째로 센다 (2021-02-16 → 1일째). D+는 출생일을 0으로 센다.
  function bornDays(birthKey, refKey) {
    var diff = dayNumber(refKey) - dayNumber(birthKey);
    if (isNaN(diff)) return 1;
    return Math.floor(diff) + 1;
  }

  function nextBirthdayInfo(birthKey, refKey) {
    var b = dateParts(birthKey), r = dateParts(refKey);
    var thisYear = Date.UTC(r.y, b.m - 1, b.d) / 86400000;
    var today = dayNumber(refKey);
    var target = thisYear >= today ? thisYear : Date.UTC(r.y + 1, b.m - 1, b.d) / 86400000;
    var left = Math.round(target - today);
    var age = (r.y + (thisYear >= today ? 0 : 1)) - b.y;
    return { days: left, age: age };
  }

  function fmtComma(n) {
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // 표준정규분포 누적확률 (Abramowitz & Stegun 7.1.26)
  function normCdf(z) {
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989423 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z >= 0 ? 1 - p : p;
  }

  function lmsAt(metric, month) {
    if (!GROWTH_LMS || !GROWTH_LMS[metric]) return null;
    var m = Math.max(GROWTH_LMS.fromMonth, Math.min(GROWTH_LMS.toMonth, Math.round(month)));
    return GROWTH_LMS[metric][String(m)] || null;
  }

  // 백분위 → 값(cm 또는 kg)
  function valueAtPct(lms, pct) {
    if (!lms) return NaN;
    var L = lms[0], M = lms[1], S = lms[2];
    var z = GROWTH_Z[pct] == null ? 0 : GROWTH_Z[pct];
    if (!z) return M;
    if (L === 0) return M * Math.exp(S * z);
    return M * Math.pow(1 + L * S * z, 1 / L);
  }

  // 측정값 → 백분위 (0.1 ~ 99.9)
  function pctOfValue(lms, value) {
    if (!lms || !isFinite(value) || value <= 0) return NaN;
    var L = lms[0], M = lms[1], S = lms[2];
    var z = L === 0 ? Math.log(value / M) / S : (Math.pow(value / M, L) - 1) / (L * S);
    var p = normCdf(z) * 100;
    return Math.max(0.1, Math.min(99.9, p));
  }

  function pctText(p) {
    if (!isFinite(p)) return "-";
    return (p >= 99.9 ? "99.9" : p <= 0.1 ? "0.1" : String(Math.round(p)));
  }

  function growthMonthOf(dateKey, birthKey) {
    return monthsBetween(birthKey || GROWTH_BIRTH, dateKey);
  }

  function normalizeGrowth(raw) {
    var g = raw && typeof raw === "object" ? raw : {};
    var records = Array.isArray(g.records) ? g.records : [];
    var out = {
      birthDate: isDateKey(g.birthDate) ? g.birthDate : GROWTH_BIRTH,
      sex: "F",
      records: []
    };
    records.forEach(function (r) {
      if (!r || !isDateKey(r.date)) return;
      var h = Number(r.height), w = Number(r.weight);
      if (!(h > 0) && !(w > 0)) return;
      out.records.push({
        id: r.id || uid("g"),
        date: r.date,
        height: h > 0 ? Math.round(h * 10) / 10 : 0,
        weight: w > 0 ? Math.round(w * 10) / 10 : 0
      });
    });
    out.records.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    return out;
  }

  function growthRecords() {
    if (!state.growth) state.growth = normalizeGrowth(null);
    if (!Array.isArray(state.growth.records)) state.growth.records = [];
    return state.growth.records;
  }

  function growthRecordById(id) {
    return growthRecords().find(function (r) { return r.id === id; }) || null;
  }

  // 가장 최근(날짜가 늦은) 기록과 그 앞 기록
  function latestGrowth() {
    var list = growthRecords().slice().sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
    if (!list.length) return { latest: null, prev: null };
    return { latest: list[list.length - 1], prev: list.length > 1 ? list[list.length - 2] : null };
  }

  function growthPctOf(record, metric) {
    if (!record) return NaN;
    var lms = lmsAt(metric, growthMonthOf(record.date));
    return pctOfValue(lms, metric === "height" ? record.height : record.weight);
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
      calendar: { events: [] },          // 가족 공유 달력 일정
      checklists: { lists: defaultLists() }, // 가족 공유 체크리스트
      routine: {                          // 다인이 저녁 루틴 + 용돈
        items: JSON.parse(JSON.stringify(DEFAULT_ROUTINE_ITEMS)),
        days: {},                         // "YYYY-MM-DD": { checked: { itemId: true } }
        spent: 0                          // 부모님이 쓴(차감한) 용돈
      },
      growth: normalizeGrowth(null),        // 다인이 키·몸무게 성장 기록
      settings: { weatherCache: null, notify: false }
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
    if (!s.calendar || typeof s.calendar !== "object") { s.calendar = { events: [] }; changed = true; }
    if (!Array.isArray(s.calendar.events)) { s.calendar.events = []; changed = true; }
    if (!s.checklists || typeof s.checklists !== "object" || !Array.isArray(s.checklists.lists)) {
      s.checklists = { lists: defaultLists() };
      changed = true;
    }
    if (!s.chat) { s.chat = []; changed = true; }
    if (!s.routine || typeof s.routine !== "object") { s.routine = normalizeRoutine(null); changed = true; }
    if (!s.growth || typeof s.growth !== "object") { s.growth = normalizeGrowth(null); changed = true; }
    if (!s.settings || typeof s.settings !== "object") { s.settings = { weatherCache: null, notify: false }; changed = true; }
    if (s.settings.notify === undefined) { s.settings.notify = false; changed = true; }
    if (!s.members || !s.members.length) { s.members = JSON.parse(JSON.stringify(CFG.defaultMembers)); changed = true; }
    return changed;
  }

  function normalizeState(raw) {
    var s = raw && typeof raw === "object" ? raw : null;
    if (!s) s = freshState();
    // 알려진 필드만 유지 (이상한 데이터 방어)
    var out = freshState();
    ["members", "study", "stamps", "badges", "dex", "mission", "todos", "chat", "calendar", "checklists", "routine", "growth", "settings"].forEach(function (k) {
      if (s[k] !== undefined) out[k] = s[k];
    });
    rollDailyState(out);
    out.calendar.events = normalizeEvents(out.calendar.events);
    out.checklists.lists = normalizeLists(out.checklists.lists);
    out.routine = normalizeRoutine(out.routine);
    out.growth = normalizeGrowth(out.growth);
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

  /* ---------- 저녁 루틴 · 용돈 100원 / 보너스 500원 ---------- */
  function routineItems() { return (state.routine && state.routine.items) || []; }

  function routineDay(dateKey) {
    if (!state.routine) state.routine = normalizeRoutine(null);
    if (!state.routine.days) state.routine.days = {};
    var key = dateKey || todayKey();
    if (!state.routine.days[key] || typeof state.routine.days[key] !== "object") {
      state.routine.days[key] = { checked: {} };
    }
    if (!state.routine.days[key].checked || typeof state.routine.days[key].checked !== "object") {
      state.routine.days[key].checked = {};
    }
    return state.routine.days[key];
  }

  // 어떤 날짜든 [그 날 체크한 항목] × 100원 + (그날 항목을 모두 완료했으면) 500원
  // → 체크를 풀면 그 항목 금액과 보너스가 함께 사라지고, 다시 다 하면 다시 붙는다. 하루 최대 보너스 1회.
  function routineStats(dateKey) {
    var items = routineItems();
    var checked = routineDay(dateKey).checked;
    var done = 0;
    items.forEach(function (it) { if (checked[it.id]) done += 1; });
    var allDone = items.length > 0 && done === items.length;
    return {
      done: done,
      total: items.length,
      allDone: allDone,
      earned: done * ROUTINE_PER_ITEM + (allDone ? ROUTINE_ALL_BONUS : 0)
    };
  }

  function routineEarned() {
    var days = (state.routine && state.routine.days) || {};
    var sum = 0;
    Object.keys(days).forEach(function (k) {
      if (!isDateKey(k)) return;
      sum += routineStats(k).earned;
    });
    return sum;
  }

  function routineSpent() {
    return Math.max(0, Math.round(Number(state.routine && state.routine.spent) || 0));
  }

  function routineTotal() {
    return Math.max(0, routineEarned() - routineSpent());
  }

  function routineByName(id) {
    var it = routineItems().find(function (x) { return x.id === id; });
    return it ? it.name : "";
  }

  function toggleRoutineItem(id) {
    if (!routineByName(id)) return;
    var rec = routineDay(todayKey());
    if (rec.checked[id]) delete rec.checked[id];
    else rec.checked[id] = true;
    var st = routineStats(todayKey());
    persist(true);
    renderAll();
    if (rec.checked[id] && st.allDone) {
      toast("저녁 루틴 모두 완료! +" + fmtWon(st.earned) + " (보너스 " + fmtWon(ROUTINE_ALL_BONUS) + " 포함)", "🎉");
    } else if (rec.checked[id]) {
      toast("『" + routineByName(id) + "』 +" + fmtWon(ROUTINE_PER_ITEM), "💰");
    } else if (st.allDone) {
      toast("체크를 풀었어요 — 오늘 " + fmtWon(st.earned), "↩️");
    } else {
      toast("체크를 풀었어요 — 오늘 " + fmtWon(st.earned), "↩️");
    }
  }

  function addRoutineItem(name) {
    var t = String(name || "").trim();
    if (!t) { toast("루틴 항목을 적어 주세요", "🌙"); return false; }
    var items = routineItems();
    if (items.some(function (x) { return x.name === t; })) { toast("이미 있는 항목이에요", "🌙"); return false; }
    if (items.length >= 12) { toast("항목은 12개까지 넣을 수 있어요", "🌙"); return false; }
    state.routine.items.push({ id: uid("r"), name: t.slice(0, 30) });
    persist(true);
    renderAll();
    toast("『" + t.slice(0, 30) + "』 추가했어요", "🌙");
    return true;
  }

  function deleteRoutineItem(id) {
    var name = routineByName(id);
    if (!name) return;
    confirmModal("루틴 항목 삭제", "『" + name + "』을(를) 저녁 루틴에서 지울까요? 지금까지 모은 용돈은 그대로예요.", "삭제", function () {
      state.routine.items = routineItems().filter(function (x) { return x.id !== id; });
      // 지운 항목의 체크도 오늘 기록에서 정리 (금액은 자동으로 다시 계산돼요)
      Object.keys(state.routine.days || {}).forEach(function (k) {
        if (state.routine.days[k] && state.routine.days[k].checked) delete state.routine.days[k].checked[id];
      });
      persist(true);
      renderAll();
      toast("『" + name + "』을(를) 지웠어요", "🌙");
    });
  }

  function openSpendAllowance() {
    var total = routineTotal();
    openModal(
      '<p class="muted" style="font-size:12.5px">지금까지 모은 용돈 <b style="color:#C2557C">' + fmtWon(routineTotal()) + '</b>' +
        (routineSpent() ? ' · 지금까지 쓴 용돈 ' + fmtWon(routineSpent()) : '') + '</p>' +
      '<div class="field"><label for="spendAmount">쓴(뺄) 금액</label>' +
        '<input type="number" id="spendAmount" min="100" step="100" max="' + Math.max(100, total) + '" placeholder="예: 1000"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" type="button" data-action="close-modal">취소</button>' +
        '<button class="btn btn-primary" type="button" id="spendOkBtn">차감하기</button>' +
      '</div>',
      { title: "다인이 용돈 쓰기" }
    );
    qs("#spendOkBtn").addEventListener("click", function () {
      var v = Math.round(Number(qs("#spendAmount").value) || 0);
      if (v <= 0) { toast("금액을 넣어 주세요", "💰"); return; }
      var left = routineTotal();
      if (v > left) { toast("모은 용돈(" + fmtWon(left) + ")보다 많아요", "💰"); return; }
      state.routine.spent = routineSpent() + v;
      closeModal();
      persist(true);
      renderAll();
      toast(fmtWon(v) + " 썼어요 — 남은 용돈 " + fmtWon(routineTotal()), "💰");
    });
  }

  function resetAllowance() {
    confirmModal("용돈 기록 초기화", "모은 용돈과 날짜별 루틴 기록을 모두 지우고 0원부터 다시 시작해요. 루틴 항목 목록은 그대로 둘게요. 계속할까요?", "초기화", function () {
      state.routine.days = {};
      state.routine.spent = 0;
      persist(true);
      renderAll();
      toast("용돈을 0원부터 다시 모아요", "🌱");
    });
  }

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
    box.className = "modal" + (opts.center ? " center" : "") + (opts.cls ? " " + opts.cls : "");
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

  /* =========================================================
     홈 — 큰 시계 + 태블릿 끄기 타이머
     ========================================================= */
  var tabletTimer = { total: 0, remaining: 0, running: false, started: false, endAt: 0, intId: null, ringing: false, presetMin: 0 };
  var audioCtx = null;

  function setTextById(id, text) {
    var node = qs("#" + id);
    if (node && node.textContent !== text) node.textContent = text;
  }

  function tickClock() {
    var now = new Date();
    var h = now.getHours();
    var hh = h % 12; if (hh === 0) hh = 12;
    var key = todayKey(now);
    setTextById("bigClockAmpm", h < 12 ? "오전" : "오후");
    setTextById("bigClock", pad2(hh) + ":" + pad2(now.getMinutes()) + ":" + pad2(now.getSeconds()));
    setTextById("bigClockDate", fmtDateKo(key) + " " + DOW_KO[dowOfKey(key)] + "요일");
  }

  function ensureAudio() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume();
      return audioCtx;
    } catch (e) { return null; }
  }

  // 부드러운 알람음 세 번 (무음이 불가능해도 화면으로 알림)
  function playAlarmChime(times) {
    var ctx = ensureAudio();
    if (!ctx) return;
    try {
      var base = ctx.currentTime;
      var rounds = times || 3;
      for (var r = 0; r < rounds; r++) {
        [880, 1174.66].forEach(function (f, i) {
          var o = ctx.createOscillator();
          var g = ctx.createGain();
          o.type = "sine";
          o.frequency.value = f;
          o.connect(g); g.connect(ctx.destination);
          var t0 = base + r * 1.05 + i * 0.24;
          g.gain.setValueAtTime(0.0001, t0);
          g.gain.exponentialRampToValueAtTime(0.20, t0 + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.60);
          o.start(t0); o.stop(t0 + 0.65);
        });
      }
    } catch (e) { /* 소리는 선택 */ }
  }

  function tabletToggleLabel() {
    if (tabletTimer.running) return "⏸ 일시정지";
    if (tabletTimer.started && tabletTimer.remaining > 0) return "▶ 이어서";
    return "▶ 시작";
  }

  function tabletTimerSubText() {
    if (tabletTimer.ringing) return "알람이 울리는 중이에요";
    if (tabletTimer.running) return "태블릿을 끌 준비를 해요…";
    if (tabletTimer.started && tabletTimer.remaining > 0) return "잠깐 멈췄어요 — 이어서 눌러요";
    if (tabletTimer.remaining > 0) return "준비됐어요 — 시작을 눌러요";
    return "10 · 20 · 30 · 60분 또는 직접 입력";
  }

  function paintTabletTimer() {
    var label = mmss(tabletTimer.remaining);
    var warn = tabletTimer.running && tabletTimer.remaining <= 10;

    // 홈의 컴팩트 카드
    var face = qs("#tabTimerFace");
    if (face) {
      face.textContent = label;
      face.classList.toggle("is-warn", warn);
    }
    setTextById("tabTimerSub", tabletTimerSubText());
    var card = qs("#tabletTimerCard");
    if (card) {
      card.classList.toggle("is-running", tabletTimer.running);
      var live = qs(".tbl-live", card);
      if (live) live.classList.toggle("is-on", tabletTimer.running);
    }

    // 크게 보기(확대 타이머)가 열려 있으면 그 숫자도 같이
    var expFace = qs("#expTimerFace");
    if (expFace) {
      expFace.textContent = label;
      expFace.classList.toggle("is-warn", warn);
    }
    setTextById("expTimerSub", tabletTimerSubText());

    var toggle = qs("#tabTimerToggle");
    if (toggle) toggle.textContent = tabletToggleLabel();
    qsa(".tbl-preset").forEach(function (b) {
      var on = !tabletTimer.running && tabletTimer.remaining > 0 &&
        Number(b.getAttribute("data-min")) * 60 === tabletTimer.remaining;
      b.classList.toggle("is-active", on);
    });
  }

  function stopTabletInt() {
    if (tabletTimer.intId) { clearInterval(tabletTimer.intId); tabletTimer.intId = null; }
  }

  function startTabletInt() {
    stopTabletInt();
    tabletTimer.intId = setInterval(function () {
      var left = Math.max(0, Math.round((tabletTimer.endAt - Date.now()) / 1000));
      tabletTimer.remaining = left;
      if (left <= 0) {
        stopTabletInt();
        tabletTimer.running = false;
        onTabletFinish();
        return;
      }
      paintTabletTimer();
    }, 250);
  }

  function startTabletTimer() {
    if (tabletTimer.running) return;
    if (tabletTimer.remaining <= 0) { toast("먼저 시간을 골라 주세요", "⏰"); return; }
    tabletTimer.ringing = false;
    tabletTimer.started = true;
    tabletTimer.endAt = Date.now() + tabletTimer.remaining * 1000;
    tabletTimer.running = true;
    ensureAudio();          // 사용자가 누를 때 미리 준비해 둬야 알람음이 나와요
    startTabletInt();
    paintTabletTimer();
  }

  function pauseTabletTimer() {
    if (!tabletTimer.running) return;
    tabletTimer.remaining = Math.max(0, Math.round((tabletTimer.endAt - Date.now()) / 1000));
    stopTabletInt();
    tabletTimer.running = false;
    paintTabletTimer();
  }

  function resetTabletTimer() {
    stopTabletInt();
    tabletTimer.running = false;
    tabletTimer.ringing = false;
    tabletTimer.started = false;
    tabletTimer.remaining = 0;
    tabletTimer.total = 0;
    tableTimerHideAlarm();
    renderHome();
  }

  function setTabletPreset(min) {
    if (tabletTimer.running) { toast("타이머가 도는 중엔 못 바꿔요", "⏳"); return; }
    var m = Math.max(1, Math.min(180, Number(min) || 0));
    tabletTimer.remaining = m * 60;
    tabletTimer.total = m * 60;
    tabletTimer.presetMin = m;
    tabletTimer.ringing = false;
    tabletTimer.started = false;
    tableTimerHideAlarm();
    paintTabletTimer();
  }

  function onTabletFinish() {
    tabletTimer.remaining = 0;
    tabletTimer.ringing = true;
    paintTabletTimer();
    // 확대 타이머(또는 다른 모달)가 열려 있으면 알람이 가려지지 않게 닫고 띄운다
    if (!qs("#modalRoot").hidden) closeModal();
    tableTimerShowAlarm();
    playAlarmChime(3);
    try { if (navigator.vibrate) navigator.vibrate([200, 120, 200, 120, 400]); } catch (e) { /* 무시 */ }
  }

  function tableTimerShowAlarm() {
    var overlay = qs("#alarmOverlay");
    if (!overlay) return;
    overlay.hidden = false;
    document.body.classList.add("alarm-on");
    var btn = qs("#alarmOkBtn");
    if (btn) { try { btn.focus(); } catch (e) { /* 무시 */ } }
  }

  function tableTimerHideAlarm() {
    var overlay = qs("#alarmOverlay");
    if (overlay) overlay.hidden = true;
    document.body.classList.remove("alarm-on");
  }

  function dismissAlarm() {
    tableTimerHideAlarm();
    tabletTimer.ringing = false;
    tabletTimer.started = false;
    tabletTimer.remaining = 0;
    tabletTimer.total = 0;
    renderHome();
  }

  function buildClockCard() {
    return '<div class="card clock-card" id="homeClockCard">' +
        '<div class="clock-head"><span aria-hidden="true">⏰</span> 시간</div>' +
        '<div class="clock-main">' +
          '<div class="clock-ampm" id="bigClockAmpm">오전</div>' +
          '<div class="clock-time" id="bigClock">--:--:--</div>' +
        '</div>' +
        '<div class="clock-date" id="bigClockDate"></div>' +
      '</div>';
  }

  function buildAllowanceCard() {
    var st = routineStats(todayKey());
    var pct = st.total ? Math.round(st.done / st.total * 100) : 0;
    return '<div class="card allowance-card" id="allowanceCard">' +
        '<button class="allowance-main" type="button" data-action="open-routine" aria-label="미션 탭의 다인이 저녁 루틴으로 가기">' +
          '<span class="allowance-ico" aria-hidden="true">💰</span>' +
          '<span class="allowance-body">' +
            '<span class="allowance-label">다인이 모은 용돈</span>' +
            '<span class="allowance-total" id="allowanceTotal">' + esc(fmtWon(routineTotal())) + '</span>' +
            '<span class="allowance-today" id="allowanceToday">' +
              (st.total ? st.done + ' / ' + st.total + ' 완료 · 오늘 +' + fmtWon(st.earned) : '루틴 항목을 넣어 주세요') +
            '</span>' +
          '</span>' +
          '<span class="allowance-go" aria-hidden="true">›</span>' +
        '</button>' +
        '<div class="progress" style="margin-top:12px"><i style="width:' + pct + '%"></i></div>' +
        '<p class="allowance-hint">항목당 +' + fmtWon(ROUTINE_PER_ITEM) + ' · 모두 완료 시 보너스 +' + fmtWon(ROUTINE_ALL_BONUS) + '!</p>' +
      '</div>';
  }

  // 가운데 카드: 평소엔 한 줄 높이의 컴팩트 타이머 — 누르면 확대 타이머가 열린다
  function buildTimerCard() {
    var warn = tabletTimer.running && tabletTimer.remaining <= 10;
    return '<button class="card tbl-card' + (tabletTimer.running ? ' is-running' : '') + '" type="button"' +
        ' id="tabletTimerCard" data-action="open-timer" aria-label="태블릿 끄기 타이머 — 눌러서 크게 보기">' +
        '<span class="tbl-card-head">' +
          '<span class="tbl-card-title">⏱️ 태블릿 끄기</span>' +
          '<span class="tbl-live' + (tabletTimer.running ? ' is-on' : '') + '" aria-hidden="true"></span>' +
        '</span>' +
        '<span class="tbl-card-face' + (warn ? ' is-warn' : '') + '" id="tabTimerFace">' + mmss(tabletTimer.remaining) + '</span>' +
        '<span class="tbl-card-sub" id="tabTimerSub">' + esc(tabletTimerSubText()) + '</span>' +
        '<span class="tbl-card-cta">눌러서 설정 · 크게 보기 ⤢</span>' +
      '</button>';
  }

  // 확대 타이머 — 큰 숫자 · 빠른 시간 · 직접 입력 · 시작/일시정지/초기화
  function timerExpandHtml() {
    var warn = tabletTimer.running && tabletTimer.remaining <= 10;
    return '<div class="te-wrap">' +
        '<div class="te-face-box">' +
          '<div class="te-face' + (warn ? ' is-warn' : '') + '" id="expTimerFace">' + mmss(tabletTimer.remaining) + '</div>' +
          '<div class="te-sub" id="expTimerSub">' + esc(tabletTimerSubText()) + '</div>' +
        '</div>' +
        '<div class="te-presets">' +
          TABLET_PRESETS.map(function (m) {
            return '<button class="tbl-preset' +
              (!tabletTimer.running && tabletTimer.remaining === m * 60 ? " is-active" : "") +
              '" type="button" data-action="tab-timer-preset" data-min="' + m + '">' + m + '분</button>';
          }).join("") +
        '</div>' +
        '<div class="te-custom">' +
          '<input type="number" id="tabTimerMin" min="1" max="180" placeholder="직접 입력(분)" aria-label="직접 입력(분)">' +
          '<button class="btn btn-soft" type="button" data-action="tab-timer-custom">설정</button>' +
        '</div>' +
        '<div class="te-btns">' +
          '<button class="btn btn-purple te-toggle" type="button" data-action="tab-timer-toggle" id="tabTimerToggle">' +
            tabletToggleLabel() + '</button>' +
          '<button class="btn btn-ghost te-reset" type="button" data-action="tab-timer-reset">↺ 초기화</button>' +
        '</div>' +
        '<p class="te-hint">00:00이 되면 화면 가득 알람이 울려요</p>' +
      '</div>';
  }

  function openTimerExpand() {
    openModal(timerExpandHtml(), { title: "⏱️ 태블릿 끄기 타이머", center: true, cls: "timer-expand" });
  }

  function buildHomeTopRow() {
    var row = el("div", "span-2 home-top");
    row.innerHTML = buildClockCard() + buildAllowanceCard() + buildTimerCard();
    return row;
  }

  // 🎂 다인이 태어난 지 며칠째인지 (출생일을 1일째로 센다)
  function homeBornBannerHtml() {
    var birth = (state.growth && state.growth.birthDate) || GROWTH_BIRTH;
    var today = todayKey();
    var days = bornDays(birth, today);
    var months = monthsBetween(birth, today);
    var nb = nextBirthdayInfo(birth, today);
    var left = nb.days === 0 ? "오늘 생일! 🎉" : "생일까지 " + nb.days + "일";
    return '<div class="born-banner">' +
      '<span class="bb-emoji" aria-hidden="true">🎂</span>' +
      '<span class="bb-main"><b>' + esc(GROWTH_LABEL) + ' 태어난 지 ' + fmtComma(days) + '일째</b>' +
        '<span class="bb-sub">' + esc(ageText(months)) + ' · ' + esc(left) + '</span></span>' +
      '<span class="bb-d">D+' + fmtComma(days - 1) + '</span>' +
      '</div>';
  }

  function renderHome() {
    var home = qs("#homeContent");
    if (!home) return;
    var total = stampTotal();
    var streak = computeStreak();
    var items = state.study.items || [];
    var doneCount = items.filter(function (i) { return i.done; }).length;
    var todayStamps = Number(state.stamps[todayKey()] || 0);

    // 오늘 할 일 요약 (사람별 완료 수 + 아직 남은 할 일 몇 가지)
    var todoRows = [];
    var leftTodoRows = [];
    ["dain", "mom", "dad"].forEach(function (pid) {
      var list = state.todos[pid] || [];
      var done = list.filter(function (t) { return t.done; }).length;
      todoRows.push({ who: pid, label: memberName(pid), done: done, total: list.length });
      list.filter(function (t) { return !t.done; }).forEach(function (t) {
        leftTodoRows.push({ who: memberName(pid), avatar: memberAvatar(pid), text: t.text });
      });
    });
    leftTodoRows = leftTodoRows.slice(0, 3);

    var mission = MISSION_POOL[state.mission.index % MISSION_POOL.length];

    home.innerHTML = "";
    home.insertAdjacentHTML("beforeend", homeBornBannerHtml());
    home.appendChild(el("div", "home-grid"));

    var grid = qs(".home-grid", home);

    // ── 1번째 줄: ⏰ 시간 · 💰 용돈 현황 · ⏱️ 타이머 — 태블릿 넓은 화면에서는 3열 한 줄
    grid.appendChild(buildHomeTopRow());

    // ── 2번째 줄: 왼쪽 📅 일정 · 달력 / 오른쪽 🌤️ 성남시 분당구 날씨
    var calWrap = el("div", "home-cell home-cell-cal");
    calWrap.innerHTML = homeCalendarCardHtml();
    grid.appendChild(calWrap);

    var wWrap = el("div", "home-cell home-cell-weather");
    wWrap.innerHTML = '<div class="card weather" id="weatherCard"></div>';
    grid.appendChild(wWrap);

    // ── 3번째 줄: 왼쪽 🗒️ 오늘 할 일 / 오른쪽 ✅ 함께 체크리스트
    var todoSnap = el("div", "home-cell home-cell-todo");
    todoSnap.innerHTML =
      '<div class="card tight">' +
        '<div class="section-head"><div class="section-title"><span class="ico">🗒️</span>오늘 할 일</div>' +
          '<button class="btn btn-xs btn-ghost" type="button" data-action="tab" data-tab="mission">전체 보기</button></div>' +
        '<div class="stat-grid" style="margin-top:10px">' +
          todoRows.map(function (r) {
            return '<div class="stat"><div class="stat-num">' + (r.total ? r.done + '/' + r.total : '-') + '</div><div class="stat-label">' + esc(r.label) + '</div></div>';
          }).join("") +
        '</div>' +
        '<div class="mini-list" style="margin-top:10px">' +
          (leftTodoRows.length ? leftTodoRows.map(function (t) {
            return '<div class="mini-row"><img class="mini-avatar" src="' + esc(t.avatar) + '" alt="">' +
              '<span class="txt"><b class="up-date">' + esc(t.who) + '</b> ' + esc(t.text) + '</span></div>';
          }).join("") : '<div class="mini-row"><span class="check">🌿</span><span class="txt">오늘 할 일을 모두 마쳤어요 — 멋져요!</span></div>') +
        '</div>' +
      '</div>';
    grid.appendChild(todoSnap);

    var chkWrap = el("div", "home-cell home-cell-check");
    chkWrap.innerHTML = checklistSummaryHtml();
    grid.appendChild(chkWrap);

    // ── 4번째 줄 이후: 📌 오늘 현황 + 인사 카드 (나머지)
    var sumWrap = el("div", "span-2 home-cell-today");
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

    // 인사 카드 — 맨 아래 나머지 줄
    var me = memberById(meId);
    var greet = el("div", "span-2 home-cell-greet");
    greet.innerHTML =
      '<div class="card tight" style="display:flex;align-items:center;gap:12px">' +
        '<img src="' + esc(me ? avatarOf(me) : "assets/avatar_daini.png") + '" alt="" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid #fff;box-shadow:var(--shadow-tiny)">' +
        '<div class="grow"><p class="title-font" style="font-size:16px">' + esc(me ? me.name : "") + '의 하루, 힘차게! ✨</p>' +
        '<p class="muted">공부하고 도장 모아서 요정 친구들을 만나요</p></div>' +
      '</div>';
    grid.appendChild(greet);

    renderHomeWeather();
    fetchWeather(false);
    tickClock();
    paintTabletTimer();
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
  function buildRoutineCard() {
    var card = el("div", "card routine-card");
    card.id = "eveningRoutine";
    var items = routineItems();
    var st = routineStats(todayKey());
    var pct = st.total ? Math.round(st.done / st.total * 100) : 0;

    card.innerHTML =
      '<div class="section-head">' +
        '<div class="section-title"><span class="ico">🌙</span>다인이 저녁 루틴</div>' +
        '<span class="section-note" id="routineTodayNote">' + esc(fmtDateKo(todayKey())) + '</span>' +
      '</div>' +
      '<div class="routine-summary">' +
        '<div class="routine-total">' +
          '<span class="rt-label">모은 용돈</span>' +
          '<b id="routineTotal">' + esc(fmtWon(routineTotal())) + '</b>' +
        '</div>' +
        '<div class="routine-today">' +
          '<b id="routineToday">' + st.done + ' / ' + st.total + ' 완료</b>' +
          '<span>오늘 +' + esc(fmtWon(st.earned)) + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="progress" style="margin-top:10px"><i style="width:' + pct + '%"></i></div>' +
      '<p class="routine-hint">항목당 +' + fmtWon(ROUTINE_PER_ITEM) + ' · 모두 완료 시 보너스 +' + fmtWon(ROUTINE_ALL_BONUS) + '!</p>' +
      (st.allDone ? '<p class="routine-bonus-on">🎉 오늘 보너스 +' + fmtWon(ROUTINE_ALL_BONUS) + ' 받았어요 — 하루 최대 ' + fmtWon(st.earned) + '</p>' : '') +
      '<div class="routine-list" id="routineList">' +
        (items.length ? items.map(function (it) {
          var on = !!routineDay(todayKey()).checked[it.id];
          return '<div class="routine-item' + (on ? " done" : "") + '" data-routine="' + esc(it.id) + '">' +
            '<button class="check-btn" type="button" data-action="toggle-routine" data-id="' + esc(it.id) + '"' +
              ' aria-label="' + esc(it.name) + ' 완료 체크" aria-pressed="' + (on ? "true" : "false") + '">✓</button>' +
            '<span class="txt">' + esc(it.name) + '</span>' +
            '<span class="rt-reward">+' + fmtWon(ROUTINE_PER_ITEM) + '</span>' +
            '<button class="mini-icon" type="button" data-action="delete-routine" data-id="' + esc(it.id) + '" aria-label="' + esc(it.name) + ' 삭제">🗑️</button>' +
          '</div>';
        }).join("") : '<p class="cl-empty">아직 루틴 항목이 없어요. 아래에서 추가해 주세요.</p>') +
      '</div>' +
      '<div class="rt-add">' +
        '<input type="text" id="routineInput" maxlength="30" placeholder="루틴 추가 (예: 일기 쓰기)" aria-label="저녁 루틴 항목">' +
        '<button class="btn btn-xs btn-soft" type="button" data-action="add-routine">추가</button>' +
      '</div>' +
      '<div class="routine-foot">' +
        '<button class="btn btn-xs btn-ghost" type="button" data-action="allowance-spend">💰 용돈 쓰기</button>' +
        '<button class="btn btn-xs btn-ghost" type="button" data-action="allowance-reset">↺ 용돈 초기화</button>' +
      '</div>';
    return card;
  }

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

    // 🌙 다인이 저녁 루틴 (항목당 +100원 · 모두 완료 시 +500원)
    root.appendChild(buildRoutineCard());

    // 할 일
    var todoHead = el("div", "section-head");
    todoHead.style.padding = "2px 6px 0";
    todoHead.innerHTML = '<div class="section-title"><span class="ico">🗒️</span>각자 오늘 할 일</div>' +
      '<span class="section-note">함께 쓰는 목록은 ‘함께’ 탭에 있어요</span>';
    root.appendChild(todoHead);

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
     함께 — 가족 달력 + 함께 체크리스트
     ========================================================= */
  var TOGETHER_SUB = "calendar";
  var calView = null;

  function allEvents() { return (state.calendar && state.calendar.events) || []; }

  function cmpEvent(a, b) {
    if (!!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
    var at = a.allDay ? "" : String(a.time || "99:99");
    var bt = b.allDay ? "" : String(b.time || "99:99");
    if (at === bt) return String(a.title).localeCompare(String(b.title));
    return at < bt ? -1 : 1;
  }

  function eventsOn(key) {
    return allEvents().filter(function (e) { return e.date === key; }).sort(cmpEvent);
  }

  function ensureCalView() {
    if (calView) return;
    var p = splitKey(todayKey());
    calView = { y: p.y, m: p.m, selected: todayKey() };
  }

  function calGoto(y, m) {
    ensureCalView();
    while (m < 0) { m += 12; y -= 1; }
    while (m > 11) { m -= 12; y += 1; }
    calView.y = y;
    calView.m = m;
  }

  function renderTogether() {
    var root = qs("#togetherContent");
    if (!root) return;
    ensureCalView();
    qsa(".seg-btn").forEach(function (b) {
      var on = b.getAttribute("data-sub") === TOGETHER_SUB;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    root.setAttribute("data-sub", TOGETHER_SUB);
    if (TOGETHER_SUB === "checklist") renderTogetherChecklist(root);
    else renderTogetherCalendar(root);
  }

  function renderTogetherCalendar(root) {
    root.innerHTML = "";
    var byDay = {};
    allEvents().forEach(function (e) {
      if (!byDay[e.date]) byDay[e.date] = [];
      byDay[e.date].push(e);
    });

    var cells = monthCells(calView.y, calView.m);
    var today = todayKey();
    var sel = calView.selected || today;

    var calCard = el("div", "card");
    calCard.innerHTML =
      '<div class="section-head"><div class="section-title"><span class="ico">📅</span>가족 달력</div>' +
        '<span class="section-note">누구나 일정을 넣을 수 있어요</span></div>' +
      '<div class="cal-nav">' +
        '<button class="cal-arrow" type="button" data-action="cal-month" data-delta="-1" aria-label="이전 달">‹</button>' +
        '<div class="cal-center"><span class="cal-month" id="calMonthLabel">' + (calView.m + 1) + '월 ' + calView.y + '</span>' +
          '<button class="cal-today" type="button" data-action="cal-today">오늘</button></div>' +
        '<button class="cal-arrow" type="button" data-action="cal-month" data-delta="1" aria-label="다음 달">›</button>' +
      '</div>' +
      '<div class="cal-dow">' + DOW_KO.map(function (d, i) {
        return '<span class="' + (i === 0 ? "sun" : i === 6 ? "sat" : "") + '">' + d + '</span>';
      }).join("") + '</div>' +
      '<div class="cal-grid" id="calGrid">' + cells.map(function (c) {
        var evs = byDay[c.key] || [];
        var cls = "cal-cell" + (c.inMonth ? "" : " is-out") +
          (c.key === today ? " is-today" : "") +
          (c.key === sel ? " is-selected" : "") +
          (evs.length ? " has-events" : "");
        var dots = evs.slice(0, 3).map(function (e) {
          return '<i class="cal-dot who-' + esc(e.who || "all") + '"></i>';
        }).join("");
        return '<button class="' + cls + '" type="button" data-action="cal-pick" data-date="' + esc(c.key) + '"' +
          ' aria-pressed="' + (c.key === sel ? "true" : "false") + '"' +
          ' aria-label="' + esc(fmtDayLabel(c.key) + (evs.length ? " · 일정 " + evs.length + "개" : "")) + '">' +
          '<span class="cal-num">' + c.day + '</span>' +
          '<span class="cal-dots">' + dots + '</span>' +
          (evs.length > 3 ? '<span class="cal-more">+' + (evs.length - 3) + '</span>' : "") +
        '</button>';
      }).join("") + '</div>' +
      '<p class="cal-legend">🏡 가족 모두 · 🎀 다인이 · 💐 엄마 · 🧢 아빠</p>';
    root.appendChild(calCard);

    var dayCard = el("div", "card");
    var dayEvents = eventsOn(sel);
    dayCard.innerHTML =
      '<div class="section-head"><div class="section-title"><span class="ico">📌</span>' + esc(fmtDayLabel(sel)) + '</div>' +
        '<button class="btn btn-xs btn-primary" type="button" data-action="add-event" data-date="' + esc(sel) + '">+ 일정 추가</button></div>' +
      '<div class="day-events" id="dayEvents">' +
        (dayEvents.length ? dayEvents.map(eventRowHtml).join("") :
          '<p class="muted" style="padding:4px 2px">이 날은 아직 일정이 없어요. 가족과 함께 넣어 봐요 🌿</p>') +
      '</div>';
    root.appendChild(dayCard);
  }

  function eventRowHtml(e) {
    var w = whoInfo(e.who);
    var timeLabel = e.allDay ? "종일" : (fmtTime12(e.time) || "시간 미정");
    var byName = e.by ? memberName(e.by) : "";
    return '<div class="event-row who-' + esc(w.id) + '">' +
      '<span class="event-time' + (e.allDay ? " is-allday" : "") + '">' + esc(timeLabel) + '</span>' +
      '<div class="event-body">' +
        '<span class="event-title">' + esc(e.title) + '</span>' +
        '<span class="event-meta">' + w.emoji + " " + esc(w.label) +
          (byName ? " · " + esc(byName) + "가 넣음" : "") +
          (e.note ? " · " + esc(e.note) : "") + '</span>' +
      '</div>' +
      '<div class="item-actions">' +
        '<button class="mini-icon" type="button" data-action="edit-event" data-id="' + esc(e.id) + '" aria-label="일정 수정">✏️</button>' +
        '<button class="mini-icon" type="button" data-action="delete-event" data-id="' + esc(e.id) + '" aria-label="일정 삭제">🗑️</button>' +
      '</div>' +
    '</div>';
  }

  function openEventModal(existing, dateKey) {
    var isEdit = !!existing;
    var date = isEdit ? existing.date : (dateKey || (calView && calView.selected) || todayKey());
    if (!isDateKey(date)) date = todayKey();
    var allDay = isEdit ? !!existing.allDay : false;
    var time = isEdit ? (existing.time || "") : "";
    var who = isEdit ? (existing.who || "all") : "all";
    openModal(
      '<div class="field"><label for="evTitle">일정 제목</label>' +
        '<input type="text" id="evTitle" maxlength="40" placeholder="예: 다인이 유치원 소풍" value="' + esc(isEdit ? existing.title : "") + '"></div>' +
      '<div class="field"><label for="evDate">날짜</label>' +
        '<input type="date" id="evDate" value="' + esc(date) + '"></div>' +
      '<div class="field"><label for="evTime">시간</label>' +
        '<div class="row" style="gap:10px">' +
          '<input type="time" id="evTime" value="' + esc(time) + '"' + (allDay ? " disabled" : "") + '>' +
          '<label class="check-inline"><input type="checkbox" id="evAllDay"' + (allDay ? " checked" : "") + '> 종일</label>' +
        '</div></div>' +
      '<div class="field"><label for="evWho">누구 일정인가요?</label>' +
        '<select id="evWho">' + EVENT_WHO.map(function (w) {
          return '<option value="' + w.id + '"' + (w.id === who ? " selected" : "") + '>' + w.emoji + ' ' + esc(w.label) + '</option>';
        }).join("") + '</select></div>' +
      '<div class="field"><label for="evNote">메모 (선택)</label>' +
        '<input type="text" id="evNote" maxlength="60" placeholder="예: 준비물 가방 챙기기" value="' + esc(isEdit ? (existing.note || "") : "") + '"></div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" type="button" data-action="close-modal">취소</button>' +
        '<button class="btn btn-primary" type="button" id="evSaveBtn">' + (isEdit ? "저장" : "추가") + '</button>' +
      '</div>',
      { title: isEdit ? "일정 수정" : "일정 추가" }
    );

    var allDayBox = qs("#evAllDay");
    allDayBox.addEventListener("change", function () {
      var timeInput = qs("#evTime");
      timeInput.disabled = allDayBox.checked;
      if (allDayBox.checked) timeInput.value = "";
    });

    var save = function () {
      var title = qs("#evTitle").value.trim();
      var dkey = qs("#evDate").value;
      if (!title) { toast("일정 제목을 넣어 주세요", "✏️"); return; }
      if (!isDateKey(dkey)) { toast("날짜를 골라 주세요", "📅"); return; }
      var isAll = allDayBox.checked;
      var t = isAll ? "" : qs("#evTime").value;
      var whoId = qs("#evWho").value;
      var note = qs("#evNote").value.trim();
      if (isEdit) {
        existing.title = title; existing.date = dkey; existing.allDay = isAll;
        existing.time = t; existing.who = whoId; existing.note = note;
        existing.updatedAt = new Date().toISOString();
      } else {
        state.calendar.events.push({
          id: uid("ev"), title: title, date: dkey, allDay: isAll, time: t,
          who: whoId, by: meId || "", note: note,
          createdAt: new Date().toISOString(), updatedAt: ""
        });
      }
      var p = splitKey(dkey);
      calGoto(p.y, p.m);
      calView.selected = dkey;
      TOGETHER_SUB = "calendar";
      closeModal();
      persist(true);
      renderAll();
      toast(isEdit ? "일정을 고쳤어요" : "일정을 넣었어요!", "📅");
    };

    qs("#evSaveBtn").addEventListener("click", save);
    var titleInput = qs("#evTitle");
    titleInput.focus();
    titleInput.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter") { ev.preventDefault(); save(); }
    });
  }

  /* ---------- 함께 체크리스트 ---------- */
  function renderTogetherChecklist(root) {
    root.innerHTML = "";
    var lists = (state.checklists && state.checklists.lists) || [];

    var head = el("div", "card tight");
    head.innerHTML =
      '<div class="section-head"><div class="section-title"><span class="ico">✅</span>함께 체크리스트</div>' +
        '<button class="btn btn-sm btn-primary" type="button" data-action="add-list">+ 새 리스트</button></div>' +
      '<p class="muted" style="margin-top:6px">가족 모두가 함께 채우는 목록이에요. 각자 할 일은 ‘미션’ 탭에서 봐요.</p>';
    root.appendChild(head);

    if (!lists.length) {
      var empty = el("div", "card center");
      empty.innerHTML = '<p style="font-size:32px">🧺</p>' +
        '<p class="muted" style="margin-top:6px"><b>+ 새 리스트</b>로 장보기·준비물 목록을 만들어요.</p>';
      root.appendChild(empty);
      return;
    }

    var wrap = el("div", "cl-wrap");
    lists.forEach(function (list) { wrap.appendChild(checklistCard(list)); });
    root.appendChild(wrap);
  }

  function checklistCard(list) {
    var items = list.items || [];
    var done = items.filter(function (i) { return i.done; }).length;
    var pct = items.length ? Math.round(done / items.length * 100) : 0;
    var card = el("div", "card checklist");
    card.setAttribute("data-list-card", list.id);
    card.innerHTML =
      '<div class="cl-head">' +
        '<span class="cl-emoji">' + esc(list.emoji || "📝") + '</span>' +
        '<div class="grow">' +
          '<div class="cl-title">' + esc(list.title) + '</div>' +
          '<div class="cl-sub">' + (items.length
            ? done + " / " + items.length + " 완료" + (items.length - done ? " · 남은 " + (items.length - done) + "개" : " · 다 했어요!")
            : "항목을 넣어 보세요") + '</div>' +
        '</div>' +
        '<button class="mini-icon" type="button" data-action="rename-list" data-id="' + esc(list.id) + '" aria-label="리스트 이름 바꾸기">✏️</button>' +
        '<button class="mini-icon" type="button" data-action="delete-list" data-id="' + esc(list.id) + '" aria-label="리스트 삭제">🗑️</button>' +
      '</div>' +
      '<div class="progress" style="margin-top:9px"><i style="width:' + pct + '%"></i></div>' +
      '<div class="cl-items">' +
        (items.length ? items.map(function (it) {
          return '<div class="cl-item' + (it.done ? " done" : "") + '">' +
            '<button class="check-btn" type="button" data-action="toggle-cl-item" data-list="' + esc(list.id) + '" data-id="' + esc(it.id) + '" aria-label="체크">✓</button>' +
            '<span class="txt">' + esc(it.text) + '</span>' +
            '<button class="mini-icon" type="button" data-action="delete-cl-item" data-list="' + esc(list.id) + '" data-id="' + esc(it.id) + '" aria-label="삭제">🗑️</button>' +
          '</div>';
        }).join("") : '<p class="cl-empty">아직 항목이 없어요</p>') +
      '</div>' +
      '<form class="cl-add" data-list="' + esc(list.id) + '" autocomplete="off">' +
        '<input type="text" name="text" maxlength="40" placeholder="항목 추가 (예: 우유)" aria-label="' + esc(list.title) + ' 항목">' +
        '<button class="btn btn-xs btn-soft" type="submit">추가</button>' +
      '</form>' +
      (done ? '<div class="cl-foot"><button class="btn btn-xs btn-ghost" type="button" data-action="clear-done" data-id="' + esc(list.id) + '">완료 ' + done + '개 정리</button></div>' : "");
    return card;
  }

  function listById(id) {
    return ((state.checklists && state.checklists.lists) || []).find(function (l) { return l.id === id; }) || null;
  }

  function addChecklistItem(listId, text) {
    var list = listById(listId);
    if (!list) return;
    var t = String(text || "").trim();
    if (!t) { toast("넣을 항목을 적어 주세요", "✏️"); return; }
    list.items.push({ id: uid("it"), text: t.slice(0, 40), done: false, doneAt: "", by: meId || "", createdAt: new Date().toISOString() });
    persist(true);
    renderAll();
    var inp = qs('form.cl-add[data-list="' + listId + '"] input');
    if (inp) inp.focus();
  }

  function openListModal(existing) {
    var isEdit = !!existing;
    openModal(
      '<div class="field"><label for="clTitle">리스트 이름</label>' +
        '<input type="text" id="clTitle" maxlength="20" placeholder="예: 장보기" value="' + esc(isEdit ? existing.title : "") + '"></div>' +
      '<div class="field"><label>그림 고르기</label>' +
        '<div class="emoji-pick" id="clEmojiPick">' +
          LIST_PRESETS.map(function (p, i) {
            var on = isEdit ? (existing.emoji === p.emoji) : i === 0;
            return '<button type="button" class="emoji-opt' + (on ? " is-on" : "") + '" data-emoji="' + esc(p.emoji) + '">' +
              p.emoji + '<span>' + esc(p.title) + '</span></button>';
          }).join("") +
        '</div></div>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" type="button" data-action="close-modal">취소</button>' +
        '<button class="btn btn-primary" type="button" id="clSaveBtn">' + (isEdit ? "저장" : "만들기") + '</button>' +
      '</div>',
      { title: isEdit ? "리스트 이름 바꾸기" : "새 리스트" }
    );

    var picked = isEdit ? (existing.emoji || "📝") : LIST_PRESETS[0].emoji;
    qsa("#clEmojiPick .emoji-opt").forEach(function (b) {
      b.addEventListener("click", function () {
        picked = b.getAttribute("data-emoji");
        qsa("#clEmojiPick .emoji-opt").forEach(function (x) { x.classList.toggle("is-on", x === b); });
      });
    });

    qs("#clSaveBtn").addEventListener("click", function () {
      var title = qs("#clTitle").value.trim();
      if (!title) { toast("리스트 이름을 넣어 주세요", "✏️"); return; }
      if (isEdit) {
        existing.title = title;
        existing.emoji = picked;
      } else {
        state.checklists.lists.push({
          id: uid("cl"), emoji: picked, title: title, items: [],
          by: meId || "", createdAt: new Date().toISOString()
        });
      }
      TOGETHER_SUB = "checklist";
      closeModal();
      persist(true);
      renderAll();
      toast(isEdit ? "이름을 바꿨어요" : "리스트를 만들었어요!", "🧺");
    });
    qs("#clTitle").focus();
  }

  /* ---------- 홈 요약 카드 ---------- */

  // 홈 2번째 줄 왼쪽: 이번 달 미니 달력(오늘 강조 + 일정 점) + 다가오는 일정 목록
  // 달력의 날짜를 누르면 그 날짜를 골라 '함께 → 가족 달력'으로 이동한다.
  function homeCalendarCardHtml() {
    var today = todayKey();
    var p = splitKey(today);

    // 이번 달 마지막 주까지만 남겨 6주 → 보통 5주로 줄인다
    var cells = monthCells(p.y, p.m);
    while (cells.length > 7 && cells.slice(-7).every(function (c) { return !c.inMonth; })) {
      cells = cells.slice(0, -7);
    }

    var byDay = {};
    allEvents().forEach(function (e) {
      if (!byDay[e.date]) byDay[e.date] = [];
      byDay[e.date].push(e);
    });

    var monthCount = allEvents().filter(function (e) {
      var q = splitKey(e.date);
      return q.y === p.y && q.m === p.m;
    }).length;

    var cellHtml = cells.map(function (c) {
      var evs = byDay[c.key] || [];
      var dots = evs.slice(0, 3).map(function (e) {
        return '<i class="hcal-dot who-' + esc(e.who || "all") + '"></i>';
      }).join("");
      var cls = "hcal-cell" + (c.inMonth ? "" : " is-out") +
        (c.key === today ? " is-today" : "") + (evs.length ? " has-events" : "");
      return '<button class="' + cls + '" type="button" data-action="home-cal-day" data-date="' + esc(c.key) + '"' +
        ' aria-label="' + esc(fmtDayLabel(c.key) + (evs.length ? " · 일정 " + evs.length + "개" : "")) + '">' +
        '<span class="hcal-num">' + c.day + '</span>' +
        '<span class="hcal-dots">' + dots + '</span>' +
      '</button>';
    }).join("");

    var upcoming = allEvents().filter(function (e) { return e.date >= today; }).sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return cmpEvent(a, b);
    }).slice(0, 3);

    var upRows = upcoming.map(function (e) {
      var q = splitKey(e.date);
      var w = whoInfo(e.who);
      return '<div class="mini-row"><span class="check">' + w.emoji + '</span>' +
        '<span class="txt"><b class="up-date">' + (q.m + 1) + '/' + q.d + '(' + DOW_KO[dowOfKey(e.date)] + ')</b> ' + esc(e.title) + '</span></div>';
    }).join("") || '<div class="mini-row"><span class="check">🌿</span><span class="txt">아직 넣은 일정이 없어요 — 가족과 함께 넣어 봐요</span></div>';

    return '<div class="card tight home-cal">' +
      '<div class="section-head"><div class="section-title"><span class="ico">📅</span>일정 · 달력</div>' +
        '<button class="btn btn-xs btn-ghost" type="button" data-action="tab" data-tab="together" data-sub="calendar">달력 열기</button></div>' +
      '<div class="hcal-head"><b id="hcalMonth">' + (p.m + 1) + '월</b>' +
        '<span>' + p.y + '년 · 일정 ' + monthCount + '개</span></div>' +
      '<div class="hcal-dow">' + DOW_KO.map(function (d, i) {
        return '<span class="' + (i === 0 ? "sun" : i === 6 ? "sat" : "") + '">' + d + '</span>';
      }).join("") + '</div>' +
      '<div class="hcal-grid" id="homeCalGrid">' + cellHtml + '</div>' +
      '<div class="hcal-legend">' +
        '<span><i class="hcal-dot who-all"></i>가족</span>' +
        '<span><i class="hcal-dot who-dain"></i>다인이</span>' +
        '<span><i class="hcal-dot who-mom"></i>엄마</span>' +
        '<span><i class="hcal-dot who-dad"></i>아빠</span>' +
      '</div>' +
      '<p class="hcal-up-title">다가오는 일정</p>' +
      '<div class="mini-list hcal-up">' + upRows + '</div>' +
    '</div>';
  }

  function checklistSummaryHtml() {
    var lists = (state.checklists && state.checklists.lists) || [];
    var rows = lists.slice(0, 3).map(function (l) {
      var items = l.items || [];
      var done = items.filter(function (i) { return i.done; }).length;
      var left = items.length - done;
      return '<div class="mini-row"><span class="check">' + esc(l.emoji || "📝") + '</span>' +
        '<span class="txt">' + esc(l.title) + '</span>' +
        '<span class="cl-count">' + (items.length ? (left ? left + "개 남음" : "완료") : "비었어요") + '</span></div>';
    }).join("");

    return '<div class="card tight">' +
      '<div class="section-head"><div class="section-title"><span class="ico">✅</span>함께 체크리스트</div>' +
        '<button class="btn btn-xs btn-ghost" type="button" data-action="tab" data-tab="together" data-sub="checklist">전체 보기</button></div>' +
      '<div class="mini-list" style="margin-top:10px">' +
        (rows || '<div class="mini-row"><span class="check">🧺</span><span class="txt">장보기·준비물 목록을 함께 채워요</span></div>') +
      '</div></div>';
  }

  /* =========================================================
     채팅
     ========================================================= */
  /* =========================================================
     성장 탭 — 2017 소아청소년 성장도표(여아) 위의 다인이 기록
     ========================================================= */
  var growthMetric = "height";          // height | weight

  function growthUnit(metric) { return metric === "height" ? "cm" : "kg"; }
  function growthName(metric) { return metric === "height" ? "키" : "몸무게"; }
  function growthFix(n) { return (Math.round(n * 10) / 10).toFixed(1); }

  function growthSeries(metric, pct) {
    var out = [];
    if (!GROWTH_LMS || !GROWTH_LMS[metric]) return out;
    for (var m = GROWTH_LMS.fromMonth; m <= GROWTH_LMS.toMonth; m++) {
      var lms = GROWTH_LMS[metric][String(m)];
      if (!lms) continue;
      out.push({ m: m, v: valueAtPct(lms, pct) });
    }
    return out;
  }

  function growthPoints(metric) {
    var x0 = GROWTH_LMS ? GROWTH_LMS.fromMonth : 12;
    var x1 = GROWTH_LMS ? GROWTH_LMS.toMonth : 84;
    var birth = (state.growth && state.growth.birthDate) || GROWTH_BIRTH;
    return growthRecords().map(function (r) {
      var v = metric === "height" ? r.height : r.weight;
      if (!(v > 0)) return null;
      var m = monthsBetween(birth, r.date);
      if (m < x0 - 0.6 || m > x1 + 0.6) return null;
      return { m: m, v: v, r: r };
    }).filter(Boolean).sort(function (a, b) {
      return a.r.date < b.r.date ? -1 : a.r.date > b.r.date ? 1 : 0;
    });
  }

  function growthChartSvg(metric) {
    if (!GROWTH_LMS) return '<p class="muted center" style="padding:24px 0">성장도표 자료를 불러오지 못했어요.</p>';
    var W = 560, H = 300, padL = 34, padR = 42, padT = 18, padB = 30;
    var x0 = GROWTH_LMS.fromMonth, x1 = GROWTH_LMS.toMonth;
    var series = GROWTH_PCTS.map(function (p) { return { pct: p, points: growthSeries(metric, p) }; });
    var pts = growthPoints(metric);
    var vals = [];
    series.forEach(function (s) { s.points.forEach(function (pt) { vals.push(pt.v); }); });
    pts.forEach(function (pt) { vals.push(pt.v); });
    if (!vals.length) return '<p class="muted center" style="padding:24px 0">성장도표 자료를 불러오지 못했어요.</p>';

    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    var step = metric === "height" ? 10 : 5;
    var vMin = Math.floor((lo - 3) / step) * step;
    var vMax = Math.ceil((hi + 3) / step) * step;
    if (vMax - vMin < step * 3) vMax = vMin + step * 3;

    function X(m) { return padL + (m - x0) / (x1 - x0) * (W - padL - padR); }
    function Y(v) { return H - padB - (v - vMin) / (vMax - vMin) * (H - padT - padB); }
    function line(points) {
      return points.map(function (pt, i) { return (i ? "L" : "M") + X(pt.m).toFixed(1) + " " + Y(pt.v).toFixed(1); }).join(" ");
    }

    var svg = [];
    svg.push('<svg class="gc-svg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="다인이 ' + growthName(metric) + ' 성장도표">');

    // 가로 격자 + 눈금
    for (var v = vMin; v <= vMax; v += step) {
      svg.push('<line class="gc-grid" x1="' + padL + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + Y(v).toFixed(1) + '"/>');
      svg.push('<text class="gc-tick" x="' + (padL - 6) + '" y="' + (Y(v) + 3.2).toFixed(1) + '" text-anchor="end">' + v + '</text>');
    }

    // 백분위 밴드 (3~97, 10~90, 25~75)
    function band(a, b, cls) {
      var top = series.find(function (s) { return s.pct === b; }).points;
      var bottom = series.find(function (s) { return s.pct === a; }).points;
      var d = top.map(function (pt, i) { return (i ? "L" : "M") + X(pt.m).toFixed(1) + " " + Y(pt.v).toFixed(1); }).join(" ");
      d += " " + bottom.slice().reverse().map(function (pt) { return "L" + X(pt.m).toFixed(1) + " " + Y(pt.v).toFixed(1); }).join(" ");
      d += " Z";
      svg.push('<path class="' + cls + '" d="' + d + '"/>');
    }
    band(3, 97, "gc-band-outer");
    band(10, 90, "gc-band-mid");
    band(25, 75, "gc-band-inner");

    // 백분위 선 + 오른쪽 끝 라벨
    series.forEach(function (s) {
      svg.push('<path class="gc-pct gc-pct-' + s.pct + '" data-pct="' + s.pct + '" d="' + line(s.points) + '"/>');
      if (s.pct === 3 || s.pct === 50 || s.pct === 97 || s.pct === 90 || s.pct === 10) {
        var last = s.points[s.points.length - 1];
        svg.push('<text class="gc-pct-label" x="' + (W - padR + 5) + '" y="' + (Y(last.v) + 3.4).toFixed(1) + '">' + s.pct + '</text>');
      }
    });

    // 세로 눈금 (1살~7살)
    for (var m = x0; m <= x1; m += 12) {
      svg.push('<line class="gc-grid gc-grid-v" x1="' + X(m).toFixed(1) + '" y1="' + padT + '" x2="' + X(m).toFixed(1) + '" y2="' + (H - padB) + '"/>');
      svg.push('<text class="gc-tick" x="' + X(m).toFixed(1) + '" y="' + (H - padB + 16) + '" text-anchor="middle">' + (m / 12) + '살</text>');
    }

    // 다인이 측정점
    if (pts.length) {
      if (pts.length > 1) {
        svg.push('<path class="gc-record-line" d="' + pts.map(function (pt, i) { return (i ? "L" : "M") + X(pt.m).toFixed(1) + " " + Y(pt.v).toFixed(1); }).join(" ") + '"/>');
      }
      pts.forEach(function (pt, i) {
        svg.push('<circle class="gc-dot' + (i === pts.length - 1 ? ' is-last' : '') + '" cx="' + X(pt.m).toFixed(1) + '" cy="' + Y(pt.v).toFixed(1) + '" r="' + (i === pts.length - 1 ? 5 : 4) + '"/>');
      });
      var lastPt = pts[pts.length - 1];
      var lx = X(lastPt.m), ly = Y(lastPt.v);
      var label = growthFix(lastPt.v) + growthUnit(metric);
      var bw = 15 + label.length * 7.4;
      var bx = Math.min(Math.max(lx - bw / 2, padL + 2), W - padR - bw - 2);
      var by = Math.max(ly - 30, padT + 2);
      svg.push('<g class="gc-callout"><rect x="' + bx.toFixed(1) + '" y="' + by.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="20" rx="10"/>' +
        '<text x="' + (bx + bw / 2).toFixed(1) + '" y="' + (by + 14).toFixed(1) + '" text-anchor="middle">' + esc(label) + '</text></g>');
    }

    svg.push('<text class="gc-unit" x="' + (padL - 6) + '" y="' + (padT - 4) + '" text-anchor="end">' + growthUnit(metric) + '</text>');
    svg.push("</svg>");
    return svg.join("");
  }

  function growthSummaryBox(metric, latest, prev) {
    var unit = growthUnit(metric);
    var v = latest ? (metric === "height" ? latest.height : latest.weight) : 0;
    var pv = prev ? (metric === "height" ? prev.height : prev.weight) : 0;
    var pct = latest ? growthPctOf(latest, metric) : NaN;
    var delta = "";
    if (latest && prev && v > 0 && pv > 0) {
      var d = Math.round((v - pv) * 10) / 10;
      delta = "지난번보다 " + (d > 0 ? "+" : d < 0 ? "−" : "±") + growthFix(Math.abs(d)) + unit;
    } else if (latest) {
      delta = "처음 남긴 기록";
    } else {
      delta = "아직 기록이 없어요";
    }
    return '<div class="gs-box gs-' + metric + '">' +
      '<span class="gs-label">' + growthName(metric) + '</span>' +
      '<span class="gs-value">' + (latest && v > 0 ? growthFix(v) : "—") + '<small>' + unit + '</small></span>' +
      '<span class="gs-delta">' + esc(delta) + '</span>' +
      '<span class="gs-pct">' + (latest && v > 0 ? "또래 " + pctText(pct) + "백분위" : "기록을 남겨 보요") + '</span>' +
      '</div>';
  }

  function renderGrowth() {
    var root = qs("#growthContent");
    if (!root) return;
    if (!state.growth) state.growth = normalizeGrowth(null);
    var birth = state.growth.birthDate || GROWTH_BIRTH;
    var months = monthsBetween(birth, todayKey());
    var pick = latestGrowth();
    var latest = pick.latest, prev = pick.prev;
    var metric = growthMetric;
    var mPct = latest ? growthPctOf(latest, metric) : NaN;
    var headline = latest
      ? growthName(metric) + " 백분위 " + pctText(mPct) + "% · 또래 100명 중 " + pctText(mPct) + "명보다 " + (metric === "height" ? "커요" : "무거워요")
      : "아직 잰 기록이 없어요 — 오늘 키와 몸무게를 재어 첫 점을 찍어 보요!";
    var totalCount = growthRecords().length;

    var rowsHtml = growthRecords().slice().sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; }).map(function (r) {
      return '<tr>' +
        '<td>' + esc(fmtDateKo(r.date).replace(/년 |월 /g, ".").replace("일", "")) + '</td>' +
        '<td>' + esc(ageText(monthsBetween(birth, r.date))) + '</td>' +
        '<td>' + (r.height ? growthFix(r.height) + ' <small>cm</small>' : '—') + '</td>' +
        '<td>' + (r.weight ? growthFix(r.weight) + ' <small>kg</small>' : '—') + '</td>' +
        '<td class="gt-pct">' + (r.height ? pctText(growthPctOf(r, "height")) + '%' : '—') + '</td>' +
        '<td><button class="icon-btn gt-del" type="button" data-action="del-growth" data-id="' + esc(r.id) + '" aria-label="이 기록 지우기" title="지우기">🗑️</button></td>' +
      '</tr>';
    }).join("");

    root.innerHTML =
      '<div class="growth-hero">' +
        '<span class="gh-ico" aria-hidden="true">📏</span>' +
        '<div class="gh-main">' +
          '<p class="gh-title">이만큼 자랐어요!</p>' +
          '<p class="gh-sub">' + esc(GROWTH_LABEL) + '는 <b>' + esc(ageText(months)) + '</b> <span>· ' + esc(birth.replace(/-/g, ".")) + '생</span></p>' +
        '</div>' +
        '<span class="gh-count">기록 ' + totalCount + '번</span>' +
      '</div>' +

      '<div class="growth-grid">' +
        '<div class="card growth-sum">' +
          '<div class="gs-row">' +
            growthSummaryBox("height", latest, prev) +
            growthSummaryBox("weight", latest, prev) +
          '</div>' +
          '<p class="gs-date">' + (latest ? '마지막으로 잰 날 ' + esc(fmtDateKo(latest.date)) : '아직 잰 날이 없어요') + '</p>' +
          '<button class="btn btn-primary btn-block growth-btn" type="button" data-action="add-growth">📏 오늘 키·몸무게 재기</button>' +
        '</div>' +
        '<div class="card growth-chart">' +
          '<div class="gc-head">' +
            '<div class="gc-tabs" role="tablist" aria-label="키 또는 몸무게">' +
              '<button class="gc-tab' + (metric === "height" ? ' is-active' : '') + '" type="button" role="tab" aria-selected="' + (metric === "height") + '" data-action="growth-metric" data-metric="height">키</button>' +
              '<button class="gc-tab' + (metric === "weight" ? ' is-active' : '') + '" type="button" role="tab" aria-selected="' + (metric === "weight") + '" data-action="growth-metric" data-metric="weight">몸무게</button>' +
            '</div>' +
            '<p class="gc-headline" id="growthHeadline">' + esc(headline) + '</p>' +
          '</div>' +
          '<div class="gc-plot" id="growthChart">' + growthChartSvg(metric) + '</div>' +
          '<p class="gc-legend">' + esc(GROWTH_LMS ? GROWTH_LMS.source : "2017 소아청소년 성장도표") + ' · 백분위선 3·10·25·50·75·90·97 (100명 중 몇 번째인지)</p>' +
        '</div>' +
      '</div>' +

      '<div class="card growth-table">' +
        '<div class="section-head"><div class="section-title"><span class="ico">🗂️</span>측정 기록</div>' +
          '<button class="btn btn-xs btn-ghost" type="button" data-action="add-growth">+ 기록 추가</button></div>' +
        (totalCount
          ? '<div class="gt-scroll"><table class="gt-table"><thead><tr><th>측정일</th><th>만나이</th><th>키</th><th>몸무게</th><th>키 백분위</th><th></th></tr></thead><tbody>' + rowsHtml + '</tbody></table></div>'
          : '<p class="muted center" style="padding:14px 0">아직 측정 기록이 없어요. 「오늘 키·몸무게 재기」로 첫 기록을 남겨 보요!</p>') +
      '</div>';
  }

  function openGrowthModal(record) {
    var r = record || null;
    openModal(
      '<div class="row" style="gap:10px;flex-wrap:wrap">' +
        '<label class="gfield grow"><span>잰 날</span><input type="date" id="growthDate" value="' + esc(r ? r.date : todayKey()) + '"></label>' +
      '</div>' +
      '<div class="row" style="gap:10px;flex-wrap:wrap;margin-top:10px">' +
        '<label class="gfield grow"><span>키 (cm)</span><input type="number" id="growthHeight" inputmode="decimal" step="0.1" min="30" max="220" placeholder="예: 108.4" value="' + (r && r.height ? growthFix(r.height) : '') + '"></label>' +
        '<label class="gfield grow"><span>몸무게 (kg)</span><input type="number" id="growthWeight" inputmode="decimal" step="0.1" min="2" max="120" placeholder="예: 18.4" value="' + (r && r.weight ? growthFix(r.weight) : '') + '"></label>' +
      '</div>' +
      '<p class="muted" style="font-size:11.5px;margin-top:8px">신발을 벗고 재면 더 정확해요. 둘 중 하나만 적어도 저장돼요.</p>' +
      '<div class="modal-actions">' +
        '<button class="btn btn-ghost" type="button" data-action="close-modal">취소</button>' +
        '<button class="btn btn-primary" type="button" id="growthSaveBtn">저장</button>' +
      '</div>',
      { title: r ? "측정 기록 고치기" : "키·몸무게 기록" }
    );

    var saveBtn = qs("#growthSaveBtn");
    if (saveBtn) saveBtn.addEventListener("click", function () {
      var dateKey = qs("#growthDate").value;
      var h = Number(qs("#growthHeight").value);
      var w = Number(qs("#growthWeight").value);
      if (!isDateKey(dateKey)) { toast("잰 날을 골라 주세요", "📅"); return; }
      if (dateKey > todayKey()) { toast("오늘보다 뒤 날짜는 넣을 수 없어요", "📅"); return; }
      if (!(h > 0) && !(w > 0)) { toast("키나 몸무게를 적어 주세요", "📏"); return; }
      if (h && (h < 30 || h > 220)) { toast("키는 30~220cm 사이로 적어 주세요", "📏"); return; }
      if (w && (w < 2 || w > 120)) { toast("몸무게는 2~120kg 사이로 적어 주세요", "⚖️"); return; }
      var recs = growthRecords();
      var same = recs.find(function (x) { return x.date === dateKey && x.id !== (r && r.id); });
      var target = r || same;
      if (target) {
        target.date = dateKey;
        target.height = h > 0 ? Math.round(h * 10) / 10 : 0;
        target.weight = w > 0 ? Math.round(w * 10) / 10 : 0;
      } else {
        recs.push({ id: uid("g"), date: dateKey, height: h > 0 ? Math.round(h * 10) / 10 : 0, weight: w > 0 ? Math.round(w * 10) / 10 : 0 });
      }
      state.growth.records = recs.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
      persist(true);
      closeModal();
      renderGrowth();
      toast("다인이 성장 기록을 남겼어요", "📏");
    });
  }

  function deleteGrowth(id) {
    var rec = growthRecordById(id);
    if (!rec) return;
    confirmModal("기록 지우기", fmtDateKo(rec.date) + " 기록을 지울까요?", "지우기", function () {
      state.growth.records = growthRecords().filter(function (x) { return x.id !== id; });
      persist(true);
      renderGrowth();
      toast("기록을 지웠어요", "🗑️");
    });
  }

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
    var wrap = el("div", "msg" + (mine ? " mine" : "") + (msg.kind === "photo" ? " has-photo" : ""));
    var body;
    if (msg.kind === "voice") {
      body = '<span class="bubble"><span class="voice-bubble">🎙️ <span>' + esc(msg.durationLabel || "음성") + '</span></span><audio controls src="' + esc(msg.audio) + '"></audio></span>';
    } else if (msg.kind === "sticker") {
      body = '<span class="bubble sticker-bubble"><img src="' + esc(msg.img) + '" alt="스티커"></span>';
    } else if (msg.kind === "quick") {
      body = '<span class="bubble quick-bubble"><span class="qb-emoji" aria-hidden="true">' + esc(msg.emoji || "💬") + '</span><span class="qb-text">' + esc(msg.text || "") + '</span></span>';
    } else if (msg.kind === "photo") {
      body = msg.imageData
        ? '<button class="bubble photo-bubble" type="button" data-action="view-photo" data-id="' + esc(msg.id) + '" aria-label="사진 크게 보기"><img class="msg-photo" src="' + esc(msg.imageData) + '" alt="사진"></button>'
        : '<span class="bubble photo-bubble is-trimmed">📷 사진 (오래되어 정리되었어요)</span>';
    } else {
      body = '<span class="bubble">' + esc(msg.text) + '</span>';
    }
    wrap.innerHTML =
      '<img class="msg-avatar" src="' + esc(msg.avatar || memberAvatar(msg.from)) + '" alt="">' +
      '<div class="msg-main">' +
        '<span class="msg-name">' + esc(msg.fromName || memberName(msg.from)) + '</span>' +
        body +
        '<span class="msg-time">' + esc(fmtTime(msg.at)) + '</span>' +
        '<span class="heart-row"><button type="button" class="heart-btn' + (msg.heart ? " is-on" : "") + '" data-action="heart" data-id="' + esc(msg.id) + '">💗' +
          (msg.heart ? '<b>1</b>' : "") + '</button></span>' +
      '</div>';
    return wrap;
  }

  var MAX_PHOTO_MSGS = 24;          // 사진은 최근 24장만 화면용으로 보관 (오래된 사진은 문구만 남김)

  // 오래된 사진의 imageData를 비워 저장 용량이 무한정 커지지 않게 한다.
  function pruneChatPhotos() {
    var photos = [];
    (state.chat || []).forEach(function (m) { if (m && m.kind === "photo" && m.imageData) photos.push(m); });
    var over = photos.length - MAX_PHOTO_MSGS;
    for (var i = 0; i < over; i++) {
      photos[i].imageData = "";
      photos[i].photoTrimmed = true;
    }
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
    pruneChatPhotos();
    persist(true);
    renderChat();
    return msg;
  }

  /* ---------- 다인이 말판 ---------- */
  function renderQuickPanel() {
    var grid = qs("#quickGrid");
    if (grid && !grid.childElementCount) {
      QUICK_MESSAGES.forEach(function (q) {
        var b = el("button", "quick-btn");
        b.type = "button";
        b.setAttribute("data-action", "quick-msg");
        b.setAttribute("data-label", q.label);
        b.setAttribute("data-emoji", q.emoji);
        b.innerHTML = '<span class="quick-emoji" aria-hidden="true">' + q.emoji + '</span>' +
          '<span class="quick-label">' + esc(q.label) + '</span>';
        grid.appendChild(b);
      });
    }
    var panel = qs("#quickPanel");
    if (panel) panel.classList.toggle("is-dain", meId === "dain");
  }

  function sendQuickMessage(label, emoji) {
    sendChat({ kind: "quick", text: label, emoji: emoji });
  }

  /* ---------- 사진 올리기 ---------- */
  var PHOTO_MAX_SIDE = 720;
  var PHOTO_QUALITY = 0.72;
  var PHOTO_TARGET_CHARS = 120000;   // base64 문자열 기준(약 90KB)

  function compressImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error("no file")); return; }
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("read failed")); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error("image failed")); };
        img.onload = function () {
          try {
            var w = img.naturalWidth || img.width || 0;
            var h = img.naturalHeight || img.height || 0;
            if (!w || !h) { resolve({ dataUrl: String(reader.result), w: 0, h: 0 }); return; }
            var scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(w, h));
            var cw = Math.max(1, Math.round(w * scale));
            var ch = Math.max(1, Math.round(h * scale));
            var canvas = document.createElement("canvas");
            canvas.width = cw;
            canvas.height = ch;
            var ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, cw, ch);
            var q = PHOTO_QUALITY;
            var dataUrl = canvas.toDataURL("image/jpeg", q);
            while (dataUrl.length > PHOTO_TARGET_CHARS && q > 0.4) {
              q = Math.round((q - 0.08) * 100) / 100;
              dataUrl = canvas.toDataURL("image/jpeg", q);
            }
            resolve({ dataUrl: dataUrl, w: cw, h: ch });
          } catch (e) { reject(e); }
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function attachPhoto(file) {
    var input = qs("#chatPhotoInput");
    if (!file) return;
    if (file.type && !/^image\//.test(file.type)) {
      toast("사진 파일만 올릴 수 있어요", "📷");
      if (input) input.value = "";
      return;
    }
    toast("사진을 준비하고 있어요…", "📷");
    compressImage(file).then(function (res) {
      sendChat({ kind: "photo", imageData: res.dataUrl, w: res.w, h: res.h });
      toast("사진을 보냈어요", "📷");
    }).catch(function () {
      toast("사진을 올리지 못했어요", "⚠️");
    }).then(function () {
      if (input) input.value = "";
    });
  }

  function openPhoto(msg) {
    if (!msg || !msg.imageData) return;
    openModal(
      '<div class="photo-viewer"><img class="photo-view" src="' + esc(msg.imageData) + '" alt="사진"></div>' +
      '<p class="muted center" style="font-size:12px">' + esc(msg.fromName || memberName(msg.from)) + ' · ' + esc(fmtTime(msg.at)) + '</p>' +
      '<div class="modal-actions"><button class="btn btn-ghost" type="button" data-action="close-modal">닫기</button></div>',
      { title: "사진" }
    );
  }

  /* ---------- 채팅 알림 (안 읽은 배지 · 배너 · 알림음) ---------- */
  var unreadCount = 0;
  var bannerTimer = null;
  var notiAudio = null;
  var notiSupported = typeof window.Notification === "function";

  function paintUnread() {
    var badge = qs("#chatBadge");
    if (!badge) return;
    if (unreadCount > 0) {
      badge.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      badge.hidden = false;
    } else {
      badge.textContent = "0";
      badge.hidden = true;
    }
  }

  function setUnread(n) {
    unreadCount = Math.max(0, n | 0);
    paintUnread();
  }

  function messagePreview(m) {
    if (!m) return "";
    if (m.kind === "photo") return "📷 사진을 보냈어요";
    if (m.kind === "sticker") return "🎀 스티커를 보냈어요";
    if (m.kind === "voice") return "🎙️ 음성 메시지를 보냈어요";
    if (m.kind === "quick") return (m.emoji ? m.emoji + " " : "") + (m.text || "");
    return m.text || "메시지";
  }

  function playNotiSound() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!notiAudio) notiAudio = new Ctx();
      if (notiAudio.state === "suspended" && notiAudio.resume) notiAudio.resume();
      [880, 1180].forEach(function (freq, i) {
        var osc = notiAudio.createOscillator();
        var gain = notiAudio.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        var t0 = notiAudio.currentTime + i * 0.13;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.075, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        osc.connect(gain);
        gain.connect(notiAudio.destination);
        osc.start(t0);
        osc.stop(t0 + 0.18);
      });
    } catch (e) { /* 소리는 실패해도 괜찮아요 */ }
  }

  function deviceNotify(m) {
    try {
      if (!notiSupported || !document.hidden) return;
      if (!state || !state.settings || state.settings.notify !== true) return;
      if (window.Notification.permission !== "granted") return;
      var n = new window.Notification("우리 가족 기록장 💬", {
        body: (m.fromName || memberName(m.from)) + ": " + messagePreview(m),
        tag: "family-chat",
        icon: "favicon.png"
      });
      n.onclick = function () {
        try { window.focus(); } catch (e) { /* 무시 */ }
        switchTab("chat");
        try { n.close(); } catch (e) { /* 무시 */ }
      };
    } catch (e) { /* 알림은 실패해도 괜찮아요 */ }
  }

  function hideChatBanner() {
    var b = qs("#chatBanner");
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = null;
    if (b) b.hidden = true;
  }

  function showChatBanner(m) {
    var b = qs("#chatBanner");
    if (!b || !m) return;
    b.innerHTML =
      '<span class="cb-ico" aria-hidden="true">💬</span>' +
      '<span class="cb-txt"><b>' + esc(m.fromName || memberName(m.from)) + '</b> · ' + esc(messagePreview(m)) + '</span>' +
      '<span class="cb-go">보기</span>';
    b.hidden = false;
    if (bannerTimer) clearTimeout(bannerTimer);
    bannerTimer = setTimeout(hideChatBanner, 5000);
  }

  function noteIncoming(msgs) {
    if (!msgs || !msgs.length) return;
    var last = msgs[msgs.length - 1];
    if (CURRENT_TAB !== "chat") {
      setUnread(unreadCount + msgs.length);
      showChatBanner(last);
    }
    playNotiSound();
    deviceNotify(last);
  }

  function toggleNotify() {
    if (!state.settings) state.settings = { weatherCache: null, notify: false };
    if (state.settings.notify) {
      state.settings.notify = false;
      persist();
      renderSettings();
      toast("채팅 알림을 꺼어요", "🔕");
      return;
    }
    if (!notiSupported) {
      toast("이 브라우저는 기기 알림을 지원하지 않아요", "🔕");
      return;
    }
    try {
      window.Notification.requestPermission().then(function (perm) {
        if (perm === "granted") {
          state.settings.notify = true;
          persist();
          toast("채팅 알림을 켰어요", "🔔");
        } else {
          toast("브라우저에서 알림을 허용해 주셔야 와요", "🔕");
        }
        renderSettings();
      }).catch(function () {
        toast("알림을 켜지 못했어요", "🔕");
      });
    } catch (e) {
      toast("알림을 켜지 못했어요", "🔕");
    }
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
      '<h4 class="title-font" style="font-size:14px;color:#5A463C;margin-top:10px">채팅 알림</h4>' +
      '<div class="setting-row"><div class="sr-main"><div class="sr-title">새 메시지 알림 ' + (state.settings && state.settings.notify ? "켜짐" : "꺼짐") + '</div>' +
        '<div class="sr-sub">' + (notiSupported
          ? "다른 가족이 보내면 화면 위 배너와 알림음으로 알려드려요. 기기 알림도 함께 받을 수 있어요."
          : "이 브라우저는 기기 알림을 지원하지 않아 배너와 알림음으로 알려드려요.") + '</div></div>' +
        '<button class="btn btn-xs ' + (state.settings && state.settings.notify ? "btn-ghost" : "btn-soft") + '" type="button" data-action="toggle-notify">' +
          (state.settings && state.settings.notify ? "끄기" : "알림 켜기") + '</button></div>' +
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

  function switchTab(tab, sub) {
    CURRENT_TAB = tab;
    if (tab === "together") {
      if (sub === "calendar" || sub === "checklist") TOGETHER_SUB = sub;
      renderTogether();
    }
    qsa(".view").forEach(function (v) {
      v.classList.toggle("is-active", v.getAttribute("data-view") === tab);
    });
    qsa(".tab-btn").forEach(function (b) {
      var on = b.getAttribute("data-tab") === tab;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (tab === "chat") { renderChat(); setUnread(0); hideChatBanner(); }
    if (tab === "growth") renderGrowth();
    if (tab === "home") { renderHomeWeather(); fetchWeather(false); }
  }

  function renderAll() {
    renderHome();
    renderStudy();
    renderDex();
    renderMission();
    renderTogether();
    renderGrowth();
    renderChat();
    renderStickerSheet();
    renderQuickPanel();
    paintUnread();
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
    var listId = btn.getAttribute("data-list");

    switch (act) {
      case "tab": switchTab(btn.getAttribute("data-tab"), btn.getAttribute("data-sub")); break;

      /* 홈 미니 달력 — 고른 날짜로 가족 달력을 연다 */
      case "home-cal-day": {
        var hcalKey = btn.getAttribute("data-date");
        if (isDateKey(hcalKey)) {
          ensureCalView();
          var hcalParts = splitKey(hcalKey);
          calView.y = hcalParts.y;
          calView.m = hcalParts.m;
          calView.selected = hcalKey;
        }
        switchTab("together", "calendar");
        break;
      }

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

      /* 저녁 루틴 · 용돈 */
      case "toggle-routine": toggleRoutineItem(id); break;
      case "add-routine": {
        var rdInput = qs("#routineInput");
        var added = addRoutineItem(rdInput ? rdInput.value : "");
        if (added) {
          var again = qs("#routineInput");
          if (again) again.focus();
        }
        break;
      }
      case "delete-routine": deleteRoutineItem(id); break;
      case "allowance-spend": openSpendAllowance(); break;
      case "allowance-reset": resetAllowance(); break;
      case "open-routine": {
        switchTab("mission");
        var routineEl = qs("#eveningRoutine");
        if (routineEl) {
          try { routineEl.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (e) { try { routineEl.scrollIntoView(); } catch (e2) { /* 무시 */ } }
          routineEl.classList.add("is-flash");
          setTimeout(function () { routineEl.classList.remove("is-flash"); }, 1700);
        }
        break;
      }

      /* 홈 — 태블릿 끄기 타이머 */
      case "open-timer": openTimerExpand(); break;
      case "tab-timer-preset": setTabletPreset(btn.getAttribute("data-min")); break;
      case "tab-timer-custom": {
        var tmin = Number(qs("#tabTimerMin") && qs("#tabTimerMin").value);
        if (!tmin || tmin < 1) { toast("분을 넣어 주세요", "⏳"); return; }
        setTabletPreset(tmin);
        toast(qs("#tabTimerMin") ? Math.min(180, tmin) + "분 타이머 준비" : "", "⏰");
        break;
      }
      case "tab-timer-toggle":
        if (tabletTimer.running) pauseTabletTimer();
        else startTabletTimer();
        break;
      case "tab-timer-reset": resetTabletTimer(); break;
      case "dismiss-alarm": dismissAlarm(); break;

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

      /* 함께 — 가족 달력 */
      case "together-sub": {
        TOGETHER_SUB = btn.getAttribute("data-sub") === "checklist" ? "checklist" : "calendar";
        renderTogether();
        break;
      }
      case "cal-month": {
        ensureCalView();
        var delta = Number(btn.getAttribute("data-delta")) || 0;
        calGoto(calView.y, calView.m + delta);
        renderTogether();
        break;
      }
      case "cal-today": {
        ensureCalView();
        var tp = splitKey(todayKey());
        calView.y = tp.y;
        calView.m = tp.m;
        calView.selected = todayKey();
        renderTogether();
        break;
      }
      case "cal-pick": {
        ensureCalView();
        var pickKey = btn.getAttribute("data-date");
        if (!isDateKey(pickKey)) return;
        var pickParts = splitKey(pickKey);
        calView.y = pickParts.y;
        calView.m = pickParts.m;
        calView.selected = pickKey;
        renderTogether();
        break;
      }
      case "add-event": openEventModal(null, btn.getAttribute("data-date")); break;
      case "edit-event": {
        var ev = allEvents().find(function (x) { return x.id === id; });
        if (ev) openEventModal(ev, null);
        break;
      }
      case "delete-event": {
        var evDel = allEvents().find(function (x) { return x.id === id; });
        if (!evDel) return;
        confirmModal("일정 삭제", "『" + evDel.title + "』 일정을 지울까요?", "삭제", function () {
          state.calendar.events = allEvents().filter(function (x) { return x.id !== id; });
          persist(true);
          renderAll();
          toast("일정을 지웠어요", "🗑️");
        });
        break;
      }

      /* 함께 — 체크리스트 */
      case "add-list": openListModal(null); break;
      case "rename-list": {
        var l0 = listById(id);
        if (l0) openListModal(l0);
        break;
      }
      case "delete-list": {
        var l1 = listById(id);
        if (!l1) return;
        confirmModal("리스트 삭제", "『" + l1.title + "』 리스트를 지울까요? 항목도 함께 지워져요.", "삭제", function () {
          state.checklists.lists = state.checklists.lists.filter(function (x) { return x.id !== id; });
          persist(true);
          renderAll();
          toast("리스트를 지웠어요", "🧺");
        });
        break;
      }
      case "toggle-cl-item": {
        var l2 = listById(listId);
        if (!l2) return;
        var itm = (l2.items || []).find(function (x) { return x.id === id; });
        if (!itm) return;
        itm.done = !itm.done;
        itm.doneAt = itm.done ? new Date().toISOString() : "";
        persist(true);
        renderAll();
        break;
      }
      case "delete-cl-item": {
        var l3 = listById(listId);
        if (!l3) return;
        l3.items = (l3.items || []).filter(function (x) { return x.id !== id; });
        persist(true);
        renderAll();
        break;
      }
      case "clear-done": {
        var l4 = listById(id);
        if (!l4) return;
        var doneCount = (l4.items || []).filter(function (x) { return x.done; }).length;
        if (!doneCount) { toast("정리할 완료 항목이 없어요", "✅"); return; }
        confirmModal("완료 항목 정리", "체크한 " + doneCount + "개를 목록에서 지울까요?", "정리하기", function () {
          l4.items = (l4.items || []).filter(function (x) { return !x.done; });
          persist(true);
          renderAll();
          toast(doneCount + "개를 정리했어요", "✨");
        });
        break;
      }

      /* 성장 */
      case "growth-metric": {
        growthMetric = btn.getAttribute("data-metric") === "weight" ? "weight" : "height";
        renderGrowth();
        break;
      }
      case "add-growth": openGrowthModal(null); break;
      case "del-growth": deleteGrowth(id); break;

      /* chat */
      case "toggle-quick": {
        var qgrid = qs("#quickGrid");
        if (!qgrid) break;
        var willHide = !qgrid.hidden;
        qgrid.hidden = willHide;
        var qt = qs("#quickToggle");
        if (qt) {
          qt.textContent = willHide ? "말판 열기" : "접기";
          qt.setAttribute("aria-expanded", willHide ? "false" : "true");
        }
        break;
      }
      case "quick-msg":
        sendQuickMessage(btn.getAttribute("data-label"), btn.getAttribute("data-emoji"));
        break;
      case "pick-photo": {
        var photoInput = qs("#chatPhotoInput");
        if (photoInput) photoInput.click();
        break;
      }
      case "view-photo": {
        openPhoto((state.chat || []).find(function (m) { return m.id === id; }));
        break;
      }
      case "open-chat": switchTab("chat"); break;
      case "toggle-notify": toggleNotify(); break;

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

  // 저녁 루틴 추가 입력에서 Enter
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter") return;
    var t = e.target;
    if (t && t.id === "routineInput") {
      e.preventDefault();
      var ok = addRoutineItem(t.value);
      if (ok) { var again = qs("#routineInput"); if (again) again.focus(); }
    }
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

  qs("#chatPhotoInput").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    if (file) attachPhoto(file);
  });

  // 함께 체크리스트의 “항목 추가” 줄
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || !form.classList || !form.classList.contains("cl-add")) return;
    e.preventDefault();
    var input = form.querySelector("input");
    if (!input) return;
    var text = input.value;
    var lid = form.getAttribute("data-list");
    input.value = "";
    addChecklistItem(lid, text);
  });

  /* ---------- 시작 ---------- */
  function boot() {
    store = Store.create(CFG);
    setInterval(tickClock, 1000);
    unsubStore = store.subscribe(function (payload, updatedAt) {
      // 다른 기기의 변경 반영 (내가 방금 저장한 것은 무시)
      if (!payload) return;
      if (state && payload.updatedAt === state.updatedAt) return;
      var seen = {};
      (state && Array.isArray(state.chat) ? state.chat : []).forEach(function (m) { if (m && m.id) seen[m.id] = true; });
      var incoming = (Array.isArray(payload.chat) ? payload.chat : []).filter(function (m) {
        return m && m.id && !seen[m.id] && m.from !== meId;
      });
      state = normalizeState(payload);
      renderAll();
      if (incoming.length) noteIncoming(incoming);
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
