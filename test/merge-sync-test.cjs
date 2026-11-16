/* 기기 사이 동기화 병합 테스트
   ① 병합 규칙(mergeStates) — 오래된 기기가 저장해도 다른 기기의 채팅·일정·체크리스트·루틴이 살아남는지
   ② 두 기기 실제 흐름 — 가짜 Supabase 서버를 사이에 두고 A(오래 열어 둔 기기)·B 가 번갈아 저장 */
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

const kst = new Date(Date.now() + 9 * 3600 * 1000);
const pad = (n) => String(n).padStart(2, "0");
const TODAY = kst.getUTCFullYear() + "-" + pad(kst.getUTCMonth() + 1) + "-" + pad(kst.getUTCDate());
const YESTERDAY = (function () {
  const d = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 86400000);
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
})();

const clone = (v) => JSON.parse(JSON.stringify(v));
const T1 = "2026-11-16T11:44:00.000Z";
const T2 = "2026-11-16T11:47:00.000Z";
const T3 = "2026-11-16T12:20:00.000Z";

function makeWindow() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true, runScripts: "outside-only" });
  const { window } = dom;
  window.eval(fs.readFileSync(path.join(ROOT, "store.js"), "utf8"));
  return window;
}

function baseState(over) {
  const s = {
    version: 1,
    updatedAt: T1,
    deleted: {},
    members: [{ id: "dain", name: "다인이" }, { id: "mom", name: "엄마" }, { id: "dad", name: "아빠" }],
    study: { items: [], dayKey: TODAY, rewarded: false },
    stamps: {},
    badges: {},
    dex: { unlocked: {}, seen: {} },
    mission: { todayKey: TODAY, index: 1, doneToday: false, doneTotal: 0, history: [] },
    todos: { dain: [], mom: [], dad: [] },
    chat: [],
    quickPhrases: { custom: [], hidden: [] },
    calendar: { events: [] },
    checklists: { lists: [] },
    routine: { items: [{ id: "r1", name: "양치" }, { id: "r2", name: "책 읽기" }], days: {}, spent: 0 },
    growth: { birthDate: "2021-02-16", sex: "F", records: [] },
    pet: { name: "봄이", xp: 0, moneyXp: 0, day: TODAY, bonusDay: "", seenLevel: 1, care: { fed: 0, played: 0, petted: 0, full: 50, mood: 50, bond: 30 }, ledger: {} },
    settings: { weatherCache: null, notify: false },
  };
  if (over) Object.keys(over).forEach((k) => { s[k] = over[k]; });
  return s;
}

function msg(id, from, text, at) {
  return { id, from, fromName: from, kind: "text", text, at, heart: false };
}

const ids = (list) => (Array.isArray(list) ? list.map((x) => x.id) : []).join(",");

