/* =========================================================
   우리 가족 기록장 — store.js
   저장소 어댑터
     · local    : 이 기기의 localStorage (설정 없이 바로 동작)
     · supabase : REST + Realtime (config.js 에 URL/anon key 를 넣으면 켜짐)
   앱(app.js)은 이 인터페이스만 알면 됩니다.
     store.mode, store.describe(), store.load(), store.save(state), store.subscribe(fn), store.destroy()
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
  function createLocalStore(cfg) {
    var key = cfg.app.storageKey;
    var listeners = [];
    var storageHandler = null;

    function emit(payload, updatedAt) {
      listeners.forEach(function (fn) {
        try { fn(payload, updatedAt); } catch (e) { /* 무시 */ }
      });
    }

    function load() {
      var rec = unwrapRecord(readLocal(key));
      return Promise.resolve(rec);
    }

    function save(payload) {
      var ok = writeLocal(key, { payload: payload, updatedAt: payload.updatedAt || nowIso() });
      if (!ok) return Promise.reject(new Error("저장 공간이 가득 찼어요. 설정에서 오래된 채팅을 지워 주세요."));
      return Promise.resolve();
    }

    function subscribe(fn) {
      listeners.push(fn);
      if (hasDOM && global.addEventListener && !storageHandler) {
        storageHandler = function (event) {
          if (!event || event.key !== key) return;
          var rec = unwrapRecord(safeParse(event.newValue));
          if (rec) emit(rec.payload, rec.updatedAt);
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
  function createSupabaseStore(cfg) {
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
    var inflight = false;
    var lastRemoteAt = null;
    var online = true;
    var realtimeOn = false;

    function emit(payload, updatedAt) {
      listeners.forEach(function (fn) {
        try { fn(payload, updatedAt); } catch (e) { /* 무시 */ }
      });
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

    function flush() {
      if (inflight || !pendingPayload) return Promise.resolve();
      var payload = pendingPayload;
      inflight = true;
      return pushRemote(payload).then(function () {
        inflight = false;
        if (pendingPayload === payload) pendingPayload = null;
        return true;
      }).catch(function () {
        inflight = false;
        online = false;
        scheduleRetry();
        return false;
      });
    }

    function load() {
      return fetchRemote().then(function (remote) {
        if (remote && remote.payload) {
          lastRemoteAt = remote.updatedAt;
          writeLocal(key, { payload: remote.payload, updatedAt: remote.updatedAt });
          return remote;
        }
        // 서버가 비어 있으면 이 기기 캐시라도 사용
        var local = unwrapRecord(readLocal(key));
        return local || null;
      }).catch(function () {
        online = false;
        var local = unwrapRecord(readLocal(key));
        return local || null;
      });
    }

    function save(payload) {
      var ok = writeLocal(key, { payload: payload, updatedAt: payload.updatedAt || nowIso() });
      if (!ok) return Promise.reject(new Error("저장 공간이 가득 찼어요."));
      pendingPayload = payload;
      return flush();
    }

    function startPolling(ms) {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(function () {
        fetchRemote().then(function (remote) {
          if (!remote || !remote.payload) return;
          if (remote.updatedAt === lastRemoteAt) return;
          lastRemoteAt = remote.updatedAt;
          writeLocal(key, { payload: remote.payload, updatedAt: remote.updatedAt });
          emit(remote.payload, remote.updatedAt);
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
              lastRemoteAt = row.updated_at || nowIso();
              writeLocal(key, { payload: row.payload, updatedAt: lastRemoteAt });
              emit(row.payload, lastRemoteAt);
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

  function create(cfg) {
    if (hasSupabaseConfig(cfg)) return createSupabaseStore(cfg);
    return createLocalStore(cfg);
  }

  global.FamilyStore = {
    create: create,
    createLocalStore: createLocalStore,
    createSupabaseStore: createSupabaseStore,
    hasSupabaseConfig: hasSupabaseConfig
  };
})(typeof window !== "undefined" ? window : this);
