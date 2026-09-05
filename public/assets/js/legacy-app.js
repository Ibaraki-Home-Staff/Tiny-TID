(() => {
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => {
    for (var prop in b || (b = {}))
      if (__hasOwnProp.call(b, prop))
        __defNormalProp(a, prop, b[prop]);
    if (__getOwnPropSymbols)
      for (var prop of __getOwnPropSymbols(b)) {
        if (__propIsEnum.call(b, prop))
          __defNormalProp(a, prop, b[prop]);
      }
    return a;
  };
  var __spreadProps = (a, b) => __defProps(a, __getOwnPropDescs(b));
  var __async = (__this, __arguments, generator) => {
    return new Promise((resolve, reject) => {
      var fulfilled = (value) => {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      };
      var rejected = (value) => {
        try {
          step(generator.throw(value));
        } catch (e) {
          reject(e);
        }
      };
      var step = (x) => x.done ? resolve(x.value) : Promise.resolve(x.value).then(fulfilled, rejected);
      step((generator = generator.apply(__this, __arguments)).next());
    });
  };

  // public/assets/js/pwa.js
  var isLocalhost = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var isSecure = () => location.protocol === "https:" || isLocalhost();
  function registerServiceWorker() {
    return __async(this, null, function* () {
      try {
        if (!("serviceWorker" in navigator)) return null;
        if (!isSecure()) return null;
        const vMeta = document.querySelector('meta[name="app:version"]');
        const v = vMeta && vMeta.getAttribute("content");
        const swUrl = v ? `/service-worker.js?v=${encodeURIComponent(v)}` : "/service-worker.js";
        const reg = yield navigator.serviceWorker.register(swUrl);
        return reg;
      } catch (err) {
        console.warn("[PWA] SW register failed", err);
        return null;
      }
    });
  }
  function urlB64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
  function subscribePush(_0) {
    return __async(this, arguments, function* (reg, info = {}) {
      try {
        if (!reg || !("pushManager" in reg)) return null;
        const metaKey = document.querySelector('meta[name="push:publicKey"]');
        const metaEndpoint = document.querySelector('meta[name="push:subscribeUrl"]');
        const pubKey = metaKey && metaKey.getAttribute("content");
        const subscribeUrl = metaEndpoint && metaEndpoint.getAttribute("content");
        if (!pubKey || !subscribeUrl) return null;
        let sub = yield reg.pushManager.getSubscription();
        if (!sub) {
          sub = yield reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(pubKey) });
        }
        yield fetch(subscribeUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            subscription: sub.toJSON ? sub.toJSON() : sub,
            station: info.stationCode || "",
            prefs_json: info.prefsJson || "{}"
          })
        });
        return sub;
      } catch (err) {
        console.warn("[PWA] push subscribe failed", err);
        return null;
      }
    });
  }
  (function init() {
    return __async(this, null, function* () {
      yield registerServiceWorker();
    });
  })();

  // public/assets/js/tid-settings.js
  var SETTINGS_ROOT_KEY = "tid:v1:settings";
  var MIGRATION_DONE_KEY = "tid:v1:migrationDone";
  function isMigrationDone() {
    try {
      return localStorage.getItem(MIGRATION_DONE_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  function markMigrationDone() {
    try {
      localStorage.setItem(MIGRATION_DONE_KEY, "1");
    } catch (e) {
    }
  }
  function loadSettingsRoot() {
    try {
      const raw = localStorage.getItem(SETTINGS_ROOT_KEY);
      if (!raw) return {};
      const obj = JSON.parse(raw);
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }
  function saveSettingsRoot(obj) {
    try {
      localStorage.setItem(SETTINGS_ROOT_KEY, JSON.stringify(obj || {}));
    } catch (e) {
    }
  }
  function getPath(obj, path) {
    try {
      const segs = String(path || "").split(".");
      let cur = obj;
      for (const seg of segs) {
        if (!cur || typeof cur !== "object") return void 0;
        cur = cur[seg];
      }
      return cur;
    } catch (e) {
      return void 0;
    }
  }
  function setPath(obj, path, value) {
    try {
      const segs = String(path || "").split(".");
      let cur = obj;
      for (let i = 0; i < segs.length - 1; i += 1) {
        const seg = segs[i];
        if (!cur[seg] || typeof cur[seg] !== "object") cur[seg] = {};
        cur = cur[seg];
      }
      cur[segs[segs.length - 1]] = value;
    } catch (e) {
    }
  }
  function ensureLineConfig(root, lineId) {
    if (!root.lines) root.lines = {};
    if (!root.lines[lineId]) root.lines[lineId] = {};
  }
  function getSetting(path, fallback) {
    const root = loadSettingsRoot();
    const value = getPath(root, path);
    return value === void 0 ? fallback : value;
  }
  function setSetting(path, value) {
    const root = loadSettingsRoot();
    setPath(root, path, value);
    saveSettingsRoot(root);
  }
  function getLineConfig(lineId) {
    const root = loadSettingsRoot();
    return root.lines && root.lines[lineId] || {};
  }
  function migrateLegacySettings() {
    try {
      if (isMigrationDone()) return;
      const root = loadSettingsRoot();
      const open = localStorage.getItem("tid:settings:open");
      if (open != null) {
        setPath(root, "ui.settingsOpen", open);
        try {
          localStorage.removeItem("tid:settings:open");
        } catch (e) {
        }
      }
      try {
        localStorage.removeItem("tid:audio:unlocked");
      } catch (e) {
      }
      try {
        localStorage.removeItem("tid:tts:voice");
      } catch (e) {
      }
      const delayThreshold = localStorage.getItem("tid:delay:threshold");
      if (delayThreshold != null) {
        setPath(root, "delay.threshold", Number(delayThreshold));
        try {
          localStorage.removeItem("tid:delay:threshold");
        } catch (e) {
        }
      }
      const bgNotify = localStorage.getItem("tid:bgnotify");
      if (bgNotify != null) {
        setPath(root, "bg.notify", bgNotify);
      }
      const wakeLock = localStorage.getItem("tid:wakelock");
      if (wakeLock != null) {
        setPath(root, "bg.wakelock", wakeLock);
        try {
          localStorage.removeItem("tid:wakelock");
        } catch (e) {
        }
      }
      try {
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (!key) continue;
          const stationMatch = key.match(/^tid:station:(.+)$/);
          if (stationMatch) {
            const lineId = stationMatch[1];
            const value = localStorage.getItem(key) || "";
            if (value) {
              ensureLineConfig(root, lineId);
              setPath(root, `lines.${lineId}.station`, value);
            }
            continue;
          }
          const passMatch = key.match(/^tid:pass:(.+)$/);
          if (passMatch) {
            const lineId = passMatch[1];
            const value = localStorage.getItem(key) || "";
            if (value) {
              ensureLineConfig(root, lineId);
              setPath(root, `lines.${lineId}.pass`, value);
            }
          }
        }
      } catch (e) {
      }
      try {
        for (let i = 0; i < localStorage.length; i += 1) {
          const key = localStorage.key(i);
          if (!key) continue;
          let match = key.match(/^tid:alarm:disable:([^:]+):([^:]+):(up|down)$/);
          if (match) {
            const [, lineId, stationCode, dir] = match;
            setPath(root, `lines.${lineId}.alarms.${stationCode}.${dir}.disabled`, localStorage.getItem(key) === "1");
            continue;
          }
          match = key.match(/^tid:alarm:([^:]+):([^:]+):(up|down)$/);
          if (match) {
            const [, lineId, stationCode, dir] = match;
            try {
              const prefs = JSON.parse(localStorage.getItem(key) || "[]");
              if (Array.isArray(prefs)) {
                setPath(root, `lines.${lineId}.alarms.${stationCode}.${dir}.prefs`, prefs);
              }
            } catch (e) {
            }
            continue;
          }
          match = key.match(/^tid:alarm:target:([^:]+):([^:]+):(up|down)$/);
          if (match) {
            const [, lineId, stationCode, dir] = match;
            try {
              const targets = JSON.parse(localStorage.getItem(key) || "{}");
              if (targets && typeof targets === "object") {
                setPath(root, `lines.${lineId}.alarms.${stationCode}.${dir}.targets`, targets);
              }
            } catch (e) {
            }
          }
        }
      } catch (e) {
      }
      saveSettingsRoot(root);
      markMigrationDone();
    } catch (e) {
    }
  }

  // public/assets/js/app-alarm.js
  var SUPPRESS_MS = 3 * 60 * 1e3;
  var STORE_KEY = "tid:v1:alarm:approachSuppression";
  var lineScope = "";
  var area = "kinki";
  var line = "kyoto";
  var audioEl = null;
  var audioUnlocked = false;
  var pendingQueue = [];
  function initAlarm({ scope, areaId, lineId }) {
    lineScope = scope;
    area = areaId;
    line = lineId;
  }
  function requestUnlock(onReady) {
    const overlay = document.getElementById("audioUnlockOverlay");
    const btn = document.getElementById("audioUnlockBtn");
    const later = document.getElementById("audioUnlockLater");
    const close = document.getElementById("audioUnlockClose");
    if (!overlay || overlay.dataset.bound === "1") return;
    overlay.dataset.bound = "1";
    const show = () => {
      overlay.classList.remove("is-hidden");
      overlay.removeAttribute("aria-hidden");
    };
    const hide2 = () => {
      overlay.classList.add("is-hidden");
      overlay.setAttribute("aria-hidden", "true");
    };
    window.__tidShowAudioOverlay = show;
    btn == null ? void 0 : btn.addEventListener("click", () => __async(null, null, function* () {
      try {
        yield prime();
        audioUnlocked = true;
      } catch (e) {
      }
      hide2();
      onReady && onReady();
      flush();
    }));
    later == null ? void 0 : later.addEventListener("click", hide2);
    close == null ? void 0 : close.addEventListener("click", hide2);
    show();
  }
  function prime() {
    return __async(this, null, function* () {
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.src = "/assets/sound/alarm.mp3";
        audioEl.preload = "auto";
        audioEl.setAttribute("playsinline", "");
        audioEl.style.display = "none";
        document.body.appendChild(audioEl);
      }
      try {
        yield audioEl.play();
        audioEl.pause();
        audioEl.currentTime = 0;
      } catch (e) {
      }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          yield ctx.resume();
          const osc = ctx.createOscillator(), g = ctx.createGain();
          g.gain.value = 1e-4;
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.01);
          setTimeout(() => {
            var _a;
            return (_a = ctx.close) == null ? void 0 : _a.call(ctx);
          }, 300);
        }
      } catch (e) {
      }
    });
  }
  function approachKey(no, st, dir) {
    return `approach:${area}:${line}:${st || "_none"}:${dir}:${no || "?"}`;
  }
  function loadStore() {
    try {
      const obj = JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
      const now = Date.now();
      let changed = false;
      for (const k of Object.keys(obj)) {
        const ts = Number(obj[k]);
        if (!Number.isFinite(ts) || now - ts >= SUPPRESS_MS) {
          delete obj[k];
          changed = true;
        }
      }
      if (changed) localStorage.setItem(STORE_KEY, JSON.stringify(obj));
      return obj;
    } catch (e) {
      return {};
    }
  }
  function recentlyAnnounced(no, st, dir) {
    const k = approachKey(no, st, dir);
    const ts = Number(loadStore()[k]);
    return Number.isFinite(ts) && Date.now() - ts < SUPPRESS_MS;
  }
  function markAnnounced(no, st, dir) {
    const obj = loadStore();
    obj[approachKey(no, st, dir)] = Date.now();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(obj));
    } catch (e) {
    }
  }
  function playAlarm() {
    return __async(this, null, function* () {
      if (!audioEl) yield prime();
      try {
        audioEl.currentTime = 0;
        yield audioEl.play();
        return;
      } catch (e) {
      }
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        const ctx = new Ctx();
        yield ctx.resume();
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.frequency.value = 880;
        g.gain.value = 0.2;
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start();
        setTimeout(() => {
          var _a;
          osc.stop();
          (_a = ctx.close) == null ? void 0 : _a.call(ctx);
        }, 280);
      } catch (e) {
      }
    });
  }
  function showAlarmModal(meta2) {
    var _a;
    let wrap = document.querySelector(".tid-alert-overlay");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "tid-alert-overlay is-hidden";
      wrap.setAttribute("role", "dialog");
      wrap.setAttribute("aria-modal", "true");
      wrap.innerHTML = `<div class="tid-alert__panel" role="document">
      <h2 id="tidAlertTitle" class="tid-alert__title">\u5217\u8ECA\u63A5\u8FD1</h2>
      <div class="tid-alert__groups">
        <div class="tid-alert__row"><div class="tid-alert__label">\u5217\u756A</div><div class="tid-alert__value" data-alert-no>-</div></div>
        <div class="tid-alert__row"><div class="tid-alert__label">\u884C\u5148</div><div class="tid-alert__value" data-alert-dest>-</div></div>
        <div class="tid-alert__row"><div class="tid-alert__label">\u7A2E\u5225</div><div class="tid-alert__value" data-alert-type>-</div></div>
        <div class="tid-alert__row"><div class="tid-alert__label">\u611B\u79F0</div><div class="tid-alert__value" data-alert-nick>-</div></div>
        <div class="tid-alert__row"><div class="tid-alert__label">\u9045\u308C</div><div class="tid-alert__value" data-alert-delay>-</div></div>
      </div>
      <div class="tid-alert__actions"><button type="button" class="btn" data-alert-ok>\u78BA\u8A8D</button></div></div>`;
      document.body.appendChild(wrap);
      (_a = wrap.querySelector("[data-alert-ok]")) == null ? void 0 : _a.addEventListener("click", () => hide());
    }
    const titleEl = wrap.querySelector("#tidAlertTitle");
    if (titleEl) titleEl.textContent = meta2.direction === 0 ? "\u4E0A\u308A\u5217\u8ECA\u63A5\u8FD1" : meta2.direction === 1 ? "\u4E0B\u308A\u5217\u8ECA\u63A5\u8FD1" : "\u5217\u8ECA\u63A5\u8FD1";
    const set = (sel, text) => {
      const el = wrap.querySelector(sel);
      if (el) el.textContent = text || "-";
    };
    set("[data-alert-no]", meta2.no);
    set("[data-alert-dest]", meta2.destText);
    set("[data-alert-type]", meta2.displayType);
    set("[data-alert-nick]", meta2.nickname);
    set("[data-alert-delay]", meta2.delayMinutes > 0 ? `${meta2.delayMinutes}\u5206` : "\u306A\u3057");
    wrap.classList.remove("is-hidden");
    clearTimeout(showAlarmModal._t);
    showAlarmModal._t = setTimeout(hide, 1e4);
  }
  function hide() {
    var _a;
    (_a = document.querySelector(".tid-alert-overlay")) == null ? void 0 : _a.classList.add("is-hidden");
  }
  function evaluateAndNotify({ stations, trains, stationCode }) {
    var _a, _b, _c;
    const order = stations.map((s) => s.code);
    const orderSet = new Set(order);
    const idxOf = new Map(stations.map((s) => [s.code, s.index]));
    const pos = order.indexOf(stationCode);
    for (const t of trains) {
      let stopFired = false;
      const dirKey = t.direction === 0 ? "up" : "down";
      const cfg = getLineConfigSafe();
      const stCfg = ((_b = (_a = cfg == null ? void 0 : cfg.alarms) == null ? void 0 : _a[stationCode]) == null ? void 0 : _b[dirKey]) || {};
      if (stCfg.disabled) continue;
      const prefs = new Set(Array.isArray(stCfg.prefs) ? stCfg.prefs : []);
      if (getSetting("cars.filterEnabled", false)) {
        const cars = Number(t.cars);
        const min = Number(getSetting("cars.threshold", 9));
        if (!Number.isFinite(cars) || cars < min) continue;
      }
      const ahead = [];
      if (pos >= 0) {
        const step = t.direction === 0 ? 1 : -1;
        for (let k = 1; k <= 3; k += 1) {
          const i = pos + step * k;
          if (i >= 0 && i < order.length) ahead.push(order[i]);
        }
      }
      const savedTarget = readTarget(dirKey, stationCode, t.category);
      const target = savedTarget && orderSet.has(savedTarget) ? savedTarget : ahead[0];
      if (!target) continue;
      const selIdx = idxOf.get(stationCode);
      const tgtIdx = idxOf.get(target);
      const stoppedAt = t.stopped && t.atUnit === target;
      const movingOn = !t.stopped && (t.direction === 0 ? t.nextUnit === target : t.atUnit === target);
      const boundary = stoppedAt || movingOn;
      let range = false;
      if (selIdx != null && tgtIdx != null) {
        if (!(t.direction === 0 && tgtIdx < selIdx || t.direction === 1 && tgtIdx > selIdx)) {
          const lo = Math.min(selIdx, tgtIdx), hi = Math.max(selIdx, tgtIdx);
          range = lo === hi ? t.posIndex === lo : t.direction === 0 ? t.posIndex >= selIdx && t.posIndex <= hi : t.direction === 1 ? t.posIndex <= selIdx && t.posIndex >= lo : true;
        }
      }
      if ((boundary || range) && prefs.has(`cat:${t.category}`)) {
        fire(t, target, stationCode, dirKey, range ? "range" : "segment");
        stopFired = true;
        continue;
      }
      if (!stopFired && prefs.has("pass")) {
        const savedPass = ((_c = stCfg.targets) == null ? void 0 : _c.pass) ? String(stCfg.targets.pass) : "";
        const passTarget = savedPass && orderSet.has(savedPass) ? savedPass : ahead[0];
        if (passTarget && (stoppedAt || movingOn) && t.willStopHere === false) {
          fire(t, passTarget, stationCode, dirKey, "pass");
        }
      }
    }
  }
  function fire(t, target, stationCode, dirKey, reason) {
    var _a;
    const no = t.no || "?";
    if (recentlyAnnounced(no, stationCode, t.direction)) return;
    markAnnounced(no, stationCode, t.direction);
    if (!audioUnlocked) {
      (_a = window.__tidShowAudioOverlay) == null ? void 0 : _a.call(window);
      pendingQueue.push(t);
      return;
    }
    void playAlarm();
    showAlarmModal(__spreadProps(__spreadValues({}, t), { reason }));
    try {
      if (getSetting("bg.notify", null) === "1" && document.hidden && "Notification" in window && Notification.permission === "granted") {
        new Notification("\u5217\u8ECA\u63A5\u8FD1", { body: `${no}\u3001${t.destText || ""}\u63A5\u8FD1`, tag: approachKey(no, stationCode, t.direction), renotify: true, icon: "/assets/img/placeholder.svg" });
      }
    } catch (e) {
    }
  }
  function flush() {
    return __async(this, null, function* () {
      const q = pendingQueue.splice(0);
      for (const t of q) {
        yield playAlarm();
        showAlarmModal(t);
      }
    });
  }
  function getLineConfigSafe() {
    try {
      return getLineConfigRef ? getLineConfigRef(lineScope) : void 0;
    } catch (e) {
      return void 0;
    }
  }
  function readTarget(dirKey, st, cat) {
    var _a, _b, _c;
    const cfg = getLineConfigSafe();
    const obj = (_c = (_b = (_a = cfg == null ? void 0 : cfg.alarms) == null ? void 0 : _a[st]) == null ? void 0 : _b[dirKey]) == null ? void 0 : _c.targets;
    const v = obj && obj[`cat:${cat}`];
    return v ? String(v) : null;
  }
  var getLineConfigRef = null;
  function bindLineConfig(fn) {
    getLineConfigRef = fn;
  }
  var CAT_LABELS = { 0: "\u666E\u901A", 1: "\u65B0\u5FEB\u901F", 2: "\u5FEB\u901F", 3: "\u533A\u9593\u5FEB\u901F", 4: "\u76F4\u901A\u5FEB\u901F", 5: "\u7279\u6025", 6: "\u6025\u884C", 7: "\u5BDD\u53F0", 8: "SL", 9: "\u89B3\u5149\u5217\u8ECA", 10: "\u745E\u98A8" };
  var controlsBound = false;
  function readDisable(dir, stCode) {
    var _a, _b, _c;
    try {
      const cfg = getLineConfigSafe();
      const v = (_c = (_b = (_a = cfg == null ? void 0 : cfg.alarms) == null ? void 0 : _a[stCode]) == null ? void 0 : _b[dir]) == null ? void 0 : _c.disabled;
      return v === void 0 ? false : !!v;
    } catch (e) {
      return false;
    }
  }
  function saveDisable(dir, stCode, v) {
    try {
      setSetting(`lines.${lineScope}.alarms.${stCode}.${dir}.disabled`, !!v);
    } catch (e) {
    }
  }
  function readPrefs(dir, stCode) {
    var _a, _b, _c;
    try {
      const cfg = getLineConfigSafe();
      const arr = (_c = (_b = (_a = cfg == null ? void 0 : cfg.alarms) == null ? void 0 : _a[stCode]) == null ? void 0 : _b[dir]) == null ? void 0 : _c.prefs;
      return new Set(Array.isArray(arr) ? arr : []);
    } catch (e) {
      return /* @__PURE__ */ new Set();
    }
  }
  function savePrefs(dir, stCode, values) {
    try {
      setSetting(`lines.${lineScope}.alarms.${stCode}.${dir}.prefs`, Array.from(values || []));
    } catch (e) {
    }
  }
  function readTargets(dir, stCode) {
    var _a, _b, _c;
    try {
      const cfg = getLineConfigSafe();
      const obj = (_c = (_b = (_a = cfg == null ? void 0 : cfg.alarms) == null ? void 0 : _a[stCode]) == null ? void 0 : _b[dir]) == null ? void 0 : _c.targets;
      return obj && typeof obj === "object" ? obj : {};
    } catch (e) {
      return {};
    }
  }
  function saveTarget(dir, stCode, catKey, code) {
    try {
      const obj = readTargets(dir, stCode);
      obj[catKey] = String(code || "");
      setSetting(`lines.${lineScope}.alarms.${stCode}.${dir}.targets`, obj);
    } catch (e) {
    }
  }
  function setDisabledForDir(dir, disabled) {
    const sel = dir === "up" ? "[data-alarm-up]" : "[data-alarm-down]";
    document.querySelectorAll(sel).forEach((b) => {
      b.disabled = !!disabled;
      const p = b.parentElement;
      if (p && p.style) p.style.opacity = disabled ? "0.5" : "";
    });
    const fs = document.getElementById(dir === "up" ? "alarmUpBox" : "alarmDownBox");
    if (fs) fs.querySelectorAll("select").forEach((s2) => {
      s2.disabled = !!disabled || s2.options.length === 0 || s2.value === "";
    });
  }
  function bindAlarmControls(stationCode) {
    var _a, _b;
    const upDis = document.getElementById("alarmUpDisable");
    const dnDis = document.getElementById("alarmDownDisable");
    if (upDis) {
      upDis.checked = readDisable("up", stationCode);
      setDisabledForDir("up", upDis.checked);
      upDis.onchange = () => {
        saveDisable("up", stationCode, upDis.checked);
        setDisabledForDir("up", upDis.checked);
      };
    }
    if (dnDis) {
      dnDis.checked = readDisable("down", stationCode);
      setDisabledForDir("down", dnDis.checked);
      dnDis.onchange = () => {
        saveDisable("down", stationCode, dnDis.checked);
        setDisabledForDir("down", dnDis.checked);
      };
    }
    if (!controlsBound) {
      (_a = document.getElementById("alarmUpBox")) == null ? void 0 : _a.addEventListener("change", () => {
        const vals = new Set(Array.from(document.querySelectorAll("[data-alarm-up]")).filter((b) => b.checked).map((b) => b.value));
        savePrefs("up", stationCode, vals);
      });
      (_b = document.getElementById("alarmDownBox")) == null ? void 0 : _b.addEventListener("change", () => {
        const vals = new Set(Array.from(document.querySelectorAll("[data-alarm-down]")).filter((b) => b.checked).map((b) => b.value));
        savePrefs("down", stationCode, vals);
      });
      controlsBound = true;
    }
  }
  function renderAlarmOptions({ stations, stationCode, allowedCats, dirParam }) {
    const upBox = document.getElementById("alarmUpOptions");
    const dnBox = document.getElementById("alarmDownOptions");
    const row = document.getElementById("alarmRow");
    const upFs = document.getElementById("alarmUpBox");
    const dnFs = document.getElementById("alarmDownBox");
    if (!upBox || !dnBox || !row) return;
    if (!stationCode) {
      row.style.display = "none";
      upBox.innerHTML = "";
      dnBox.innerHTML = "";
      return;
    }
    row.style.display = "flex";
    if (dirParam === "up") {
      if (upFs) upFs.style.display = "";
      if (dnFs) dnFs.style.display = "none";
    } else if (dirParam === "down") {
      if (upFs) upFs.style.display = "none";
      if (dnFs) dnFs.style.display = "";
    } else {
      if (upFs) upFs.style.display = "";
      if (dnFs) dnFs.style.display = "";
    }
    bindAlarmControls(stationCode);
    const upDisable = document.getElementById("alarmUpDisable");
    const dnDisable = document.getElementById("alarmDownDisable");
    if (upDisable) upDisable.checked = readDisable("up", stationCode);
    if (dnDisable) dnDisable.checked = readDisable("down", stationCode);
    const cats = (Array.isArray(allowedCats) ? allowedCats : Object.keys(CAT_LABELS).map(Number)).slice().sort((x, y) => x - y);
    const order = stations.map((s) => s.code);
    const pos = order.indexOf(stationCode);
    const ahead = (dir) => {
      const out = [];
      if (pos < 0) return out;
      const step = dir === "up" ? 1 : -1;
      for (let k = 1; k <= 3; k += 1) {
        const i = pos + step * k;
        if (i >= 0 && i < order.length) out.push(order[i]);
      }
      return out;
    };
    const nameOf = (code) => {
      var _a;
      return ((_a = stations.find((s) => s.code === code)) == null ? void 0 : _a.name) || code;
    };
    const build = (container, attr, dir) => {
      container.innerHTML = "";
      const saved = readPrefs(dir, stationCode);
      const targets = readTargets(dir, stationCode);
      cats.forEach((cat) => {
        const catKey = `cat:${cat}`;
        const wrap = document.createElement("label");
        Object.assign(wrap.style, {
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.9rem 1.1rem",
          margin: "0.35rem 0",
          border: "1px solid #e0e0e0",
          borderRadius: "0.5rem",
          fontSize: "1.15rem",
          minHeight: "52px",
          cursor: "pointer"
        });
        const input = document.createElement("input");
        input.type = "checkbox";
        input.setAttribute(attr, "");
        input.value = catKey;
        input.checked = saved.has(catKey);
        input.style.transform = "scale(1.35)";
        input.style.transformOrigin = "left center";
        wrap.appendChild(input);
        const text = document.createElement("span");
        text.textContent = CAT_LABELS[cat] || `\u7A2E\u5225${cat}`;
        wrap.appendChild(text);
        const sel = document.createElement("select");
        Object.assign(sel.style, { marginLeft: "auto", fontSize: "1rem", padding: ".4rem .6rem", minWidth: "11rem" });
        const aheadList = ahead(dir);
        if (aheadList.length) {
          aheadList.forEach((code) => {
            const o = document.createElement("option");
            o.value = code;
            o.textContent = nameOf(code);
            sel.appendChild(o);
          });
          sel.value = targets[catKey] && aheadList.includes(targets[catKey]) ? targets[catKey] : aheadList[0];
        } else {
          const o = document.createElement("option");
          o.value = "";
          o.textContent = "\u5019\u88DC\u306A\u3057";
          sel.appendChild(o);
          sel.disabled = true;
        }
        sel.addEventListener("change", () => saveTarget(dir, stationCode, catKey, sel.value));
        wrap.appendChild(sel);
        container.appendChild(wrap);
      });
      const passWrap = document.createElement("label");
      Object.assign(passWrap.style, {
        display: "flex",
        alignItems: "center",
        gap: "0.75rem",
        padding: "0.9rem 1.1rem",
        margin: "0.35rem 0",
        border: "1px solid #e0e0e0",
        borderRadius: "0.5rem",
        fontSize: "1.15rem",
        minHeight: "52px",
        cursor: "pointer"
      });
      const pass = document.createElement("input");
      pass.type = "checkbox";
      pass.setAttribute(attr, "");
      pass.value = "pass";
      pass.checked = saved.has("pass");
      pass.style.transform = "scale(1.35)";
      pass.style.transformOrigin = "left center";
      passWrap.appendChild(pass);
      const pt = document.createElement("span");
      pt.textContent = "\u901A\u904E\u5217\u8ECA\u30A2\u30E9\u30FC\u30E0\uFF08\u505C\u8ECA\u3057\u306A\u3044\u5217\u8ECA\u304C\u6765\u305F\u3068\u304D\uFF09";
      passWrap.appendChild(pt);
      container.appendChild(passWrap);
    };
    build(upBox, "data-alarm-up", "up");
    build(dnBox, "data-alarm-down", "down");
  }

  // public/assets/js/components.js
  var APP_VERSION_META_SELECTOR = 'meta[name="app:version"]';
  var COMPONENTS = Object.freeze([
    { selector: '[data-include="header"]', path: "/components/header.html" },
    { selector: '[data-include="footer"]', path: "/components/footer.html" }
  ]);
  function getAssetVersion() {
    var _a;
    const meta2 = document.querySelector(APP_VERSION_META_SELECTOR);
    return ((_a = meta2 == null ? void 0 : meta2.getAttribute("content")) == null ? void 0 : _a.trim()) || "";
  }
  function withVersion(url) {
    const version = getAssetVersion();
    if (!version) return url;
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}v=${encodeURIComponent(version)}`;
  }
  function loadComponents() {
    return __async(this, null, function* () {
      yield Promise.all(
        COMPONENTS.map(({ selector, path }) => include(selector, withVersion(path)))
      );
      setActiveNav();
      initNavToggle();
    });
  }
  function include(selector, url) {
    return __async(this, null, function* () {
      const element = document.querySelector(selector);
      if (!element) return;
      try {
        const response = yield fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        element.innerHTML = yield response.text();
      } catch (error) {
        element.innerHTML = `<div class="component-error">\u8AAD\u307F\u8FBC\u307F\u30A8\u30E9\u30FC: ${url}</div>`;
        console.error("Component load failed", { selector, url, error });
      }
    });
  }
  function setActiveNav() {
    const nav = document.querySelector("[data-nav]");
    if (!nav) return;
    const currentPath = new URL(window.location.href).pathname;
    for (const link of nav.querySelectorAll("a[href]")) {
      const href = link.getAttribute("href");
      if (!href) continue;
      try {
        const linkPath = new URL(href, window.location.origin).pathname;
        if (linkPath === currentPath) {
          link.classList.add("active");
          link.setAttribute("aria-current", "page");
        }
      } catch (e) {
      }
    }
  }
  function initNavToggle() {
    const button = document.querySelector("[data-nav-toggle]");
    const nav = document.querySelector("[data-nav]");
    if (!button || !nav) return;
    button.addEventListener("click", () => {
      const expanded = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!expanded));
      nav.classList.toggle("open", !expanded);
    });
  }

  // public/assets/js/tid-background.js
  var BG_NOTIFY_KEY = "tid:bgnotify";
  var WAKE_LOCK_KEY = "tid:wakelock";
  function isBgNotifyEnabled(getSetting2) {
    try {
      const v = getSetting2 ? getSetting2("bg.notify", null) : null;
      if (v === "1" || v === 1 || v === true) return true;
      return localStorage.getItem(BG_NOTIFY_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
  var screenWakeLock = null;
  function enableWakeLock() {
    return __async(this, null, function* () {
      try {
        if (!("wakeLock" in navigator)) return false;
        screenWakeLock = yield navigator.wakeLock.request("screen");
        screenWakeLock.addEventListener("release", () => {
        });
        return true;
      } catch (e) {
        return false;
      }
    });
  }
  function disableWakeLock() {
    return __async(this, null, function* () {
      try {
        if (screenWakeLock) {
          yield screenWakeLock.release();
          screenWakeLock = null;
        }
      } catch (e) {
      }
    });
  }
  function tryReacquireWakeLock() {
    return __async(this, null, function* () {
      try {
        if (localStorage.getItem(WAKE_LOCK_KEY) === "1" && document.visibilityState === "visible") {
          if (!screenWakeLock) yield enableWakeLock();
        }
      } catch (e) {
      }
    });
  }
  function initBackgroundControls({ getSetting: getSetting2, setSetting: setSetting2, dbg } = {}) {
    try {
      const ncb = document.getElementById("bgNotifyEnable");
      const wcb = document.getElementById("wakeLockEnable");
      const _get = typeof getSetting2 === "function" ? getSetting2 : () => null;
      const _set = typeof setSetting2 === "function" ? setSetting2 : () => {
      };
      if (ncb) {
        ncb.checked = isBgNotifyEnabled(_get);
        try {
          if (ncb.checked && (!("Notification" in window) || Notification.permission !== "granted")) {
            ncb.checked = false;
            _set("bg.notify", "0");
            try {
              localStorage.setItem(BG_NOTIFY_KEY, "0");
            } catch (e) {
            }
          }
        } catch (e) {
        }
        ncb.addEventListener("change", () => __async(null, null, function* () {
          try {
            if (ncb.checked) {
              if ("Notification" in window) {
                let perm = Notification.permission;
                if (perm !== "granted") {
                  try {
                    perm = yield Notification.requestPermission();
                  } catch (e) {
                  }
                }
                if (perm === "granted") {
                  _set("bg.notify", "1");
                  try {
                    localStorage.setItem(BG_NOTIFY_KEY, "1");
                  } catch (e) {
                  }
                } else {
                  ncb.checked = false;
                  _set("bg.notify", "0");
                  try {
                    localStorage.setItem(BG_NOTIFY_KEY, "0");
                  } catch (e) {
                  }
                }
              } else {
                ncb.checked = false;
                _set("bg.notify", "0");
                try {
                  localStorage.setItem(BG_NOTIFY_KEY, "0");
                } catch (e) {
                }
              }
            } else {
              _set("bg.notify", "0");
              try {
                localStorage.setItem(BG_NOTIFY_KEY, "0");
              } catch (e) {
              }
            }
          } catch (err) {
            try {
              dbg && dbg("bg notify toggle failed", err);
            } catch (e) {
            }
          }
        }));
      }
      if (wcb) {
        const saved = _get("bg.wakelock", null) === "1" || localStorage.getItem(WAKE_LOCK_KEY) === "1";
        wcb.checked = saved;
        if (saved) enableWakeLock();
        wcb.addEventListener("change", () => __async(null, null, function* () {
          try {
            if (wcb.checked) {
              _set("bg.wakelock", "1");
              try {
                localStorage.setItem(WAKE_LOCK_KEY, "1");
              } catch (e) {
              }
              yield enableWakeLock();
            } else {
              _set("bg.wakelock", "0");
              try {
                localStorage.setItem(WAKE_LOCK_KEY, "0");
              } catch (e) {
              }
              yield disableWakeLock();
            }
          } catch (err) {
            try {
              dbg && dbg("wakelock toggle failed", err);
            } catch (e) {
            }
          }
        }));
        document.addEventListener("visibilitychange", tryReacquireWakeLock);
      }
    } catch (err) {
      try {
        dbg && dbg("init background controls failed", err);
      } catch (e) {
      }
    }
  }

  // public/assets/js/app.js
  loadComponents();
  migrateLegacySettings();
  bindLineConfig(getLineConfig);
  initBackgroundControls({ getSetting, setSetting });
  var meta = (n) => {
    var _a, _b;
    return ((_b = (_a = document.querySelector(`meta[name="${n}"]`)) == null ? void 0 : _a.getAttribute("content")) == null ? void 0 : _b.trim()) || "";
  };
  var area2 = meta("tid:fixedArea");
  var line2 = meta("tid:fixedLine");
  var lineIds = meta("tid:fixedLines").split(",").map((s) => s.trim()).filter(Boolean);
  var stationName = meta("tid:fixedStationName");
  var lineScope2 = [...lineIds].sort().join("+");
  initAlarm({ scope: lineScope2, areaId: area2, lineId: line2 });
  var paramsView = document.getElementById("paramsView");
  var updatedAtEl = document.getElementById("updatedAt");
  var trafficEl = document.getElementById("trafficInfo");
  var upEl = document.querySelector("#trainsUp") || document.querySelector("#trainsUp .train-items");
  var downEl = document.querySelector("#trainsDown") || document.querySelector("#trainsDown .train-items");
  var stationFilter = document.getElementById("stationFilter");
  var passFilter = document.getElementById("passFilter");
  paramsView.textContent = `\u30A8\u30EA\u30A2: ${area2} / \u8DEF\u7DDA: ${lineIds.join(", ")} / \u99C5: ${stationName}`;
  var currentCode = "";
  var refreshing = false;
  function esc(v) {
    return String(v != null ? v : "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  }
  function renderStations(stations) {
    if (!stationFilter || stationFilter.dataset.bound === "1") return;
    stationFilter.dataset.bound = "1";
    stationFilter.innerHTML = "";
    for (const s of stations) {
      const opt = document.createElement("option");
      opt.value = s.code;
      opt.textContent = s.name;
      stationFilter.appendChild(opt);
    }
    stationFilter.value = currentCode;
    stationFilter.addEventListener("change", () => {
      currentCode = stationFilter.value;
      void refresh(true);
    });
  }
  function renderTraffic(items) {
    if (!trafficEl) return;
    trafficEl.innerHTML = "";
    const sections = [["\u8DEF\u7DDA\u306E\u904B\u884C\u60C5\u5831", items.lines], ["\u7279\u6025\u306E\u904B\u884C\u60C5\u5831", items.express]];
    for (const [title, list] of sections) {
      if (!list.length) continue;
      const sec = document.createElement("section");
      sec.className = "traffic-section";
      const head = document.createElement("div");
      head.className = "traffic-section__header";
      head.textContent = title;
      const ul = document.createElement("ul");
      ul.className = "traffic-list";
      for (const item of list) {
        const li = document.createElement("li");
        li.className = "traffic-item";
        if (item.url) {
          const a = document.createElement("a");
          a.href = item.url;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.textContent = item.text;
          li.appendChild(a);
        } else li.textContent = item.text;
        ul.appendChild(li);
      }
      sec.appendChild(head);
      sec.appendChild(ul);
      trafficEl.appendChild(sec);
    }
  }
  function trainRow(t, delayThreshold, carsThreshold) {
    const tr = document.createElement("tr");
    const typeCls = t.colorClass || "";
    const typeHtml = typeCls ? `<span class="${esc(typeCls)}">${esc(t.displayType)}</span>` : esc(t.displayType);
    const delayHtml = t.delayMinutes > 0 ? t.delayMinutes >= delayThreshold ? `<span class="delay-bad" style="color:var(--color-danger,#c00);font-weight:700;">${t.delayMinutes}\u5206</span>` : `${t.delayMinutes}\u5206` : "";
    let carsText = t.cars != null ? String(t.cars) : "";
    if (Number.isFinite(Number(t.cars)) && Number(t.cars) >= carsThreshold) carsText = `<span class="cars-emph">${carsText}</span>`;
    tr.innerHTML = `<td>${esc(t.no)}</td><td>${typeHtml}</td><td>${esc(t.nickname)}</td><td>${carsText}</td><td>${esc(t.destText)}</td><td>${esc(t.posLabel)}</td><td>${delayHtml}</td>`;
    return tr;
  }
  function renderTrains(resp) {
    const table = (list) => {
      const wrap = document.createElement("table");
      wrap.className = "train-table";
      const colgroup = document.createElement("colgroup");
      for (let i = 0; i < 7; i += 1) colgroup.appendChild(document.createElement("col"));
      wrap.appendChild(colgroup);
      wrap.innerHTML = "<thead><tr><th>\u5217\u756A</th><th>\u7A2E\u5225</th><th>\u611B\u79F0</th><th>\u4E21\u6570</th><th>\u884C\u5148</th><th>\u4F4D\u7F6E</th><th>\u9045\u5EF6</th></tr></thead>";
      const tbody = document.createElement("tbody");
      if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="7">\u8A72\u5F53\u3059\u308B\u5217\u8ECA\u306F\u3042\u308A\u307E\u305B\u3093</td></tr>';
      } else {
        const dTh = Number(getSetting("delay.threshold", 4)) || 4;
        const cTh = Number(getSetting("cars.threshold", 9)) || 9;
        for (const t of list) tbody.appendChild(trainRow(t, dTh, cTh));
      }
      wrap.appendChild(tbody);
      return wrap;
    };
    const fill = (el, list, label) => {
      var _a;
      if (!el) return;
      el.innerHTML = "";
      el.appendChild(table(list));
      const h3 = (_a = el.closest("section")) == null ? void 0 : _a.querySelector("h3");
      if (h3 && label) h3.textContent = label;
    };
    fill(upEl, resp.up, resp.up.length ? `\u4E0A\u308A\uFF08${resp.up.length}\u672C\uFF09` : "\u4E0A\u308A");
    fill(downEl, resp.down, resp.down.length ? `\u4E0B\u308A\uFF08${resp.down.length}\u672C\uFF09` : "\u4E0B\u308A");
  }
  function buildPushPrefs() {
    const dir = (d) => {
      var _a, _b;
      const cfg = getLineConfig(lineScope2);
      const st = ((_b = (_a = cfg == null ? void 0 : cfg.alarms) == null ? void 0 : _a[currentCode]) == null ? void 0 : _b[d]) || {};
      if (st.disabled) return { cats: [], pass: false, carsMin: 0, carsFilter: false, targets: {} };
      const cats = (Array.isArray(st.prefs) ? st.prefs : []).map((v) => typeof v === "string" && v.startsWith("cat:") ? Number(v.slice(4)) : NaN).filter((n) => Number.isFinite(n));
      const targets = st.targets && typeof st.targets === "object" ? st.targets : {};
      return {
        cats,
        pass: Array.isArray(st.prefs) && st.prefs.includes("pass"),
        carsMin: Number(getSetting("cars.threshold", 9)) || 0,
        carsFilter: !!getSetting("cars.filterEnabled", false),
        targets
      };
    };
    return JSON.stringify({ up: dir("up"), down: dir("down") });
  }
  var pushSynced = false;
  var lastSyncKey = "";
  function syncPushSubscription() {
    return __async(this, null, function* () {
      try {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        if (getSetting("bg.notify", null) !== "1") return;
        const prefsJson = buildPushPrefs();
        const syncKey = `${currentCode}