(function main() {
  const window = makeWindow();
  const merge = (base, local, remote, opts) => window.FamilyStore.mergeStates(base, local, remote, opts);

  /* ---------------- ① 병합 규칙 ---------------- */
  console.log("\n[1] 오래된 기기 저장 — 채팅");
  {
    const base = baseState({ chat: [msg("m1", "dain", "잘 잤어요", T1)] });
    const local = clone(base);
    local.settings.weatherCache = { at: T3, temp: 3 };   // 이 기기는 날씨만 새로 받음
    local.updatedAt = T3;
    const remote = clone(base);
    remote.chat.push(msg("m2", "mom", "보고 싶어요", T2));
    remote.updatedAt = T2;
    const res = merge(base, local, remote);
    check("다른 기기의 새 채팅이 남아 있음", ids(res.payload.chat) === "m1,m2", ids(res.payload.chat));
    check("채팅은 시간순 정렬", res.payload.chat[1].text === "보고 싶어요", JSON.stringify(res.payload.chat.map((m) => m.text)));
    check("이 기기의 날씨 갱신도 반영", !!res.payload.settings.weatherCache, JSON.stringify(res.payload.settings));
    check("화면 다시 그리기 필요 표시", res.remoteChanged === true);
    check("저장 시각은 둘 중 최신", res.payload.updatedAt === T3, res.payload.updatedAt);
  }
  {
    const base = baseState({ chat: [msg("m1", "dain", "안녕", T1)] });
    const local = clone(base);
    local.chat.push(msg("m3", "dad", "다인아 양치하까?", T3));
    local.updatedAt = T3;
    const remote = clone(base);
    remote.chat.push(msg("m2", "mom", "사랑해요", T2));
    remote.updatedAt = T2;
    const res = merge(base, local, remote);
    check("양쪽이 동시에 보낸 채팅 모두 보존", ids(res.payload.chat) === "m1,m2,m3", ids(res.payload.chat));
  }

  console.log("\n[2] 가족 달력 일정 — 추가는 살리고 삭제는 지킨다");
  {
    const base = baseState({ calendar: { events: [{ id: "e1", date: "2026-11-20", title: "소풍", updatedAt: T1 }] } });
    const local = clone(base);
    local.updatedAt = T3;
    local.settings.weatherCache = { at: T3 };            // 이 기기는 일정을 건드리지 않음
    const remote = clone(base);
    remote.calendar.events.push({ id: "e2", date: "2026-11-28", title: "이서네", updatedAt: T2 });
    remote.updatedAt = T2;
    const res = merge(base, local, remote);
    check("다른 기기에서 넣은 11/28 이서네 일정 보존", ids(res.payload.calendar.events) === "e1,e2", ids(res.payload.calendar.events));
  }
  {
    // A 가 e2 를 지운다 → tombstone
    const base = baseState({ calendar: { events: [{ id: "e1", date: "2026-11-20", title: "소풍" }, { id: "e2", date: "2026-11-28", title: "이서네" }] } });
    const del = clone(base);
    del.calendar.events = del.calendar.events.filter((x) => x.id !== "e2");
    del.deleted = { events: { e2: T3 } };
    del.updatedAt = T3;
    const res1 = merge(base, del, clone(base));
    check("지운 일정은 지워진 채로 저장", ids(res1.payload.calendar.events) === "e1", ids(res1.payload.calendar.events));

    // B 는 e2 를 아직 들고 있다가 다른 일을 저장한다 → 되살아나면 안 됨
    const baseB = clone(base);
    const localB = clone(base);
    localB.updatedAt = "2026-11-16T13:00:00.000Z";
    localB.chat.push(msg("m9", "dad", "늦어요", "2026-11-16T12:59:00.000Z"));
    const res2 = merge(baseB, localB, res1.payload, { maxChat: 200 });
    check("오래된 기기가 저장해도 지운 일정이 되살아나지 않음", ids(res2.payload.calendar.events) === "e1", ids(res2.payload.calendar.events));
    check("그 기기의 새 채팅은 그대로 올라감", ids(res2.payload.chat) === "m9", ids(res2.payload.chat));
  }
  {
    // tombstone 만 있어도(기준 상태 없이) 지운 항목은 걸러진다
    const local = baseState({ deleted: { events: { eX: T3 } }, calendar: { events: [{ id: "eX", date: "2026-11-28", title: "지운 일정" }] } });
    local.updatedAt = T3;
    const res = merge(null, local, baseState());
    check("tombstone 이 있는 항목은 병합에서 제외", ids(res.payload.calendar.events) === "", ids(res.payload.calendar.events));
  }

  console.log("\n[3] 함께 체크리스트");
  {
    const base = baseState({ checklists: { lists: [{ id: "l1", emoji: "🧺", title: "장보기", createdAt: T1, items: [] }] } });
    const local = clone(base);
    local.checklists.lists[0].items.push({ id: "i1", text: "우유", done: false, createdAt: T3 });
    local.updatedAt = T3;
    const remote = clone(base);
    remote.checklists.lists[0].items.push({ id: "i2", text: "계란", done: true, doneAt: T2, createdAt: T2 });
    remote.updatedAt = T2;
    const res = merge(base, local, remote);
    check("양쪽에서 넣은 항목 모두 보존", ids(res.payload.checklists.lists[0].items) === "i2,i1", ids(res.payload.checklists.lists[0].items));
    const byId = {};
    res.payload.checklists.lists[0].items.forEach((it) => { byId[it.id] = it; });
    check("체크 표시도 함께 보존", byId.i2.done === true && byId.i1.done === false);

    // 체크는 어느 쪽에서 하든 남는다
    const base2 = clone(base);
    const local2 = clone(base2);
    local2.checklists.lists[0].items = [{ id: "i1", text: "우유", done: true, doneAt: T3, createdAt: T1 }];
    local2.updatedAt = T3;
    const remote2 = clone(base2);
    remote2.checklists.lists[0].items = [{ id: "i1", text: "우유", done: false, createdAt: T1 }];
    remote2.updatedAt = T2;
    check("한쪽에서 체크한 항목 유지", merge(base2, local2, remote2).payload.checklists.lists[0].items[0].done === true);
  }

  console.log("\n[4] 저녁 루틴 · 용돈");
  {
    const base = baseState();
    const local = clone(base);
    local.routine.days = {}; local.routine.days[TODAY] = { checked: { r1: true } };
    local.updatedAt = T3;
    const remote = clone(base);
    remote.routine.days = {}; remote.routine.days[TODAY] = { checked: { r2: true } };
    remote.updatedAt = T2;
    const res = merge(base, local, remote);
    const checked = res.payload.routine.days[TODAY].checked;
    check("양쪽에서 체크한 루틴 모두 남음", !!checked.r1 && !!checked.r2, JSON.stringify(checked));

    // 체크를 푼 것도 그대로 전달된다
    const base2 = clone(base);
    base2.routine.days = {}; base2.routine.days[TODAY] = { checked: { r1: true, r2: true } };
    const local2 = clone(base2);
    local2.routine.days[TODAY].checked = { r2: true };
    local2.updatedAt = T3;
    const res2 = merge(base2, local2, clone(base2));
    check("체크를 푼 항목은 풀린 채로 저장", !res2.payload.routine.days[TODAY].checked.r1 && !!res2.payload.routine.days[TODAY].checked.r2,
      JSON.stringify(res2.payload.routine.days[TODAY].checked));

    // 루틴 항목 삭제(tombstone)는 되살아나지 않는다
    const base3 = clone(base);
    const local3 = clone(base3);
    local3.routine.items = local3.routine.items.filter((x) => x.id !== "r1");
    local3.deleted = { routineItems: { r1: T3 } };
    local3.updatedAt = T3;
    const res3 = merge(base3, local3, clone(base3));
    check("지운 루틴 항목이 되살아나지 않음", ids(res3.payload.routine.items) === "r2", ids(res3.payload.routine.items));
  }

  console.log("\n[5] 말판(빠른 문구)");
  {
    const base = baseState();
    const local = clone(base);
    local.quickPhrases = { custom: [{ id: "qp1", emoji: "🍚", label: "밥 줘요" }], hidden: ["q-tv"] };
    local.updatedAt = T3;
    const remote = clone(base);
    remote.quickPhrases = { custom: [{ id: "qp2", emoji: "🧸", label: "놀아 줘요" }], hidden: [] };
    remote.updatedAt = T2;
    const res = merge(base, local, remote);
    check("양쪽에서 더한 말판 문구 모두 보존", ids(res.payload.quickPhrases.custom) === "qp2,qp1", ids(res.payload.quickPhrases.custom));
    check("숨긴 기본 문구도 보존", res.payload.quickPhrases.hidden.join(",") === "q-tv", res.payload.quickPhrases.hidden.join(","));

    const base2 = clone(base);
    const local2 = clone(base2);
    local2.quickPhrases = { custom: [], hidden: [] };
    local2.deleted = { quickCustom: { qp1: T3 } };
    local2.updatedAt = T3;
    const remote2 = clone(base2);
    remote2.quickPhrases = { custom: [{ id: "qp1", emoji: "🍚", label: "밥 줘요" }], hidden: [] };
    remote2.updatedAt = T2;
    check("지운 말판 문구가 되살아나지 않음",
      merge(base2, local2, remote2).payload.quickPhrases.custom.length === 0,
      JSON.stringify(merge(base2, local2, remote2).payload.quickPhrases.custom));
  }

  console.log("\n[6] 캐릭터 — 경험치는 뒤로 가지 않는다");
  {
    const base = baseState({ pet: Object.assign(baseState().pet, { xp: 40, moneyXp: 3, seenLevel: 1 }) });
    const local = clone(base);                       // 오래된 기기: 경험치가 예전 값
    local.updatedAt = T3;
    const remote = clone(base);
    remote.pet.xp = 120;
    remote.pet.moneyXp = 9;
    remote.pet.seenLevel = 3;
    remote.pet.care.bond = 45;
    remote.pet.name = "별이";
    remote.updatedAt = T2;
    const res = merge(base, local, remote);
    check("경험치가 뒤로 가지 않음", res.payload.pet.xp === 120, String(res.payload.pet.xp));
    check("용돈 경험치도 유지", res.payload.pet.moneyXp === 9, String(res.payload.pet.moneyXp));
    check("본 레벨 표시 유지", res.payload.pet.seenLevel === 3, String(res.payload.pet.seenLevel));
    check("친밀도는 큰 값 유지", res.payload.pet.care.bond === 45, String(res.payload.pet.care.bond));
    check("이름은 새로 바꾼 쪽", res.payload.pet.name === "별이", res.payload.pet.name);
  }

  console.log("\n[7] 가족 미션 · 공부");
  {
    const base = baseState();
    const local = clone(base);
    local.mission.doneToday = false; local.mission.doneTotal = 0; local.updatedAt = T3;
    const remote = clone(base);
    remote.mission.doneToday = true; remote.mission.doneTotal = 2; remote.mission.todayKey = TODAY; remote.updatedAt = T2;
    const res = merge(base, local, remote);
    check("미션 완료 표시가 풀리지 않음", res.payload.mission.doneToday === true);
    check("미션 완료 횟수는 큰 값", res.payload.mission.doneTotal === 2, String(res.payload.mission.doneTotal));

    // 날짜가 바뀐 기기(어제 것)가 저장해도 오늘 것으로 넘어간다
    const baseS = baseState({ study: { items: [{ id: "s1", name: "책 읽기", minutes: 15, kind: "countdown", done: true }], dayKey: YESTERDAY, rewarded: true } });
    const localS = clone(baseS);
    localS.updatedAt = T3;
    const remoteS = clone(baseS);
    remoteS.study = { items: [{ id: "s1", name: "책 읽기", minutes: 15, kind: "countdown", done: false }, { id: "s2", name: "수학", minutes: 10, kind: "countdown", done: false }], dayKey: TODAY, rewarded: false };
    remoteS.updatedAt = T2;
    const resS = merge(baseS, localS, remoteS);
    check("공부는 새 날짜 기록 사용", resS.payload.study.dayKey === TODAY, resS.payload.study.dayKey);
    check("오늘 체크는 새로 시작(false)", resS.payload.study.items[0].done === false);
    check("다른 기기에서 넣은 공부 항목 보존", ids(resS.payload.study.items) === "s1,s2", ids(resS.payload.study.items));
  }

  console.log("\n[8] 채팅 상한 · 사진 정리 · 기준 없는 첫 병합");
  {
    const many = [];
    for (let i = 0; i < 210; i++) many.push(msg("m" + i, "mom", "메시지 " + i, new Date(Date.UTC(2026, 10, 16, 1, 0, i)).toISOString()));
    const base = baseState({ chat: many.slice(0, 205) });
    const local = clone(base);
    local.updatedAt = T3;
    const remote = clone(base);
    remote.chat = many.slice(0, 209);
    remote.updatedAt = T2;
    const res = merge(base, local, remote, { maxChat: 200 });
    check("채팅은 상한(200)까지만", res.payload.chat.length === 200, String(res.payload.chat.length));
    check("상한을 넘으면 오래된 것부터 정리", res.payload.chat[199].id === "m208", res.payload.chat[199].id);

    const photos = [];
    for (let i = 0; i < 30; i++) photos.push({ id: "p" + i, from: "dad", kind: "photo", imageData: "data:image/jpeg;base64,AAAA", at: new Date(Date.UTC(2026, 10, 16, 1, 0, i)).toISOString() });
    const baseP = baseState({ chat: photos.slice(0, 28) });
    const localP = clone(baseP); localP.updatedAt = T3;
    const remoteP = clone(baseP); remoteP.chat = photos.slice(0, 30); remoteP.updatedAt = T2;
    const resP = merge(baseP, localP, remoteP, { maxPhotos: 24 });
    check("사진은 24장만 남기고 오래된 사진은 글만", resP.payload.chat.filter((m) => m.imageData).length === 24,
      String(resP.payload.chat.filter((m) => m.imageData).length));

    // 기준 상태 없이(첫 병합) — 잃지 않게 합집합
    const l = baseState({ chat: [msg("a1", "dain", "하이", T1)], calendar: { events: [{ id: "ea", date: "2026-11-20", title: "A" }] } });
    const r = baseState({ chat: [msg("a2", "mom", "안녕", T2)], calendar: { events: [{ id: "eb", date: "2026-11-21", title: "B" }] } });
    l.updatedAt = T3; r.updatedAt = T2;
    const resN = merge(null, l, r);
    check("기준 없이도 채팅 합집합", ids(resN.payload.chat) === "a1,a2", ids(resN.payload.chat));
    check("기준 없이도 일정 합집합", ids(resN.payload.calendar.events) === "eb,ea", ids(resN.payload.calendar.events));
  }

  /* ---------------- ② 두 기기 실제 흐름 ---------------- */
  console.log("\n[9] 기기 A(오래 열어 둔 태블릿) · 기기 B(폰) — 가짜 Supabase 서버");
  (async function () {
    const server = { payload: baseState({ chat: [msg("m1", "dain", "잘 잤어요", T1)] }), updated_at: T1 };
    function makeDevice(name, pollMs) {
      const w = makeWindow();
      const dev = { name, state: null, store: null, posts: 0 };
      w.fetch = (url, opts) => {
        const isGet = !opts || !opts.method || opts.method === "GET";
        if (isGet) return Promise.resolve({ ok: true, json: () => Promise.resolve([{ payload: server.payload, updated_at: server.updated_at }]) });
        const body = JSON.parse(opts.body);
        dev.posts++;
        server.payload = body[0].payload;
        server.updated_at = body[0].updated_at;
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      };
      dev.store = w.FamilyStore.create({
        app: { storageKey: "family-dashboard.state.v1" },
        supabase: { url: "https://example.supabase.co", anonKey: "k", table: "family_state", rowId: "main", pollMs: pollMs || 100000, realtime: false },
      }, { getLocal: () => dev.state, maxChat: 200, maxPhotos: 24 });
      return dev;
    }

    const A = makeDevice("A");
    const B = makeDevice("B");
    const recA = await A.store.load();
    A.state = clone(recA.payload);
    const recB = await B.store.load();
    B.state = clone(recB.payload);
    check("두 기기 모두 같은 상태로 시작", ids(A.state.chat) === ids(B.state.chat), ids(A.state.chat));

    // B(폰): 채팅 두 개 + 11/28 이서네 일정
    B.state.chat.push(msg("m2", "mom", "보고 싶어요", T2));
    B.state.chat.push(msg("m3", "dad", "다인아 양치하까?", T2));
    B.state.calendar.events.push({ id: "e-iseo", date: "2026-11-28", title: "이서네", createdAt: T2 });
    B.state.updatedAt = "2026-11-16T11:47:00.000Z";
    await B.store.save(B.state);
    check("B 저장 → 서버에 채팅 3건", server.payload.chat.length === 3, String(server.payload.chat.length));

    // A(오래 열어 둔 기기): 아무것도 모른 채 날씨만 새로 받아 저장 (사고 상황)
    A.state.settings.weatherCache = { at: T3, temp: 1.5 };
    A.state.updatedAt = "2026-11-16T12:20:00.000Z";
    await A.store.save(A.state);
    check("A 의 날씨 저장 뒤에도 서버 채팅 3건 유지", server.payload.chat.length === 3, String(server.payload.chat.length));
    check("A 저장 뒤에도 11/28 이서네 일정 유지", server.payload.calendar.events.some((e) => e.id === "e-iseo"),
      JSON.stringify(server.payload.calendar.events));
    check("A 화면에도 B 의 새 채팅이 합쳐짐", A.state.chat.length === 3, String(A.state.chat.length));
    check("A 의 날씨 갱신 저장됨", !!server.payload.settings.weatherCache, JSON.stringify(server.payload.settings));

    // A: 체크리스트에 항목 추가
    A.state.checklists.lists = [{ id: "l1", emoji: "🧺", title: "장보기", createdAt: T1, items: [{ id: "i-a", text: "우유", done: false, createdAt: T3 }] }];
    A.state.updatedAt = "2026-11-16T12:30:00.000Z";
    await A.store.save(A.state);

    // B: 체크리스트에 다른 항목 추가 + 캐릭터 경험치 상승
    B.state.checklists.lists = [{ id: "l1", emoji: "🧺", title: "장보기", createdAt: T1, items: [{ id: "i-b", text: "계란", done: false, createdAt: "2026-11-16T12:31:00.000Z" }] }];
    B.state.pet.xp = 130;
    B.state.updatedAt = "2026-11-16T12:32:00.000Z";
    await B.store.save(B.state);
    check("양쪽 체크리스트 항목 모두 서버에", ids(server.payload.checklists.lists[0].items) === "i-a,i-b",
      ids(server.payload.checklists.lists[0].items));
    check("캐릭터 경험치 130 유지", server.payload.pet.xp === 130, String(server.payload.pet.xp));

    // A: 오래된 경험치(0)를 들고 저장해도 뒤로 가지 않는다
    A.state.pet.xp = 0;
    A.state.updatedAt = "2026-11-16T12:33:00.000Z";
    await A.store.save(A.state);
    check("오래된 기기 저장으로 경험치가 줄지 않음", server.payload.pet.xp === 130, String(server.payload.pet.xp));

    // B: 이서네 일정 삭제 → A(옛 복사본)가 나중에 저장해도 되살아나지 않는다
    B.state.calendar.events = B.state.calendar.events.filter((e) => e.id !== "e-iseo");
    B.state.deleted = { events: { "e-iseo": "2026-11-16T12:34:00.000Z" } };
    B.state.updatedAt = "2026-11-16T12:34:00.000Z";
    await B.store.save(B.state);
    check("B 가 지운 일정이 서버에서 사라짐", !server.payload.calendar.events.some((e) => e.id === "e-iseo"));

    A.state.todos.dain.push({ id: "t1", text: "가방 싸기", done: false, createdAt: "2026-11-16T12:35:00.000Z" });
    A.state.updatedAt = "2026-11-16T12:35:00.000Z";
    await A.store.save(A.state);
    check("A 의 할 일 저장됨", (server.payload.todos.dain || []).length === 1, JSON.stringify(server.payload.todos.dain));
    check("A 의 오래된 복사본이 지운 일정을 되살리지 않음", !server.payload.calendar.events.some((e) => e.id === "e-iseo"),
      JSON.stringify(server.payload.calendar.events));
    check("그동안 쌓인 채팅 3건 그대로", server.payload.chat.length === 3, String(server.payload.chat.length));

    // 다른 기기 변경 수신(폴링)도 통째 교체가 아니라 병합인지 — 새 기기 C 로 확인
    const C = makeDevice("C", 40);
    const recC = await C.store.load();
    C.state = clone(recC.payload);
    C.state.todos.dain.push({ id: "t-c", text: "C 기기 메모", done: false, createdAt: "2026-11-16T12:36:00.000Z" }); // 아직 저장 전
    const before = C.state.chat.length;
    server.payload.chat.push(msg("m4", "mom", "오늘 뭐 해?", "2026-11-16T12:37:00.000Z"));
    server.updated_at = "2026-11-16T12:37:00.000Z";
    let got = null;
    C.store.subscribe((p) => { got = p; });
    await sleep(250);
    check("다른 기기 채팅이 실시간으로 합쳐짐", !!got && got.chat.length === before + 1, got && String(got.chat.length));
    check("받는 쪽이 하던 일도 그대로", (C.state.todos.dain || []).some((t) => t.id === "t-c"), JSON.stringify(C.state.todos.dain));

    A.store.destroy();
    B.store.destroy();
    C.store.destroy();

    console.log("\n================================");
    if (failures) { console.log("FAILED: " + failures + " checks"); process.exit(1); }
    console.log("ALL MERGE CHECKS PASSED ✅");
    process.exit(0);
  })().catch((e) => { console.error("TEST CRASH:", e); process.exit(2); });
})();
