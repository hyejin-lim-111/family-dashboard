/* =========================================================
   우리 가족 기록장 — lock.js (입장 비밀번호 잠금)
   · 비밀번호는 평문으로 저장하지 않고 SHA-256 해시로만 비교해요.
   · 처음 배포용 임시 비밀번호의 해시만 기본값으로 들어 있어요.
   · 한 번 맞힌 기기는 이 기기(localStorage)에 인증을 기억해
     다음에 열 때 다시 넣지 않아도 돼요.
   · app.js 가 이 도구들을 씁니다. (window.FamilyLock)
   ========================================================= */

(function (global) {
  "use strict";

  var AUTH_KEY = "family-dashboard.lock.v1";     // 이 기기 인증 기록 { hash, at }

  /* ---------- SHA-256 (순수 JS) ----------
     · https 가 아닌 곳(파일로 열기 등)에서도 crypto.subtle 없이 같은 결과가 나오게 직접 계산해요.
     · UTF-8 로 바꿔 계산하므로 한글 비밀번호도 됩니다. */
  var K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  function utf8Bytes(str) {
    var out = [];
    var s = String(str == null ? "" : str);
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code < 0x80) {
        out.push(code);
      } else if (code < 0x800) {
        out.push(0xc0 | (code >> 6), 0x80 | (code & 63));
      } else if (code >= 0xd800 && code <= 0xdbff && i + 1 < s.length) {
        var next = s.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          var cp = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
          out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
          i++;
        } else {
          out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
        }
      } else {
        out.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 63), 0x80 | (code & 63));
      }
    }
    return out;
  }

  function rotr(x, n) {
    return (x >>> n) | (x << (32 - n));
  }

  function sha256Hex(text) {
    var bytes = utf8Bytes(text);
    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor(bitLen / 4294967296);
    bytes.push((hi >>> 24) & 255, (hi >>> 16) & 255, (hi >>> 8) & 255, hi & 255);
    bytes.push((bitLen >>> 24) & 255, (bitLen >>> 16) & 255, (bitLen >>> 8) & 255, bitLen & 255);

    var H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];
    var w = new Array(64);
    var a, b, c, d, e, f, g, h, i, off, s0, s1, S0, S1, ch, maj, t1, t2;

    for (off = 0; off < bytes.length; off += 64) {
      for (i = 0; i < 16; i++) {
        w[i] = ((bytes[off + i * 4] << 24) | (bytes[off + i * 4 + 1] << 16) |
          (bytes[off + i * 4 + 2] << 8) | bytes[off + i * 4 + 3]) | 0;
      }
      for (i = 16; i < 64; i++) {
        s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
      }
      a = H[0]; b = H[1]; c = H[2]; d = H[3];
      e = H[4]; f = H[5]; g = H[6]; h = H[7];
      for (i = 0; i < 64; i++) {
        S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        ch = (e & f) ^ ((~e) & g);
        t1 = (h + S1 + ch + K[i] + w[i]) | 0;
        S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        maj = (a & b) ^ (a & c) ^ (b & c);
        t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0;
        d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0;
      H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
      H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0;
      H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
    }

    return H.map(function (x) {
      return ("00000000" + (x >>> 0).toString(16)).slice(-8);
    }).join("");
  }

  /* ---------- 기본(임시) 비밀번호 ----------
     배포 직후 외부인이 바로 열지 못하도록 6자리 임시 비밀번호의 해시만 넣어 둡니다.
     (평문은 코드에 넣지 않아요. 바뀐 비밀번호는 state.security.lockHash 에 저장돼요.) */
  var TEMP_PASSWORD_HASH = "0f8a8e5d59b092712c1422f5cc8b064079008483ebd3beeaae33d1fe0493aa65";

  /* ---------- 현재 비밀번호 해시 ---------- */
  function hashFromState(state) {
    var sec = state && state.security;
    var h = sec && typeof sec.lockHash === "string" ? sec.lockHash.toLowerCase() : "";
    if (/^[0-9a-f]{64}$/.test(h)) return h;
    return TEMP_PASSWORD_HASH;
  }

  /* ---------- 이 기기 인증 기록 ---------- */
  function readAuth() {
    try {
      var raw = global.localStorage ? global.localStorage.getItem(AUTH_KEY) : null;
      if (!raw) return null;
      var rec = JSON.parse(raw);
      if (!rec || typeof rec.hash !== "string") return null;
      return rec;
    } catch (e) {
      return null;
    }
  }

  function writeAuth(hash) {
    try {
      global.localStorage.setItem(AUTH_KEY, JSON.stringify({
        hash: String(hash || ""),
        at: new Date().toISOString()
      }));
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearAuth() {
    try { global.localStorage.removeItem(AUTH_KEY); } catch (e) { /* 무시 */ }
  }

  /* 이 기기가 지금 비밀번호로 인증돼 있는지 — 비밀번호를 바꾸면 다시 넣어야 해요 */
  function isUnlocked(currentHash) {
    var rec = readAuth();
    if (!rec) return false;
    return String(rec.hash || "") === String(currentHash || "");
  }

  /* 입력한 비밀번호가 맞는지 — 앞뒤 공백은 무시해요 */
  function verify(text, hash) {
    var want = String(hash || "");
    if (!want) return false;
    return sha256Hex(String(text == null ? "" : text).trim()) === want;
  }

  global.FamilyLock = {
    AUTH_KEY: AUTH_KEY,
    TEMP_PASSWORD_HASH: TEMP_PASSWORD_HASH,
    DEFAULT_HASH: TEMP_PASSWORD_HASH,      // 지금 state 에 저장된 해시가 없을 때 쓰는 기본값
    sha256: sha256Hex,
    hashFromState: hashFromState,
    readAuth: readAuth,
    writeAuth: writeAuth,
    clearAuth: clearAuth,
    isUnlocked: isUnlocked,
    verify: verify
  };
})(typeof window !== "undefined" ? window : this);
