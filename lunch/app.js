/* =========================================================
   점심 뭐 먹지? — app.js
   회사 점심 멤버들이 함께 쓰는 메뉴 뽑기 · 주변 맛집 추첨
   ========================================================= */

(function (global) {
  "use strict";

  var CFG = global.LUNCH_CONFIG || {};
  var APP = CFG.app || {};
  var MAX_HISTORY = APP.maxHistory || 40;
  var SEED_TS = "2026-11-26T00:00:00.000Z";

  var CATS = [
    { id: "korean", label: "한식", emoji: "🍚" },
    { id: "chinese", label: "중식", emoji: "🥟" },
    { id: "japanese", label: "일식", emoji: "🍣" },
    { id: "western", label: "양식", emoji: "🍝" },
    { id: "snack", label: "분식", emoji: "🍢" },
    { id: "asian", label: "아시안", emoji: "🍜" }
  ];
  var CAT_LABEL = {};
  var CAT_EMOJI = {};
  CATS.forEach(function (c) { CAT_LABEL[c.id] = c.label; CAT_EMOJI[c.id] = c.emoji; });

  /* ---------------- 기본 메뉴 (51종) ---------------- */
  var DEFAULT_MENUS = [
    ["d1", "김치찌개", "korean"], ["d2", "된장찌개", "korean"], ["d3", "제육볶음", "korean"],
    ["d4", "순대국밥", "korean"], ["d5", "비빔밥", "korean"], ["d6", "물냉면", "korean"],
    ["d7", "닭갈비", "korean"], ["d8", "삼겹살", "korean"], ["d9", "김치볶음밥", "korean"],
    ["d10", "감자탕", "korean"], ["d11", "부대찌개", "korean"], ["d12", "불고기정식", "korean"],
    ["d13", "갈비탕", "korean"], ["d14", "청국장", "korean"],
    ["d15", "짜장면", "chinese"], ["d16", "짬뽕", "chinese"], ["d17", "탕수육", "chinese"],
    ["d18", "마라탕", "chinese"], ["d19", "마라샹궈", "chinese"], ["d20", "꿔바로우", "chinese"],
    ["d21", "양꼬치", "chinese"], ["d22", "고추잡채밥", "chinese"],
    ["d23", "초밥", "japanese"], ["d24", "돈까스", "japanese"], ["d25", "라멘", "japanese"],
    ["d26", "우동", "japanese"], ["d27", "카레라이스", "japanese"], ["d28", "규동", "japanese"],
    ["d29", "텐동", "japanese"], ["d30", "사케동", "japanese"],
    ["d31", "파스타", "western"], ["d32", "피자", "western"], ["d33", "수제버거", "western"],
    ["d34", "리조또", "western"], ["d35", "스테이크덮밥", "western"], ["d36", "샐러드", "western"],
    ["d37", "오므라이스", "western"],
    ["d38", "떡볶이", "snack"], ["d39", "김밥", "snack"], ["d40", "라면", "snack"],
    ["d41", "샌드위치", "snack"], ["d42", "길거리토스트", "snack"], ["d43", "참치마요덮밥", "snack"],
    ["d44", "쌀국수", "asian"], ["d45", "팟타이", "asian"], ["d46", "반미", "asian"],
    ["d47", "인도커리", "asian"], ["d48", "타코", "asian"], ["d49", "분짜", "asian"],
    ["d50", "포케", "asian"], ["d51", "나시고랭", "asian"]
  ].map(function (row) {
    return { id: row[0], name: row[1], category: row[2], memo: "", custom: false, hidden: false };
  });

  /* ---------------- 작은 도우미 ---------------- */
  function nowIso() { return new Date().toISOString(); }
  function uid(prefix) {
    return (prefix || "x") + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }
  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function $(sel) { return document.querySelector(sel); }
  function arr(v) { return Array.isArray(v) ? v : []; }
  function clone(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }
  function distanceText(m) {
    var n = Number(m);
    if (!isFinite(n) || n <= 0) return "";
    return n < 1000 ? Math.round(n) + "m" : (n / 1000).toFixed(1) + "km";
  }
  function timeAgo(iso) {
    var t = Date.parse(iso);
    if (isNaN(t)) return "";
    var diff = Date.now() - t;
    if (diff < 60 * 1000) return "방금 전";
    if (diff < 60 * 60 * 1000) return Math.floor(diff / 60000) + "분 전";
    if (diff < 24 * 60 * 60 * 1000) return Math.floor(diff / 3600000) + "시간 전";
    var d = new Date(t);
    return (d.getMonth() + 1) + "월 " + d.getDate() + "일";
  }
  function readJSON(key) {
    try { return JSON.parse(global.localStorage.getItem(key) || "null"); }
    catch (e) { return null; }
  }
  function writeJSON(key, value) {
    try { global.localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  /* ---------------- 앱 상태 ---------------- */
  var store = null;
  var state = null;
  var ui = {
    tab: "menu",
    menuFilter: "all",
    showHidden: false,
    drawing: false,
    confirmDelete: "",
    confirmTimer: null,
    nickname: "",
    places: {
      lat: null, lng: null, label: "",
      radius: 500, category: "all",
      items: [], excluded: [], picked: null, updatedAt: null
    },
    map: null,
    markers: [],
    loadingPlaces: false,
    drawingPlace: false
  };

  function makeDefault(item) {
    return {
      id: item.id, name: item.name, category: item.category, memo: "",
      custom: false, hidden: false, createdAt: SEED_TS, updatedAt: SEED_TS
    };
  }

  function emptyState() {
    return {
      version: 1,
      updatedAt: nowIso(),
      menus: DEFAULT_MENUS.map(makeDefault),
      excluded: [],
      history: [],
      deleted: { menus: {}, history: {} }
    };
  }

  function normalizeMenu(m) {
    if (!m || typeof m !== "object" || !m.id) return null;
    return {
      id: String(m.id),
      name: String(m.name || "").slice(0, 40) || "이름 없는 메뉴",
      category: CAT_LABEL[m.category] ? m.category : "korean",
      memo: String(m.memo || "").slice(0, 80),
      custom: !!m.custom,
      hidden: !!m.hidden,
      createdAt: m.createdAt || SEED_TS,
      updatedAt: m.updatedAt || m.createdAt || SEED_TS
    };
  }

  function normalizeState(s) {
    s = (s && typeof s === "object") ? s : {};
    var out = {
      version: 1,
      updatedAt: s.updatedAt || nowIso(),
      menus: arr(s.menus).map(normalizeMenu).filter(Boolean),
      excluded: arr(s.excluded).filter(function (x) { return typeof x === "string"; }),
      history: arr(s.history).filter(function (h) { return h && typeof h === "object"; }).map(function (h) {
        return {
          id: h.id || uid("h"),
          menuId: h.menuId || "",
          name: String(h.name || "").slice(0, 40),
          category: CAT_LABEL[h.category] ? h.category : "korean",
          by: String(h.by || "").slice(0, 20),
          at: h.at || nowIso(),
          source: h.source === "place" ? "place" : "menu"
        };
      }),
      deleted: {
        menus: (s.deleted && s.deleted.menus) || {},
        history: (s.deleted && s.deleted.history) || {}
      }
    };
    out.history = out.history
      .sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); })
      .slice(0, MAX_HISTORY);
    return out;
  }

  // 기본 메뉴는 "없을 때만" 채운다 (지운 메뉴는 tombstone 때문에 되살아나지 않음)
  function ensureDefaults(s) {
    var have = {};
    s.menus.forEach(function (m) { have[m.id] = true; });
    var changed = false;
    DEFAULT_MENUS.forEach(function (d) {
      if (have[d.id]) return;
      if (s.deleted && s.deleted.menus && s.deleted.menus[d.id]) return;
      s.menus.push(makeDefault(d));
      changed = true;
    });
    return changed;
  }

  function excludedSet() {
    var map = {};
    arr(state.excluded).forEach(function (id) { map[id] = true; });
    return map;
  }

  function save() {
    if (!store) return;
    state.updatedAt = nowIso();
    store.save(state).then(function () { renderSync(); }).catch(function (err) {
      toast((err && err.message) || "저장에 실패했어요.");
    });
  }

  /* ---------------- 토스트 ---------------- */
  var toastTimer = null;
  function toast(text) {
    var el = $("#toast");
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      el.classList.remove("is-visible");
      setTimeout(function () { el.hidden = true; }, 250);
    }, 2400);
  }

  /* ---------------- 닉네임 ---------------- */
  function loadNickname() {
    try { return global.localStorage.getItem(APP.deviceKey) || ""; }
    catch (e) { return ""; }
  }
  function saveNickname(name) {
    ui.nickname = String(name || "").slice(0, 12);
    try { global.localStorage.setItem(APP.deviceKey, ui.nickname); } catch (e) { /* 무시 */ }
  }

  /* ---------------- 렌더: 공통 ---------------- */
  function renderSync() {
    var el = $("#syncBadge");
    if (!el || !store) return;
    var label = store.shortLabel ? store.shortLabel() : "";
    el.textContent = label;
    el.title = store.describe ? store.describe() : "";
    el.dataset.mode = store.mode || "";
    el.classList.toggle("is-offline", label === "오프라인 저장");
  }

  function renderTabs() {
    var menu = $("#tabMenu"), places = $("#tabPlaces");
    if (menu) { menu.classList.toggle("is-active", ui.tab === "menu"); menu.setAttribute("aria-selected", ui.tab === "menu" ? "true" : "false"); }
    if (places) { places.classList.toggle("is-active", ui.tab === "places"); places.setAttribute("aria-selected", ui.tab === "places" ? "true" : "false"); }
    var vMenu = $("#viewMenu"), vPlaces = $("#viewPlaces");
    if (vMenu) vMenu.classList.toggle("is-active", ui.tab === "menu");
    if (vPlaces) vPlaces.classList.toggle("is-active", ui.tab === "places");
  }

  /* ---------------- 렌더: 메뉴 ---------------- */
  function renderMenuFilter() {
    var box = $("#menuFilter");
    if (!box) return;
    var options = [{ id: "all", label: "전체", emoji: "🍽️" }].concat(CATS);
    box.innerHTML = options.map(function (c) {
      var active = ui.menuFilter === c.id ? " is-active" : "";
      return '<button type="button" class="chip' + active + '" data-action="filter-menu" data-cat="' + esc(c.id) + '">' +
        (c.emoji || "") + " " + esc(c.label) + "</button>";
    }).join("");
  }

  function visibleMenus() {
    return state.menus.filter(function (m) {
      return ui.menuFilter === "all" || m.category === ui.menuFilter;
    });
  }

  function renderMenus() {
    var box = $("#menuList");
    if (!box) return;
    var ex = excludedSet();
    var list = visibleMenus().filter(function (m) { return ui.showHidden ? true : !m.hidden; });
    var shown = visibleMenus();
    var hiddenCount = shown.filter(function (m) { return m.hidden; }).length;

    var countEl = $("#menuCount");
    if (countEl) countEl.textContent = shown.length + "개";

    var hiddenNote = $("#hiddenNote");
    if (hiddenNote) {
      hiddenNote.hidden = hiddenCount === 0;
      hiddenNote.innerHTML = hiddenCount
        ? '숨긴 메뉴 ' + hiddenCount + "개 · " +
          '<button type="button" class="link-btn" data-action="toggle-hidden">' +
          (ui.showHidden ? "숨기기" : "보기") + "</button>"
        : "";
    }

    if (!list.length) {
      box.innerHTML = '<li class="empty">' +
        (shown.length ? "숨긴 메뉴만 있어요." : "이 분류에 메뉴가 없어요. 아래에서 추가해 보세요.") + "</li>";
      return;
    }

    list.sort(function (a, b) {
      if (a.category !== b.category) return CATS.findIndex(function (c) { return c.id === a.category; }) - CATS.findIndex(function (c) { return c.id === b.category; });
      return String(a.name).localeCompare(String(b.name), "ko");
    });

    box.innerHTML = list.map(function (m) {
      var off = !!ex[m.id];
      var confirming = ui.confirmDelete === m.id;
      return '<li class="menu-row' + (m.hidden ? " is-hidden" : "") + (off ? " is-excluded" : "") + '" data-id="' + esc(m.id) + '">' +
        '<label class="menu-check" title="오늘 뽑기에서 빼기">' +
          '<input type="checkbox" data-action="toggle-exclude" data-id="' + esc(m.id) + '"' + (off ? " checked" : "") + ">" +
          '<span class="menu-check-mark">빼기</span>' +
        "</label>" +
        '<div class="menu-main">' +
          '<div class="menu-title"><span class="menu-emoji">' + (CAT_EMOJI[m.category] || "🍽️") + "</span>" +
            '<span class="menu-name">' + esc(m.name) + "</span>" +
            '<span class="cat-badge cat-' + esc(m.category) + '">' + esc(CAT_LABEL[m.category] || "") + "</span>" +
            (m.custom ? '<span class="custom-badge">직접 추가</span>' : "") +
            (m.hidden ? '<span class="hidden-badge">숨김</span>' : "") +
          "</div>" +
          (m.memo ? '<p class="menu-memo">' + esc(m.memo) + "</p>" : "") +
        "</div>" +
        '<div class="menu-actions">' +
          '<button type="button" class="icon-btn" data-action="toggle-hide" data-id="' + esc(m.id) + '" title="' +
            (m.hidden ? "다시 보이기" : "목록에서 숨기기") + '">' + (m.hidden ? "🙈" : "👁️") + "</button>" +
          (confirming
            ? '<button type="button" class="icon-btn danger is-confirming" data-action="delete-menu-confirm" data-id="' + esc(m.id) + '" title="정말 삭제">지우기</button>'
            : '<button type="button" class="icon-btn" data-action="delete-menu" data-id="' + esc(m.id) + '" title="삭제">✕</button>') +
        "</div>" +
        "</li>";
    }).join("");
  }

  function renderHistory() {
    var box = $("#historyList");
    if (!box) return;
    var list = arr(state.history).slice(0, 20);
    var countEl = $("#historyCount");
    if (countEl) countEl.textContent = state.history.length ? state.history.length + "개" : "";
    if (!list.length) {
      box.innerHTML = '<li class="empty">아직 뽑기 기록이 없어요. 첫 메뉴를 뽑아 보세요!</li>';
      return;
    }
    box.innerHTML = list.map(function (h) {
      return '<li class="history-row">' +
        '<span class="history-emoji">' + (CAT_EMOJI[h.category] || "🍽️") + "</span>" +
        '<span class="history-name">' + esc(h.name) + "</span>" +
        '<span class="history-by">' + esc(h.by || "익명") + "</span>" +
        '<span class="history-time">' + esc(timeAgo(h.at)) + "</span>" +
        "</li>";
    }).join("");
  }

  function renderDrawHint() {
    var el = $("#drawHint");
    if (!el) return;
    var pool = drawPool();
    var ex = Object.keys(excludedSet()).length;
    el.textContent = pool.length
      ? "지금 뽑을 수 있는 메뉴 " + pool.length + "개" + (ex ? " · 오늘 빼기 " + ex + "개" : "")
      : "뽑을 메뉴가 없어요. 오늘 빼기를 풀거나 메뉴를 추가해 보세요.";
  }

  function drawPool() {
    var ex = excludedSet();
    return state.menus.filter(function (m) {
      if (m.hidden || ex[m.id]) return false;
      return ui.menuFilter === "all" || m.category === ui.menuFilter;
    });
  }

  /* ---------------- 추첨 애니메이션 ---------------- */
  function animateSlot(slotEl, names, done) {
    var reduce = false;
    try { reduce = global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches; }
    catch (e) { reduce = false; }
    if (reduce || names.length < 2) { done(); return; }
    var start = Date.now();
    var total = 1500;
    slotEl.classList.add("is-rolling");
    function tick() {
      slotEl.textContent = names[Math.floor(Math.random() * names.length)];
      var t = Date.now() - start;
      if (t >= total) {
        slotEl.classList.remove("is-rolling");
        done();
        return;
      }
      var wait = 55 + Math.round((t / total) * (t / total) * 320);
      setTimeout(tick, wait);
    }
    tick();
  }

  function drawMenu() {
    if (ui.drawing) return;
    var pool = drawPool();
    if (!pool.length) {
      toast("뽑을 메뉴가 없어요. 오늘 빼기를 풀거나 메뉴를 추가해 보세요.");
      return;
    }
    ui.drawing = true;
    var winner = pool[Math.floor(Math.random() * pool.length)];
    var slot = $("#drawSlot");
    var btn = $("#drawBtn");
    if (btn) btn.disabled = true;
    if (slot) slot.textContent = winner.name;
    var names = pool.map(function (m) { return m.name; });

    var finish = function () {
      ui.drawing = false;
      if (btn) btn.disabled = false;
      if (slot) {
        slot.textContent = winner.name;
        slot.classList.add("is-winner");
        setTimeout(function () { slot.classList.remove("is-winner"); }, 900);
      }
      showMenuResult(winner);
      recordDraw(winner);
    };
    if (slot) animateSlot(slot, names, finish); else finish();
  }

  function showMenuResult(winner) {
    var box = $("#drawResult");
    if (!box) return;
    box.hidden = false;
    box.innerHTML = '<p class="result-label">오늘의 점심은…</p>' +
      '<p class="result-name"><span class="result-emoji">' + (CAT_EMOJI[winner.category] || "🍽️") + "</span>" + esc(winner.name) + "</p>" +
      '<p class="result-meta">' + esc(CAT_LABEL[winner.category] || "") +
        (winner.memo ? " · " + esc(winner.memo) : "") + "</p>" +
      '<div class="result-actions">' +
        '<button type="button" class="btn-ghost" data-action="draw-menu">🎲 한 번 더</button>' +
        '<button type="button" class="btn-ghost" data-action="open-places">📍 주변 맛집 보기</button>' +
      "</div>";
  }

  function recordDraw(winner) {
    var entry = {
      id: uid("h"),
      menuId: winner.id,
      name: winner.name,
      category: winner.category,
      by: ui.nickname || "익명",
      at: nowIso(),
      source: "menu"
    };
    state.history.unshift(entry);
    state.history = state.history.slice(0, MAX_HISTORY);
    renderHistory();
    save();
  }

  /* ---------------- 메뉴 조작 ---------------- */
  function toggleExclude(id) {
    var ex = excludedSet();
    if (ex[id]) state.excluded = state.excluded.filter(function (x) { return x !== id; });
    else if (state.excluded.indexOf(id) === -1) state.excluded.push(id);
    renderMenus();
    renderDrawHint();
    save();
  }

  function toggleHide(id) {
    var m = state.menus.find(function (x) { return x.id === id; });
    if (!m) return;
    m.hidden = !m.hidden;
    m.updatedAt = nowIso();
    renderMenus();
    renderDrawHint();
    save();
  }

  function requestDelete(id) {
    clearTimeout(ui.confirmTimer);
    ui.confirmDelete = id;
    renderMenus();
    ui.confirmTimer = setTimeout(function () {
      ui.confirmDelete = "";
      renderMenus();
    }, 4000);
  }

  function deleteMenu(id) {
    var m = state.menus.find(function (x) { return x.id === id; });
    if (!m) return;
    state.menus = state.menus.filter(function (x) { return x.id !== id; });
    state.excluded = state.excluded.filter(function (x) { return x !== id; });
    state.deleted = state.deleted || { menus: {}, history: {} };
    state.deleted.menus = state.deleted.menus || {};
    state.deleted.menus[id] = nowIso();
    ui.confirmDelete = "";
    clearTimeout(ui.confirmTimer);
    renderMenus();
    renderDrawHint();
    toast(m.name + " 메뉴를 지웠어요. 기본 메뉴라면 복원할 수 있어요.");
    save();
  }

  function addMenu(name, category, memo) {
    var clean = String(name || "").trim().slice(0, 40);
    if (!clean) { toast("메뉴 이름을 입력해 주세요."); return false; }
    var dup = state.menus.some(function (m) { return !m.hidden && m.name === clean; });
    if (dup) { toast("이미 메뉴판에 있는 이름이에요."); return false; }
    var id = uid("m");
    state.menus.push({
      id: id,
      name: clean,
      category: CAT_LABEL[category] ? category : "korean",
      memo: String(memo || "").trim().slice(0, 80),
      custom: true,
      hidden: false,
      createdAt: nowIso(),
      updatedAt: nowIso()
    });
    if (state.deleted && state.deleted.menus) delete state.deleted.menus[id];
    renderMenus();
    renderDrawHint();
    save();
    toast("'" + clean + "' 메뉴를 추가했어요. 멤버 모두에게 공유돼요.");
    return true;
  }

  function restoreDefaults() {
    var added = 0;
    DEFAULT_MENUS.forEach(function (d) {
      var cur = state.menus.find(function (m) { return m.id === d.id; });
      if (cur) { cur.hidden = false; cur.updatedAt = nowIso(); return; }
      delete (state.deleted.menus || {})[d.id];
      state.menus.push(makeDefault(d));
      added++;
    });
    renderMenus();
    renderDrawHint();
    save();
    toast(added ? "기본 메뉴 " + added + "개를 되살렸어요." : "기본 메뉴를 모두 보이게 했어요.");
  }

  function clearHistory() {
    var tomb = (state.deleted && state.deleted.history) || {};
    arr(state.history).forEach(function (h) { tomb[h.id] = nowIso(); });
    state.history = [];
    state.deleted = state.deleted || { menus: {}, history: {} };
    state.deleted.history = tomb;
    renderHistory();
    save();
    toast("뽑기 기록을 지웠어요.");
  }

  /* ---------------- 위치 / 주변 맛집 ---------------- */
  function loadPlaces() {
    var saved = readJSON(APP.placesKey);
    if (saved && typeof saved === "object") {
      ui.places = Object.assign(ui.places, {
        lat: typeof saved.lat === "number" ? saved.lat : null,
        lng: typeof saved.lng === "number" ? saved.lng : null,
        label: saved.label || "",
        radius: [300, 500, 1000, 2000].indexOf(saved.radius) >= 0 ? saved.radius : 500,
        category: saved.category || "all",
        items: arr(saved.items),
        excluded: arr(saved.excluded),
        picked: saved.picked || null,
        updatedAt: saved.updatedAt || null
      });
    }
  }
  function savePlaces() {
    writeJSON(APP.placesKey, ui.places);
  }

  var kakaoPromise = null;
  function loadKakao() {
    if (kakaoPromise) return kakaoPromise;
    kakaoPromise = new Promise(function (resolve, reject) {
      if (!CFG.kakaoAppKey) { reject(new Error("nokey")); return; }
      if (global.kakao && global.kakao.maps && global.kakao.maps.services) {
        global.kakao.maps.load(function () { resolve(global.kakao.maps); });
        return;
      }
      var src = "https://dapi.kakao.com/v2/maps/sdk.js?appkey=" + encodeURIComponent(CFG.kakaoAppKey) +
        "&libraries=services&autoload=false";
      var existing = document.querySelector('script[data-kakao-sdk="1"]');
      var el = existing;
      if (!el) {
        el = document.createElement("script");
        el.src = src;
        el.async = true;
        el.setAttribute("data-kakao-sdk", "1");
        document.head.appendChild(el);
      }
      var settled = false;
      el.addEventListener("load", function () {
        if (settled) return;
        settled = true;
        if (!global.kakao || !global.kakao.maps) { reject(new Error("sdk")); return; }
        global.kakao.maps.load(function () { resolve(global.kakao.maps); });
      });
      el.addEventListener("error", function () {
        if (settled) return;
        settled = true;
        reject(new Error("load"));
      });
    });
    return kakaoPromise;
  }

  function placeFilterCategory() {
    return [
      { id: "all", label: "전체" },
      { id: "korean", label: "한식" },
      { id: "chinese", label: "중식" },
      { id: "japanese", label: "일식" },
      { id: "western", label: "양식" },
      { id: "cafe", label: "카페·디저트" }
    ];
  }

  function renderPlaceChips() {
    var radiusBox = $("#radiusChips");
    if (radiusBox) {
      radiusBox.innerHTML = [
        { v: 300, label: "300m" }, { v: 500, label: "500m" },
        { v: 1000, label: "1km" }, { v: 2000, label: "2km" }
      ].map(function (r) {
        return '<button type="button" class="chip' + (ui.places.radius === r.v ? " is-active" : "") +
          '" data-action="set-radius" data-radius="' + r.v + '">' + r.label + "</button>";
      }).join("");
    }
    var catBox = $("#placeFilter");
    if (catBox) {
      catBox.innerHTML = placeFilterCategory().map(function (c) {
        return '<button type="button" class="chip' + (ui.places.category === c.id ? " is-active" : "") +
          '" data-action="filter-place" data-cat="' + esc(c.id) + '">' + esc(c.label) + "</button>";
      }).join("");
    }
  }

  function renderPlaceStatus() {
    var el = $("#placeStatus");
    if (!el) return;
    if (ui.places.lat === null) {
      el.innerHTML = '<span class="status-dot"></span>위치를 아직 몰라요. <b>내 위치로 찾기</b> 또는 아래에 동네·주소를 입력해 주세요.';
    } else {
      el.innerHTML = '<span class="status-dot is-on"></span>' + esc(ui.places.label || "현재 위치") +
        (ui.places.items.length ? " · 맛집 " + ui.places.items.length + "곳" : "") +
        (ui.places.updatedAt ? ' <span class="muted">(' + esc(timeAgo(ui.places.updatedAt)) + " 확인)</span>" : "");
    }
    var notice = $("#kakaoNotice");
    if (notice) notice.hidden = !!CFG.kakaoAppKey;
    var keyBadge = $("#kakaoKeyState");
    if (keyBadge) {
      keyBadge.textContent = CFG.kakaoAppKey ? "카카오맵 키 연결됨" : "카카오맵 키 없음";
      keyBadge.classList.toggle("is-off", !CFG.kakaoAppKey);
    }
  }

  // 카페(CE7)인지 — 분류 이름이나 검색 종류로 판단
  function isCafePlace(p) {
    if (!p) return false;
    if (p.kind === "cafe") return true;
    return /카페|디저트/.test(String(p.category || ""));
  }

  function filteredPlaces() {
    var cat = ui.places.category;
    if (cat === "all") {
      // '전체'는 식사용 음식점만 — 예전에 저장해 둔 카페가 섞여 있어도 빼고 보여 준다
      return ui.places.items.filter(function (p) { return !isCafePlace(p); });
    }
    return ui.places.items.filter(function (p) {
      var name = String(p.category || "");
      if (cat === "cafe") return /카페|디저트/.test(name) || p.kind === "cafe";
      var label = CAT_LABEL[cat] || "";
      return label && name.indexOf(label) >= 0;
    });
  }

  function placePool() {
    var ex = {};
    ui.places.excluded.forEach(function (id) { ex[id] = true; });
    return filteredPlaces().filter(function (p) { return !ex[p.id]; });
  }

  function renderPlaces() {
    renderPlaceChips();
    renderPlaceStatus();
    var box = $("#restList");
    if (!box) return;
    var list = filteredPlaces().slice().sort(function (a, b) { return (a.distance || 0) - (b.distance || 0); });
    var countEl = $("#restCount");
    if (countEl) countEl.textContent = list.length ? list.length + "곳" : "";
    var titleEl = $("#restTitle");
    if (titleEl) titleEl.textContent = ui.places.category === "cafe" ? "주변 카페·디저트" : "주변 음식점";
    if (ui.loadingPlaces) {
      box.innerHTML = '<li class="empty">주변 맛집을 찾고 있어요…</li>';
      return;
    }
    if (!list.length) {
      box.innerHTML = '<li class="empty">' +
        (CFG.kakaoAppKey
          ? "아직 불러온 맛집이 없어요. 위치를 잡고 ‘주변 맛집 찾기’를 눌러 주세요."
          : "카카오맵 키가 설정되면 주변 맛집을 불러올 수 있어요.") + "</li>";
      return;
    }
    var ex = {};
    ui.places.excluded.forEach(function (id) { ex[id] = true; });
    box.innerHTML = list.slice(0, 60).map(function (p) {
      var off = !!ex[p.id];
      var leaf = String(p.category || "").split(">").pop().trim();
      return '<li class="rest-row' + (off ? " is-excluded" : "") + '" data-id="' + esc(p.id) + '">' +
        '<label class="menu-check" title="추첨에서 빼기">' +
          '<input type="checkbox" data-action="toggle-place" data-id="' + esc(p.id) + '"' + (off ? " checked" : "") + ">" +
          '<span class="menu-check-mark">빼기</span>' +
        "</label>" +
        '<div class="rest-main">' +
          '<div class="rest-title"><span class="rest-name">' + esc(p.name) + "</span>" +
            (p.distance ? '<span class="rest-distance">' + esc(distanceText(p.distance)) + "</span>" : "") +
          "</div>" +
          '<p class="rest-meta">' + esc(leaf || p.category || "음식점") + "</p>" +
          (p.address ? '<p class="rest-addr">' + esc(p.address) + "</p>" : "") +
          '<div class="rest-links">' +
            (p.phone ? '<a href="tel:' + esc(String(p.phone).replace(/[^0-9+\-]/g, "")) + '">📞 ' + esc(p.phone) + "</a>" : "") +
            (p.url ? '<a href="' + esc(p.url) + '" target="_blank" rel="noopener">카카오맵에서 보기 ↗</a>' : "") +
          "</div>" +
        "</div>" +
        "</li>";
    }).join("");
  }

  function renderPlaceResult() {
    var box = $("#restResult");
    if (!box) return;
    var p = ui.places.picked;
    if (!p) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = '<p class="result-label">오늘 갈 곳은…</p>' +
      '<p class="result-name">📍 ' + esc(p.name) + "</p>" +
      '<p class="result-meta">' + esc(String(p.category || "").split(">").pop().trim() || "음식점") +
        (p.distance ? " · " + esc(distanceText(p.distance)) : "") + "</p>" +
      (p.address ? '<p class="result-addr">🗺️ ' + esc(p.address) + "</p>" : "") +
      (p.phone ? '<p class="result-addr">📞 ' + esc(p.phone) + "</p>" : "") +
      '<div class="result-actions">' +
        '<button type="button" class="btn-ghost" data-action="draw-place">🎲 한 번 더</button>' +
        (p.url ? '<a class="btn-ghost" href="' + esc(p.url) + '" target="_blank" rel="noopener">카카오맵 ↗</a>' : "") +
      "</div>";
  }

  function handleKakaoError(err) {
    var reason = err && err.message;
    if (reason === "nokey") {
      renderPlaceStatus();
      toast("카카오맵 JavaScript 키가 아직 없어요. config.js 의 kakaoAppKey 를 채워 주세요.");
    } else {
      toast("카카오맵을 불러오지 못했어요. config.js 의 JavaScript 키와 카카오 디벨로퍼스의 도메인 등록을 확인해 주세요.");
    }
  }

  function setLocation(lat, lng, label) {
    ui.places.lat = lat;
    ui.places.lng = lng;
    ui.places.label = label || ui.places.label || "현재 위치";
    savePlaces();
    renderPlaceStatus();
  }

  function locate() {
    renderPlaceStatus();
    if (!global.navigator || !global.navigator.geolocation) {
      toast("이 브라우저에서는 위치를 가져올 수 없어요. 동네·주소로 검색해 주세요.");
      return;
    }
    var status = $("#placeStatus");
    if (status) status.innerHTML = '<span class="status-dot is-on"></span>위치를 확인하고 있어요…';
    global.navigator.geolocation.getCurrentPosition(function (pos) {
      setLocation(pos.coords.latitude, pos.coords.longitude, "현재 위치");
      findPlaces();
    }, function (err) {
      renderPlaceStatus();
      var msg = (err && err.code === 1)
        ? "위치 권한이 꺼져 있어요. 주소로 검색하시거나 브라우저에서 위치를 허용해 주세요."
        : "위치를 찾지 못했어요. 아래에 동네·주소를 입력해 주세요.";
      toast(msg);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
  }

  function searchAddress(query) {
    var q = String(query || "").trim();
    if (!q) { toast("동네나 주소(예: 분당 정자동)를 입력해 주세요."); return; }
    if (!CFG.kakaoAppKey) { handleKakaoError(new Error("nokey")); return; }
    loadKakao().then(function (maps) {
      var places = new global.kakao.maps.services.Places();
      places.keywordSearch(q, function (data, status) {
        if (status !== global.kakao.maps.services.Status.OK || !data || !data.length) {
          toast("주소를 찾지 못했어요. 다른 동네 이름으로 검색해 보세요.");
          return;
        }
        var hit = data[0];
        var label = hit.road_address_name || hit.address_name || hit.place_name || q;
        setLocation(Number(hit.y), Number(hit.x), label);
        findPlaces();
      });
    }).catch(handleKakaoError);
  }

  function categoryQueries() {
    var cat = ui.places.category;
    var out = [];
    // '카페·디저트'를 직접 고른 때만 CE7(카페)을 불러온다.
    // '전체'는 식사용 음식점 FD6 만 — 추첨에 카페가 섞이지 않게.
    if (cat === "cafe") out.push({ code: "CE7", kind: "cafe" });
    else out.push({ code: "FD6", kind: "food" });
    return out;
  }

  function haversine(aLat, aLng, bLat, bLng) {
    var R = 6371000;
    var toRad = Math.PI / 180;
    var dLat = (bLat - aLat) * toRad;
    var dLng = (bLng - aLng) * toRad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return Math.round(2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s)));
  }

  // 카카오는 한 번 검색에 15곳까지만 준다 → 중심을 조금씩 옮겨 여러 번 검색해 모은다
  function searchCenters(lat, lng, radius) {
    var dLat = (radius * 0.55) / 111320;
    var dLng = (radius * 0.55) / (111320 * Math.max(0.2, Math.cos(lat * Math.PI / 180)));
    return [
      { lat: lat, lng: lng },
      { lat: lat + dLat, lng: lng },
      { lat: lat - dLat, lng: lng },
      { lat: lat, lng: lng + dLng },
      { lat: lat, lng: lng - dLng }
    ];
  }

  function findPlaces() {
    if (ui.places.lat === null || ui.places.lng === null) { locate(); return; }
    if (!CFG.kakaoAppKey) { handleKakaoError(new Error("nokey")); return; }
    ui.loadingPlaces = true;
    renderPlaces();
    loadKakao().then(function () {
      var maps = global.kakao.maps;
      var services = maps.services;
      var centers = searchCenters(ui.places.lat, ui.places.lng, ui.places.radius);
      var queries = categoryQueries();
      var collected = {};
      var pending = centers.length * queries.length;

      function finish() {
        ui.loadingPlaces = false;
        var items = Object.keys(collected).map(function (k) { return collected[k]; })
          .filter(function (p) { return p.distance <= Math.round(ui.places.radius * 1.05); })
          .sort(function (a, b) { return a.distance - b.distance; });
        // '전체'는 카페를 빼고 음식점만 남긴다 (카페는 '카페·디저트'를 고를 때만)
        if (ui.places.category === "all") {
          items = items.filter(function (p) { return !isCafePlace(p); });
        } else if (ui.places.category !== "cafe") {
          // 분류를 고르면 그 분류 음식점만 남긴다
          var label = CAT_LABEL[ui.places.category] || "";
          items = items.filter(function (p) { return String(p.category || "").indexOf(label) >= 0; });
        }
        ui.places.items = items;
        var keep = {};
        items.forEach(function (p) { keep[p.id] = true; });
        ui.places.excluded = ui.places.excluded.filter(function (id) { return keep[id]; });
        ui.places.updatedAt = nowIso();
        savePlaces();
        renderPlaces();
        renderPlaceResult();
        drawMap();
        if (!ui.places.items.length) toast("이 반경에는 음식점이 없어요. 반경을 넓혀 보세요.");
      }

      function done() {
        pending -= 1;
        if (pending > 0) return;
        finish();
      }

      queries.forEach(function (q) {
        centers.forEach(function (c) {
          var ps = new services.Places();
          var options = {
            location: new maps.LatLng(c.lat, c.lng),
            radius: Math.min(ui.places.radius, 20000),
            sort: services.SortBy.DISTANCE
          };
          var handle = function (data, status) {
            if (status === services.Status.OK && data) {
              data.forEach(function (place) {
                var id = String(place.id || (place.place_name + "|" + place.x + "," + place.y));
                if (collected[id]) return;
                var lat = Number(place.y), lng = Number(place.x);
                var dist = (isFinite(lat) && isFinite(lng))
                  ? haversine(ui.places.lat, ui.places.lng, lat, lng)
                  : (Number(place.distance) || 0);
                collected[id] = {
                  id: id,
                  name: place.place_name,
                  category: place.category_name || "",
                  kind: q.kind,
                  distance: dist,
                  address: place.road_address_name || place.address_name || "",
                  phone: place.phone || "",
                  url: place.place_url || "",
                  x: lng,
                  y: lat
                };
              });
            }
            done();
          };
          try { ps.categorySearch(q.code, handle, options); }
          catch (e) { handle([], "ERROR"); }
        });
      });
    }).catch(function (err) {
      ui.loadingPlaces = false;
      renderPlaces();
      handleKakaoError(err);
    });
  }

  function drawMap() {
    var el = $("#mapPreview");
    if (!el || !global.kakao || !global.kakao.maps || ui.places.lat === null) return;
    try {
      var maps = global.kakao.maps;
      var center = new maps.LatLng(ui.places.lat, ui.places.lng);
      if (!ui.map) ui.map = new maps.Map(el, { center: center, level: 5 });
      else ui.map.setCenter(center);
      el.classList.add("has-map");
      ui.markers.forEach(function (m) { m.setMap(null); });
      ui.markers = [];
      var bounds = new maps.LatLngBounds();
      bounds.extend(center);
      var me = new maps.Marker({ position: center, map: ui.map, title: "내 위치" });
      ui.markers.push(me);
      filteredPlaces().slice(0, 12).forEach(function (p) {
        if (!isFinite(p.x) || !isFinite(p.y)) return;
        var pos = new maps.LatLng(p.y, p.x);
        bounds.extend(pos);
        ui.markers.push(new maps.Marker({ position: pos, map: ui.map, title: p.name }));
      });
      ui.map.setBounds(bounds);
    } catch (e) { /* 지도는 없어도 목록은 쓸 수 있어요 */ }
  }

  function drawPlace() {
    if (ui.drawingPlace) return;
    var pool = placePool();
    if (!pool.length) {
      toast(ui.places.items.length ? "뽑을 맛집이 없어요. ‘빼기’를 풀어 보세요." : "먼저 주변 맛집을 불러와 주세요.");
      return;
    }
    ui.drawingPlace = true;
    var winner = pool[Math.floor(Math.random() * pool.length)];
    var slot = $("#restSlot");
    var btn = $("#restDrawBtn");
    if (btn) btn.disabled = true;
    if (slot) slot.textContent = winner.name;
    var names = pool.map(function (p) { return p.name; });
    var finish = function () {
      ui.drawingPlace = false;
      if (btn) btn.disabled = false;
      if (slot) {
        slot.textContent = winner.name;
        slot.classList.add("is-winner");
        setTimeout(function () { slot.classList.remove("is-winner"); }, 900);
      }
      ui.places.picked = winner;
      savePlaces();
      renderPlaceResult();
    };
    if (slot) animateSlot(slot, names, finish); else finish();
  }

  function togglePlaceExclude(id) {
    var i = ui.places.excluded.indexOf(id);
    if (i >= 0) ui.places.excluded.splice(i, 1);
    else ui.places.excluded.push(id);
    savePlaces();
    renderPlaces();
  }

  function setRadius(v) {
    ui.places.radius = Number(v) || 500;
    savePlaces();
    renderPlaceChips();
    if (ui.places.lat !== null) findPlaces();
  }

  function setPlaceCategory(cat) {
    ui.places.category = cat;
    savePlaces();
    renderPlaces();
    if (ui.places.lat !== null && ui.places.items.length) findPlaces();
  }

  /* ---------------- 렌더 전체 ---------------- */
  function renderAll() {
    renderTabs();
    renderSync();
    renderMenuFilter();
    renderMenus();
    renderHistory();
    renderDrawHint();
    renderPlaces();
    renderPlaceResult();
    var nick = $("#nickname");
    if (nick && nick.value !== ui.nickname) nick.value = ui.nickname;
  }

  /* ---------------- 이벤트 ---------------- */
  function switchTab(tab) {
    ui.tab = tab === "places" ? "places" : "menu";
    renderTabs();
    if (ui.tab === "places") {
      renderPlaces();
      renderPlaceResult();
    }
  }

  function onAction(ev) {
    var el = ev.target.closest ? ev.target.closest("[data-action]") : null;
    if (!el) return;
    var action = el.getAttribute("data-action");
    var id = el.getAttribute("data-id");

    switch (action) {
      case "tab": switchTab(el.getAttribute("data-tab")); break;
      case "filter-menu":
        ui.menuFilter = el.getAttribute("data-cat") || "all";
        renderMenuFilter(); renderMenus(); renderDrawHint();
        break;
      case "toggle-hidden":
        ui.showHidden = !ui.showHidden;
        renderMenus();
        break;
      case "toggle-exclude": toggleExclude(id); break;
      case "toggle-hide": toggleHide(id); break;
      case "delete-menu": requestDelete(id); break;
      case "delete-menu-confirm": deleteMenu(id); break;
      case "restore-defaults": restoreDefaults(); break;
      case "clear-history": clearHistory(); break;
      case "draw-menu": drawMenu(); break;
      case "open-places": switchTab("places"); break;
      case "locate": locate(); break;
      case "search-address": {
        var q = $("#placeQuery") ? $("#placeQuery").value : "";
        searchAddress(q);
        break;
      }
      case "find-places": findPlaces(); break;
      case "set-radius": setRadius(el.getAttribute("data-radius")); break;
      case "filter-place": setPlaceCategory(el.getAttribute("data-cat") || "all"); break;
      case "toggle-place": togglePlaceExclude(id); break;
      case "draw-place": drawPlace(); break;
      default: break;
    }
  }

  function onSubmit(ev) {
    if (ev.target && ev.target.id === "addMenuForm") {
      ev.preventDefault();
      var nameEl = $("#menuName"), catEl = $("#menuCategory"), memoEl = $("#menuMemo");
      var ok = addMenu(nameEl ? nameEl.value : "", catEl ? catEl.value : "korean", memoEl ? memoEl.value : "");
      if (ok) {
        if (nameEl) nameEl.value = "";
        if (memoEl) memoEl.value = "";
        if (nameEl) nameEl.focus();
      }
    }
  }

  function boot() {
    if (!document || !document.getElementById) return;
    loadNickname();
    loadPlaces();
    state = emptyState();

    var createStore = global.LunchStore && global.LunchStore.create;
    if (!createStore) {
      renderAll();
      toast("저장 모듈(store.js)을 불러오지 못했어요.");
      return;
    }
    store = createStore(CFG, { maxHistory: MAX_HISTORY, getLocal: function () { return state; } });

    store.load().then(function (rec) {
      if (rec && rec.data) {
        state = normalizeState(rec.data);
        var filled = ensureDefaults(state);
        if (filled) save();
      } else {
        state = emptyState();
        ensureDefaults(state);
      }
      renderAll();
      store.subscribe(function (remote) {
        if (!remote || ui.drawing || ui.drawingPlace) return;
        state = normalizeState(remote);
        ensureDefaults(state);
        renderAll();
      });
      if (ui.places.lat !== null && ui.places.items.length) drawMap();
    }).catch(function () {
      state = emptyState();
      renderAll();
    });

    document.addEventListener("click", onAction);
    document.addEventListener("submit", onSubmit);
    var nick = $("#nickname");
    if (nick) {
      nick.addEventListener("input", function () { saveNickname(nick.value); });
      nick.addEventListener("change", function () { saveNickname(nick.value); });
    }
    var query = $("#placeQuery");
    if (query) {
      query.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") { ev.preventDefault(); searchAddress(query.value); }
      });
    }
    setInterval(renderSync, 4000);
  }

  global.LunchApp = {
    boot: boot,
    // 테스트에서 쓰는 손잡이
    _test: {
      drawMenu: drawMenu,
      addMenu: addMenu,
      deleteMenu: deleteMenu,
      toggleExclude: toggleExclude,
      restoreDefaults: restoreDefaults,
      getState: function () { return state; },
      setState: function (s) { state = normalizeState(s); ensureDefaults(state); renderAll(); },
      drawPool: drawPool,
      visibleMenus: visibleMenus,
      DEFAULT_MENUS: DEFAULT_MENUS,
      categories: CATS,
      normalizeState: normalizeState,
      emptyState: emptyState,
      ensureDefaults: ensureDefaults
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(typeof window !== "undefined" ? window : this);
