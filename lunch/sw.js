/* =========================================================
   점심 뭐 먹지? — sw.js (서비스 워커)
   · GitHub Pages 서브경로(/family-dashboard/lunch/)에서 동작
   · 이 폴더(lunch/)의 파일만 Network-First 로 캐시합니다.
     (고쳐서 올리면 앱을 다시 설치하지 않아도 다음에 열 때 새 버전)
   · Supabase · 카카오맵 · Pretendard CDN 등 외부 주소는
     절대 가로채지 않고 그대로 네트워크로 보냅니다.
   ========================================================= */

var VERSION = "20261126-2";
var CACHE_NAME = "lunch-app-" + VERSION;
var SCOPE = self.registration ? self.registration.scope : "/family-dashboard/lunch/";

var PRECACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./config.js",
  "./store.js",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon.svg",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        PRECACHE.map(function (url) {
          return cache.add(new Request(url, { cache: "reload" })).catch(function () {});
        })
      );
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME && key.indexOf("lunch-app-") === 0) return caches.delete(key);
          return null;
        })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("message", function (event) {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

/* 이 서비스 워커가 다룰 요청인지 — 같은 주소의 /family-dashboard/lunch/ 아래 GET 만 */
function isOwnAsset(request) {
  if (request.method !== "GET") return false;
  var url;
  try { url = new URL(request.url); } catch (e) { return false; }
  if (url.origin !== self.location.origin) return false;      // Supabase·카카오·CDN: 손대지 않음
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  var base = new URL(SCOPE, self.location.href).pathname;     // 예: /family-dashboard/lunch/
  if (url.pathname.indexOf(base) !== 0) return false;
  if (url.pathname.indexOf("/sw.js") >= 0) return false;
  if (request.headers && request.headers.has("range")) return false;
  return true;
}

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (!isOwnAsset(request)) return;

  event.respondWith(
    // GitHub Pages 가 10분간 브라우저 캐시를 허용하므로, 고친 파일이 바로 보이도록
    // 네트워크에서 항상 새로 받는다(작은 앱이라 부담 없음).
    fetch(request, { cache: "no-store" }).then(function (response) {
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
        if (request.mode === "navigate") {
          return caches.match("./index.html").then(function (page) {
            return page || new Response(
              "<!doctype html><meta charset=utf-8><title>점심 뭐 먹지?</title>" +
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
