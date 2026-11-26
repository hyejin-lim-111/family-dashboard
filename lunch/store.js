/* =========================================================
   점심 뭐 먹지? — store.js (공유 저장소 어댑터)
     · local    : 이 기기의 localStorage (설정 없이 바로 동작)
     · supabase : REST + Realtime (config.js 에 URL/anon key 를 넣으면 켜짐)

   저장 방식은 "마지막 저장이 이김(덮어쓰기)" 이 아니라 "항목 단위 3-way 병합" 입니다.
     · 저장 전에 서버의 최신 상태를 먼저 받아(Read)
     · 이 기기가 바꾼 것만 얹고(Merge)
     · 다시 올립니다(Write).
   이 기기에서 실제로 지운 메뉴는 지운 채로 남습니다(tombstone: state.deleted).

   앱(app.js)이 아는 인터페이스
     store.mode, store.describe(), store.shortLabel(),
     store.load(), store.save(state), store.subscribe(fn), store.destroy()

   load() 는 { data, updatedAt } (또는 null) 을 돌려줍니다.
   ========================================================= */

(function (global) {
  "use strict";

  var hasDOM = typeof document !== "undefined";
  var TOMBSTONE_KEEP_DAYS = 120;
  var TOMBSTONE_MAX = 800;

  /* ---------------- 기본 도우미 ---------------- */

  function nowIso() {
    return new Date().toISOString();
  }

  function safeParse(text) {
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  function isObj(v) {
    return !!v && typeof v === "object" && !Array.isArray(v);
  }

  function clone(v) {
    if (v === undefined) return undefined;
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
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
      for (i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
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

  function arr(v) {
    return Array.isArray(v) ? v : [];
  }

  function keyOf(item) {
    if (item === null || item === undefined) return null;
    if (typeof item === "string" || typeof item === "number") return String(item);
    if (typeof item === "object" && item.id !== undefined && item.id !== null) return String(item.id);
    return null;
  }

  function indexById(list) {
    var map = {};
    arr(list).forEach(function (x) {
      var k = keyOf(x);
      if (k !== null) map[k] = x;
    });
    return map;
  }

  function unionKeys() {
    var out = [];
    Array.prototype.slice.call(arguments).forEach(function (o) {
      Object.keys(o || {}).forEach(function (k) {
        if (out.indexOf(k) === -1) out.push(k);
      });
    });
    return out;
  }

  function maxIso() {
    var best = "";
    Array.prototype.slice.call(arguments).forEach(function (v) {
      if (typeof v === "string" && v > best) best = v;
    });
    return best || nowIso();
  }

  /* ---------------- 3-way 병합 ---------------- */

  function mergeValue(path, base, local, remote, ctx) {
    if (deepEqual(local, remote)) return clone(local);
    if (deepEqual(local, base)) {                 // 이 기기는 손대지 않음 → 서버 것
      if (!deepEqual(remote, base)) ctx.remoteTouched = true;
      return clone(remote);
    }
    if (deepEqual(remote, base)) return clone(local);   // 서버는 그대로 → 이 기기 것
    if (local === undefined) return undefined;
    if (remote === undefined) return undefined;
    if (isObj(local) && isObj(remote)) {
      return mergeObject(path, isObj(base) ? base : {}, local, remote, ctx);
    }
    if (Array.isArray(local) && Array.isArray(remote)) {
      if (ctx.preferLocal) return clone(local);
      ctx.preferLocal = false;
      return mergeByIdList(path, base, local, remote, ctx);
    }
    // 둘 다 바뀐 단순 값 → 이 기기에서 방금 고른 값을 살린다
    return clone(local);
  }

  function mergeObject(path, base, local, remote, ctx) {
    var out = {};
    unionKeys(local, remote, base).forEach(function (k) {
      var v = mergeValue(path ? path + "." + k : k, base[k], local[k], remote[k], ctx);
      if (v !== undefined) out[k] = v;
    });
    return out;
  }

  // id 가 있는 목록: 항목 단위로 합친다 (동시에 추가/수정해도 서로 덮어쓰지 않음)
  function mergeByIdList(path, base, local, remote, ctx) {
    var b = indexById(base);
    var l = indexById(local);
    var r = indexById(remote);
    var out = [];
    var ids = unionKeys(l, r, b);
    ids.forEach(function (k) {
      var item = null;
      if (l[k] && r[k]) item = mergeItem(path, b[k], l[k], r[k], ctx);
      else if (l[k]) item = clone(l[k]);            // 이 기기에만 있음 (새로 추가 / 남아 있음)
      else if (r[k]) { item = clone(r[k]); ctx.remoteTouched = true; }  // 서버에만 있음
      if (item) out.push(item);
    });
    return out;
  }

  function mergeItem(path, base, local, remote, ctx) {
    if (deepEqual(local, remote)) return clone(local);
    if (deepEqual(local, base)) { ctx.remoteTouched = true; return clone(remote); }
    if (deepEqual(remote, base)) return clone(local);
    var b = isObj(base) ? base : {};
    var out = {};
    unionKeys(local, remote, b).forEach(function (k) {
      var v;
      if (deepEqual(local[k], b[k])) v = clone(remote[k]);
      else if (deepEqual(remote[k], b[k])) v = clone(local[k]);
      else if (deepEqual(local[k], remote[k])) v = clone(local[k]);
      else v = clone(local[k]);                     // 둘 다 바꾼 필드는 이 기기 우선
      if (v !== undefined) out[k] = v;
      if (k === "updatedAt") out[k] = maxIso(local[k], remote[k], b[k]);
    });
    return out;
  }

  // "오늘 제외" 같은 집합: 이 기기에서 더하고 뺀 것만 반영한다
  function mergeSet(base, local, remote) {
    var b = {}, l = {}, r = {};
    arr(base).forEach(function (x) { var k = keyOf(x); if (k !== null) b[k] = 1; });
    arr(local).forEach(function (x) { var k = keyOf(x); if (k !== null) l[k] = 1; });
    arr(remote).forEach(function (x) { var k = keyOf(x); if (k !== null) r[k] = 1; });

    var out = [];
    arr(remote).forEach(function (x) {                 // 서버 상태가 바탕
      var k = keyOf(x);
      if (k !== null && out.indexOf(k) === -1) out.push(k);
    });
    Object.keys(l).forEach(function (k) {
      if (b[k]) return;                                // 예전부터 있던 것
      if (out.indexOf(k) === -1) out.push(k);          // 이 기기에서 새로 더함
    });
    Object.keys(b).forEach(function (k) {
      if (!l[k]) {                      // 이 기기에서 뺌
        var i = out.indexOf(k);
        if (i >= 0) out.splice(i, 1);
      }
    });
    return out;
  }

  function pruneTomb(kindMap) {
    var out = {};
    if (!isObj(kindMap)) return out;
    var cutoff = Date.now() - TOMBSTONE_KEEP_DAYS * 24 * 60 * 60 * 1000;
    var keys = Object.keys(kindMap)
      .filter(function (k) {
        var ts = Date.parse(kindMap[k]);
        return isNaN(ts) ? false : ts >= cutoff;
      })
      .sort(function (a, b) { return String(kindMap[b]).localeCompare(String(kindMap[a])); })
      .slice(0, TOMBSTONE_MAX);
    keys.forEach(function (k) { out[k] = kindMap[k]; });
    return out;
  }

  function mergeTombstones(kind, base, local, remote) {
    var out = {};
    [base, local, remote].forEach(function (m) {
      if (!isObj(m)) return;
      Object.keys(m).forEach(function (id) {
        if (out[id] === undefined || String(m[id]) > String(out[id])) out[id] = m[id];
      });
    });
    return pruneTomb(out);
  }

  function mergeDeletedTomb(base, local, remote) {
    var out = {};
    var kinds = unionKeys(isObj(local) ? local : {}, isObj(remote) ? remote : {}, isObj(base) ? base : {});
    kinds.forEach(function (kind) {
      var merged = mergeTombstones(kind, base && base[kind], local && local[kind], remote && remote[kind]);
      if (Object.keys(merged).length) out[kind] = merged;
    });
    return out;
  }

  function stripDeleted(list, tomb) {
    if (!isObj(tomb) || !Object.keys(tomb).length) return arr(list).map(clone);
    var out = [];
    arr(list).forEach(function (x) {
      var k = keyOf(x);
      if (k !== null && tomb[k]) return;
      out.push(clone(x));
    });
    return out;
  }

  /**
   * base(이 기기가 마지막으로 서버와 맞춘 상태) / local(지금 저장하려는 상태) / remote(서버 최신)
   * → { state, remoteChanged }
   */
  function mergeStates(base, local, remote, opts) {
    base = isObj(base) ? base : {};
    local = isObj(local) ? local : {};
    remote = isObj(remote) ? remote : {};
    opts = opts || {};
    var ctx = { remoteTouched: false, preferLocal: false };

    var out = {};
    unionKeys(local, remote).forEach(function (k) {
      if (k === "updatedAt" || k === "deleted") return;
      if (k === "menus" || k === "history") {
        out[k] = mergeByIdList(k, base[k], local[k], remote[k], ctx);
      } else if (k === "excluded") {
        out[k] = mergeSet(base[k], local[k], remote[k]);
      } else {
        var v = mergeValue(k, base[k], local[k], remote[k], ctx);
        if (v !== undefined) out[k] = v;
      }
    });

    var mergedTomb = mergeDeletedTomb(base.deleted, local.deleted, remote.deleted);
    var deleted = {
      menus: mergedTomb.menus || {},
      history: mergedTomb.history || {}
    };
    Object.keys(mergedTomb).forEach(function (k) { if (!deleted[k]) deleted[k] = mergedTomb[k]; });
    out.deleted = deleted;
    out.menus = stripDeleted(out.menus, deleted.menus);
    out.history = stripDeleted(out.history, deleted.history);
    out.excluded = arr(out.excluded).filter(function (k) { return !(deleted.menus && deleted.menus[k]); });

    // 최근 뽑기 기록은 최신순으로, 정해진 개수만
    var maxHistory = (opts.maxHistory !== undefined) ? opts.maxHistory : 40;
    out.history = out.history
      .slice()
      .sort(function (a, b) { return String(b.at || "").localeCompare(String(a.at || "")); })
      .slice(0, maxHistory);

    out.updatedAt = maxIso(base.updatedAt, local.updatedAt, remote.updatedAt);
    var remoteChanged = ctx.remoteTouched ||
      !deepEqual(out.menus, arr(local.menus)) ||
      !deepEqual(out.history, arr(local.history)) ||
      !deepEqual(out.excluded, arr(local.excluded)) ||
      !deepEqual(out.deleted, local.deleted || {});
    return { state: out, remoteChanged: !!remoteChanged };
  }

  /* ---------------- localStorage 어댑터 ---------------- */

  function readLocal(key) {
    if (!hasDOM || !global.localStorage) return null;
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return null;
      return safeParse(raw);
    } catch (e) { return null; }
  }

  function writeLocal(key, value) {
    if (!hasDOM || !global.localStorage) return false;
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) { return false; }
  }

  function unwrapRecord(rec) {
    if (!rec) return null;
    if (isObj(rec) && isObj(rec.data)) return { data: rec.data, updatedAt: rec.updatedAt || rec.data.updatedAt || nowIso() };
    if (isObj(rec)) return { data: rec, updatedAt: rec.updatedAt || nowIso() };
    return null;
  }

  function createLocalStore(cfg, opts) {
    opts = opts || {};
    var key = cfg.app.storageKey;
    var listeners = [];
    var storageHandler = null;
    var baseState = null;

    function emit(data, updatedAt) {
      listeners.slice().forEach(function (fn) {
        try { fn(data, updatedAt); } catch (e) { /* 무시 */ }
      });
    }

    function liveLocal() {
      if (typeof opts.getLocal === "function") {
        try {
          var v = opts.getLocal();
          if (isObj(v)) return v;
        } catch (e) { /* 무시 */ }
      }
      return null;
    }

    function load() {
      var rec = unwrapRecord(readLocal(key));
      if (rec) baseState = clone(rec.data);
      return Promise.resolve(rec);
    }

    function save(state) {
      var local = liveLocal() || state;
      var prev = unwrapRecord(readLocal(key));
      var toSave = local;
      // 같은 브라우저의 다른 탭이 더 새로 저장했다면 덮어쓰지 말고 합친다
      if (prev && String(prev.updatedAt || "") > String((baseState && baseState.updatedAt) || "")) {
        try { toSave = mergeStates(baseState, local, prev.data, opts).state; }
        catch (e) { toSave = local; }
      }
      var out = clone(toSave) || {};
      out.updatedAt = nowIso();
      if (!writeLocal(key, { data: out, updatedAt: out.updatedAt })) {
        return Promise.reject(new Error("이 기기 저장 공간이 가득 찼어요."));
      }
      baseState = clone(out);
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
          var merged = rec.data;
          if (isObj(local)) {
            try { merged = mergeStates(baseState, local, rec.data, opts).state; }
            catch (e) { merged = rec.data; }
          }
          baseState = clone(merged);
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
        return "이 기기에만 저장되고 있어요 (localStorage). 멤버들과 함께 쓰려면 Supabase 연결을 확인하세요.";
      },
      shortLabel: function () { return "이 기기 저장"; },
      load: load,
      save: save,
      subscribe: subscribe,
      destroy: destroy
    };
  }

  /* ---------------- Supabase 어댑터 (REST + Realtime) ---------------- */

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (!hasDOM) return reject(new Error("no dom"));
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

  function createSupabaseStore(cfg, opts) {
    opts = opts || {};
    var sb = cfg.supabase || {};
    var key = cfg.app.storageKey;
    var base = String(sb.url || "").replace(/\/+$/, "");
    var table = sb.table || "lunch_state";
    var rowId = sb.rowId || "company-lunch";
    var pollMs = sb.pollMs || 5000;
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
    var pendingState = null;
    var saveSeq = 0;
    var inflight = false;
    var lastRemoteAt = null;
    var baseState = null;       // 이 기기가 마지막으로 서버와 맞춘 상태 (병합 기준)
    var online = true;
    var realtimeOn = false;

    function emit(data, updatedAt) {
      listeners.slice().forEach(function (fn) {
        try { fn(data, updatedAt); } catch (e) { /* 무시 */ }
      });
    }

    function liveLocal() {
      if (typeof opts.getLocal === "function") {
        try {
          var v = opts.getLocal();
          if (isObj(v)) return v;
        } catch (e) { /* 무시 */ }
      }
      return isObj(pendingState) ? pendingState : null;
    }

    function mergedInto(local, remoteData) {
      var res = mergeStates(baseState, local, remoteData, opts);
      return { data: res.state, remoteChanged: res.remoteChanged };
    }

    function fetchRemote() {
      var url = base + "/rest/v1/" + encodeURIComponent(table) +
        "?id=eq." + encodeURIComponent(rowId) + "&select=data,updated_at";
      return fetch(url, { headers: headers, cache: "no-store" }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      }).then(function (rows) {
        online = true;
        if (!rows || !rows.length) return null;
        return { data: rows[0].data, updatedAt: rows[0].updated_at };
      });
    }

    function pushRemote(data) {
      var url = base + "/rest/v1/" + encodeURIComponent(table) + "?on_conflict=id";
      return fetch(url, {
        method: "POST",
        headers: Object.assign({}, headers, { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify([{ id: rowId, data: data, updated_at: data.updatedAt || nowIso() }])
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        online = true;
        lastRemoteAt = data.updatedAt || nowIso();
      });
    }

    function scheduleRetry() {
      if (retryTimer) return;
      retryTimer = setTimeout(function () {
        retryTimer = null;
        if (pendingState) flush();
      }, Math.max(4000, pollMs * 2));
    }

    // 저장: 서버 최신 상태를 먼저 받아(Read) → 이 기기 변경만 얹고(Merge) → 올린다(Write)
    function flush() {
      if (inflight || !pendingState) return Promise.resolve(true);
      var local = liveLocal() || pendingState;
      var seq = saveSeq;
      var sent = local;
      var carry = false;
      inflight = true;
      return fetchRemote().then(function (remote) {
        var toPush = local;
        if (remote && remote.data) {
          try {
            var res = mergedInto(local, remote.data);
            toPush = res.data;
            carry = res.remoteChanged;
            baseState = clone(toPush);
          } catch (e) {
            toPush = local;              // 병합이 실패해도 이 기기의 저장은 잃지 않는다
          }
          if (remote.updatedAt) lastRemoteAt = remote.updatedAt;
        } else {
          baseState = clone(toPush);
        }
        toPush = clone(toPush) || {};
        toPush.updatedAt = nowIso();
        writeLocal(key, { data: toPush, updatedAt: toPush.updatedAt });
        return pushRemote(toPush).then(function () {
          inflight = false;
          if (saveSeq === seq && pendingState === sent) pendingState = null;
          if (carry) emit(clone(toPush), toPush.updatedAt);
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
        var local = isObj(localNow) ? localNow : (cache && cache.data ? cache.data : null);
        if (remote && remote.data) {
          var merged;
          var useMerge = !!baseState ||
            (!!local && String(local.updatedAt || "") > String(remote.updatedAt || ""));
          if (local && useMerge) {
            try { merged = mergeStates(baseState, local, remote.data, opts).state; }
            catch (e) { merged = clone(remote.data); }
          } else {
            merged = clone(remote.data);
          }
          baseState = clone(merged);
          lastRemoteAt = remote.updatedAt || merged.updatedAt;
          writeLocal(key, { data: merged, updatedAt: lastRemoteAt });
          return { data: merged, updatedAt: lastRemoteAt };
        }
        // 서버가 비어 있으면 이 기기 캐시라도 사용
        if (cache && cache.data) baseState = clone(cache.data);
        return cache || null;
      }).catch(function () {
        online = false;
        var local = unwrapRecord(readLocal(key));
        if (local && local.data) baseState = clone(local.data);
        return local || null;
      });
    }

    function save(state) {
      var out = clone(state) || {};
      out.updatedAt = nowIso();
      if (!writeLocal(key, { data: out, updatedAt: out.updatedAt })) {
        return Promise.reject(new Error("이 기기 저장 공간이 가득 찼어요."));
      }
      pendingState = out;
      saveSeq += 1;
      return flush();
    }

    // 다른 기기 변경 수신 — 통째로 갈아 끼우지 않고 이 기기 상태와 합친다
    function handleRemote(remoteData, updatedAt) {
      if (!isObj(remoteData)) return;
      lastRemoteAt = updatedAt || remoteData.updatedAt || nowIso();
      var local = liveLocal();
      var merged;
      var changed = true;
      if (isObj(local)) {
        try {
          var res = mergedInto(local, remoteData);
          merged = res.data;
          changed = res.remoteChanged;
        } catch (e) {
          return;   // 병합 실패 시 화면은 그대로, 다음 확인에서 다시
        }
      } else {
        merged = clone(remoteData);
      }
      baseState = clone(merged);
      writeLocal(key, { data: merged, updatedAt: lastRemoteAt });
      if (changed) emit(merged, lastRemoteAt);
    }

    function startPolling(ms) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(function () {
        fetchRemote().then(function (remote) {
          if (!remote || !remote.data) return;
          if (remote.updatedAt === lastRemoteAt) return;
          handleRemote(remote.data, remote.updatedAt);
        }).catch(function () { online = false; });
      }, ms || pollMs);
    }

    function startRealtime() {
      if (!sb.realtime || !hasDOM) {
        startPolling(pollMs);
        return;
      }
      loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js")
        .then(function () {
          if (!global.supabase || typeof global.supabase.createClient !== "function") {
            throw new Error("no supabase client");
          }
          client = global.supabase.createClient(base, sb.anonKey);
          channel = client
            .channel("lunch_state_" + rowId)
            .on("postgres_changes", {
              event: "*",
              schema: "public",
              table: table,
              filter: "id=eq." + rowId
            }, function (payload) {
              var row = payload && payload.new;
              if (!row || !row.data) return;
              handleRemote(row.data, row.updated_at || nowIso());
            })
            .subscribe(function (status) {
              realtimeOn = status === "SUBSCRIBED";
            });
          // 실시간이 붙어도 가끔 확인해서 놓친 변경을 따라잡아요
          startPolling(Math.max(pollMs, 5000) * 6);
        })
        .catch(function () {
          realtimeOn = false;
          startPolling(pollMs);
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
        return realtimeOn ? "실시간 공유" : "동기화 중";
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

  global.LunchStore = {
    create: create,
    createLocalStore: createLocalStore,
    createSupabaseStore: createSupabaseStore,
    hasSupabaseConfig: hasSupabaseConfig,
    mergeStates: mergeStates,
    deepEqual: deepEqual
  };
})(typeof window !== "undefined" ? window : this);
