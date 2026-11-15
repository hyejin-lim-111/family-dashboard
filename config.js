/* =========================================================
   우리 가족 기록장 — config.js
   여기 값만 바꾸면 됩니다. (앱을 다시 열면 반영)
   ========================================================= */

window.FAMILY_CONFIG = {

  /* ---------- 가족 정보 (앱 안 설정에서도 바꿀 수 있어요) ---------- */
  familyName: "우리 가족",
  defaultMembers: [
    {
      id: "dain",
      name: "다인이",
      role: "6살 · 우리 딸",
      avatar: "assets/avatar_daini.png",
      photo: "",
      color: "#F58FB2"
    },
    {
      id: "mom",
      name: "엄마",
      role: "엄마",
      avatar: "assets/avatar_mom.png",
      photo: "",
      color: "#A98BE8"
    },
    {
      id: "dad",
      name: "아빠",
      role: "아빠",
      avatar: "assets/avatar_dad.png",
      photo: "",
      color: "#5FB9B6"
    }
  ],

  /* ---------- 날씨 / 미세먼지 (Open-Meteo, 인증키 없음) ---------- */
  weather: {
    name: "성남시 분당구",
    lat: 37.3827,
    lon: 127.1189,
    timezone: "Asia/Seoul",
    refreshMinutes: 15,      // 이 시간이 지나면 새로 받아와요
    forecastUrl: "https://api.open-meteo.com/v1/forecast",
    airUrl: "https://air-quality-api.open-meteo.com/v1/air-quality"
  },

  /* ---------- 저장소 ----------
     비워 두면: 이 기기의 localStorage 에만 저장 (지금 바로 쓸 수 있어요)
     Supabase 프로젝트의 URL 과 anon key 를 넣으면:
       3대 기기(엄마 폰 · 아빠 폰 · 다인이 태블릿)가 실시간으로 같은 기록을 봅니다.
     준비물(SQL)은 README.md 참고. */
  supabase: {
    url: "",                                   // 예: "https://abcdefghijk.supabase.co"
    anonKey: "",                               // 예: "eyJhbGciOiJIUzI1NiIsInR5cCI6..."
    table: "family_state",                     // 테이블 이름
    rowId: "main",                             // 한 가족이 쓰는 행 id
    pollMs: 5000,                              // 실시간 연결이 안 될 때 확인 주기
    realtime: true                             // supabase-js 로 실시간 구독 시도
  },

  /* ---------- 앱 동작 ---------- */
  app: {
    storageKey: "family-dashboard.state.v1",
    deviceKey: "family-dashboard.device.v1",
    maxChatMessages: 200,
    maxVoiceSeconds: 20,
    voiceMaxBytes: 900000,                     // 음성 메모 1개 최대 크기(약 0.9MB)
    countdownPresets: [10, 20, 30],
    missionCountPerDay: 1,
    version: 1
  }
};