${prefsJson}`;
        if (pushSynced && syncKey === lastSyncKey) return;
        const reg = yield navigator.serviceWorker.getRegistration();
        if (!reg) return;
        yield subscribePush(reg, { stationCode: currentCode, prefsJson });
        pushSynced = true;
        lastSyncKey = syncKey;
      } catch (err) {
        console.warn("push subscribe failed", err);
      }
    });
  }
  function formatJST(iso) {
    try {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return "";
      const p = new Intl.DateTimeFormat("ja-JP", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false
      }).formatToParts(d);
      const g = (t) => {
        var _a;
        return ((_a = p.find((x) => x.type === t)) == null ? void 0 : _a.value) || "";
      };
      return `${g("year")}\u5E74${g("month")}\u6708${g("day")}\u65E5 ${g("hour")}\u6642${g("minute")}\u5206${g("second")}\u79D2\u66F4\u65B0`;
    } catch (e) {
      return "";
    }
  }
  function refresh(immediate = false) {
    return __async(this, null, function* () {
      if (refreshing) return;
      refreshing = true;
      try {
        const pass = (passFilter == null ? void 0 : passFilter.value) || "hide";
        const q = new URLSearchParams({ station: currentCode || stationName, pass });
        const res = yield fetch(`/api/view?${q}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const resp = yield res.json();
        if (!currentCode) {
          currentCode = resp.station.code;
          renderStations(resp.stations);
        }
        updatedAtEl.textContent = formatJST(resp.update || resp.serverTime);
        renderTraffic(resp.traffic);
        renderTrains(resp);
        renderAlarmOptions({
          stations: resp.stations,
          stationCode: currentCode,
          allowedCats: resp.stationAllowedCats,
          dirParam: "both"
        });
        try {
          localStorage.setItem("tid:lastStationCode", currentCode);
        } catch (e) {
        }
        void syncPushSubscription();
        evaluateAndNotify({
          stations: resp.stations,
          trains: [...resp.up, ...resp.down],
          stationCode: currentCode
        });
      } catch (err) {
        console.error("\u53D6\u5F97\u306B\u5931\u6557", err);
        if (updatedAtEl && !immediate) updatedAtEl.textContent = "\u66F4\u65B0\u306B\u5931\u6557\u3057\u307E\u3057\u305F\uFF08\u518D\u8A66\u884C\u4E2D\uFF09";
      } finally {
        refreshing = false;
      }
    });
  }
  function initControls() {
    var _a;
    const delayInput = document.getElementById("delayThreshold");
    if (delayInput) {
      delayInput.value = String(Number(getSetting("delay.threshold", 4)) || 4);
      delayInput.addEventListener("change", () => {
        let v = Number(delayInput.value);
        if (!Number.isFinite(v) || v < 0) v = 4;
        setSetting("delay.threshold", Math.floor(v));
        void refresh(true);
      });
    }
    const carsInput = document.getElementById("carsThreshold");
    if (carsInput) {
      carsInput.value = String(Number(getSetting("cars.threshold", 9)) || 9);
      carsInput.addEventListener("change", () => {
        let v = Number(carsInput.value);
        if (!Number.isFinite(v) || v < 0) v = 9;
        setSetting("cars.threshold", Math.floor(v));
      });
    }
    const carsFilter = document.getElementById("carsFilterEnable");
    if (carsFilter) {
      carsFilter.checked = !!getSetting("cars.filterEnabled", false);
      carsFilter.addEventListener("change", () => setSetting("cars.filterEnabled", carsFilter.checked));
    }
    passFilter == null ? void 0 : passFilter.addEventListener("change", () => void refresh(true));
    (_a = document.getElementById("bgNotifyEnable")) == null ? void 0 : _a.addEventListener("change", () => {
      pushSynced = false;
      setTimeout(() => void syncPushSubscription(), 500);
    });
  }
  function startPolling() {
    void refresh();
    setInterval(() => {
      if (!document.hidden) void refresh();
    }, 1e4);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void refresh();
    });
  }
  requestUnlock(() => {
  });
  initControls();
  startPolling();
})();
