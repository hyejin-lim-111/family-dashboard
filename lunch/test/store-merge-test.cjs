/* lunch/store.js — 3-way 병합(tombstone 포함) 검증 */
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = __dirname + "/..";

let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("  ✓ " + name);
  else { failures++; console.log("  ✗ FAIL: " + name + (extra ? " — " + extra : "")); }
}

// 브라우저 없이 store.js 만 실행 (global.LunchStore 노출)
const sandbox = { console, window: null };
sandbox.window = sandbox;
sandbox.global = sandbox;
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, "store.js"), "utf8"), sandbox);
const Store = sandbox.LunchStore;
const merge = Store.mergeStates;

function state(over) {
  return Object.assign({
    updatedAt: "2026-11-26T00:00:00.000Z",
    menus: [],
    excluded: [],
    history: [],
    deleted: { menus: {}, history: {} }
  }, over);
}
function menu(id, name, over) {
  return Object.assign({ id, name, category: "korean", memo: "", custom: false, hidden: false, createdAt: "2026-11-26T00:00:00.000Z", updatedAt: "2026-11-26T00:00:00.000Z" }, over);
}

console.log("\n[1] 동시에 추가한 메뉴는 둘 다 살아남는다");
{
  const base = state({});
  const local = state({ menus: [menu("a", "김치찌개")] });
  const remote = state({ menus: [menu("b", "짜장면")] });
  const out = merge(base, local, remote).state;
  const names = out.menus.map((m) => m.name).sort();
  check("두 메뉴 모두 있음", names.join(",") === "김치찌개,짜장면", names.join(","));
}

console.log("\n[2] 한쪽이 지운 메뉴는 다른 기기가 저장해도 되살아나지 않는다");
{
  const base = state({ menus: [menu("a", "김치찌개"), menu("b", "짜장면")] });
  const local = state({                                   // a 를 지움 (tombstone)
    menus: [menu("b", "짜장면")],
    deleted: { menus: { a: "2026-11-26T01:00:00.000Z" }, history: {} }
  });
  const remote = state({                                  // 다른 기기는 옛 복사본 + 새 메뉴 c
    menus: [menu("a", "김치찌개"), menu("b", "짜장면"), menu("c", "쌀국수")]
  });
  const out = merge(base, local, remote).state;
  const ids = out.menus.map((m) => m.id).sort();
  check("지운 a 는 없음", ids.indexOf("a") === -1, ids.join(","));
  check("새 메뉴 c 는 살아남음", ids.indexOf("c") >= 0, ids.join(","));
  check("tombstone 이 남아 있음", !!out.deleted.menus.a);
}

console.log("\n[3] 같은 메뉴를 양쪽에서 다르게 고치면 각 필드가 합쳐진다");
{
  const base = state({ menus: [menu("a", "김치찌개", { memo: "옛 메모" })] });
  const local = state({ menus: [menu("a", "김치찌개", { memo: "2층 8000원", updatedAt: "2026-11-26T02:00:00.000Z" })] });
  const remote = state({ menus: [menu("a", "김치찌개", { hidden: true, updatedAt: "2026-11-26T03:00:00.000Z" })] });
  const out = merge(base, local, remote).state;
  const m = out.menus[0];
  check("메모는 이 기기 것", m.memo === "2층 8000원", m.memo);
  check("숨김은 서버 것", m.hidden === true, String(m.hidden));
  check("updatedAt 은 더 최신", m.updatedAt === "2026-11-26T03:00:00.000Z", m.updatedAt);
}

console.log("\n[4] '오늘 빼기' 는 더하고 뺀 것만 반영된다 (동시 편집)");
{
  const base = state({ menus: [menu("a", "A"), menu("b", "B"), menu("c", "C")], excluded: [] });
  const local = state({ menus: base.menus, excluded: ["a"] });            // a 빼기
  const remote = state({ menus: base.menus, excluded: ["b"] });           // b 빼기
  const out = merge(base, local, remote).state;
  check("a, b 둘 다 빠짐", out.excluded.slice().sort().join(",") === "a,b", out.excluded.join(","));

  const base2 = state({ menus: [menu("a", "A"), menu("b", "B")], excluded: ["a", "b"] });
  const local2 = state({ menus: base2.menus, excluded: ["b"] });          // a 다시 넣기
  const remote2 = state({ menus: base2.menus, excluded: ["a", "b", "c"] }); // c 추가
  const out2 = merge(base2, local2, remote2).state;
  check("a 는 빠지고 b, c 는 남음", out2.excluded.slice().sort().join(",") === "b,c", out2.excluded.join(","));
}

