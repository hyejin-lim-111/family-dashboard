/* =========================================================
   우리 가족 기록장 — store.js
   저장소 어댑터
     · local    : 이 기기의 localStorage (설정 없이 바로 동작)
     · supabase : REST + Realtime (config.js 에 URL/anon key 를 넣으면 켜짐)
   앱(app.js)은 이 인터페이스만 알면 됩니다.
     store.mode, store.describe(), store.load(), store.save(state), store.subscribe(fn), store.destroy()

   ※ 저장은 이제 "마지막 저장이 이김(덮어쓰기)" 이 아니라 "항목 단위 병합" 입니다.
     · 저장 전에 서버의 최신 상태를 먼저 받아(Read) → 이 기기가 바꾼 것만 얹고(Merge) → 다시 올립니다(Write).
     · 다른 기기에서 보낸 채팅·일정·체크리스트·루틴은 오래 열어 둔 기기가 저장해도 사라지지 않습니다.
     · 이 기기에서 실제로 지운 것은 지운 채로 남습니다(tombstone: state.deleted).
   ========================================================= */

(function (global) {
  "use strict";

  var hasDOM = typeof document !== "undefined";

  function nowIso() {
    return new Date().toISOString();
  }

  function safeParse(text) {
    try {
      return JSON.parse(text);
    } catch (e) {
      return null;
    }
  }

  function readLocal(key) {
    if (!hasDOM || !global.localStorage) return null;
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return null;
      return safeParse(raw);
    } catch (e) {
      return null;
    }
  }

  function writeLocal(key, value) {
    if (!hasDOM || !global.localStorage) return false;
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }

  function unwrapRecord(rec) {
    if (!rec) return null;
    // {payload, updatedAt} 형태이거나, 예전처럼 상태 객체만 저장된 경우 모두 지원
    if (rec.payload && typeof rec.payload === "object") {
      return { payload: rec.payload, updatedAt: rec.updatedAt || rec.payload.updatedAt || nowIso() };
    }
    return { payload: rec, updatedAt: rec.updatedAt || nowIso() };
  }

  /* =========================================================
     항목 단위 병합(merge)
       base   : 이 기기가 마지막으로 서버와 맞춘 상태
       local  : 이 기기가 지금 저장하려는 상태
       remote : 서버에 있는 최신 상태

     세 갈래(3-way) 병합으로, 이 기기가 건드리지 않은 것은 서버 것을 그대로 쓴다.
     → 오래 열어 둔 기기가 옛 복사본으로 저장해도 다른 기기의 새 채팅·일정이 살아남는다.
     ========================================================= */

  var TOMBSTONE_KEYS = ["chat", "events", "lists", "listItems", "routineItems", "growth", "study", "todos", "quickCustom"];
  var TOMBSTONE_KEEP_DAYS = 120;
  var TOMBSTONE_MAX = 600;

  function isPlainObject(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function numOr(v, d) {
    var n = Number(v);
    return isFinite(n) ? n : d;
  }

  function tsOf(payload) {
    return (payload && typeof payload.updatedAt === "string") ? payload.updatedAt : "";
  }

  function cloneValue(v) {
    if (v === undefined) return undefined;
    try {
      return JSON.parse(JSON.stringify(v));
    } catch (e) {
      return v;
    }
  }

  function deepEqual(a, b) {
    if (a === b) return true;
    if (a === undefined || b === undefined) return false;
    if (a === null || b === null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a !== "object") return a === b;
    var aArr = Array.isArray(a);
    var bArr = Array.isArray(b);
    if (aArr !== bArr) return false;
    var i;
    if (aArr) {
      if (a.length !== b.length) return false;
      for (i = 0; i < a.length; i++) {
        if (!deepEqual(a[i], b[i])) return false;
      }
      return true;
    }
    var ka = Object.keys(a);
    var kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    for (i = 0; i < ka.length; i++) {
      if (!Object.prototype.hasOwnProperty.call(b, ka[i])) return false;
      if (!deepEqual(a[ka[i]], b[ka[i]])) return false;
    }
    return true;
  }

  function hasIdList(list) {
    if (!Array.isArray(list) || !list.length) return true;
    for (var i = 0; i < list.length; i++) {
      var x = list[i];
      if (!x || typeof x !== "object" || x.id === undefined || x.id === null) return false;
    }
    return true;
  }

  function indexById(list) {
    var map = {};
    (Array.isArray(list) ? list : []).forEach(function (x) {
      if (x && typeof x === "object" && x.id !== undefined && x.id !== null) map[String(x.id)] = x;
    });
    return map;
  }

  function eachKeys(o, fn) {
    if (!isPlainObject(o)) return;
    Object.keys(o).forEach(fn);
  }

  /* ---------- 특별 규칙이 필요한 필드 ---------- */
  function mergeField(path, base, local, remote, ctx) {
    switch (path) {
      case "pet": return mergePet(base, local, remote, ctx);
      case "stamps": return mergeMaxMap(base, local, remote);
      case "badges":
      case "dex.unlocked":
      case "dex.seen":
      case "pet.ledger": return mergeBoolMap(base, local, remote);
      case "mission": return mergeMission(base, local, remote, ctx);
      case "study": return mergeStudy(base, local, remote, ctx);
      case "chat": return mergeChat(base, local, remote, ctx);
      case "deleted": return mergeTombstones(base, local, remote);
      case "quickPhrases.hidden": return mergeTagList(base, local, remote, ctx);
      default: return mergeValue(path, base, local, remote, ctx);
    }
  }

  function mergeValue(path, base, local, remote, ctx) {
    // 양쪽이 똑같으면 그대로 (큰 사진 데이터를 불필요하게 복사하지 않게)
    if (deepEqual(local, remote)) return local;
    // 이 기기가 손대지 않은 값 → 서버 것을 그대로 쓴다
    if (deepEqual(local, base)) {
      if (!deepEqual(remote, base)) ctx.remoteTouched = true;
      return cloneValue(remote);
    }
    // 서버가 그대로(이 기기만 바뀜) → 이 기기 것을 쓴다
    if (deepEqual(remote, base)) return cloneValue(local);
    // 한쪽에서 지운 값
    if (local === undefined) return undefined;
    if (remote === undefined) return undefined;
    // 양쪽 다 바뀜 → 더 안쪽을 맞춰 본다
    if (isPlainObject(local) && isPlainObject(remote)) {
      return mergeObject(path, isPlainObject(base) ? base : null, local, remote, ctx);
    }
    if (Array.isArray(local) && Array.isArray(remote)) {
      return mergeList(path, base, local, remote, ctx);
    }
    if (ctx.preferLocal) return cloneValue(local);
    ctx.remoteTouched = true;
    return cloneValue(remote);
  }

  function mergeObject(path, base, local, remote, ctx) {
    var out = {};
    var keys = [];
    var add = function (o) {
      eachKeys(o, function (k) {
        if (keys.indexOf(k) === -1) keys.push(k);
      });
    };
    add(remote);   // 서버 순서 먼저 (이 기기에서 새로 넣은 것이 뒤에 붙는다)
    add(local);
    add(base);
    keys.forEach(function (k) {
      var childPath = path ? path + "." + k : k;
      var v = mergeField(
        childPath,
        base ? base[k] : undefined,
        local ? local[k] : undefined,
        remote ? remote[k] : undefined,
        ctx
      );
      if (v !== undefined) out[k] = v;
    });
    return out;
  }

  // 목록: id 기준 합집합. 지운 항목은 지운 채로, 새 항목은 양쪽 다 살린다.
  function mergeList(path, base, local, remote, ctx) {
    var bl = Array.isArray(base) ? base : [];
    if (!hasIdList(local) || !hasIdList(remote) || !hasIdList(bl)) {
      // id 로 묶을 수 없는 목록(문자열·숫자 목록 등) → 최신 쪽을 쓴다
      if (ctx.preferLocal) return cloneValue(local);
      ctx.remoteTouched = true;
      return cloneValue(remote);
    }
    var bm = indexById(bl);
    var lm = indexById(local);
    var rm = indexById(remote);
    var order = [];
    var push = function (list) {
      (list || []).forEach(function (x) {
        var id = String(x.id);
        if (order.indexOf(id) === -1) order.push(id);
      });
    };
    push(remote);
    push(local);
    push(bl);
    var out = [];
    order.forEach(function (id) {
      var v = mergeItem(path, bm[id], lm[id], rm[id], ctx);
      if (v !== undefined) out.push(v);
    });
    return out;
  }

  function mergeItem(path, base, local, remote, ctx) {
    if (local === undefined && base !== undefined) return undefined;    // 이 기기에서 지운 항목
    if (remote === undefined && base !== undefined) return undefined;   // 다른 기기에서 지운 항목
    if (local === undefined) {                                         // 다른 기기에만 있던 새 항목
      ctx.remoteTouched = true;
      return cloneValue(remote);
    }
    if (remote === undefined) return cloneValue(local);                 // 이 기기에만 있던 새 항목
    return mergeValue(path, base, local, remote, ctx);
  }

  function mergeChat(base, local, remote, ctx) {
    var list = mergeList("chat", base, local, remote, ctx);
    list.sort(function (a, b) {
      var x = String((a && a.at) || "");
      var y = String((b && b.at) || "");
      return x < y ? -1 : x > y ? 1 : 0;
    });
    if (ctx.maxChat > 0 && list.length > ctx.maxChat) list = list.slice(-ctx.maxChat);
    if (ctx.maxPhotos > 0) {
      var photos = list.filter(function (m) { return m && m.kind === "photo" && m.imageData; });
      var over = photos.length - ctx.maxPhotos;
      for (var i = 0; i < over; i++) {
        photos[i].imageData = "";
        photos[i].photoTrimmed = true;
      }
    }
    return list;
  }

  // 도장 수: 날짜별로 큰 값(많이 찍은 쪽)을 쓴다 — 뒤로 돌아가지 않게
  function mergeMaxMap(base, local, remote) {
    var out = {};
    var keys = [];
    [base, local, remote].forEach(function (o) {
      eachKeys(o, function (k) {
        if (keys.indexOf(k) === -1) keys.push(k);
      });
    });
    keys.forEach(function (k) {
      out[k] = Math.max(numOr(base && base[k], 0), numOr(local && local[k], 0), numOr(remote && remote[k], 0));
    });
    return out;
  }

  // 배지·만난 요정·경험치 지급 표시: 한 번 얻으면 유지 (합집합)
  function mergeBoolMap(base, local, remote) {
    var out = {};
    [base, local, remote].forEach(function (o) {
      eachKeys(o, function (k) {
        if (o[k]) out[k] = true;
      });
    });
    return out;
  }

  // 숨긴 말판 문구 같은 문자열 목록
  function mergeTagList(base, local, remote, ctx) {
    var l = Array.isArray(local) ? local : [];
    var r = Array.isArray(remote) ? remote : [];
    var b = Array.isArray(base) ? base : [];
    if (deepEqual(l, b)) {
      if (!deepEqual(r, b)) ctx.remoteTouched = true;
      return r.slice();
    }
    if (deepEqual(r, b)) return l.slice();
    var out = l.slice();
    r.forEach(function (x) {
      if (out.indexOf(x) === -1) out.push(x);
    });
    if (!deepEqual(out, l)) ctx.remoteTouched = true;
    return out;
  }

  // 가족 미션: 오늘 것만 뜻이 있으니 날짜가 새 쪽을 기준으로, 같은 날이면 완료·개수를 합친다
  function mergeMission(base, local, remote, ctx) {
    var l = isPlainObject(local) ? local : null;
    var r = isPlainObject(remote) ? remote : null;
    if (!l) {
      if (r) ctx.remoteTouched = true;
      return r ? cloneValue(r) : undefined;
    }
    if (!r) return cloneValue(l);
    var lk = String(l.todayKey || "");
    var rk = String(r.todayKey || "");
    if (lk > rk) return cloneValue(l);
    if (rk > lk) {
      ctx.remoteTouched = true;
      return cloneValue(r);
    }
    var out = mergeObject("mission", isPlainObject(base) ? base : null, l, r, ctx);
    out.todayKey = lk;
    out.doneToday = !!(l.doneToday || r.doneToday);
    out.doneTotal = Math.max(numOr(l.doneTotal, 0), numOr(r.doneTotal, 0));
    out.index = ctx.preferLocal ? l.index : r.index;
    return out;
  }

  // 공부: 날짜가 바뀌면 그날 체크는 새로 시작하므로, 새 날짜 쪽을 기준으로 항목 목록만 합친다
  function mergeStudy(base, local, remote, ctx) {
    var l = isPlainObject(local) ? local : {};
    var r = isPlainObject(remote) ? remote : {};
    var b = isPlainObject(base) ? base : null;
    var lk = String(l.dayKey || "");
    var rk = String(r.dayKey || "");
    if (lk === rk) {
      var out = mergeObject("study", b, l, r, ctx);
      out.dayKey = lk || (b && b.dayKey) || "";
      out.items = mergeList("study.items", b && b.items, l.items || [], r.items || [], ctx);
      out.rewarded = !!(l.rewarded || r.rewarded);
      return out;
    }
    var newer = lk > rk ? l : r;
    var older = lk > rk ? r : l;
    if (!deepEqual(newer, l)) ctx.remoteTouched = true;
    // 새 날짜 쪽 항목을 기준으로, 다른 쪽에만 있던 항목은 새로 추가된 것으로 보고 살린다(체크는 새 날부터)
    var items = [];
    var seen = {};
    (newer.items || []).forEach(function (it) {
      if (!it || !it.id) return;
      items.push(cloneValue(it));
      seen[String(it.id)] = true;
    });
    (older.items || []).forEach(function (it) {
      if (!it || !it.id || seen[String(it.id)]) return;
      var copy = cloneValue(it);
      copy.done = false;
      items.push(copy);
      seen[String(it.id)] = true;
    });
    return {
      dayKey: newer.dayKey || "",
      rewarded: !!newer.rewarded,
      items: items
    };
  }

  // 캐릭터: 경험치·레벨·친밀도는 뒤로 돌아가지 않는다
  function mergePet(base, local, remote, ctx) {
    var l = isPlainObject(local) ? local : null;
    var r = isPlainObject(remote) ? remote : null;
    if (!l) {
      if (r) ctx.remoteTouched = true;
      return r ? cloneValue(r) : undefined;
    }
    if (!r) return cloneValue(l);
    var b = isPlainObject(base) ? base : {};

    // 이름: 이 기기가 안 바꿨으면 서버에서 바꾼 이름을 따른다
    var name = l.name;
    if (b.name !== undefined && l.name === b.name && r.name !== b.name) {
      name = r.name;
      ctx.remoteTouched = true;
    } else if (!(b.name !== undefined && r.name === b.name && l.name !== b.name)) {
      name = ctx.preferLocal ? l.name : r.name;
      if (!ctx.preferLocal && r.name !== l.name) ctx.remoteTouched = true;
    }
    if (!name) name = l.name || r.name || "";

    var lCare = isPlainObject(l.care) ? l.care : {};
    var rCare = isPlainObject(r.care) ? r.care : {};
    var care;
    if (isPlainObject(b.care) && deepEqual(lCare, b.care) && !deepEqual(rCare, b.care)) {
      care = rCare;
      ctx.remoteTouched = true;
    } else if (isPlainObject(b.care) && deepEqual(rCare, b.care) && !deepEqual(lCare, b.care)) {
      care = lCare;
    } else {
      care = ctx.preferLocal ? lCare : rCare;
      if (!ctx.preferLocal && !deepEqual(rCare, lCare)) ctx.remoteTouched = true;
    }
    care = isPlainObject(care) ? care : {};

    var xp = Math.max(numOr(l.xp, 0), numOr(r.xp, 0));
    var moneyXp = Math.max(numOr(l.moneyXp, 0), numOr(r.moneyXp, 0));
    var seenLevel = Math.max(numOr(l.seenLevel, 1), numOr(r.seenLevel, 1));
    var day = String(l.day || "") > String(r.day || "") ? String(l.day || "") : String(r.day || "");
    var bonusDay = String(l.bonusDay || "") > String(r.bonusDay || "") ? String(l.bonusDay || "") : String(r.bonusDay || "");
    var sameDay = String(l.day || "") === String(r.day || "");
    var ledger = sameDay
      ? mergeBoolMap(null, l.ledger, r.ledger)
      : cloneValue((String(l.day || "") === day ? l.ledger : r.ledger) || {});
    if (xp > numOr(l.xp, 0) || moneyXp > numOr(l.moneyXp, 0) || seenLevel > numOr(l.seenLevel, 1) ||
        day !== String(l.day || "") || bonusDay !== String(l.bonusDay || "")) {
      ctx.remoteTouched = true;
    }
    return {
      name: String(name).slice(0, 12),
      xp: xp,
      moneyXp: moneyXp,
      seenLevel: seenLevel,
      day: day,
      bonusDay: bonusDay,
      care: {
        fed: numOr(care.fed, 0),
        played: numOr(care.played, 0),
        petted: numOr(care.petted, 0),
        full: numOr(care.full, 50),
        mood: numOr(care.mood, 50),
        bond: Math.max(numOr(lCare.bond, 0), numOr(rCare.bond, 0))
      },
      ledger: isPlainObject(ledger) ? ledger : {}
    };
  }

  // 지운 항목 표시(tombstone) — 한 번 지운 id 는 어느 기기에서도 되살아나지 않는다
  function mergeTombstones(base, local, remote) {
    var out = {};
    [base, local, remote].forEach(function (m) {
      if (!isPlainObject(m)) return;
      Object.keys(m).forEach(function (key) {
        if (TOMBSTONE_KEYS.indexOf(key) === -1) return;
        var bucket = m[key];
        if (!isPlainObject(bucket)) return;
        var target = out[key] || (out[key] = {});
        Object.keys(bucket).forEach(function (id) {
          var t = String(bucket[id] || "");
          if (t && (!target[id] || t > target[id])) target[id] = t;
        });
      });
    });
    var cutoff = "";
    try {
      cutoff = new Date(Date.now() - TOMBSTONE_KEEP_DAYS * 24 * 3600 * 1000).toISOString();
    } catch (e) {
      cutoff = "";
    }
    Object.keys(out).forEach(function (key) {
      var bucket = out[key];
      var ids = Object.keys(bucket).filter(function (id) {
        return !cutoff || String(bucket[id]) >= cutoff;
      });
      ids.sort(function (a, b) {
        return String(bucket[a]) < String(bucket[b]) ? -1 : String(bucket[a]) > String(bucket[b]) ? 1 : 0;
      });
      if (ids.length > TOMBSTONE_MAX) ids = ids.slice(0, TOMBSTONE_MAX);
      if (!ids.length) {
        delete out[key];
        return;
      }
      var next = {};
      ids.forEach(function (id) { next[id] = bucket[id]; });
      out[key] = next;
    });
    return out;
  }

  function purge(list, bucket) {
    if (!Array.isArray(list)) return list;
    if (!isPlainObject(bucket)) return list;
    return list.filter(function (x) {
      return !(x && typeof x === "object" && x.id !== undefined && bucket[String(x.id)]);
    });
  }

  function applyTombstones(payload) {
    var d = payload && payload.deleted;
    if (!isPlainObject(d)) return payload;
    if (payload.calendar) payload.calendar.events = purge(payload.calendar.events, d.events);
    if (payload.checklists) {
      payload.checklists.lists = purge(payload.checklists.lists, d.lists);
      (payload.checklists.lists || []).forEach(function (l) {
        if (l) l.items = purge(l.items, d.listItems);
      });
    }
    if (payload.routine) payload.routine.items = purge(payload.routine.items, d.routineItems);
    if (payload.growth) payload.growth.records = purge(payload.growth.records, d.growth);
    if (payload.quickPhrases) payload.quickPhrases.custom = purge(payload.quickPhrases.custom, d.quickCustom);
    if (payload.study) payload.study.items = purge(payload.study.items, d.study);
    if (payload.todos) {
      ["dain", "mom", "dad"].forEach(function (w) {
        payload.todos[w] = purge(payload.todos[w], d.todos);
      });
    }
    payload.chat = purge(payload.chat, d.chat);
    return payload;
  }

  /**
   * base/local/remote 를 병합한다.
   * @returns {{payload:Object, remoteChanged:boolean}} remoteChanged = 서버 쪽 내용이 더해져 화면을 다시 그려야 하는지
   */
  function mergeStates(base, local, remote, opts) {
    opts = opts || {};
    var l = isPlainObject(local) ? local : {};
    var r = isPlainObject(remote) ? remote : {};
    var b = isPlainObject(base) ? base : null;
    var ctx = {
      preferLocal: tsOf(l) >= tsOf(r),
      maxChat: numOr(opts.maxChat, 0),
      maxPhotos: numOr(opts.maxPhotos, 0),
      remoteTouched: false
    };
    var merged = b ? mergeObject("", b, l, r, ctx) : mergeObject("", null, l, r, ctx);
    merged.version = l.version || r.version || 1;
    merged.updatedAt = tsOf(l) > tsOf(r) ? tsOf(l) : tsOf(r);
    if (!merged.updatedAt) merged.updatedAt = nowIso();
    merged = applyTombstones(merged);
    return { payload: merged, remoteChanged: ctx.remoteTouched };
  }

  // 병합 결과를 이 기기의 상태 객체에 그대로 옮겨 담는다 (앱이 들고 있는 참조를 유지)
  function applyInto(target, merged) {
    if (!isPlainObject(target)) return merged;
    Object.keys(target).forEach(function (k) {
      if (!(k in merged)) delete target[k];
    });
    Object.keys(merged).forEach(function (k) {
      target[k] = merged[k];
    });
    return target;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (!hasDOM) {
        reject(new Error("no dom"));
        return;
      }
      var existing = document.querySelector('script[data-src="' + src + '"]');
      if (existing) {
        existing.addEventListener("load", resolve);
        existing.addEventListener("error", reject);
        return;
      }
      var el = document.createElement("script");
      el.src = src;
      el.async = true;
      el.setAttribute("data-src", src);
      el.onload = function () { resolve(); };
      el.onerror = function () { reject(new Error("script load failed")); };
      document.head.appendChild(el);
    });
  }

  /* ---------------------------------------------------------
     localStorage 어댑터
     --------------------------------------------------------- */
  function createLocalStore(cfg, opts) {
    opts = opts || {};
    var key = cfg.app.storageKey;
    var listeners = [];
    var storageHandler = null;
    var basePayload = null;

    function emit(payload, updatedAt) {
      listeners.forEach(function (fn) {
        try { fn(payload, updatedAt); } catch (e) { /* 무시 */ }
      });
    }

    function liveLocal() {
      if (typeof opts.getLocal === "function") {
        try {
          var v = opts.getLocal();
          if (isPlainObject(v)) return v;
        } catch (e) { /* 무시 */ }
      }
      return null;
    }

    function load() {
      var rec = unwrapRecord(readLocal(key));
      if (rec && rec.payload) basePayload = cloneValue(rec.payload);
      return Promise.resolve(rec);
    }

    function save(payload) {
      var local = liveLocal() || payload;
      var prev = unwrapRecord(readLocal(key));
      var toSave = local;
      // 같은 브라우저의 다른 탭이 이 기기의 마지막 동기화보다 더 새로 저장했을 때만, 덮어쓰지 말고 합친다
      var prevNewer = !!(prev && prev.payload && String(prev.updatedAt || "") > tsOf(basePayload));
      if (prevNewer) {
        try {
          toSave = applyInto(local, mergeStates(basePayload, local, prev.payload).payload);
        } catch (e) {
          toSave = local;
        }
      }
      var ok = writeLocal(key, { payload: toSave, updatedAt: toSave.updatedAt || nowIso() });
      if (!ok) return Promise.reject(new Error("저장 공간이 가득 찼어요. 설정에서 오래된 채팅을 지워 주세요."));
      basePayload = cloneValue(toSave);
      return Promise.resolve();
    }

    function subscribe(fn) {
      listeners.push(fn);
      if (hasDOM && global.addEventListener && !storageHandler) {
        storageHandler = function (event) {
          if (!event || event.key !== key) return;
          var rec = unwrapRecord(safeParse(event.newValue));
          if (!rec) return;
          var local = liveLocal();
          var merged = rec.payload;
          if (local) {
            try {
              merged = applyInto(local, mergeStates(basePayload, local, rec.payload).payload);
            } catch (e) {
              merged = rec.payload;
            }
          }
          basePayload = cloneValue(merged);
          emit(merged, rec.updatedAt);
        };
        global.addEventListener("storage", storageHandler);
      }
      return function () {
        listeners = listeners.filter(function (x) { return x !== fn; });
      };
    }

    function destroy() {
      if (storageHandler && hasDOM) global.removeEventListener("storage", storageHandler);
      storageHandler = null;
      listeners = [];
    }

    return {
      mode: "local",
      describe: function () {
        return "이 기기에만 저장되고 있어요 (localStorage). 3대를 함께 쓰려면 config.js 에 Supabase를 연결하세요.";
      },
      shortLabel: function () { return "이 기기 저장"; },
      load: load,
      save: save,
      subscribe: subscribe,
      destroy: destroy
    };
  }

  /* ---------------------------------------------------------
     Supabase 어댑터 (REST + Realtime, supabase-js 없이도 폴링으로 동작)
     --------------------------------------------------------- */
  function createSupabaseStore(cfg, opts) {
    opts = opts || {};
    var sb = cfg.supabase;
    var key = cfg.app.storageKey;
    var base = String(sb.url || "").replace(/\/+$/, "");
    var table = sb.table || "family_state";
    var rowId = sb.rowId || "main";
    var headers = {
      apikey: sb.anonKey,
      Authorization: "Bearer " + sb.anonKey,
      "Content-Type": "application/json"
    };

    var listeners = [];
    var client = null;
    var channel = null;
    var pollTimer = null;
    var retryTimer = null;
    var pendingPayload = null;
    var saveSeq = 0;
    var inflight = false;
    var lastRemoteAt = null;
    var basePayload = null;        // 마지막으로 서버와 맞춘 상태 (병합 기준)
    var online = true;
    var realtimeOn = false;

    function emit(payload, updatedAt) {
      listeners.forEach(function (fn) {
        try { fn(payload, updatedAt); } catch (e) { /* 무시 */ }
      });
    }

    function mergeOptions() {
      return {
        maxChat: numOr(opts.maxChat, numOr(cfg.app && cfg.app.maxChatMessages, 0)),
        maxPhotos: numOr(opts.maxPhotos, 0)
      };
    }

    // 이 기기가 지금 들고 있는 상태 (앱이 알려 준 것)
    function liveLocal() {
      if (typeof opts.getLocal === "function") {
        try {
          var v = opts.getLocal();
          if (isPlainObject(v)) return v;
        } catch (e) { /* 무시 */ }
      }
      return isPlainObject(pendingPayload) ? pendingPayload : null;
    }

    function mergedInto(local, remotePayload) {
      var res = mergeStates(basePayload, local, remotePayload, mergeOptions());
      return { payload: applyInto(local, res.payload), remoteChanged: res.remoteChanged };
    }

    function fetchRemote() {
      var url = base + "/rest/v1/" + encodeURIComponent(table) +
        "?id=eq." + encodeURIComponent(rowId) + "&select=payload,updated_at";
      return fetch(url, { headers: headers, cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }).then(function (rows) {
        online = true;
        if (!rows || !rows.length) return null;
        return { payload: rows[0].payload, updatedAt: rows[0].updated_at };
      });
    }

    function pushRemote(payload) {
      var url = base + "/rest/v1/" + encodeURIComponent(table) + "?on_conflict=id";
      return fetch(url, {
        method: "POST",
        headers: Object.assign({}, headers, { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify([{ id: rowId, payload: payload, updated_at: payload.updatedAt || nowIso() }])
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        online = true;
        lastRemoteAt = payload.updatedAt || nowIso();
      });
    }

    function scheduleRetry() {
      if (retryTimer) return;
      retryTimer = setTimeout(function () {
        retryTimer = null;
        if (pendingPayload) flush();
      }, Math.max(4000, (sb.pollMs || 5000) * 2));
    }

    // 저장: 서버 최신 상태를 먼저 받아(Read) → 이 기기 변경만 얹고(Merge) → 올린다(Write)
    function flush() {
      if (inflight || !pendingPayload) return Promise.resolve(true);
      var local = liveLocal() || pendingPayload;
      var seq = saveSeq;
      var sent = local;
      var carry = false;
      inflight = true;
      return fetchRemote().then(function (remote) {
        var toPush = local;
        if (remote && remote.payload) {
          var res = mergedInto(local, remote.payload);
          toPush = res.payload;
          carry = res.remoteChanged;
          basePayload = cloneValue(toPush);
          if (remote.updatedAt) lastRemoteAt = remote.updatedAt;
        } else {
          basePayload = cloneValue(toPush);
        }
        writeLocal(key, { payload: toPush, updatedAt: toPush.updatedAt || nowIso() });
        return pushRemote(toPush).then(function () {
          inflight = false;
          if (saveSeq === seq && pendingPayload === sent) pendingPayload = null;
          if (carry) emit(toPush, toPush.updatedAt);
          return true;
        });
      }).catch(function () {
        inflight = false;
        online = false;
        scheduleRetry();
        return false;
      });
    }

    function load() {
      return fetchRemote().then(function (remote) {
        var cache = unwrapRecord(readLocal(key));
        var localNow = liveLocal();
        var local = isPlainObject(localNow) ? localNow : (cache && cache.payload ? cache.payload : null);
        if (remote && remote.payload) {
          var merged;
          // 이 기기에 아직 못 올린 변경(오프라인 편집)이 있으면 그것도 살린다
          var useMerge = !!basePayload ||
            (!!local && tsOf(local) > String(remote.updatedAt || tsOf(remote.payload)));
          var res = null;
          if (local && useMerge) {
            res = mergeStates(basePayload, local, remote.payload, mergeOptions());
            merged = res.payload;
          } else {
            merged = cloneValue(remote.payload);
          }
          basePayload = cloneValue(merged);
          lastRemoteAt = remote.updatedAt || tsOf(merged);
          writeLocal(key, { payload: merged, updatedAt: lastRemoteAt });
          if (isPlainObject(localNow)) applyInto(localNow, merged);
          return { payload: merged, updatedAt: lastRemoteAt };
        }
        // 서버가 비어 있으면 이 기기 캐시라도 사용
        if (cache && cache.payload) basePayload = cloneValue(cache.payload);
        return cache || null;
      }).catch(function () {
        online = false;
        var local = unwrapRecord(readLocal(key));
        if (local && local.payload) basePayload = cloneValue(local.payload);
        return local || null;
      });
    }

    function save(payload) {
      var ok = writeLocal(key, { payload: payload, updatedAt: payload.updatedAt || nowIso() });
      if (!ok) return Promise.reject(new Error("저장 공간이 가득 찼어요."));
      pendingPayload = payload;
      saveSeq += 1;
      return flush();
    }

    // 다른 기기 변경 수신 — 통째로 갈아 끼우지 않고 이 기기 상태와 합친다
    function handleRemote(remotePayload, updatedAt) {
      if (!remotePayload) return;
      lastRemoteAt = updatedAt || tsOf(remotePayload) || nowIso();
      var local = liveLocal();
      var merged;
      var changed = true;
      if (isPlainObject(local)) {
        var res = mergedInto(local, remotePayload);
        merged = res.payload;
        changed = res.remoteChanged;
      } else {
        merged = remotePayload;
      }
      basePayload = cloneValue(merged);
      writeLocal(key, { payload: merged, updatedAt: lastRemoteAt });
      if (changed) emit(merged, lastRemoteAt);
    }

    function startPolling(ms) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(function () {
        fetchRemote().then(function (remote) {
          if (!remote || !remote.payload) return;
          if (remote.updatedAt === lastRemoteAt) return;
          handleRemote(remote.payload, remote.updatedAt);
        }).catch(function () { online = false; });
      }, ms || sb.pollMs || 5000);
    }

    function startRealtime() {
      if (!sb.realtime || !hasDOM) {
        startPolling(sb.pollMs || 5000);
        return;
      }
      loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js")
        .then(function () {
          if (!global.supabase || typeof global.supabase.createClient !== "function") {
            throw new Error("no supabase client");
          }
          client = global.supabase.createClient(base, sb.anonKey);
          channel = client
            .channel("family_state_" + rowId)
            .on("postgres_changes", {
              event: "*",
              schema: "public",
              table: table,
              filter: "id=eq." + rowId
            }, function (payload) {
              var row = payload && payload.new;
              if (!row || !row.payload) return;
              handleRemote(row.payload, row.updated_at || nowIso());
            })
            .subscribe(function (status) {
              realtimeOn = status === "SUBSCRIBED";
            });
          // 실시간이 붙어도 가끔은 확인해서 놓친 변경을 따라잡아요
          startPolling(Math.max(sb.pollMs || 5000, 5000) * 6);
        })
        .catch(function () {
          realtimeOn = false;
          startPolling(sb.pollMs || 5000);
        });
    }

    function subscribe(fn) {
      listeners.push(fn);
      return function () {
        listeners = listeners.filter(function (x) { return x !== fn; });
      };
    }

    function destroy() {
      if (pollTimer) clearInterval(pollTimer);
      if (retryTimer) clearTimeout(retryTimer);
      pollTimer = null;
      retryTimer = null;
      if (channel && client) {
        try { client.removeChannel(channel); } catch (e) { /* 무시 */ }
      }
      channel = null;
      client = null;
      listeners = [];
    }

    startRealtime();

    return {
      mode: "supabase",
      describe: function () {
        var kind = realtimeOn ? "실시간" : "주기 확인(폴링)";
        var state = online ? "연결됨" : "오프라인 — 이 기기에 저장 중";
        return "Supabase " + kind + " 동기화 · " + table + "/" + rowId + " · " + state;
      },
      shortLabel: function () {
        if (!online) return "오프라인 저장";
        return realtimeOn ? "실시간 동기화" : "동기화 중";
      },
      load: load,
      save: save,
      subscribe: subscribe,
      destroy: destroy,
      flushNow: flush
    };
  }

  function hasSupabaseConfig(cfg) {
    var sb = (cfg && cfg.supabase) || {};
    return !!(sb.url && sb.anonKey && /^https?:\/\//.test(sb.url));
  }

  function create(cfg, opts) {
    if (hasSupabaseConfig(cfg)) return createSupabaseStore(cfg, opts);
    return createLocalStore(cfg, opts);
  }

  global.FamilyStore = {
    create: create,
    createLocalStore: createLocalStore,
    createSupabaseStore: createSupabaseStore,
    hasSupabaseConfig: hasSupabaseConfig,
    mergeStates: mergeStates,
    applyInto: applyInto
  };
})(typeof window !== "undefined" ? window : this);
