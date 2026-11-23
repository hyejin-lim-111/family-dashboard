/* =========================================================
   우리 가족 기록장 — sw.js (서비스 워커)
   · GitHub Pages 서브경로(/family-dashboard/)에서 동작
   · HTML/JS/CSS 등 이 사이트 파일은 Network-First → 늘 새 버전을 먼저 받아요.
     (고쳐서 푸시하면 앱을 다시 설치하지 않아도 다음에 열 때 바로 반영)
   · Supabase · Open-Meteo · 공휴일 API 등 다른 주소(다른 origin) 요청은
     손대지 않고 그대로 네트워크로 보냅니다. (캐시·가로채기 없음)
   ========================================================= */

var VERSION = "20261123-1";
var CACHE_NAME = "family-dashboard-" + VERSION;
var SCOPE = self.registration ? self.registration.scope : "/family-dashboard/";

/* 오프라인일 때를 대비해 미리 받아 두는 최소 파일들 */
var PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/icon-maskable-512.png",
  "./assets/apple-touch-icon.png"
];

/* ---------- 설치: 핵심 파일만 미리 캐시 ---------- */
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        PRECACHE.map(function (url) {
          // 하나가 실패해도 설치가 막히지 않게 개별로 담는다
          return cache.add(new Request(url, { cache: "reload" })).catch(function () {});
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

/* ---------- 활성화: 옛 버전 캐시 정리 + 바로 제어 ---------- */
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME && key.indexOf("family-dashboard-") === 0) {
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

/* 앱(app.js)에서 새 버전으로 바꾸고 싶을 때 보내는 신호 */
self.addEventListener("message", function (event) {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* ---------- 이 서비스 워커가 다룰 요청인지 판단 ----------
   · GET 만
   · 같은 주소(origin)의 파일만 — Supabase/날씨/공휴일/CDN 은 여기서 걸러져 그대로 지나감
   · /family-dashboard/ 아래만 */
function isOwnAsset(request) {
  if (request.method !== "GET") return false;
  var url;
  try { url = new URL(request.url); } catch (e) { return false; }
  if (url.origin !== self.location.origin) return false;          // 외부 API·CDN: 절대 캐시하지 않음
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  var path = url.pathname;
  var base = new URL(SCOPE, self.location.href).pathname;         // 예: /family-dashboard/
  if (path.indexOf(base) !== 0) return false;                     // 다른 사이트 영역은 건드리지 않음
  if (request.headers && request.headers.has("range")) return false; // 음성 메모 등 부분 요청
  if (url.pathname.indexOf("/sw.js") >= 0) return false;          // 서비스 워커 자체는 캐시 제외
  return true;
}

/* Network-First: 네트워크가 되면 새 파일을 받아 캐시에 갱신, 실패하면 캐시로 */
self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (!isOwnAsset(request)) return;   // respondWith 하지 않음 = 브라우저 기본 동작 그대로

  event.respondWith(
    fetch(request).then(function (response) {
      if (response && response.ok && response.type === "basic") {
        var copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy).catch(function () {});
        });
      }
      return response;
    }).catch(function () {
      return caches.match(request, { ignoreSearch: true }).then(function (hit) {
        if (hit) return hit;
        // 페이지 이동이면 앱 첫 화면으로 (오프라인에서도 열리게)
        if (request.mode === "navigate") {
          return caches.match("./index.html").then(function (page) {
            return page || new Response(
              "<!doctype html><meta charset=utf-8><title>우리 가족 기록장</title>" +
              "<p style='font-family:sans-serif;padding:24px'>지금은 인터넷이 연결되지 않아요. 연결되면 다시 열어 주세요.</p>",
              { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
            );
          });
        }
        return new Response("", { status: 504, statusText: "offline" });
      });
    })
  );
});
