/* =========================================================
   점심 뭐 먹지? — config.js
   여기 값만 바꾸면 됩니다. (앱을 다시 열면 반영)
   ========================================================= */

window.LUNCH_CONFIG = {

  /* ---------- 제목 ---------- */
  title: "점심 뭐 먹지?",

  /* ---------- 공유 저장소 (Supabase) ----------
     가족 기록장과 같은 프로젝트를 쓰되, 테이블만 lunch_state 로 따로 씁니다.
     비워 두면: 이 기기의 localStorage 에만 저장됩니다. */
  supabase: {
    url: "https://rfftsmdvvlcuesyqizbs.supabase.co",
    anonKey: "sb_publishable_OJHJjHENxITeZVor5C9PiA_-9QMxUaC",
    table: "lunch_state",                 // 테이블 이름 (가족 기록장 family_state 와 분리)
    rowId: "company-lunch",               // 회사 점심 멤버들이 함께 쓰는 행 id
    pollMs: 5000,                         // 실시간 연결이 안 될 때 확인 주기
    realtime: true                        // supabase-js 로 실시간 구독 시도
  },

  /* ---------- 카카오맵 (주변 맛집) ----------
     카카오 디벨로퍼스 > 내 애플리케이션 > 앱 키 > JavaScript 키.
     비워 두면 "내 위치 주변 맛집" 탭에 안내 문구가 나옵니다.
     플랫폼 > Web 에 https://hyejin-lim-111.github.io 도메인을 등록해야 동작해요. */
  kakaoAppKey: "9915cd11a65bb420e5e7668c005945a0",

  /* ---------- 앱 동작 ---------- */
  app: {
    storageKey: "lunch-app.state.v1",
    deviceKey: "lunch-app.nickname.v1",   // 이 기기에서 뽑은 사람 이름 (기기에만 저장)
    placesKey: "lunch-app.places.v1",     // 주변 맛집 검색 결과 (기기에만 저장)
    maxHistory: 40,
    version: 1
  }
};
