# 🏠 우리 가족 기록장

다인이(6살)·엄마·아빠가 함께 쓰는 따뜻한 가족 기록장 웹앱이에요.
설치 없이 **`index.html` 만 열면 바로 동작**합니다.

## 시작하기

1. 이 폴더를 그대로 두거나, 아무 사이트(네이버 마이폴더, GitHub Pages, 개인 호스팅 등)에 올려요.
2. 폰이나 태블릿 브라우저에서 `index.html` 을 열어요.
3. 처음 열면 **이 기기의 주인을 고르는 화면**이 나와요 — 다인이 태블릿은 "다인이", 엄마 폰은 "엄마", 아빠 폰은 "아빠"를 고르면 기억해요.
   - 위쪽 🔓 버튼으로 언제든 다시 고를 수 있어요. (기기 잠금)

> 인터넷이 되어야 날씨·미세먼지를 불러와요 (성남시 분당구 기준). 그 외 기능은 오프라인에서도 동작해요.

## 담긴 기능

| 탭 | 내용 |
|---|---|
| 🏄 홈 | 분당구 실시간 날씨·미세먼지 배지·외출 팁, 오늘 현황(도장·연속 기록·미션), 할 일 스냅샷 |
| 📖 공부 | 오늘의 공부 플랜 (기본: 책 읽기 15분 · 한글·숫자 놀이 · 그림 그리기), + 공부 추가 / 수정 / 삭제, 진행률 바, 10·20·30분·직접 입력 카운트다운 + 스톱워치, 완료 시 도장 적립 |
| 🧚 도감 | 월~일 도장판 + 연속 기록 배지, 도장을 모을 때마다 요정 8종 순서대로 해금 (해금 축하 모달 + 이름·성격·설명), 미션 5·10회 배지 |
| 🌈 미션·할일 | 오늘의 가족 미션(18종 풀), "다 같이 했어요" 완료 + 도장 연동, "다른 미션 뽑기", 다인이·엄마·아빠 각자 할 일 추가/체크/삭제 |
| 💬 채팅 | 가족 말풍선 채팅, 캐릭터 스티커 8종, 하트 반응, 마이크 버튼으로 짧은 음성 메모(최대 20초) 녹음·재생 |

⚙️ 설정에서: 프로필 사진 직접 업로드(기기 안 저장)·이름 수정, 기록 파일 백업/복구, 도장판 새로 시작, 기기 동기화 상태 확인.

## 요정 해금 조건

| 요정 | 조건 |
|---|---|
| ⭐ 별별 요정 | 도장 1개 |
| 🌼 꽃송이 요정 | 도장 3개 |
| 🍓 딸기맛 요정 | 도장 6개 |
| ☁️ 구름솜 요정 | 도장 10개 |
| 🌙 자장가 요정 | 도장 15개 |
| 🌰 도토리 요정 | 도장 21개 |
| 🌊 물방울 요정 | 도장 28개 |
| 🌈 무지개 요정 | 도장 36개 (만렙!) |

도장은 이렇게 모아요: 공부 플랜 전부 완료(+1), 가족 미션 완료(+1), 다인이의 할 일 전부 완료(+1).
3일 연속·7일 연속 기록 배지도 있어요.

## 3대 기기 실시간 동기화 켜기 (Supabase)

지금은 **이 기기의 브라우저 저장소(localStorage)** 에 저장돼요 — 준비물 없이 바로 써요.
세 기기가 같은 기록을 실시간으로 공유하게 하려면 무료 Supabase 계정만 있으면 돼요:

1. https://supabase.com 에서 프로젝트를 만들어요.
2. SQL Editor 에서 아래를 실행해 테이블을 만들어요:

```sql
create table if not exists family_state (
  id text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
insert into family_state (id) values ('main') on conflict do nothing;

alter table family_state enable row level security;

create policy "family read"  on family_state for select using (true);
create policy "family write" on family_state for insert with check (true);
create policy "family update" on family_state for update using (true);
```

3. Project Settings → API 에서 **Project URL** 과 **anon public key** 를 복사해요.
4. `config.js` 를 열어 `supabase: { url: "...", anonKey: "..." }` 에 붙여 넣고 저장해요.
5. 앱을 다시 열면 끝! 설정 화면에 "실시간 동기화"라고 나오면 3대 기기가 같은 도장판·채팅·할 일을 봐요.

> anon key 는 브라우저에서 공개되는 키예요. 가족 외에는 쓸 수 없도록 하려면 Supabase 대시보드에서 도메인 제한(RLS 강화·인증 추가)을 더할 수 있어요. 지정한 테이블 외에는 어떤 데이터도 읽지 않아요.

## 파일 구성

```
family-dashboard/
├── index.html      화면 골격 (하단 탭 5개)
├── styles.css      크림/파스텔 테마, 모바일~태블릿 반응형
├── app.js          모든 기능 (날씨·공부·도장·도감·미션·할 일·채팅)
├── store.js        저장소 어댑터 (localStorage / Supabase 자동 전환)
├── config.js       가족 정보·날씨 위치·Supabase 연결 값
├── favicon.png
├── assets/         요정 캐릭터 그림 11종 (프로필 3 + 도감 8)
└── test/           동작 확인용 스모크 테스트 (jsdom)
```

## 기술 메모

- 폰트: Google Fonts CDN — Jua(제목) · Gowun Dodum(본문) · Noto Sans KR
- 날씨: Open-Meteo Forecast + Air Quality API (분당구 lat=37.3827, lon=127.1189, 인증키 불필요, 15분 캐시)
- 저장: `store.js` 어댑터 — localStorage 모드는 완전 오프라인 동작, Supabase 모드는 REST 업서트 + postgres_changes 실시간 구독(실패 시 폴링 자동 전환)
- 음성 메모: MediaRecorder (브라우저 미지원 시 자동으로 버튼만 비활성 안내)

## 검증 이력

- HTML 태그 균형 · 로컬 에셋 경로 · CSS 중괄호 · JS 문법(esprima) 전수 확인 ✓
- jsdom 부트/인터랙션 스모크 테스트 45항목 전부 통과 ✓ (`test/boot-test.cjs`)
  - 기기 게이트 선택 → 홈·공부(타이머 프리셋·스톱워치·항목 추가) → 공부 완주 시 도장 적립 + 요정 해금 모달 → 가족 미션 완료·랜덤 버튼 → 할 일 추가/체크·도장 연동 → 도감 8카드·도장판 7칸·잠금 상세 → 채팅 전송·하트·스티커 → 설정·기기 잠금/복구 → localStorage 저장 검증
- Open-Meteo 두 엔드포인트(현재 날씨 + 대기질) 분당구 좌표로 실제 호출 확인 ✓ (예: 3.5°C, 구름 조금, pm10 46.9 / pm2.5 44.7)