console.log("\n[5] 뽑기 기록은 양쪽 것이 합쳐지고 최신순 · 개수 제한");
{
  const base = state({});
  const local = state({ history: [{ id: "h1", name: "김치찌개", at: "2026-11-26T01:00:00.000Z", by: "나" }] });
  const remote = state({ history: [
    { id: "h2", name: "짜장면", at: "2026-11-26T02:00:00.000Z", by: "동료" },
    { id: "h3", name: "초밥", at: "2026-11-26T00:30:00.000Z", by: "동료2" }
  ] });
  const out = merge(base, local, remote, { maxHistory: 40 }).state;
  check("기록 3개", out.history.length === 3, String(out.history.length));
  check("최신순 정렬", out.history.map((h) => h.id).join(",") === "h2,h1,h3", out.history.map((h) => h.id).join(","));

  const many = [];
  for (let i = 0; i < 60; i++) many.push({ id: "x" + i, name: "메뉴" + i, at: new Date(Date.UTC(2026, 10, 1, 0, i)).toISOString() });
  const out2 = merge(state({}), state({ history: many }), state({}), { maxHistory: 40 }).state;
  check("40개까지만 유지", out2.history.length === 40, String(out2.history.length));
}

console.log("\n[6] 지운 기록은 다른 기기 저장에도 되살아나지 않는다");
{
  const base = state({ history: [{ id: "h1", name: "김치찌개", at: "2026-11-26T01:00:00.000Z" }] });
  const local = state({ history: [], deleted: { menus: {}, history: { h1: "2026-11-26T02:00:00.000Z" } } });
  const remote = state({ history: [{ id: "h1", name: "김치찌개", at: "2026-11-26T01:00:00.000Z" }, { id: "h2", name: "짜장면", at: "2026-11-26T03:00:00.000Z" }] });
  const out = merge(base, local, remote).state;
  check("지운 h1 없음", !out.history.some((h) => h.id === "h1"));
  check("h2 는 남음", out.history.some((h) => h.id === "h2"));
}

console.log("\n[7] 서버에 없는 상태에서 이 기기 초기값은 유지되고, 원격 값이 우선한다");
{
  const local = state({ menus: [menu("d1", "김치찌개")] });
  const out = merge(null, local, null).state;
  check("로컬만으로도 병합", out.menus.length === 1);
  const remote = state({ menus: [menu("d1", "김치찌개", { hidden: true, updatedAt: "2026-11-26T05:00:00.000Z" })] });
  const out2 = merge(state({ menus: [menu("d1", "김치찌개")] }), local, remote).state;
  check("서버가 숨긴 값이 유지", out2.menus[0].hidden === true);
}

console.log("\n[8] tombstone 정리 · 비어 있는 상태 안전");
{
  const out = merge(undefined, undefined, undefined).state;
  check("빈 값도 안전", Array.isArray(out.menus) && Array.isArray(out.history) && Array.isArray(out.excluded));
  const old = new Date(Date.now() - 200 * 24 * 3600 * 1000).toISOString();
  const out2 = merge(state({}), state({ deleted: { menus: { old: old }, history: {} } }), state({})).state;
  check("120일 지난 tombstone 은 정리", !out2.deleted.menus.old, JSON.stringify(out2.deleted.menus));
}

console.log("\n[9] 병합 결과는 다시 병합해도 그대로 (멱등)");
{
  const base = state({ menus: [menu("a", "A")] });
  const local = state({ menus: [menu("a", "A"), menu("b", "B")] });
  const remote = state({ menus: [menu("a", "A2"), menu("c", "C")] });
  const once = merge(base, local, remote).state;
  const twice = merge(once, once, once).state;
  check("같은 결과", Store.deepEqual(once, twice));
}

console.log("\n========================================");
if (failures) { console.log("실패 " + failures + "개"); process.exit(1); }
console.log("store 병합 테스트 통과 ✅");
