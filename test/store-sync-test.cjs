/* 저장소 어댑터 테스트 — Supabase(실시간/폴링) 경로와 로컬 경로를 모의 fetch로 검증한다.
   config.js 값은 건드리지 않고, 테스트용 설정만 넘긴다. */
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

function makeWindow() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true, runScripts: "outside-only" });
  const { window } = dom;
  window.eval(fs.readFileSync(path.join(ROOT, "store.js"), "utf8"));
  return window;
}

const baseCfg = (over) => ({
  app: { storageKey: "family-dashboard.state.v1" },
  supabase: Object.assign({
    url: "https://example.supabase.co",
    anonKey: "anon-test-key",
    table: "family_state",
    rowId: "main",
    pollMs: 40,
    realtime: false,           // CDN 스크립트 없이 폴링 경로만 검증
  }, over || {}),
});

(async function main() {
  /* ---------------- Supabase 어댑터 ---------------- */
  console.log("\n[1] Supabase 저장소 — 불러오기·저장·폴링");
  {
    const window = makeWindow();
    const calls = [];
    let remote = {
      payload: { version: 1, updatedAt: "2026-11-10T00:00:00.000Z", chat: [], calendar: { events: [] }, checklists: { lists: [] } },
      updated_at: "2026-11-10T00:00:00.000Z",
    };
    let offline = false;

    window.fetch = (url, opts) => {
      calls.push({ url: String(url), opts: opts || {} });
      if (offline) return Promise.reject(new Error("network down"));
      const isGet = !opts || !opts.method || opts.method === "GET";
      if (isGet) return Promise.resolve({ ok: true, json: () => Promise.resolve([remote]) });
      const body = JSON.parse(opts.body);
      remote = { payload: body[0].payload, updated_at: body[0].updated_at };
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    };

    const store = window.FamilyStore.create(baseCfg());
    check("모드가 supabase", store.mode === "supabase", store.mode);

    const rec = await store.load();
    check("원격 payload를 불러옴", rec && rec.payload && rec.payload.version === 1);
    check("GET 요청 대상이 테이블·행", calls[0].url.includes("/rest/v1/family_state") && calls[0].url.includes("id=eq.main"), calls[0].url);
    check("anon key 헤더", calls[0].opts.headers.apikey === "anon-test-key");
    const cached = window.localStorage.getItem("family-dashboard.state.v1");
    check("이 기기에도 캐시", !!cached && JSON.parse(cached).payload.version === 1);

    const payload = {
      version: 1,
      updatedAt: new Date().toISOString(),
      chat: [{ id: "m1", text: "안녕" }],
      calendar: { events: [{ id: "ev1", date: "2026-11-20", title: "소풍" }] },
      checklists: { lists: [{ id: "l1", title: "장보기", items: [] }] },
    };
    await store.save(payload);
    const post = calls.filter((c) => c.opts.method === "POST").pop();
    check("업서트 POST", !!post && post.url.includes("on_conflict=id"), post && post.url);
    check("merge-duplicates 로 덮어쓰기", !!post && post.opts.headers.Prefer.includes("merge-duplicates"));
    const sent = JSON.parse(post.opts.body)[0];
    check("행 id·payload·updated_at 전송", sent.id === "main" && sent.payload.calendar.events.length === 1 && !!sent.updated_at);
    check("새 필드도 그대로 전송", sent.payload.checklists.lists[0].title === "장보기");

    let received = null;
    const unsub = store.subscribe((p) => { received = p; });
    remote = {
      payload: { version: 1, updatedAt: "2026-11-16T01:00:00.000Z", calendar: { events: [{ id: "ev2", date: "2026-11-21", title: "다른 기기 일정" }] }, checklists: { lists: [] } },
      updated_at: "2026-11-16T01:00:00.000Z",
    };
    await sleep(250);
    check("폴링으로 다른 기기 변경 수신", !!received && received.calendar.events[0].title === "다른 기기 일정", JSON.stringify(received && received.calendar));
    unsub();

    offline = true;
    const ok = await store.save({ version: 1, updatedAt: new Date().toISOString(), chat: [] });
    check("오프라인이면 저장 실패로 알려줌", ok === false, String(ok));
    check("오프라인 라벨", store.shortLabel() === "오프라인 저장", store.shortLabel());

    store.destroy();
    const after = calls.length;
    await sleep(200);
    check("destroy 후 폴링 중단", calls.length === after, "calls " + after + " → " + calls.length);
  }

  /* ---------------- localStorage 어댑터 ---------------- */
  console.log("\n[2] 이 기기 저장(local) — 저장·불러오기");
  {
    const window = makeWindow();
    const store = window.FamilyStore.create({ app: { storageKey: "family-dashboard.state.v1" }, supabase: { url: "", anonKey: "" } });
    check("모드가 local", store.mode === "local", store.mode);
    await store.save({ version: 1, updatedAt: "2026-11-16T00:00:00.000Z", calendar: { events: [{ id: "e", date: "2026-11-20", title: "x" }] }, checklists: { lists: [] } });
    const rec = await store.load();
    check("저장한 값이 그대로", rec.payload.calendar.events[0].title === "x");
    check("안내 문구", store.describe().includes("localStorage"));
    store.destroy();
  }

  /* ---------------- 설정이 없을 때 local로 떨어지는지 ---------------- */
  console.log("\n[3] 설정 판별");
  {
    const window = makeWindow();
    check("supabase 설정 없음", window.FamilyStore.hasSupabaseConfig({ supabase: { url: "", anonKey: "" } }) === false);
    check("supabase 설정 있음", window.FamilyStore.hasSupabaseConfig({ supabase: { url: "https://a.supabase.co", anonKey: "k" } }) === true);
  }

  console.log("\n================================");
  if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
  console.log("ALL STORE CHECKS PASSED ✅");
  process.exit(0);
})().catch((e) => { console.error("TEST CRASH:", e); process.exit(2); });
