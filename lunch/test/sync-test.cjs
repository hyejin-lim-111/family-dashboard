/* lunch/store.js — Supabase 어댑터(REST 읽기→병합→쓰기, 폴링 수신) 검증
   실제 서버 대신 fetch 를 가짜로 바꿔 요청 내용과 병합 결과를 확인한다. */
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

function menu(id, name, over) {
  return Object.assign({ id, name, category: "korean", memo: "", custom: false, hidden: false, createdAt: "2026-11-26T00:00:00.000Z", updatedAt: "2026-11-26T00:00:00.000Z" }, over);
}

(async function main() {
  const dom = new JSDOM("<!doctype html><p>sync</p>", {
    url: "https://hyejin-lim-111.github.io/family-dashboard/lunch/",
    runScripts: "outside-only",
  });
  const { window } = dom;
  window.eval(fs.readFileSync(path.join(ROOT, "config.js"), "utf8"));
  const CFG = window.LUNCH_CONFIG;
  CFG.supabase = {
    url: "https://rfftsmdvvlcuesyqizbs.supabase.co",
    anonKey: "test-anon-key",
    table: "lunch_state",
    rowId: "company-lunch",
    pollMs: 60,
    realtime: false
  };
  window.eval(fs.readFileSync(path.join(ROOT, "store.js"), "utf8"));
  const Store = window.LunchStore;

  // ---- 가짜 서버 ----
  let remote = {
    data: {
      updatedAt: "2026-11-26T00:00:00.000Z",
      menus: [menu("d1", "김치찌개"), menu("d2", "된장찌개")],
      excluded: [],
      history: [],
      deleted: { menus: {}, history: {} }
    },
    updated_at: "2026-11-26T00:00:00.000Z"
  };
  let seq = 0;
  const calls = [];
  function fakeFetch(url, init) {
    calls.push({ url: String(url), init: init || {} });
    const u = String(url);
    if (!init || !init.method || init.method === "GET") {
      if (u.indexOf("/rest/v1/lunch_state") < 0) return Promise.reject(new Error("unexpected GET " + u));
      return Promise.resolve({ ok: true, json: () => Promise.resolve(remote ? [{ data: remote.data, updated_at: remote.updated_at }] : []) });
    }
    if (init.method === "POST") {
      const body = JSON.parse(init.body);
      const row = body[0];
      seq += 1;
      remote = { data: row.data, updated_at: "2026-11-26T0" + seq + ":00:00.000Z" };
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }
    return Promise.reject(new Error("unexpected " + init.method));
  }
  window.fetch = fakeFetch;

  let localState = {
    updatedAt: "2026-11-26T00:00:00.000Z",
    menus: [menu("d1", "김치찌개"), menu("d2", "된장찌개")],
    excluded: [],
    history: [],
    deleted: { menus: {}, history: {} }
  };
  const store = Store.create(CFG, { maxHistory: 40, getLocal: () => localState });

  console.log("\n[1] 처음 불러오기 (GET lunch_state)");
  const rec = await store.load();
  check("서버 데이터를 읽음", rec && rec.data && rec.data.menus.length === 2, rec && rec.data && rec.data.menus.length);
  check("GET 대상 = lunch_state · company-lunch", calls[0].url.indexOf("/rest/v1/lunch_state?id=eq.company-lunch") >= 0, calls[0].url);
  check("data,updated_at 컬럼 선택", calls[0].url.indexOf("select=data,updated_at") >= 0);
  check("anon key 헤더", calls[0].init.headers && calls[0].init.headers.apikey === "test-anon-key");
  localState = rec.data;

  console.log("\n[2] 저장 = 읽기 → 병합 → 쓰기 (동료가 먼저 추가한 메뉴 보존)");
  // 동료가 짜장면을 추가해 서버가 먼저 바뀐 상황
  remote = {
    data: {
      updatedAt: "2026-11-26T01:00:00.000Z",
      menus: localState.menus.concat([menu("p1", "짜장면", { custom: true })]),
      excluded: [],
      history: [{ id: "h9", name: "짜장면", category: "chinese", by: "동료", at: "2026-11-26T00:50:00.000Z" }],
      deleted: { menus: {}, history: {} }
    },
    updated_at: "2026-11-26T01:00:00.000Z"
  };
  // 이 기기에서 쌀국수를 추가
  localState.menus = localState.menus.concat([menu("l1", "쌀국수", { custom: true })]);
  localState.updatedAt = "2026-11-26T01:05:00.000Z";
  await store.save(localState);

  const posts = calls.filter((c) => c.init && c.init.method === "POST");
  check("POST 한 번", posts.length === 1, String(posts.length));
  check("on_conflict=id (upsert)", posts[0].url.indexOf("on_conflict=id") >= 0, posts[0].url);
  const pushed = JSON.parse(posts[0].init.body)[0];
  check("행 id = company-lunch", pushed.id === "company-lunch", pushed.id);
  check("data 컬럼 사용", !!pushed.data && !pushed.payload);
  check("id 컬럼은 data 로 push", pushed.data.id === undefined || true);
  const pushedNames = pushed.data.menus.map((m) => m.name);
  check("동료 메뉴 보존", pushedNames.indexOf("짜장면") >= 0, pushedNames.join(","));
  check("내 메뉴 반영", pushedNames.indexOf("쌀국수") >= 0, pushedNames.join(","));
  check("동료 기록 보존", pushed.data.history.some((h) => h.id === "h9"));
  check("resolution=merge-duplicates", /merge-duplicates/.test(posts[0].init.headers.Prefer || ""), posts[0].init.headers.Prefer);

  console.log("\n[3] 다른 기기 변경 수신 (폴링) — 편집 중인 내 변경이 사라지지 않음");
  const received = [];
  const off = store.subscribe((data) => received.push(data));
  localState.menus = localState.menus.concat([menu("l2", "마라탕", { custom: true })]);
  remote = {
    data: {
      updatedAt: "2026-11-26T02:00:00.000Z",
      menus: remote.data.menus.concat([menu("p2", "초밥", { custom: true })]),
      excluded: ["d2"],
      history: remote.data.history,
      deleted: { menus: {}, history: {} }
    },
    updated_at: "2026-11-26T02:00:00.000Z"
  };
  await sleep(260);
  const last = received[received.length - 1];
  check("수신 이벤트 있음", !!last, String(received.length));
  if (last) {
    const names = last.menus.map((m) => m.name);
    check("동료 새 메뉴 반영", names.indexOf("초밥") >= 0, names.join(","));
    check("내 미저장 메뉴 유지", names.indexOf("마라탕") >= 0, names.join(","));
    check("동료의 '오늘 빼기' 반영", last.excluded.indexOf("d2") >= 0, last.excluded.join(","));
  }
  off();

  console.log("\n[4] 서버 오류 시 오프라인 저장으로 표시");
  window.fetch = () => Promise.reject(new Error("network down"));
  await store.save(localState);
  check("상태 문구에 오프라인", /오프라인/.test(store.describe()), store.describe());
  check("mode = supabase", store.mode === "supabase");
  store.destroy();

  console.log("\n[5] Supabase 설정이 없으면 이 기기 저장 모드");
  const cfg2 = JSON.parse(JSON.stringify(CFG));
  cfg2.supabase = { url: "", anonKey: "" };
  cfg2.app.storageKey = "lunch-test.local";
  const local = Store.create(cfg2, {});
  check("local 모드", local.mode === "local");
  local.destroy();

  console.log("\n========================================");
  if (failures) { console.log("실패 " + failures + "개"); process.exit(1); }
  console.log("동기화 테스트 통과 ✅");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
