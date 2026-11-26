# 🍱 점심 뭐 먹지?

회사 점심 멤버들이 **함께 쓰는** 메뉴추첨 · 주변 맛집 추첨 웹앱이에요.
가족 기록장(`family-dashboard/`)과 같은 저장소에 있지만 **폴더와 데이터가 완전히 분리**돼 있습니다
(가족 기록장 파일과 `family_state` 테이블은 건드리지 않아요).

- 주소: `https://hyejin-lim-111.github.io/family-dashboard/lunch/`
- 폰에서는 **⋮ → 홈 화면에 추가**(아이폰은 공유 → 홈 화면에 추가)로 앱처럼 설치해 쓸 수 있어요.

## 담긴 기능

| 탭 | 내용 |
|---|---|
| 🍽️ 메뉴 뽑기 | **오늘 뽑기** — 슬롯 애니메이션으로 메뉴를 뽑고 결과 카드에 보여 줘요. 분류 필터(전체/한식/중식/일식/양식/분식/아시안), **오늘 빼기** 체크, **공유 메뉴판**(기본 메뉴 51종 + 직접 추가, 숨기기·삭제·기본 메뉴 복원), **최근 뽑기 기록**(누가 뽑았는지 닉네임과 함께 모두에게 공유) |
| 📍 주변 맛집 | `navigator.geolocation` 으로 현재 위치를 잡고 카카오맵으로 주변 음식점(FD6)·카페(CE7)를 검색. 반경 300m/500m/1km/2km, 분류 필터(전체/한식/중식/일식/양식/카페·디저트), **갈 만한 곳/빼기** 토글, **주변 맛집 랜덤 추첨**, 거리·도로명주소·전화·카카오맵 링크·작은 지도 미리보기. 위치를 못 잡으면 동네·주소 검색으로 대신 찾아요 |

## 설정

### 1) Supabase 공유 테이블 (`lunch_state`)

`config.js` 의 `supabase` 는 가족 기록장과 같은 프로젝트(`rfftsmdvvlcuesyqizbs`)를 쓰고,
테이블만 `lunch_state`, 행 id 는 `company-lunch` 입니다. Supabase SQL Editor 에서 아래를 한 번 실행하세요.

```sql
create table if not exists public.lunch_state (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.lunch_state enable row level security;

create policy "lunch read"   on public.lunch_state for select using (true);
create policy "lunch insert" on public.lunch_state for insert with check (true);
create policy "lunch update" on public.lunch_state for update using (true);

alter publication supabase_realtime add table public.lunch_state;
```

### 2) 카카오맵 JavaScript 키

`config.js` 의 `kakaoAppKey` 에 **JavaScript 키**를 넣어 주세요(지금 채워져 있어요).
카카오 디벨로퍼스 → 내 애플리케이션 → **플랫폼 → Web** 에 `https://hyejin-lim-111.github.io` 를 등록해야 지도가 열립니다.
키가 비어 있으면 「주변 맛집」 탭에 안내 문구가 나오고, 메뉴 뽑기는 그대로 동작해요.

## 동기화 방식 (덮어쓰지 않는 공유)

- 저장은 **Read → Merge → Write**: 저장 직전에 서버의 최신 상태를 먼저 받아, 이 기기가 바꾼 것만 얹어 다시 올립니다.
- 메뉴·기록은 **항목(id) 단위 3-way 병합**이라, 두 사람이 동시에 메뉴를 추가하거나 서로 다른 메뉴를 숨겨도 서로 덮어쓰지 않아요.
- 지운 메뉴·기록은 **tombstone(`state.deleted`)** 으로 남겨, 오래 열어 둔 기기가 저장해도 다시 살아나지 않습니다.
- **Supabase Realtime** 으로 바로 반영하고, 실시간이 막힌 환경에서는 **5초 폴링**으로 따라잡습니다.
- 주변 맛집 검색 결과와 '뽑는 사람' 닉네임은 그 기기에만 저장돼요(위치·개인 설정이라 공유하지 않음).

## 개발 메모

```
node lunch/test/run-all.cjs      # 정적 점검 + 병합 + 앱 동작 + 동기화 + 맛집 탭 테스트
```

- `sw.js` 는 `/family-dashboard/lunch/` 안의 파일만 Network-First 로 캐시하고,
  Supabase · 카카오맵 · Pretendard CDN 같은 외부 주소는 절대 가로채지 않습니다.
- 가족 기록장 루트 파일(`index.html`, `app.js`, `store.js`, `config.js`, `styles.css`, `sw.js`, `manifest.webmanifest`)은
  이 앱과 무관하며 수정하지 않았습니다.
