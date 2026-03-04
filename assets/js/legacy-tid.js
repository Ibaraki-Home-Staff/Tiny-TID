(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __defProps = Object.defineProperties;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropDescs = Object.getOwnPropertyDescriptors;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __getProtoOf = Object.getPrototypeOf;
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
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
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

  // assets/js/components.js
  function getAssetVersion() {
    var _a;
    const meta = document.querySelector(APP_VERSION_META_SELECTOR);
    return ((_a = meta == null ? void 0 : meta.getAttribute("content")) == null ? void 0 : _a.trim()) || "";
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
  var APP_VERSION_META_SELECTOR, COMPONENTS;
  var init_components = __esm({
    "assets/js/components.js"() {
      APP_VERSION_META_SELECTOR = 'meta[name="app:version"]';
      COMPONENTS = Object.freeze([
        { selector: '[data-include="header"]', path: "/components/header.html" },
        { selector: '[data-include="footer"]', path: "/components/footer.html" }
      ]);
    }
  });

  // assets/js/tid-rules.js
  var U_TOKEN_TYPE_MAP;
  var init_tid_rules = __esm({
    "assets/js/tid-rules.js"() {
      U_TOKEN_TYPE_MAP = {
        "\u76F4\u5FEB": "\u76F4\u901A\u5FEB\u901F",
        "\u533A\u5FEB": "\u533A\u9593\u5FEB\u901F",
        "\u307F\u5FEB": "\u307F\u3084\u3053\u8DEF\u5FEB\u901F"
        // Add more pairs here as needed
      };
    }
  });

  // assets/js/tid-category.js
  function trainCategoryFromDisplayType(displayType) {
    const label = String(displayType || "").trim();
    for (const { pattern, category } of CATEGORY_MATCHERS) {
      if (pattern.test(label)) return category;
    }
    return -1;
  }
  function getCategoryLabel(category) {
    return CATEGORY_LABELS[Number(category)] || `\u7A2E\u5225${category}`;
  }
  function typeTextClass(category) {
    return CATEGORY_COLOR_CLASS[Number(category)] || "";
  }
  function getNickname(train) {
    return String((train == null ? void 0 : train.nickname) || "").trim();
  }
  function normalizeTrain(train) {
    if (!train || typeof train !== "object") return train;
    const normalized = __spreadValues({}, train);
    const displayType = String(normalized.displayType || "").trim();
    normalizeAShinkaisoku(displayType, normalized);
    normalizeUreshito(displayType, normalized);
    return normalized;
  }
  function normalizeAShinkaisoku(displayType, train) {
    const match = displayType.match(/^A[\s　]*新快[\s　]*([○◯〇×])/i);
    if (!match) return;
    train.displayType = "\u65B0\u5FEB\u901F";
    appendNicknameSuffix(train, `A\u30B7\u30FC\u30C8${match[1]}`, /Aシート/i);
  }
  function normalizeUreshito(displayType, train) {
    const match = displayType.match(/^う[\s　]*([^\s○◯〇×]+)[\s　]*([○◯〇×])$/);
    if (!match) return;
    const [, token, mark] = match;
    const resolvedType = resolveUTokenType(token);
    if (!resolvedType) return;
    train.displayType = resolvedType;
    appendNicknameSuffix(train, `\u3046\u308C\u3057\u30FC\u30C8${mark}`, /うれしート/i);
  }
  function resolveUTokenType(token) {
    var _a;
    if (token === "\u5FEB\u901F" || token === "\u666E\u901A") return token;
    return (_a = U_TOKEN_TYPE_MAP) == null ? void 0 : _a[token];
  }
  function appendNicknameSuffix(train, suffix, alreadyHasPattern) {
    const nickname = getNickname(train);
    if (alreadyHasPattern.test(nickname)) return;
    train.nickname = nickname ? `${nickname} ${suffix}` : suffix;
  }
  function stationAllowedCategories(stationData) {
    if (!Array.isArray(stationData == null ? void 0 : stationData.stopTrains)) return null;
    const categories = new Set(stationData.stopTrains.map((value) => Number(value)));
    categories.add(CATEGORY.LOCAL);
    return categories;
  }
  var CATEGORY, CATEGORY_MATCHERS, CATEGORY_LABELS, CATEGORY_COLOR_CLASS;
  var init_tid_category = __esm({
    "assets/js/tid-category.js"() {
      init_tid_rules();
      CATEGORY = Object.freeze({
        LOCAL: 0,
        RAPID_SPECIAL: 1,
        RAPID: 2,
        RAPID_SECTION: 3,
        RAPID_DIRECT: 4,
        LIMITED_EXPRESS: 5,
        EXPRESS: 6,
        SLEEPER: 7,
        SL: 8,
        SIGHTSEEING: 9,
        TWILIGHT: 10
      });
      CATEGORY_MATCHERS = [
        { pattern: /新快速/, category: CATEGORY.RAPID_SPECIAL },
        { pattern: /区間快速/, category: CATEGORY.RAPID_SECTION },
        { pattern: /直通快速/, category: CATEGORY.RAPID_DIRECT },
        { pattern: /快速/, category: CATEGORY.RAPID },
        { pattern: /特急/, category: CATEGORY.LIMITED_EXPRESS },
        { pattern: /急行/, category: CATEGORY.EXPRESS },
        { pattern: /寝台/, category: CATEGORY.SLEEPER },
        { pattern: /\bSL\b/, category: CATEGORY.SL },
        { pattern: /観光/, category: CATEGORY.SIGHTSEEING },
        { pattern: /瑞風/, category: CATEGORY.TWILIGHT },
        { pattern: /普通/, category: CATEGORY.LOCAL }
      ];
      CATEGORY_LABELS = Object.freeze({
        [CATEGORY.LOCAL]: "\u666E\u901A",
        [CATEGORY.RAPID_SPECIAL]: "\u65B0\u5FEB\u901F",
        [CATEGORY.RAPID]: "\u5FEB\u901F",
        [CATEGORY.RAPID_SECTION]: "\u533A\u9593\u5FEB\u901F",
        [CATEGORY.RAPID_DIRECT]: "\u76F4\u901A\u5FEB\u901F",
        [CATEGORY.LIMITED_EXPRESS]: "\u7279\u6025",
        [CATEGORY.EXPRESS]: "\u6025\u884C",
        [CATEGORY.SLEEPER]: "\u5BDD\u53F0",
        [CATEGORY.SL]: "SL",
        [CATEGORY.SIGHTSEEING]: "\u89B3\u5149",
        [CATEGORY.TWILIGHT]: "\u745E\u98A8"
      });
      CATEGORY_COLOR_CLASS = Object.freeze({
        [CATEGORY.LIMITED_EXPRESS]: "type-text-red",
        [CATEGORY.EXPRESS]: "type-text-red",
        [CATEGORY.SLEEPER]: "type-text-red",
        [CATEGORY.SL]: "type-text-red",
        [CATEGORY.SIGHTSEEING]: "type-text-red",
        [CATEGORY.RAPID_SPECIAL]: "type-text-blue",
        [CATEGORY.RAPID_DIRECT]: "type-text-bluegray",
        [CATEGORY.RAPID]: "type-text-orange",
        [CATEGORY.RAPID_SECTION]: "type-text-green",
        [CATEGORY.TWILIGHT]: "type-text-emerald"
      });
    }
  });

  // assets/js/tid-background.js
  function isBgNotifyEnabled(getSetting) {
    try {
      const v = getSetting ? getSetting("bg.notify", null) : null;
      if (v === "1" || v === 1 || v === true) return true;
      return localStorage.getItem(BG_NOTIFY_KEY) === "1";
    } catch (e) {
      return false;
    }
  }
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
  function initBackgroundControls({ getSetting, setSetting, dbg } = {}) {
    try {
      const ncb = document.getElementById("bgNotifyEnable");
      const wcb = document.getElementById("wakeLockEnable");
      const _get = typeof getSetting === "function" ? getSetting : () => null;
      const _set = typeof setSetting === "function" ? setSetting : () => {
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
  function notifyIfBackground(message, tag, { getSetting, dbg } = {}) {
    try {
      if (!document.hidden) return;
      const _get = typeof getSetting === "function" ? getSetting : () => null;
      if (!isBgNotifyEnabled(_get)) return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const opts = { body: String(message || ""), tag: String(tag || ""), renotify: true, icon: "/assets/img/placeholder.svg" };
      new Notification("\u5217\u8ECA\u63A5\u8FD1", opts);
    } catch (err) {
      try {
        dbg && dbg("notifyIfBackground failed", err);
      } catch (e) {
      }
    }
  }
  var BG_NOTIFY_KEY, WAKE_LOCK_KEY, screenWakeLock;
  var init_tid_background = __esm({
    "assets/js/tid-background.js"() {
      BG_NOTIFY_KEY = "tid:bgnotify";
      WAKE_LOCK_KEY = "tid:wakelock";
      screenWakeLock = null;
    }
  });

  // assets/js/tid-alarm.js
  function createAlarmSystem(deps) {
    const {
      area,
      line,
      getSetting,
      setSetting,
      getLineConfig,
      dbg,
      TID_DEBUG,
      getDelayThreshold,
      getCarsThreshold,
      isCarsFilterEnabled,
      trainCategoryFromDisplayType: trainCategoryFromDisplayType2,
      getCategoryLabel: getCategoryLabel2,
      stationAllowedCategories: stationAllowedCategories2,
      getNickname: getNickname2,
      getDestText,
      configuredTypeTextClass,
      typeTextClass: typeTextClass2,
      buildTtsMessage,
      notifyIfBackground: notifyIfBackground2,
      playAlarmSound,
      playBeep,
      speakTextAsync,
      preemptDelayTts,
      drainDelayTts,
      bindAudioUnlockOnce,
      getAudioUnlocked
    } = deps || {};
    const alarmNotified = { up: /* @__PURE__ */ new Set(), down: /* @__PURE__ */ new Set() };
    const pendingAudioQueue = [];
    const pendingAudioKeys = /* @__PURE__ */ new Set();
    const alarmPlayQueue = [];
    const alarmQueueKeys = /* @__PURE__ */ new Set();
    let alarmPlaying = false;
    const ALARM_STALE_THRESHOLD_MS = 5 * 60 * 1e3;
    const ALARM_RECENT_GRACE_MS = 3 * 60 * 1e3;
    let lastShownTrains = { up: [], down: [] };
    let lastIndexes = null;
    function parseAlarmQueueKey(key) {
      const parts = String(key || "").split(":");
      if (parts.length < 2) return null;
      const no = String(parts[0] || "").trim();
      const dirNum = Number(parts[1]);
      if (!no || dirNum !== 0 && dirNum !== 1) return null;
      return { no, dirNum };
    }
    function createAlarmQueueItem({ key, message, meta, onDone, queuedAt } = {}) {
      return {
        key: String(key || ""),
        message: String(message || ""),
        meta: meta || null,
        onDone,
        queuedAt: Number.isFinite(queuedAt) ? queuedAt : Date.now()
      };
    }
    function isQueueItemStale(item) {
      var _a, _b;
      try {
        const parsed = parseAlarmQueueKey(item == null ? void 0 : item.key);
        if (!parsed) return false;
        const age = Date.now() - Number((item == null ? void 0 : item.queuedAt) || 0);
        if (age > ALARM_STALE_THRESHOLD_MS) {
          try {
            dbg && dbg("ALARM_SKIP_STALE_AGE", { key: item == null ? void 0 : item.key, ageMs: age });
          } catch (e) {
          }
          return true;
        }
        const list = parsed.dirNum === 0 ? lastShownTrains.up || [] : lastShownTrains.down || [];
        const found = list.some((t) => String(t.no || "") === parsed.no);
        if (!found && age < ALARM_RECENT_GRACE_MS) {
          try {
            dbg && dbg("ALARM_QUEUE_NOT_STALE_YET", { key: item == null ? void 0 : item.key, ageMs: age, found });
          } catch (e) {
          }
          return false;
        }
        if (!found) {
          try {
            dbg && dbg("ALARM_SKIP_STALE", {
              time: (/* @__PURE__ */ new Date()).toISOString(),
              key: (item == null ? void 0 : item.key) || "",
              dir: parsed.dirNum,
              ageMs: age,
              shownUp: ((_a = lastShownTrains.up) == null ? void 0 : _a.length) || 0,
              shownDown: ((_b = lastShownTrains.down) == null ? void 0 : _b.length) || 0
            });
          } catch (e) {
          }
        }
        return !found;
      } catch (e) {
        return false;
      }
    }
    let alarmModalEl = null;
    let alarmModalTimer = null;
    function ensureAlarmModal() {
      if (alarmModalEl) return alarmModalEl;
      try {
        const wrap = document.createElement("div");
        wrap.className = "tid-alert-overlay is-hidden";
        wrap.setAttribute("role", "dialog");
        wrap.setAttribute("aria-modal", "true");
        wrap.setAttribute("aria-labelledby", "tidAlertTitle");
        wrap.innerHTML = `
        <div class="tid-alert__panel" role="document">
          <h2 id="tidAlertTitle" class="tid-alert__title">\u5217\u8ECA\u63A5\u8FD1</h2>
          <div class="tid-alert__groups">
            <div class="tid-alert__group">
              <div class="tid-alert__row"><div class="tid-alert__label">\u5217\u756A</div><div class="tid-alert__value" data-alert-no>-</div></div>
              <div class="tid-alert__row"><div class="tid-alert__label">\u884C\u5148</div><div class="tid-alert__value" data-alert-dest>-</div></div>
            </div>
            <div class="tid-alert__group">
              <div class="tid-alert__row"><div class="tid-alert__label">\u7A2E\u5225</div><div class="tid-alert__value" data-alert-type>-</div></div>
              <div class="tid-alert__row"><div class="tid-alert__label">\u611B\u79F0</div><div class="tid-alert__value" data-alert-nick>-</div></div>
            </div>
            <div class="tid-alert__group">
              <div class="tid-alert__row"><div class="tid-alert__label">\u9045\u308C</div><div class="tid-alert__value" data-alert-delay>-</div></div>
            </div>
          </div>
          <div class="tid-alert__actions"><button type="button" class="btn" data-alert-ok>\u78BA\u8A8D</button></div>
        </div>`;
        document.body.appendChild(wrap);
        const btn = wrap.querySelector("[data-alert-ok]");
        btn == null ? void 0 : btn.addEventListener("click", hideAlarmModal);
        alarmModalEl = wrap;
      } catch (e) {
      }
      return alarmModalEl;
    }
    function hideAlarmModal() {
      try {
        if (alarmModalTimer) {
          clearTimeout(alarmModalTimer);
          alarmModalTimer = null;
        }
        if (alarmModalEl) {
          alarmModalEl.classList.add("is-hidden");
          alarmModalEl.setAttribute("aria-hidden", "true");
        }
      } catch (e) {
      }
    }
    function showAlarmModal(meta) {
      var _a, _b, _c, _d;
      try {
        const el = ensureAlarmModal();
        if (!el) return;
        try {
          const title = el.querySelector("#tidAlertTitle");
          let label = "\u5217\u8ECA\u63A5\u8FD1";
          const numDir = typeof (meta == null ? void 0 : meta.direction) === "number" ? meta.direction : null;
          if (numDir === 0) label = "\u4E0A\u308A\u5217\u8ECA\u63A5\u8FD1";
          else if (numDir === 1) label = "\u4E0B\u308A\u5217\u8ECA\u63A5\u8FD1";
          else {
            try {
              const aIdx = (_b = (_a = lastIndexes == null ? void 0 : lastIndexes.byCode) == null ? void 0 : _a.get(String((meta == null ? void 0 : meta.atCode) || ""))) == null ? void 0 : _b.index;
              const bIdx = (_d = (_c = lastIndexes == null ? void 0 : lastIndexes.byCode) == null ? void 0 : _c.get(String((meta == null ? void 0 : meta.nextCode) || ""))) == null ? void 0 : _d.index;
              if (typeof aIdx === "number" && typeof bIdx === "number" && aIdx !== bIdx) {
                label = bIdx < aIdx ? "\u4E0A\u308A\u5217\u8ECA\u63A5\u8FD1" : "\u4E0B\u308A\u5217\u8ECA\u63A5\u8FD1";
              } else {
                const d = String((meta == null ? void 0 : meta.dir) || "");
                if (d === "up") label = "\u4E0A\u308A\u5217\u8ECA\u63A5\u8FD1";
                else if (d === "down") label = "\u4E0B\u308A\u5217\u8ECA\u63A5\u8FD1";
              }
            } catch (e) {
            }
          }
          if (title) title.textContent = label;
        } catch (e) {
        }
        const no = String((meta == null ? void 0 : meta.trainNo) || (meta == null ? void 0 : meta.no) || "").trim();
        const type = String((meta == null ? void 0 : meta.displayType) || (meta == null ? void 0 : meta.type) || "").trim();
        const nick = String((meta == null ? void 0 : meta.nickname) || (meta == null ? void 0 : meta.nick) || "").trim();
        const delayNum = typeof (meta == null ? void 0 : meta.delay) === "number" ? meta.delay : 0;
        const delayText = delayNum && delayNum > 0 ? `${delayNum}\u5206` : "\u306A\u3057";
        const root = el.querySelector(".tid-alert__groups") || el;
        const noEl = root.querySelector("[data-alert-no]") || el.querySelector("[data-alert-no]");
        const destEl = root.querySelector("[data-alert-dest]") || el.querySelector("[data-alert-dest]");
        const typeEl = root.querySelector("[data-alert-type]") || el.querySelector("[data-alert-type]");
        const nickEl = root.querySelector("[data-alert-nick]") || el.querySelector("[data-alert-nick]");
        const delayEl = root.querySelector("[data-alert-delay]") || el.querySelector("[data-alert-delay]");
        if (noEl) noEl.textContent = no || "-";
        if (destEl) {
          destEl.textContent = (meta == null ? void 0 : meta.dest) && String(meta.dest).trim() ? String(meta.dest).trim() : "-";
        }
        if (typeEl) {
          typeEl.textContent = type || "-";
          try {
            const mapCls = configuredTypeTextClass ? configuredTypeTextClass(type) : "";
            const cat = trainCategoryFromDisplayType2 ? trainCategoryFromDisplayType2(type) : null;
            const cls = mapCls || (typeTextClass2 ? typeTextClass2(cat) : "");
            typeEl.className = "tid-alert__value";
            if (cls) typeEl.classList.add(cls);
          } catch (e) {
          }
        }
        if (nickEl) {
          nickEl.textContent = nick || "-";
        }
        if (delayEl) {
          delayEl.textContent = delayText;
          delayEl.className = "tid-alert__value";
          try {
            const th = getDelayThreshold ? getDelayThreshold() : 0;
            if (delayNum && delayNum >= th) {
              delayEl.classList.add("tid-alert__value--delay-bad", "delay-bad");
            }
          } catch (e) {
          }
        }
        el.classList.remove("is-hidden");
        el.removeAttribute("aria-hidden");
        if (alarmModalTimer) {
          clearTimeout(alarmModalTimer);
        }
        alarmModalTimer = setTimeout(() => {
          hideAlarmModal();
        }, 1e4);
      } catch (e) {
      }
    }
    const approachAnnouncedAt = /* @__PURE__ */ new Map();
    const APPROACH_SUPPRESS_MS = 3 * 60 * 1e3;
    const APPROACH_STORE_KEY = "tid:v1:alarm:approachSuppression";
    function approachKey(trainNo, selectedCode, dir) {
      const no = trainNo != null && String(trainNo).trim() ? String(trainNo).trim() : "?";
      const st = selectedCode != null && String(selectedCode).trim() ? String(selectedCode).trim() : "_none";
      const d = dir === 0 || dir === 1 ? String(dir) : String(dir || "");
      const a = String(area || "_");
      const l = String(line || "_");
      return `approach:${a}:${l}:${st}:${d}:${no}`;
    }
    function loadApproachStore() {
      try {
        const raw = localStorage.getItem(APPROACH_STORE_KEY);
        const obj = raw ? JSON.parse(raw) : {};
        if (!obj || typeof obj !== "object") return {};
        const now = Date.now();
        let changed = false;
        for (const k of Object.keys(obj)) {
          const ts = Number(obj[k]);
          if (!Number.isFinite(ts) || now - ts >= APPROACH_SUPPRESS_MS) {
            delete obj[k];
            changed = true;
          }
        }
        if (changed) {
          try {
            localStorage.setItem(APPROACH_STORE_KEY, JSON.stringify(obj));
          } catch (e) {
          }
        }
        return obj;
      } catch (e) {
        return {};
      }
    }
    function saveApproachStore(obj) {
      try {
        localStorage.setItem(APPROACH_STORE_KEY, JSON.stringify(obj || {}));
      } catch (e) {
      }
    }
    function approachRecentlyAnnounced(trainNo, selectedCode, dir) {
      try {
        const k = approachKey(trainNo, selectedCode, dir);
        const now = Date.now();
        const mem = approachAnnouncedAt.get(k) || 0;
        if (now - mem < APPROACH_SUPPRESS_MS) return true;
        const store = loadApproachStore();
        const ts = Number(store[k] || 0);
        if (Number.isFinite(ts) && now - ts < APPROACH_SUPPRESS_MS) return true;
        return false;
      } catch (e) {
        return false;
      }
    }
    function markApproachAnnounced(trainNo, selectedCode, dir) {
      try {
        const k = approachKey(trainNo, selectedCode, dir);
        const now = Date.now();
        approachAnnouncedAt.set(k, now);
        const store = loadApproachStore();
        store[k] = now;
        saveApproachStore(store);
      } catch (e) {
      }
    }
    function selectedStationCode() {
      var _a;
      return (((_a = document.getElementById("stationFilter")) == null ? void 0 : _a.value) || "").trim();
    }
    function alarmKey(dir, st) {
      const code = (st != null ? String(st) : selectedStationCode()) || "_none";
      return `tid:alarm:${line}:${code}:${dir}`;
    }
    function alarmDisableKey(dir, st) {
      const code = (st != null ? String(st) : selectedStationCode()) || "_none";
      return `tid:alarm:disable:${line}:${code}:${dir}`;
    }
    function alarmTargetKey(dir, st) {
      const code = (st != null ? String(st) : selectedStationCode()) || "_none";
      return `tid:alarm:target:${line}:${code}:${dir}`;
    }
    function readAlarmPrefs(dir, st) {
      var _a, _b, _c;
      try {
        const cfg = getLineConfig ? getLineConfig(line) : null;
        const stKey = String(st || "_none");
        const dirKey = dir === 0 || dir === "up" ? "up" : dir === 1 || dir === "down" ? "down" : String(dir || "up");
        const arr = (_c = (_b = (_a = cfg == null ? void 0 : cfg.alarms) == null ? void 0 : _a[stKey]) == null ? void 0 : _b[dirKey]) == null ? void 0 : _c.prefs;
        if (Array.isArray(arr)) return new Set(arr);
      } catch (e) {
      }
      try {
        const raw = localStorage.getItem(alarmKey(dir, st));
        const arr = raw ? JSON.parse(raw) : [];
        if (Array.isArray(arr)) return new Set(arr);
      } catch (e) {
      }
      return /* @__PURE__ */ new Set();
    }
    function saveAlarmPrefs(dir, values, st) {
      try {
        const stKey = String(st || "_none");
        const dirKey = dir === 0 || dir === "up" ? "up" : dir === 1 || dir === "down" ? "down" : String(dir || "up");
        const arr = Array.from(values || []);
        if (setSetting) setSetting(`lines.${line}.alarms.${stKey}.${dirKey}.prefs`, arr);
      } catch (e) {
      }
    }
    function readAlarmDisable(dir, st) {
      try {
        const stKey = String(st || "_none");
        const dirKey = dir === 0 || dir === "up" ? "up" : dir === 1 || dir === "down" ? "down" : String(dir || "up");
        const v = getSetting ? getSetting(`lines.${line}.alarms.${stKey}.${dirKey}.disabled`, void 0) : void 0;
        if (v === void 0) return false;
        return !!v;
      } catch (e) {
        return false;
      }
    }
    function saveAlarmDisable(dir, v, st) {
      try {
        const stKey = String(st || "_none");
        const dirKey = dir === 0 || dir === "up" ? "up" : dir === 1 || dir === "down" ? "down" : String(dir || "up");
        if (setSetting) setSetting(`lines.${line}.alarms.${stKey}.${dirKey}.disabled`, !!v);
      } catch (e) {
      }
    }
    function readAlarmTargets(dir, st) {
      try {
        const stKey = String(st || "_none");
        const dirKey = dir === 0 || dir === "up" ? "up" : dir === 1 || dir === "down" ? "down" : String(dir || "up");
        const obj = getSetting ? getSetting(`lines.${line}.alarms.${stKey}.${dirKey}.targets`, {}) : {};
        return obj && typeof obj === "object" ? obj : {};
      } catch (e) {
      }
      try {
        const raw = localStorage.getItem(alarmTargetKey(dir, st));
        const obj = raw ? JSON.parse(raw) : {};
        return obj && typeof obj === "object" ? obj : {};
      } catch (e) {
        return {};
      }
    }
    function saveAlarmTarget(dir, st, catKey, stationCode) {
      try {
        const stKey = String(st || "_none");
        const dirKey = dir === 0 || dir === "up" ? "up" : dir === 1 || dir === "down" ? "down" : String(dir || "up");
        const obj = readAlarmTargets(dir, st);
        obj[catKey] = String(stationCode || "");
        if (setSetting) setSetting(`lines.${line}.alarms.${stKey}.${dirKey}.targets`, obj);
      } catch (e) {
      }
    }
    function setDisabledForDir(dir, disabled) {
      const sel = dir === "up" ? "[data-alarm-up]" : "[data-alarm-down]";
      const boxes = document.querySelectorAll(sel);
      boxes.forEach((b) => {
        b.disabled = !!disabled;
        const p = b.parentElement;
        if (p && p.style) {
          p.style.opacity = disabled ? "0.5" : "";
        }
      });
      const fs = document.getElementById(dir === "up" ? "alarmUpBox" : "alarmDownBox");
      if (fs) {
        fs.querySelectorAll("select").forEach((s) => {
          s.disabled = !!disabled || s.options.length === 0 || s.value === "";
        });
      }
    }
    function initAlarmControls() {
      const upDis = document.getElementById("alarmUpDisable");
      const dnDis = document.getElementById("alarmDownDisable");
      if (upDis) {
        upDis.checked = readAlarmDisable("up", selectedStationCode());
        setDisabledForDir("up", upDis.checked);
        upDis.onchange = () => {
          saveAlarmDisable("up", upDis.checked, selectedStationCode());
          setDisabledForDir("up", upDis.checked);
        };
      }
      if (dnDis) {
        dnDis.checked = readAlarmDisable("down", selectedStationCode());
        setDisabledForDir("down", dnDis.checked);
        dnDis.onchange = () => {
          saveAlarmDisable("down", dnDis.checked, selectedStationCode());
          setDisabledForDir("down", dnDis.checked);
        };
      }
    }
    function renderAlarmOptions(indexes, selectedCode, allowedCats, dirParam) {
      var _a, _b;
      const upBox = document.getElementById("alarmUpOptions");
      const downBox = document.getElementById("alarmDownOptions");
      const row = document.getElementById("alarmRow");
      const upFs = document.getElementById("alarmUpBox");
      const dnFs = document.getElementById("alarmDownBox");
      if (!upBox || !downBox || !row) return;
      if (!selectedCode) {
        row.style.display = "none";
        upBox.innerHTML = "";
        downBox.innerHTML = "";
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
      upBox.innerHTML = "";
      downBox.innerHTML = "";
      const cats = allowedCats instanceof Set ? Array.from(allowedCats) : [];
      function nextStations(indexes2, code, dirLabel, count) {
        const order = indexes2.order || [];
        const idx = order.indexOf(String(code));
        const out = [];
        if (idx < 0) return out;
        if (dirLabel === "up") {
          for (let k = 1; k <= count; k++) {
            if (idx + k < order.length) out.push(order[idx + k]);
          }
        } else {
          for (let k = 1; k <= count; k++) {
            if (idx - k >= 0) out.push(order[idx - k]);
          }
        }
        return out;
      }
      const build = (container, attr, saved, dirLabel) => {
        var _a2;
        cats.sort((a, b) => Number(a) - Number(b)).forEach((cat) => {
          const label = getCategoryLabel2 ? getCategoryLabel2(cat) : String(cat);
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
          input.value = `cat:${cat}`;
          if (saved.has(`cat:${cat}`)) input.checked = true;
          input.style.transform = "scale(1.35)";
          input.style.transformOrigin = "left center";
          wrap.appendChild(input);
          const text = document.createElement("span");
          text.textContent = label;
          wrap.appendChild(text);
          const sel = document.createElement("select");
          sel.style.marginLeft = "auto";
          sel.style.fontSize = "1rem";
          sel.style.padding = ".4rem .6rem";
          sel.style.minWidth = "11rem";
          const options = [];
          const makeOpt = (code, label2) => {
            const o = document.createElement("option");
            o.value = code;
            o.textContent = label2;
            return o;
          };
          const nameOf = (code) => {
            const st = indexes.byCode.get(String(code));
            return (st == null ? void 0 : st.name) || String(code);
          };
          const ahead = nextStations(indexes, selectedCode, dirLabel, 3);
          if (ahead.length) {
            ahead.forEach((code) => options.push(makeOpt(code, nameOf(code))));
          } else {
            const o = document.createElement("option");
            o.value = "";
            o.textContent = "\u5019\u88DC\u306A\u3057";
            sel.disabled = true;
            options.push(o);
          }
          options.forEach((o) => sel.appendChild(o));
          const dirKey = dirLabel === "up" ? "up" : "down";
          const targets = readAlarmTargets(dirKey, selectedCode);
          const catKey = `cat:${cat}`;
          if (targets[catKey] && Array.from(sel.options).some((o) => o.value === targets[catKey])) {
            sel.value = targets[catKey];
          }
          sel.addEventListener("change", () => saveAlarmTarget(dirKey, selectedCode, catKey, sel.value));
          wrap.appendChild(sel);
          container.appendChild(wrap);
        });
        const wrapPass = document.createElement("label");
        Object.assign(wrapPass.style, {
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
        pass.style.transform = "scale(1.35)";
        pass.style.transformOrigin = "left center";
        if (saved.has("pass")) pass.checked = true;
        wrapPass.appendChild(pass);
        wrapPass.appendChild(document.createTextNode("\u901A\u904E"));
        const selPass = document.createElement("select");
        selPass.style.marginLeft = "auto";
        selPass.style.fontSize = "1rem";
        selPass.style.padding = ".4rem .6rem";
        selPass.style.minWidth = "11rem";
        const aheadPass = nextStations(indexes, selectedCode, dirLabel, 3);
        if (aheadPass.length) {
          aheadPass.forEach((code) => {
            var _a3;
            const o = document.createElement("option");
            o.value = code;
            o.textContent = ((_a3 = indexes.byCode.get(String(code))) == null ? void 0 : _a3.name) || String(code);
            selPass.appendChild(o);
          });
        } else {
          const o = document.createElement("option");
          o.value = "";
          o.textContent = "\u5019\u88DC\u306A\u3057";
          selPass.disabled = true;
          selPass.appendChild(o);
        }
        const dirKey2 = dirLabel === "up" ? "up" : "down";
        const targets2 = readAlarmTargets(dirKey2, selectedCode);
        if (targets2["pass"] && Array.from(selPass.options).some((o) => o.value === targets2["pass"])) {
          selPass.value = targets2["pass"];
        }
        selPass.addEventListener("change", () => saveAlarmTarget(dirKey2, selectedCode, "pass", selPass.value));
        wrapPass.appendChild(selPass);
        const passSetting = ((_a2 = document.getElementById("passFilter")) == null ? void 0 : _a2.value) || "hide";
        if (passSetting !== "show") {
          pass.disabled = true;
          selPass.disabled = true;
          wrapPass.style.opacity = "0.5";
          wrapPass.style.color = "var(--color-muted)";
          wrapPass.style.pointerEvents = "none";
          wrapPass.title = "\u8A2D\u5B9A\u300C\u901A\u904E\u5217\u8ECA\u306E\u8868\u793A\u300D\u304C\u975E\u8868\u793A\u306E\u305F\u3081\u3001\u4E00\u6642\u7684\u306B\u7121\u52B9\u3067\u3059";
        } else {
          pass.disabled = false;
          selPass.disabled = selPass.options.length === 0 || selPass.value === "";
          wrapPass.style.opacity = "";
          wrapPass.style.color = "";
          wrapPass.style.pointerEvents = "";
          wrapPass.removeAttribute("title");
        }
        container.appendChild(wrapPass);
      };
      const savedUp = readAlarmPrefs("up", selectedCode);
      const savedDown = readAlarmPrefs("down", selectedCode);
      build(upBox, "data-alarm-up", savedUp, "up");
      build(downBox, "data-alarm-down", savedDown, "down");
      const saveScope = (dir, selector) => {
        const boxes = Array.from(document.querySelectorAll(selector));
        const vals = new Set(boxes.filter((b) => b.checked).map((b) => b.value));
        saveAlarmPrefs(dir, vals, selectedCode);
      };
      (_a = document.getElementById("alarmUpBox")) == null ? void 0 : _a.addEventListener("change", () => saveScope("up", "[data-alarm-up]"));
      (_b = document.getElementById("alarmDownBox")) == null ? void 0 : _b.addEventListener("change", () => saveScope("down", "[data-alarm-down]"));
      setDisabledForDir("up", readAlarmDisable("up", selectedCode));
      setDisabledForDir("down", readAlarmDisable("down", selectedCode));
    }
    function getPrefsForDir2(dir) {
      const st = selectedStationCode();
      const disabled = readAlarmDisable(dir === 0 ? "up" : "down", st);
      if (disabled) {
        try {
          dbg && dbg("ALARM_PREFS_DISABLED", { dir: dir === 0 ? "up" : "down", station: st });
        } catch (e) {
        }
        return /* @__PURE__ */ new Set();
      }
      const sel = dir === 0 ? "[data-alarm-up]" : "[data-alarm-down]";
      const boxes = Array.from(document.querySelectorAll(sel));
      const vals = new Set(boxes.filter((b) => b.checked).map((b) => b.value));
      try {
        dbg && dbg("ALARM_PREFS", { dir: dir === 0 ? "up" : "down", station: st, disabled, prefs: Array.from(vals) });
      } catch (e) {
      }
      return vals;
    }
    function drainAlarmQueue() {
      return __async(this, null, function* () {
        if (alarmPlaying) return;
        alarmPlaying = true;
        try {
          try {
            preemptDelayTts && preemptDelayTts();
          } catch (e) {
          }
          while (alarmPlayQueue.length) {
            const it = alarmPlayQueue.shift();
            if (!it) continue;
            if (isQueueItemStale(it)) {
              try {
                if (it && it.key) alarmQueueKeys.delete(it.key);
              } catch (e) {
              }
              continue;
            }
            try {
              const m = it && it.meta ? it.meta : null;
              if (m) {
                showAlarmModal(m);
              }
            } catch (e) {
            }
            try {
              if (TID_DEBUG) {
                const dt = /* @__PURE__ */ new Date();
                const hh = String(dt.getHours()).padStart(2, "0");
                const mm = String(dt.getMinutes()).padStart(2, "0");
                const ss = String(dt.getSeconds()).padStart(2, "0");
                if (it && it.meta) {
                  const m = it.meta;
                  const dirJa = m.dir === "up" ? "\u4E0A\u308A" : m.dir === "down" ? "\u4E0B\u308A" : String(m.dir || "");
                  const seg = m.stopped ? `${m.atName || m.atCode}\uFF08\u505C\u8ECA\uFF09` : `${m.atName || m.atCode}\u2192${m.nextName || m.nextCode}`;
                  console.log("[TID][ALARM]", `${hh}:${mm}:${ss}`, dirJa, seg, "\u5217\u8ECA", m.trainNo || "?");
                } else {
                  console.log("[TID][ALARM]", `${hh}:${mm}:${ss}`, it && it.key ? it.key : "(no-key)", it && it.message ? it.message : "");
                }
              }
            } catch (e) {
            }
            let ms = 0;
            try {
              ms = yield playAlarmSound();
            } catch (e) {
            }
            if (ms <= 0) {
              ms = playBeep ? playBeep() : 0;
              if (ms > 0) {
                yield new Promise((r) => setTimeout(r, ms));
              }
            }
            try {
              yield new Promise((r) => setTimeout(r, 140));
            } catch (e) {
            }
            if (it.message) {
              try {
                yield speakTextAsync(it.message);
              } catch (e) {
              }
            }
            try {
              if (typeof it.onDone === "function") it.onDone();
            } catch (e) {
            }
            try {
              if (it.key) alarmQueueKeys.delete(it.key);
            } catch (e) {
            }
          }
        } finally {
          alarmPlaying = false;
          try {
            drainDelayTts && drainDelayTts();
          } catch (e) {
          }
        }
      });
    }
    function doAlarmBeepAndSpeak(dirStr, key, message, afterPlay, meta) {
      const set = dirStr === "up" ? alarmNotified.up : alarmNotified.down;
      if (set.has(key)) return false;
      if (key && alarmQueueKeys.has(key)) return false;
      if (key) alarmQueueKeys.add(key);
      alarmPlayQueue.push(createAlarmQueueItem({
        key,
        message,
        meta,
        queuedAt: Date.now(),
        onDone: () => {
          try {
            set.add(key);
          } catch (e) {
          }
          try {
            if (typeof afterPlay === "function") afterPlay();
          } catch (e) {
          }
        }
      }));
      try {
        drainAlarmQueue();
      } catch (e) {
      }
      return true;
    }
    function notifyOnce(dirStr, key, message, afterPlay, meta) {
      const set = dirStr === "up" ? alarmNotified.up : alarmNotified.down;
      if (set.has(key)) return false;
      const unlocked = typeof getAudioUnlocked === "function" ? !!getAudioUnlocked() : false;
      if (!unlocked) {
        try {
          bindAudioUnlockOnce && bindAudioUnlockOnce();
        } catch (e) {
        }
        try {
          if (meta) showAlarmModal(meta);
        } catch (e) {
        }
        try {
          if ("vibrate" in navigator) {
            navigator.vibrate([120, 80, 120]);
          }
        } catch (e) {
        }
        if (!pendingAudioKeys.has(key)) {
          pendingAudioKeys.add(key);
          pendingAudioQueue.push({
            dirStr,
            key,
            message,
            afterPlay,
            meta,
            queuedAt: Date.now()
            // Timestamp for stale detection
          });
          try {
            dbg && dbg("ALARM_QUEUED", { key, queuedAt: (/* @__PURE__ */ new Date()).toISOString(), reason: "audioUnlocked=false" });
          } catch (e) {
          }
        }
        return false;
      }
      try {
        (() => __async(null, null, function* () {
          yield doAlarmBeepAndSpeak(dirStr, key, message, afterPlay, meta);
        }))();
      } catch (e) {
      }
      return true;
    }
    function flushPendingAudio() {
      const unlocked = typeof getAudioUnlocked === "function" ? !!getAudioUnlocked() : false;
      if (!unlocked) return;
      try {
        while (pendingAudioQueue.length) {
          const it = pendingAudioQueue.shift();
          if (!it) continue;
          pendingAudioKeys.delete(it.key);
          try {
            (() => __async(null, null, function* () {
              const queuedAt = Number.isFinite(it.queuedAt) ? it.queuedAt : Date.now();
              const set = it.dirStr === "up" ? alarmNotified.up : alarmNotified.down;
              if (set.has(it.key)) return;
              if (it.key && alarmQueueKeys.has(it.key)) return;
              if (it.key) alarmQueueKeys.add(it.key);
              alarmPlayQueue.push(createAlarmQueueItem({
                key: it.key,
                message: it.message,
                meta: it.meta,
                queuedAt,
                onDone: () => {
                  try {
                    set.add(it.key);
                  } catch (e) {
                  }
                  try {
                    if (typeof it.afterPlay === "function") it.afterPlay();
                  } catch (e) {
                  }
                }
              }));
              try {
                drainAlarmQueue();
              } catch (e) {
              }
            }))();
          } catch (e) {
          }
        }
      } catch (e) {
      }
    }
    function handleApproachAlarms(indexes, list, selectedCode, stationIdx, allowedCats, dirParam) {
      var _a, _b, _c, _d, _e, _f, _g;
      if (!selectedCode || stationIdx == null) return;
      const byCode = indexes.byCode;
      const stationIndexOf = (code) => {
        if (code == null) return null;
        const rec = byCode.get(String(code));
        const idx = rec == null ? void 0 : rec.index;
        return typeof idx === "number" ? idx : null;
      };
      const selectedIndex = typeof stationIdx === "number" ? stationIdx : stationIndexOf(selectedCode);
      for (const t of list) {
        if (typeof t.direction !== "number") continue;
        if (dirParam === "up" && t.direction !== 0) continue;
        if (dirParam === "down" && t.direction !== 1) continue;
        try {
          if (isCarsFilterEnabled && isCarsFilterEnabled()) {
            const threshold = getCarsThreshold ? getCarsThreshold() : 0;
            const cars = typeof t.cars === "number" ? t.cars : 0;
            if (cars < threshold) {
              try {
                dbg && dbg("ALARM_CARS_FILTERED", { trainNo: t.no, cars, threshold });
              } catch (e) {
              }
              continue;
            }
          }
        } catch (e) {
        }
        const dir = t.direction;
        const prefs = getPrefsForDir2(dir);
        const prefsRaw = new Set(prefs);
        const posIdx = typeof t.posIndex === "number" ? t.posIndex : null;
        try {
          const passSetting = ((_a = document.getElementById("passFilter")) == null ? void 0 : _a.value) || "hide";
          if (passSetting !== "show") prefs.delete("pass");
        } catch (e) {
        }
        if (!prefs || prefs.size === 0) {
          try {
            dbg && dbg("ALARM_NO_PREFS", { trainNo: t.no, direction: dir, prefs: Array.from(prefs || []) });
          } catch (e) {
          }
          continue;
        }
        const cat = trainCategoryFromDisplayType2 ? trainCategoryFromDisplayType2(t.displayType) : -1;
        const st = selectedStationCode();
        const targets = readAlarmTargets(dir === 0 ? "up" : "down", st);
        const catKey = `cat:${cat}`;
        const ahead = (function() {
          const order = indexes.order || [];
          const idx = order.indexOf(String(selectedCode));
          const out = [];
          if (idx >= 0) {
            if (dir === 0) {
              for (let k = 1; k <= 3; k++) {
                if (idx + k < order.length) out.push(order[idx + k]);
              }
            } else {
              for (let k = 1; k <= 3; k++) {
                if (idx - k >= 0) out.push(order[idx - k]);
              }
            }
          }
          return out;
        })();
        const fallbackTarget = ahead[0] || null;
        let alerted = false;
        try {
          dbg && dbg("ALARM_CHECK_TRAIN", {
            trainNo: t.no,
            displayType: t.displayType,
            category: cat,
            categoryLabel: getCategoryLabel2 ? getCategoryLabel2(cat) : String(cat),
            prefs: Array.from(prefs),
            hasCategory: prefs.has(`cat:${cat}`),
            hasPass: prefs.has("pass")
          });
        } catch (e) {
        }
        if (prefs.has(`cat:${cat}`)) {
          const targetCode = targets[catKey] || fallbackTarget;
          if (!targetCode) {
            try {
              dbg && dbg("ALARM_NO_TARGET", { trainNo: t.no, cat, targets, fallbackTarget });
            } catch (e) {
            }
          }
          if (targetCode) {
            const targetIndex = stationIndexOf(targetCode);
            const here = String(t.atCode || "");
            const nxt = t.nextCode != null ? String(t.nextCode) : "";
            const isStoppedAtTarget = t.stopped && here === String(targetCode);
            const isMovingOnTarget = !t.stopped && (dir === 0 ? nxt === String(targetCode) : here === String(targetCode));
            const segmentMatch = (() => {
              if (posIdx == null || selectedIndex == null || targetIndex == null) return false;
              if (dir === 0 && targetIndex < selectedIndex) return false;
              if (dir === 1 && targetIndex > selectedIndex) return false;
              const lower = Math.min(selectedIndex, targetIndex);
              const upper = Math.max(selectedIndex, targetIndex);
              if (lower === upper) return posIdx === lower;
              if (dir === 0) {
                return posIdx >= selectedIndex && posIdx <= upper;
              }
              if (dir === 1) {
                return posIdx <= selectedIndex && posIdx >= lower;
              }
              return posIdx >= lower && posIdx <= upper;
            })();
            const boundaryMatch = isStoppedAtTarget || isMovingOnTarget;
            const rangeMatch = segmentMatch && !boundaryMatch;
            if (boundaryMatch || rangeMatch) {
              const targetAllowed = stationAllowedCategories2 ? stationAllowedCategories2(indexes.byCode.get(String(targetCode))) : null;
              const stopsHere = cat !== -1 && targetAllowed && targetAllowed.has(cat) || cat === -1;
              try {
                dbg && dbg("ALARM_TARGET_CHECK", {
                  trainNo: t.no,
                  cat,
                  targetCode,
                  targetAllowed: targetAllowed ? Array.from(targetAllowed) : null,
                  stopsHere,
                  boundaryMatch,
                  rangeMatch
                });
              } catch (e) {
              }
              if (stopsHere) {
                if (approachRecentlyAnnounced(t.no, selectedCode, dir)) {
                  alerted = true;
                  continue;
                }
                const key = `${t.no || "?"}:${dir}:${targetCode}`;
                const msg = buildTtsMessage ? buildTtsMessage(t, targetCode, indexes) : "";
                const afterPlay = () => {
                  try {
                    markApproachAnnounced(t.no, selectedCode, dir);
                  } catch (e) {
                  }
                };
                const meta = {
                  area,
                  line,
                  dir: dir === 0 ? "up" : "down",
                  direction: typeof t.direction === "number" ? t.direction : void 0,
                  trainNo: t.no || "?",
                  atCode: String(t.atCode || ""),
                  nextCode: String(t.nextCode || ""),
                  atName: (_b = indexes.byCode.get(String(t.atCode || ""))) == null ? void 0 : _b.name,
                  nextName: (_c = indexes.byCode.get(String(t.nextCode || ""))) == null ? void 0 : _c.name,
                  targetCode: String(targetCode || ""),
                  targetName: (_d = indexes.byCode.get(String(targetCode || ""))) == null ? void 0 : _d.name,
                  stopped: !!t.stopped,
                  displayType: String(t.displayType || ""),
                  nickname: String(getNickname2 ? getNickname2(t) : ""),
                  delay: typeof t.delayMinutes === "number" ? t.delayMinutes : 0,
                  dest: String(getDestText ? getDestText(t, indexes, "dest") : ""),
                  triggerReason: rangeMatch ? "range" : "segment",
                  selectedIndex,
                  targetIndex,
                  posIndex: posIdx
                };
                try {
                  dbg && dbg("ALARM_TRIGGER", {
                    time: (/* @__PURE__ */ new Date()).toISOString(),
                    line,
                    area,
                    selectedStation: String(selectedCode),
                    trainNo: meta.trainNo,
                    displayType: meta.displayType,
                    prefsRaw: Array.from(prefsRaw || []),
                    prefsNow: Array.from(prefs || []),
                    target: { code: meta.targetCode, name: meta.targetName },
                    pos: { at: meta.atCode, next: meta.nextCode },
                    reason: rangeMatch ? "stop-range" : "stop-segment"
                  });
                } catch (e) {
                }
                notifyOnce(dir === 0 ? "up" : "down", key, msg, afterPlay, meta);
                try {
                  notifyIfBackground2 && notifyIfBackground2(msg, approachKey(t.no, selectedCode, dir));
                } catch (e) {
                }
                alerted = true;
              } else {
                try {
                  dbg && dbg("ALARM_NOT_STOPPING", { trainNo: t.no, cat, targetCode, targetAllowed: targetAllowed ? Array.from(targetAllowed) : null });
                } catch (e) {
                }
              }
            } else {
              try {
                dbg && dbg("ALARM_NO_MATCH", { trainNo: t.no, boundaryMatch, rangeMatch, here, nxt, targetCode, isStoppedAtTarget, isMovingOnTarget, segmentMatch });
              } catch (e) {
              }
            }
          }
        } else {
          try {
            dbg && dbg("ALARM_CATEGORY_NOT_IN_PREFS", {
              trainNo: t.no,
              displayType: t.displayType,
              category: cat,
              categoryLabel: getCategoryLabel2 ? getCategoryLabel2(cat) : String(cat),
              prefs: Array.from(prefs)
            });
          } catch (e) {
          }
        }
        if (!alerted && prefs.has("pass")) {
          const targetCode = targets["pass"] || fallbackTarget;
          if (targetCode) {
            const here = String(t.atCode || "");
            const nxt = t.nextCode != null ? String(t.nextCode) : "";
            const isStoppedAtTarget = t.stopped && here === String(targetCode);
            const isMovingOnTarget = !t.stopped && (dir === 0 ? nxt === String(targetCode) : here === String(targetCode));
            if (isStoppedAtTarget || isMovingOnTarget) {
              const targetAllowed = stationAllowedCategories2 ? stationAllowedCategories2(indexes.byCode.get(String(targetCode))) : null;
              const stopsHere2 = cat !== -1 && targetAllowed && targetAllowed.has(cat) || cat === -1;
              if (!stopsHere2) {
                if (approachRecentlyAnnounced(t.no, selectedCode, dir)) {
                  continue;
                }
                const key = `${t.no || "?"}:${dir}:${targetCode}`;
                const msg = buildTtsMessage ? buildTtsMessage(t, targetCode, indexes) : "";
                const afterPlay = () => {
                  try {
                    markApproachAnnounced(t.no, selectedCode, dir);
                  } catch (e) {
                  }
                };
                const meta = {
                  area,
                  line,
                  dir: dir === 0 ? "up" : "down",
                  direction: typeof t.direction === "number" ? t.direction : void 0,
                  trainNo: t.no || "?",
                  atCode: String(t.atCode || ""),
                  nextCode: String(t.nextCode || ""),
                  atName: (_e = indexes.byCode.get(String(t.atCode || ""))) == null ? void 0 : _e.name,
                  nextName: (_f = indexes.byCode.get(String(t.nextCode || ""))) == null ? void 0 : _f.name,
                  targetCode: String(targetCode || ""),
                  targetName: (_g = indexes.byCode.get(String(targetCode || ""))) == null ? void 0 : _g.name,
                  stopped: !!t.stopped,
                  displayType: String(t.displayType || ""),
                  nickname: String(getNickname2 ? getNickname2(t) : ""),
                  delay: typeof t.delayMinutes === "number" ? t.delayMinutes : 0,
                  dest: String(getDestText ? getDestText(t, indexes, "dest") : "")
                };
                try {
                  dbg && dbg("ALARM_TRIGGER", {
                    time: (/* @__PURE__ */ new Date()).toISOString(),
                    line,
                    area,
                    selectedStation: String(selectedCode),
                    trainNo: meta.trainNo,
                    displayType: meta.displayType,
                    prefsRaw: Array.from(prefsRaw || []),
                    prefsNow: Array.from(prefs || []),
                    target: { code: meta.targetCode, name: meta.targetName },
                    pos: { at: meta.atCode, next: meta.nextCode },
                    reason: "pass"
                  });
                } catch (e) {
                }
                notifyOnce(dir === 0 ? "up" : "down", key, msg, afterPlay, meta);
                try {
                  notifyIfBackground2 && notifyIfBackground2(msg, approachKey(t.no, selectedCode, dir));
                } catch (e) {
                }
                alerted = true;
              }
            }
          }
        }
      }
    }
    function setLastShown({ up = [], down = [] } = {}, selectedCode, indexes) {
      try {
        lastShownTrains = { up: up.slice(), down: down.slice() };
        lastIndexes = indexes || null;
      } catch (e) {
      }
    }
    function clearNotified() {
      try {
        alarmNotified.up.clear();
        alarmNotified.down.clear();
      } catch (e) {
      }
    }
    function isPlaying() {
      return !!alarmPlaying;
    }
    return {
      initAlarmControls,
      renderAlarmOptions,
      handleApproachAlarms,
      notifyOnce,
      clearNotified,
      setLastShown,
      flushPendingAudio,
      isPlaying
    };
  }
  var init_tid_alarm = __esm({
    "assets/js/tid-alarm.js"() {
    }
  });

  // assets/js/tid.js
  var require_tid = __commonJS({
    "assets/js/tid.js"(exports) {
      init_components();
      init_tid_rules();
      init_tid_category();
      init_tid_background();
      init_tid_alarm();
      loadComponents();
      var paramsView = document.getElementById("paramsView");
      var trainsContainer = document.getElementById("trainsContainer");
      var upContainer = document.querySelector("#trainsUp .train-items");
      var downContainer = document.querySelector("#trainsDown .train-items");
      var updatedAtEl = document.getElementById("updatedAt");
      var settingsPanel = document.getElementById("settingsPanel");
      var audioOverlay = document.getElementById("audioUnlockOverlay");
      var audioOverlayBtn = document.getElementById("audioUnlockBtn");
      var audioOverlayHint = document.getElementById("audioUnlockHint");
      var audioOverlayLater = document.getElementById("audioUnlockLater");
      var audioOverlayClose = document.getElementById("audioUnlockClose");
      var __dbgParam = new URLSearchParams(window.location.search).get("debug");
      var TID_DEBUG = __dbgParam === "1" || localStorage.getItem("tid:debug") === "1";
      function dbg() {
        try {
          if (TID_DEBUG) console.log("[TID]", ...arguments);
        } catch (e) {
        }
      }
      function warn() {
        try {
          console.warn("[TID]", ...arguments);
        } catch (e) {
        }
      }
      var alarmSystem = null;
      var audioCtx = null;
      var audioUnlocked = false;
      var audioUnlockBound = false;
      var delayTtsPlaying = false;
      var refreshing = false;
      var sp = new URLSearchParams(window.location.search);
      var area = sp.get("area") || "";
      var line = sp.get("line") || "";
      var dir = sp.get("dir");
      var dirLabel = dir === "up" ? "\u4E0A\u308A" : dir === "down" ? "\u4E0B\u308A" : "\u4E21\u65B9";
      paramsView.textContent = `\u9078\u629E\u4E2D\u306E\u30A8\u30EA\u30A2: ${area || "(\u672A\u6307\u5B9A)"} / \u8DEF\u7DDA: ${line || "(\u672A\u6307\u5B9A)"} / \u65B9\u5411: ${dirLabel}`;
      alarmSystem = createAlarmSystem({
        area,
        line,
        getSetting,
        setSetting,
        getLineConfig,
        dbg,
        TID_DEBUG,
        getDelayThreshold,
        getCarsThreshold,
        isCarsFilterEnabled,
        trainCategoryFromDisplayType,
        getCategoryLabel,
        stationAllowedCategories,
        getNickname,
        getDestText,
        configuredTypeTextClass,
        typeTextClass,
        buildTtsMessage,
        notifyIfBackground: (message, tag) => notifyIfBackground(message, tag, { getSetting, dbg }),
        playAlarmSound,
        playBeep,
        speakTextAsync,
        preemptDelayTts,
        drainDelayTts,
        bindAudioUnlockOnce,
        getAudioUnlocked: () => audioUnlocked
      });
      (() => __async(null, null, function* () {
        try {
          migrateLegacySettings();
        } catch (e) {
        }
        try {
          bindAudioUnlockOnce();
        } catch (e) {
        }
        try {
          setupAudioUnlockOverlay();
        } catch (e) {
        }
        if (!line) {
          upContainer.textContent = "\u8DEF\u7DDA\u304C\u672A\u6307\u5B9A\u3067\u3059";
          downContainer.textContent = "";
          return;
        }
        try {
          try {
            yield loadTypeColorMap();
          } catch (e) {
          }
          try {
            yield loadYomiageMap();
          } catch (e) {
          }
          let indexes = buildIndexesFromCache(area, line);
          if (!indexes) {
            const stations = yield fetchStations(line);
            indexes = buildStationIndexes(stations);
          }
          populateStationFilter(indexes);
          alarmSystem == null ? void 0 : alarmSystem.initAlarmControls();
          initTTSControls();
          initDelayControls();
          initCarsControls();
          initBackgroundControls({ getSetting, setSetting, dbg });
          if (TID_DEBUG) {
            try {
              initDebugPanel();
            } catch (e) {
            }
          }
          const trains = yield fetchTrains(line);
          setUpdatedAt(trains == null ? void 0 : trains.update);
          renderTrains(indexes, trains, dir);
          try {
            yield updateTrafficInfo(area, line);
          } catch (e) {
            dbg("traffic info failed", e);
          }
          try {
            const areaCached = loadAreaStationsCache(area);
            if (!areaCached && area) {
              buildGlobalStationsForArea(area).then(() => {
                try {
                  refreshTrains();
                } catch (e) {
                }
              });
            }
          } catch (e) {
          }
          startAutoRefresh();
        } catch (err) {
          console.error("\u5217\u8ECA\u60C5\u5831\u306E\u53D6\u5F97\u306B\u5931\u6557", err);
          upContainer.textContent = "\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F";
          downContainer.textContent = "";
        }
      }))();
      if (settingsPanel) {
        try {
          const applySettingsOpenFromStorage = () => {
            const saved = String(getSetting("ui.settingsOpen", "1"));
            const wantOpen = saved !== "0";
            try {
              settingsPanel.open = wantOpen;
              if (wantOpen) {
                settingsPanel.setAttribute("open", "");
              } else {
                settingsPanel.removeAttribute("open");
              }
            } catch (e) {
            }
          };
          applySettingsOpenFromStorage();
          try {
            requestAnimationFrame(() => {
              applySettingsOpenFromStorage();
            });
          } catch (e) {
          }
          try {
            window.addEventListener("load", applySettingsOpenFromStorage, { once: true });
          } catch (e) {
          }
          settingsPanel.addEventListener("toggle", () => {
            try {
              setSetting("ui.settingsOpen", settingsPanel.open ? "1" : "0");
            } catch (e) {
            }
          });
        } catch (e) {
        }
      }
      function apiBase() {
        return window.TID_API_BASE && String(window.TID_API_BASE) || "/api/v3/";
      }
      var TYPE_COLOR_MAP = /* @__PURE__ */ new Map();
      function typeColorNameToClass(name) {
        const n = String(name || "").trim();
        switch (n) {
          case "\u8D64":
            return "type-text-red";
          case "\u9752":
            return "type-text-blue";
          case "\u9752\u7070":
            return "type-text-bluegray";
          case "\u6A59":
            return "type-text-orange";
          case "\u7DD1":
            return "type-text-green";
          case "\u30A8\u30E1\u30E9\u30EB\u30C9\u30B0\u30EA\u30FC\u30F3":
            return "type-text-emerald";
          default:
            return "";
        }
      }
      function resolveColorMapUrls() {
        const urls = [];
        try {
          const sp2 = new URLSearchParams(window.location.search);
          const fromQuery = sp2.get("colormap") || sp2.get("color");
          if (fromQuery) urls.push(String(fromQuery));
        } catch (e) {
        }
        try {
          const meta = document.querySelector('meta[name="tid:colorUrl"]');
          const fromMeta = meta && meta.getAttribute("content");
          if (fromMeta) urls.push(String(fromMeta));
        } catch (e) {
        }
        urls.push("/assets/color.txt", "/color.txt");
        return urls;
      }
      function loadTypeColorMap() {
        return __async(this, null, function* () {
          const urls = resolveColorMapUrls();
          for (const u of urls) {
            try {
              const res = yield fetch(u, { cache: "no-store" });
              if (!res.ok) continue;
              const text = yield res.text();
              parseTypeColorText(text);
              try {
                dbg("color map loaded", { url: u, size: TYPE_COLOR_MAP.size });
              } catch (e) {
              }
              return;
            } catch (e) {
            }
          }
          try {
            dbg("color map not found; using defaults");
          } catch (e) {
          }
        });
      }
      function parseTypeColorText(text) {
        try {
          TYPE_COLOR_MAP.clear();
          const lines = String(text || "").split(/\r?\n/);
          for (const ln of lines) {
            const line2 = ln.trim();
            if (!line2 || line2.startsWith("#")) continue;
            const parts = line2.split(",");
            if (parts.length < 2) continue;
            const type = parts[0].trim();
            const color = parts[1].trim();
            const cls = typeColorNameToClass(color);
            if (type && cls) TYPE_COLOR_MAP.set(type, cls);
          }
          try {
            dbg("parsed color map", Object.fromEntries(TYPE_COLOR_MAP));
          } catch (e) {
          }
        } catch (e) {
        }
      }
      function configuredTypeTextClass(typeLabel) {
        if (!typeLabel) return "";
        const t = String(typeLabel).trim();
        const exact = TYPE_COLOR_MAP.get(t);
        if (exact) return exact;
        for (const [key, cls] of TYPE_COLOR_MAP.entries()) {
          if (!key) continue;
          if (t.includes(key) || key.includes(t)) return cls;
        }
        return "";
      }
      var YOMI_MAP = /* @__PURE__ */ new Map();
      function resolveYomiUrls() {
        const urls = [];
        try {
          const sp2 = new URLSearchParams(window.location.search);
          const fromQuery = sp2.get("yomiage") || sp2.get("yomi");
          if (fromQuery) urls.push(String(fromQuery));
        } catch (e) {
        }
        try {
          const meta = document.querySelector('meta[name="tid:yomiUrl"]');
          const fromMeta = meta && meta.getAttribute("content");
          if (fromMeta) urls.push(String(fromMeta));
        } catch (e) {
        }
        urls.push("/assets/yomiage.txt", "/yomiage.txt");
        return urls;
      }
      function loadYomiageMap() {
        return __async(this, null, function* () {
          const urls = resolveYomiUrls();
          for (const u of urls) {
            try {
              const res = yield fetch(u, { cache: "no-store" });
              if (!res.ok) continue;
              const text = yield res.text();
              parseYomiageText(text);
              try {
                dbg("yomiage map loaded", { url: u, size: YOMI_MAP.size });
              } catch (e) {
              }
              return;
            } catch (e) {
            }
          }
          try {
            dbg("yomiage map not found; using defaults");
          } catch (e) {
          }
        });
      }
      function parseYomiageText(text) {
        try {
          YOMI_MAP.clear();
          const lines = String(text || "").split(/\r?\n/);
          for (const ln of lines) {
            const s = ln.trim();
            if (!s || s.startsWith("#")) continue;
            const parts = s.split(",");
            if (parts.length < 2) continue;
            const key = parts[0].trim();
            const val = parts[1].trim();
            if (key && val) YOMI_MAP.set(key, val);
          }
          try {
            dbg("parsed yomiage map", Object.fromEntries(YOMI_MAP));
          } catch (e) {
          }
        } catch (e) {
        }
      }
      function yomiFor(text) {
        if (text == null) return "";
        const t = String(text).trim();
        return YOMI_MAP.get(t) || t;
      }
      function getJapaneseVoices() {
        try {
          const synth = window.speechSynthesis;
          if (!synth || !synth.getVoices) return [];
          const list = synth.getVoices() || [];
          return list.filter((v) => /^ja([-_]|$)/i.test(v.lang) || /japanese/i.test(v.name));
        } catch (e) {
          return [];
        }
      }
      function fixTtsText(raw) {
        try {
          let s = String(raw || "");
          s = s.replace(/(\d+)\s*[mMＭ]\b/g, "$1\u30A8\u30E0");
          return s;
        } catch (e) {
          return String(raw || "");
        }
      }
      function getDelayThreshold() {
        try {
          const raw = getSetting("delay.threshold", void 0);
          if (raw == null || raw === "") return 4;
          const v = Number(raw);
          if (Number.isFinite(v) && v >= 0) return Math.floor(v);
        } catch (e) {
        }
        return 4;
      }
      function initDelayControls() {
        const el = document.getElementById("delayThreshold");
        if (!el) return;
        try {
          const v = getDelayThreshold();
          el.value = String(v);
          el.addEventListener("change", () => {
            let n = Number(el.value);
            if (!Number.isFinite(n) || n < 0) n = 4;
            try {
              setSetting("delay.threshold", Math.floor(n));
            } catch (e) {
            }
            refreshTrains();
          });
        } catch (e) {
        }
      }
      function getCarsThreshold() {
        try {
          const raw = getSetting("cars.threshold", void 0);
          if (raw == null || raw === "") return 9;
          const v = Number(raw);
          if (Number.isFinite(v) && v >= 0) return Math.floor(v);
        } catch (e) {
        }
        return 9;
      }
      function isCarsFilterEnabled() {
        try {
          const v = getSetting("cars.filterEnabled", false);
          return !!v;
        } catch (e) {
        }
        return false;
      }
      function initCarsControls() {
        const el = document.getElementById("carsThreshold");
        const filterCb = document.getElementById("carsFilterEnable");
        if (!el) return;
        try {
          const v = getCarsThreshold();
          el.value = String(v);
          el.addEventListener("change", () => {
            let n = Number(el.value);
            if (!Number.isFinite(n) || n < 0) n = 9;
            try {
              setSetting("cars.threshold", Math.floor(n));
            } catch (e) {
            }
            refreshTrains();
          });
        } catch (e) {
        }
        if (filterCb) {
          try {
            filterCb.checked = isCarsFilterEnabled();
            filterCb.addEventListener("change", () => {
              try {
                setSetting("cars.filterEnabled", filterCb.checked);
                dbg("CARS_FILTER_ENABLED", { enabled: filterCb.checked, threshold: getCarsThreshold() });
              } catch (e) {
              }
            });
          } catch (e) {
          }
        }
      }
      var delayAnnouncedAt = /* @__PURE__ */ new Map();
      var DELAY_TTS_INTERVAL_MS = 5 * 60 * 1e3;
      function buildDelayTtsMessage(t, indexes) {
        try {
          const segs = [];
          const no = t && t.no ? String(t.no).trim() : "";
          if (no) segs.push(no);
          let type = t && t.displayType ? String(t.displayType).trim() : "";
          type = yomiFor(type);
          const nick = getNickname(t);
          if (type) {
            if (nick) {
              segs.push(`${type} ${nick}`);
            } else {
              segs.push(`${type}\u5217\u8ECA`);
            }
          }
          let dest = getDestText(t, indexes, "tts.dest");
          if (dest) {
            dest = yomiFor(String(dest).trim());
            if (dest && !dest.endsWith("\u884C\u304D")) dest = `${dest}\u884C\u304D`;
            segs.push(dest);
          }
          const delay = t && typeof t.delayMinutes === "number" ? t.delayMinutes : null;
          if (delay && delay > 0) {
            segs.push(`\u7D04${delay}\u5206\u9045\u5EF6`);
          }
          return segs.filter(Boolean).join("\u3001");
        } catch (e) {
          return "";
        }
      }
      function handleDelayAnnouncements(list, indexes) {
        try {
          if (document.hidden) return;
        } catch (e) {
        }
        if (!audioUnlocked) {
          try {
            bindAudioUnlockOnce();
          } catch (e) {
          }
          return;
        }
        const threshold = getDelayThreshold();
        const now = Date.now();
        for (const t of list) {
          const delay = typeof t.delayMinutes === "number" ? t.delayMinutes : 0;
          if (delay < threshold) continue;
          const key = `delay:${line}:${t.no || "?"}:${t.direction}`;
          const last = delayAnnouncedAt.get(key) || 0;
          if (now - last < DELAY_TTS_INTERVAL_MS) continue;
          const msg = buildDelayTtsMessage(t, indexes);
          if (msg) {
            queueDelayTts(msg, key);
          }
        }
      }
      function buildTtsMessage(t, targetCode, indexes) {
        var _a, _b;
        try {
          const segs = [];
          const no = t && t.no ? String(t.no).trim() : "";
          if (no) segs.push(no);
          let type = t && t.displayType ? String(t.displayType).trim() : "";
          type = yomiFor(type);
          const nick = getNickname(t);
          if (type) {
            if (nick) {
              segs.push(`${type} ${nick}`);
            } else {
              segs.push(`${type}\u5217\u8ECA`);
            }
          }
          let dest = getDestText(t, indexes, "tts.dest");
          if (dest) {
            dest = yomiFor(String(dest).trim());
            if (dest && !dest.endsWith("\u884C\u304D")) dest = `${dest}\u884C\u304D`;
            segs.push(dest);
          }
          const stationName = ((_a = indexes.byCode.get(String(targetCode))) == null ? void 0 : _a.name) || String(targetCode);
          segs.push(`${yomiFor(stationName)}\u306B\u63A5\u8FD1`);
          const delay = t && typeof t.delayMinutes === "number" ? t.delayMinutes : null;
          if (delay && delay > 0) {
            segs.push(`\u7D04${delay}\u5206\u9045\u5EF6`);
          }
          return segs.filter(Boolean).join("\u3001");
        } catch (e) {
          const stationName = ((_b = indexes.byCode.get(String(targetCode))) == null ? void 0 : _b.name) || String(targetCode);
          const no = t && t.no ? String(t.no) : "\u5217\u8ECA";
          return `${no}\u3001${stationName}\u306B\u63A5\u8FD1`;
        }
      }
      function getSelectedVoice() {
        var _a;
        try {
          const name = getSetting("tts.voice", "") || ((_a = document.getElementById("ttsVoice")) == null ? void 0 : _a.value) || "";
          const voices = getJapaneseVoices();
          return voices.find((v) => v.name === name) || voices[0] || null;
        } catch (e) {
          return null;
        }
      }
      function populateTTSSelect() {
        const sel = document.getElementById("ttsVoice");
        if (!sel) return;
        const voices = getJapaneseVoices();
        sel.innerHTML = "";
        if (!voices.length) {
          const opt = document.createElement("option");
          opt.value = "";
          opt.textContent = "\u65E5\u672C\u8A9E\u97F3\u58F0\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093";
          sel.appendChild(opt);
          sel.disabled = true;
          return;
        }
        sel.disabled = false;
        const none = document.createElement("option");
        none.value = "";
        none.textContent = "\uFF08\u672A\u9078\u629E\uFF09";
        sel.appendChild(none);
        const saved = getSetting("tts.voice", "") || "";
        for (const v of voices) {
          const opt = document.createElement("option");
          opt.value = v.name;
          opt.textContent = `${v.name} (${v.lang})`;
          if (saved && saved === v.name) opt.selected = true;
          sel.appendChild(opt);
        }
      }
      function fetchTrafficInfo(area2) {
        return __async(this, null, function* () {
          const url = `${apiBase()}area_${area2}_trafficinfo.json`;
          try {
            const res = yield fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return yield res.json();
          } catch (err) {
            const fallbacks = [
              `/assets/data/area_${area2}_trafficinfo.json`,
              `/area_${area2}_trafficinfo.json`
            ];
            for (const f of fallbacks) {
              try {
                const r = yield fetch(f, { cache: "no-store" });
                if (r.ok) return yield r.json();
              } catch (e) {
              }
            }
            throw err;
          }
        });
      }
      function renderTrafficInfo(area2, line2, data) {
        try {
          const box = document.getElementById("trafficInfo");
          if (!box) return;
          box.innerHTML = "";
          if (!data || typeof data !== "object") return;
          const lineItems = [];
          const expressItems = [];
          if (data.lines && typeof data.lines === "object") {
            const entry = data.lines[line2];
            if (entry) {
              const section = entry.section;
              let sectionText = "";
              if (typeof section === "string") sectionText = section;
              else if (section && typeof section === "object") {
                const from = section.from || section.start || "";
                const to = section.to || section.end || "";
                if (from || to) sectionText = `${from || ""} ~ ${to || ""}`.trim();
              }
              const cause = entry.cause || "";
              const status = entry.status || "";
              const url = entry.url || "";
              const text = `${sectionText ? sectionText + ": " : ""}${cause ? cause + " \u306B\u3088\u308A " : ""}${status}`.trim();
              if (text) lineItems.push({ text, url });
            }
          }
          if (data.express && typeof data.express === "object") {
            const e = data.express[line2];
            if (e) {
              const name = e.name || "";
              const cause = e.cause || "";
              const status = e.status || "";
              const url = e.url || "";
              const text = `${name ? "\u7279\u6025 " + name + ": " : ""}${cause ? cause + " \u306B\u3088\u308A " : ""}${status}`.trim();
              if (text) expressItems.push({ text, url });
            }
          }
          if (!lineItems.length && !expressItems.length) return;
          const buildSection = (title, items, kind) => {
            const sec = document.createElement("section");
            sec.className = "traffic-section";
            const h = document.createElement("div");
            h.className = `traffic-section__header ${kind === "express" ? "traffic-section__header--express" : "traffic-section__header--line"}`;
            h.textContent = title;
            const ul = document.createElement("ul");
            ul.className = "traffic-list";
            for (const it of items) {
              const li = document.createElement("li");
              li.className = `traffic-item ${kind === "express" ? "traffic-item--express" : "traffic-item--line"}`;
              if (it.url) {
                const a = document.createElement("a");
                a.href = it.url;
                a.target = "_blank";
                a.rel = "noopener noreferrer";
                a.textContent = it.text;
                li.appendChild(a);
              } else {
                li.textContent = it.text;
              }
              ul.appendChild(li);
            }
            sec.appendChild(h);
            sec.appendChild(ul);
            box.appendChild(sec);
          };
          if (lineItems.length) buildSection("\u8DEF\u7DDA\u306E\u904B\u884C\u60C5\u5831", lineItems, "line");
          if (expressItems.length) buildSection("\u7279\u6025\u306E\u904B\u884C\u60C5\u5831", expressItems, "express");
        } catch (err) {
          dbg("renderTrafficInfo error", err);
        }
      }
      function updateTrafficInfo(area2, line2) {
        return __async(this, null, function* () {
          if (!area2 || !line2) return;
          try {
            const data = yield fetchTrafficInfo(area2);
            renderTrafficInfo(area2, line2, data);
          } catch (err) {
            dbg("traffic fetch fail", err);
          }
        });
      }
      function initTTSControls() {
        const sel = document.getElementById("ttsVoice");
        const btn = document.getElementById("ttsTestBtn");
        if (!sel) return;
        try {
          bindAudioUnlockOnce();
          populateTTSSelect();
          if ("speechSynthesis" in window) {
            window.speechSynthesis.onvoiceschanged = () => {
              const saved2 = getSetting("tts.voice", "") || "";
              populateTTSSelect();
              if (saved2) {
                const s = document.getElementById("ttsVoice");
                if (s && Array.from(s.options).some((o) => o.value === saved2)) s.value = saved2;
              }
            };
          }
          sel.addEventListener("change", () => {
            try {
              setSetting("tts.voice", sel.value || "");
            } catch (e) {
            }
          });
          const saved = getSetting("tts.voice", "");
          if (saved && Array.from(sel.options).some((o) => o.value === saved)) sel.value = saved;
          if (btn) {
            if (!("speechSynthesis" in window)) {
              btn.disabled = true;
              btn.textContent = "\u97F3\u58F0\u672A\u5BFE\u5FDC";
            } else {
              btn.addEventListener("click", () => __async(null, null, function* () {
                try {
                  bindAudioUnlockOnce();
                  const synth = window.speechSynthesis;
                  if (synth.speaking || synth.pending) {
                    synth.cancel();
                    btn.textContent = "\u30C6\u30B9\u30C8\u518D\u751F";
                    return;
                  }
                  audioUnlocked = true;
                  btn.textContent = "\u505C\u6B62";
                  yield speakTextAsync("4049M\u3001\u7279\u6025 \u30B5\u30F3\u30C0\u30FC\u30D0\u30FC\u30C949\u53F7\u3001\u5927\u962A\u884C\u304D\u3001\u5343\u91CC\u4E18\u306B\u63A5\u8FD1");
                  btn.textContent = "\u30C6\u30B9\u30C8\u518D\u751F";
                } catch (e) {
                  btn.textContent = "\u30A8\u30E9\u30FC";
                }
              }));
            }
          }
        } catch (e) {
        }
      }
      var BEEP_DURATION_MS = 280;
      var ALARM_SOUND_URL = "/assets/sound/alarm.mp3";
      var alarmAudioEl = null;
      var alarmAudioPrimed = false;
      function ensureAlarmAudioEl() {
        if (alarmAudioEl) return alarmAudioEl;
        try {
          const el = document.createElement("audio");
          el.src = ALARM_SOUND_URL;
          el.preload = "auto";
          el.controls = false;
          el.loop = false;
          el.style.display = "none";
          el.setAttribute("aria-hidden", "true");
          try {
            el.setAttribute("playsinline", "");
            el.setAttribute("webkit-playsinline", "");
          } catch (e) {
          }
          document.body.appendChild(el);
          alarmAudioEl = el;
        } catch (e) {
        }
        return alarmAudioEl;
      }
      function primeAlarmAudio() {
        return __async(this, null, function* () {
          try {
            const el = ensureAlarmAudioEl();
            if (!el || alarmAudioPrimed === true) return true;
            yield el.play();
            try {
              yield new Promise((r) => setTimeout(r, 10));
            } catch (e) {
            }
            try {
              el.pause();
              el.currentTime = 0;
            } catch (e) {
            }
            alarmAudioPrimed = true;
            return true;
          } catch (e) {
            return false;
          }
        });
      }
      var delayTtsQueue = [];
      var delayTtsKeys = /* @__PURE__ */ new Set();
      function queueDelayTts(message, key) {
        try {
          const k = String(key || "");
          if (k && delayTtsKeys.has(k)) return;
          delayTtsQueue.push({ message, key: k });
          if (k) delayTtsKeys.add(k);
          if (!delayTtsPlaying) {
            try {
              drainDelayTts();
            } catch (e) {
            }
          }
        } catch (e) {
        }
      }
      function drainDelayTts() {
        return __async(this, null, function* () {
          if (delayTtsPlaying) return;
          delayTtsPlaying = true;
          try {
            while (delayTtsQueue.length) {
              if ((alarmSystem == null ? void 0 : alarmSystem.isPlaying) && alarmSystem.isPlaying()) break;
              const it = delayTtsQueue[0];
              yield speakTextAsync(it.message);
              delayTtsQueue.shift();
              if (it.key) {
                delayTtsKeys.delete(it.key);
                try {
                  delayAnnouncedAt.set(it.key, Date.now());
                } catch (e) {
                }
              }
            }
          } finally {
            delayTtsPlaying = false;
          }
        });
      }
      function preemptDelayTts() {
        try {
          if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
          }
        } catch (e) {
        }
        try {
          const btn = document.getElementById("ttsTestBtn");
          if (btn) {
            btn.textContent = "\u30C6\u30B9\u30C8\u518D\u751F";
          }
        } catch (e) {
        }
      }
      function cleanupAudioUnlockListeners() {
        audioUnlockBound = false;
      }
      function handleAudioUnlockGesture() {
        performAudioUnlock("gesture");
      }
      function performAudioUnlock(source) {
        if (audioUnlocked) return;
        try {
          audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
          if (audioCtx && audioCtx.resume) {
            audioCtx.resume().catch(() => {
            });
          }
        } catch (e) {
        }
        audioUnlocked = true;
        try {
          setSetting("ui.audioUnlocked", "1");
          sessionStorage.setItem("tid:audio:session", "1");
        } catch (e) {
        }
        cleanupAudioUnlockListeners();
        try {
          dbg("audio unlocked", source || "");
        } catch (e) {
        }
        try {
          document.dispatchEvent(new CustomEvent("tid:audiounlocked"));
        } catch (e) {
        }
        try {
          primeAlarmAudio();
        } catch (e) {
        }
        try {
          alarmSystem == null ? void 0 : alarmSystem.flushPendingAudio();
        } catch (e) {
        }
        try {
          refreshTrains();
        } catch (e) {
        }
        try {
          drainDelayTts();
        } catch (e) {
        }
      }
      function bindAudioUnlockOnce() {
        if (audioUnlocked) return;
        if (audioUnlockBound) return;
        audioUnlockBound = true;
        try {
          document.addEventListener("touchstart", handleAudioUnlockGesture, { once: true, passive: true });
          document.addEventListener("keydown", handleAudioUnlockGesture, { once: true });
          if ("PointerEvent" in window) {
            document.addEventListener("pointerdown", handleAudioUnlockGesture, { once: true, passive: true });
          } else {
            document.addEventListener("mousedown", handleAudioUnlockGesture, { once: true, passive: true });
          }
        } catch (e) {
        }
      }
      function setupAudioUnlockOverlay() {
        if (!audioOverlay) return;
        const supported = "speechSynthesis" in window || "AudioContext" in window || "webkitAudioContext" in window;
        if (!supported) {
          audioOverlay.classList.add("is-hidden");
          audioOverlay.setAttribute("aria-hidden", "true");
          return;
        }
        const hide = () => {
          try {
            audioOverlay.classList.add("is-hidden");
            audioOverlay.setAttribute("aria-hidden", "true");
          } catch (e) {
          }
        };
        const show = () => {
          try {
            audioOverlay.classList.remove("is-hidden");
            audioOverlay.removeAttribute("aria-hidden");
          } catch (e) {
          }
        };
        try {
          const isStandalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches || window.navigator && window.navigator.standalone === true;
          const text = isStandalone ? "\u30A2\u30D7\u30EA\u3068\u3057\u3066\u8D77\u52D5\u4E2D\u3067\u3059\u3002\u97F3\u58F0\u3092\u6709\u52B9\u306B\u3059\u308B\u3068\u30A2\u30E9\u30FC\u30C8\u901A\u77E5\u3084\u30C6\u30B9\u30C8\u97F3\u58F0\u3092\u78BA\u8A8D\u3067\u304D\u307E\u3059\u3002" : "\u30D6\u30E9\u30A6\u30B6\u3067\u958B\u3044\u3066\u3044\u307E\u3059\u3002\u97F3\u58F0\u3092\u6709\u52B9\u306B\u3059\u308B\u3068\u30C6\u30B9\u30C8\u97F3\u58F0\u3084\u30A2\u30E9\u30FC\u30C8\u901A\u77E5\u304C\u884C\u3048\u308B\u3088\u3046\u306B\u306A\u308A\u307E\u3059\u3002";
          if (audioOverlayHint) {
            audioOverlayHint.textContent = text;
          }
        } catch (e) {
        }
        show();
        try {
          if (audioOverlayBtn) {
            audioOverlayBtn.addEventListener("click", () => {
              try {
                bindAudioUnlockOnce();
                performAudioUnlock("overlay-button");
                runAudioUnlockTestPlayback();
              } catch (err) {
                dbg("audio unlock button failed", err);
              }
            });
          }
          if (audioOverlayLater) {
            audioOverlayLater.addEventListener("click", () => {
              try {
                audioOverlay.classList.add("is-hidden");
                audioOverlay.setAttribute("aria-hidden", "true");
              } catch (e) {
              }
            });
          }
          if (audioOverlayClose) {
            audioOverlayClose.addEventListener("click", () => {
              try {
                audioOverlay.classList.add("is-hidden");
                audioOverlay.setAttribute("aria-hidden", "true");
              } catch (e) {
              }
            });
          }
          document.addEventListener("tid:audiounlocked", hide, { once: true });
        } catch (e) {
        }
      }
      function runAudioUnlockTestPlayback() {
        return __async(this, null, function* () {
          try {
            if (!audioUnlocked) return;
            preemptDelayTts();
            const waitMs = playBeep();
            if (waitMs > 0) {
              try {
                yield new Promise((r) => setTimeout(r, waitMs));
              } catch (e) {
              }
            }
            yield speakTextAsync("\u30C6\u30B9\u30C8\u97F3\u58F0\u3067\u3059\u3002");
          } catch (err) {
            dbg("audio unlock test failed", err);
          }
        });
      }
      function playAlarmSound() {
        return __async(this, null, function* () {
          try {
            if (!audioUnlocked) {
              bindAudioUnlockOnce();
              return 0;
            }
            const el = ensureAlarmAudioEl();
            if (!el) {
              return 0;
            }
            try {
              yield primeAlarmAudio();
            } catch (e) {
            }
            el.currentTime = 0;
            el.volume = 1;
            return yield new Promise((resolve) => {
              let settled = false;
              const done = (ms) => {
                if (!settled) {
                  settled = true;
                  resolve(Number.isFinite(ms) ? ms : 0);
                }
              };
              const onEnded = () => {
                const durMs = typeof el.duration === "number" && isFinite(el.duration) ? Math.round(el.duration * 1e3) : 0;
                cleanup();
                done(durMs);
              };
              const onError = () => {
                cleanup();
                done(0);
              };
              const cleanup = () => {
                try {
                  el.removeEventListener("ended", onEnded);
                } catch (e) {
                }
                try {
                  el.removeEventListener("error", onError);
                } catch (e) {
                }
              };
              try {
                el.addEventListener("ended", onEnded, { once: true });
                el.addEventListener("error", onError, { once: true });
                try {
                  if (!el.paused) {
                    el.pause();
                    el.currentTime = 0;
                  }
                } catch (e) {
                }
                const p = el.play();
                if (p && typeof p.then === "function") {
                  p.catch(() => {
                    try {
                      audioUnlocked = false;
                      sessionStorage.removeItem("tid:audio:session");
                      setSetting("ui.audioUnlocked", "0");
                      bindAudioUnlockOnce();
                      setupAudioUnlockOverlay();
                    } catch (e) {
                    }
                    cleanup();
                    done(0);
                  });
                }
              } catch (e) {
                cleanup();
                done(0);
              }
              setTimeout(() => {
                cleanup();
                done(0);
              }, 6e3);
            });
          } catch (e) {
            dbg("alarm audio failed", e);
            return 0;
          }
        });
      }
      function playBeep() {
        try {
          if (!audioUnlocked) {
            bindAudioUnlockOnce();
            return 0;
          }
          audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
          if (audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume().catch(() => {
          });
          const o = audioCtx.createOscillator();
          const g = audioCtx.createGain();
          o.type = "sine";
          o.frequency.value = 880;
          g.gain.setValueAtTime(1e-4, audioCtx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.02);
          g.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + BEEP_DURATION_MS / 1e3 - 0.02);
          o.connect(g).connect(audioCtx.destination);
          o.start();
          o.stop(audioCtx.currentTime + BEEP_DURATION_MS / 1e3);
        } catch (err) {
          dbg("beep failed", err);
        }
        return BEEP_DURATION_MS;
      }
      function speakTextAsync(text) {
        return __async(this, null, function* () {
          try {
            if (!audioUnlocked) return;
            if (!("speechSynthesis" in window)) return;
            const synth = window.speechSynthesis;
            const voice = getSelectedVoice();
            return yield new Promise((resolve) => {
              try {
                try {
                  synth.cancel();
                } catch (e) {
                }
                try {
                  if (synth.paused && synth.resume) synth.resume();
                } catch (e) {
                }
                const startSpeak = () => {
                  try {
                    const u = new SpeechSynthesisUtterance(fixTtsText(text));
                    if (voice) {
                      u.voice = voice;
                      u.lang = voice.lang || "ja-JP";
                    } else {
                      u.lang = "ja-JP";
                    }
                    u.rate = 1;
                    u.pitch = 1;
                    u.volume = 1;
                    u.onend = () => resolve();
                    u.onerror = () => resolve();
                    synth.speak(u);
                  } catch (e) {
                    resolve();
                  }
                };
                setTimeout(startSpeak, 30);
              } catch (e) {
                resolve();
              }
            });
          } catch (e) {
          }
        });
      }
      var globalStationsByCode = /* @__PURE__ */ new Map();
      var AREA_LIST = ["kinki", "hokuriku", "okayama", "hiroshima", "sanin"];
      var CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
      function areaCacheKey(a) {
        return `tid:areaStations:${a}`;
      }
      function areaCrossKey(a) {
        return `tid:cross:${a}`;
      }
      function loadAreaStationsCache(a) {
        try {
          const raw = localStorage.getItem(areaCacheKey(a));
          if (!raw) return null;
          const obj = JSON.parse(raw);
          if (!obj || !obj.updatedAt || !obj.stations) return null;
          const age = Date.now() - Number(obj.updatedAt);
          if (age > CACHE_TTL_MS) return null;
          return obj;
        } catch (e) {
          return null;
        }
      }
      function saveAreaStationsCache(a, data) {
        try {
          const payload = {
            updatedAt: Date.now(),
            stations: data.stations || {},
            lines: data.lines || {},
            lineStations: data.lineStations || {}
          };
          localStorage.setItem(areaCacheKey(a), JSON.stringify(payload));
        } catch (e) {
        }
      }
      function loadAreaCrossCache(a) {
        try {
          const raw = localStorage.getItem(areaCrossKey(a));
          if (!raw) return null;
          const obj = JSON.parse(raw);
          if (!obj || !obj.updatedAt || !obj.lines) return null;
          const age = Date.now() - Number(obj.updatedAt);
          if (age > CACHE_TTL_MS) return null;
          return obj;
        } catch (e) {
          return null;
        }
      }
      function saveAreaCrossCache(a, data) {
        try {
          const payload = { updatedAt: Date.now(), lines: data.lines || {} };
          localStorage.setItem(areaCrossKey(a), JSON.stringify(payload));
        } catch (e) {
        }
      }
      function pairKey(a, b) {
        const x = String(a), y = String(b);
        return x < y ? `${x}_${y}` : `${y}_${x}`;
      }
      function getCrossPreferredLine(a, userLine, codeA, codeB) {
        const obj = loadAreaCrossCache(a);
        if (!obj || !obj.lines) return null;
        const table = obj.lines[userLine];
        if (!table) return null;
        return table[pairKey(codeA, codeB)] || null;
      }
      function setCrossPreferredLine(a, userLine, codeA, codeB, chosenLine) {
        try {
          const obj = loadAreaCrossCache(a) || { updatedAt: Date.now(), lines: {} };
          if (!obj.lines[userLine]) obj.lines[userLine] = {};
          obj.lines[userLine][pairKey(codeA, codeB)] = String(chosenLine);
          saveAreaCrossCache(a, obj);
          dbg("cross pair cached", { area: a, userLine, pair: pairKey(codeA, codeB), chosenLine });
        } catch (e) {
        }
      }
      var globalLineOrders = /* @__PURE__ */ new Map();
      function buildGlobalStationsForArea(_0) {
        return __async(this, arguments, function* (a, { force = false } = {}) {
          if (!a) return;
          if (!force) {
            const cached = loadAreaStationsCache(a);
            if (cached) {
              const stations = cached.stations || {};
              for (const [code, v] of Object.entries(stations)) {
                const name = typeof v === "string" ? v : v == null ? void 0 : v.name;
                if (name) {
                  globalStationsByCode.set(String(code), String(name));
                }
              }
              const lines = cached.lines || {};
              for (const [lid, arr] of Object.entries(lines)) {
                if (Array.isArray(arr)) globalLineOrders.set(lid, arr.map(String));
              }
              return;
            }
          }
          try {
            const master = yield fetchAreaMaster(a);
            const lineIds = Object.keys((master == null ? void 0 : master.lines) || {});
            if (!lineIds.length) return;
            const results = yield Promise.allSettled(
              lineIds.map((l) => fetchStations(l).then((data) => ({ lineId: l, data })))
            );
            const toCacheStations = {};
            const toCacheLines = {};
            const toCacheLineStations = {};
            for (const r of results) {
              if (r.status !== "fulfilled") continue;
              const { lineId, data } = r.value;
              const list = Array.isArray(data == null ? void 0 : data.stations) ? data.stations : [];
              const orderCodes = [];
              const perLine = {};
              for (const s of list) {
                const info = (s == null ? void 0 : s.info) || {};
                const code = info == null ? void 0 : info.code;
                const name = info == null ? void 0 : info.name;
                if (code) {
                  const c = String(code);
                  if (name) {
                    const n = String(name);
                    globalStationsByCode.set(c, n);
                    const stopTrains = Array.isArray(info == null ? void 0 : info.stopTrains) ? info.stopTrains.slice() : void 0;
                    const transferLines = extractTransferLinesFromInfo(info);
                    toCacheStations[c] = { name: n, stopTrains };
                    perLine[c] = { name: n, stopTrains, transferLines };
                  }
                  orderCodes.push(c);
                }
              }
              if (lineId && orderCodes.length) {
                globalLineOrders.set(lineId, orderCodes);
                toCacheLines[lineId] = orderCodes;
                toCacheLineStations[lineId] = perLine;
              }
            }
            saveAreaStationsCache(a, { stations: toCacheStations, lines: toCacheLines, lineStations: toCacheLineStations });
          } catch (err) {
            console.warn("\u30A8\u30EA\u30A2\u99C5\u540D\u306E\u69CB\u7BC9\u306B\u5931\u6557", err);
          }
        });
      }
      function warmAreaFromCache(a) {
        const cached = loadAreaStationsCache(a);
        if (!cached) return;
        for (const [code, v] of Object.entries(cached.stations || {})) {
          const name = typeof v === "string" ? v : v == null ? void 0 : v.name;
          if (name) globalStationsByCode.set(String(code), String(name));
        }
        for (const [lid, arr] of Object.entries(cached.lines || {})) {
          if (Array.isArray(arr)) globalLineOrders.set(lid, arr.map(String));
        }
      }
      (function warmAllAreasFromCache() {
        try {
          AREA_LIST.forEach((a) => warmAreaFromCache(a));
        } catch (e) {
        }
      })();
      function fetchAreaMaster(area2) {
        return __async(this, null, function* () {
          const url = `${apiBase()}area_${area2}_master.json`;
          try {
            const res = yield fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return yield res.json();
          } catch (err) {
            const fallbacks = [
              `/assets/data/area_${area2}_master.json`,
              `/area_${area2}_master.json`
            ];
            for (const f of fallbacks) {
              try {
                const r = yield fetch(f, { cache: "no-store" });
                if (r.ok) return yield r.json();
              } catch (e) {
              }
            }
            throw err;
          }
        });
      }
      function fetchStations(line2) {
        return __async(this, null, function* () {
          const url = `${apiBase()}${line2}_st.json`;
          try {
            const res = yield fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return yield res.json();
          } catch (err) {
            const fallbacks = [
              `/assets/data/${line2}_st.json`,
              `/${line2}_st.json`
            ];
            for (const f of fallbacks) {
              try {
                const r = yield fetch(f, { cache: "no-store" });
                if (r.ok) return yield r.json();
              } catch (e) {
              }
            }
            throw err;
          }
        });
      }
      function buildStationIndexes(data) {
        const byCode = /* @__PURE__ */ new Map();
        const list = Array.isArray(data == null ? void 0 : data.stations) ? data.stations : [];
        list.forEach((s, idx) => {
          const info = (s == null ? void 0 : s.info) || {};
          const code = info == null ? void 0 : info.code;
          if (code) {
            byCode.set(String(code), {
              index: idx,
              name: String((info == null ? void 0 : info.name) || ""),
              code: String(code),
              stopTrains: Array.isArray(info == null ? void 0 : info.stopTrains) ? info.stopTrains.slice() : null,
              transferLines: extractTransferLinesFromInfo(info)
            });
          }
        });
        const order = list.map((s) => {
          var _a;
          return String(((_a = s == null ? void 0 : s.info) == null ? void 0 : _a.code) || "");
        });
        return { byCode, order };
      }
      function extractTransferLinesFromInfo(info) {
        const out = /* @__PURE__ */ new Set();
        const arr = Array.isArray(info == null ? void 0 : info.transfer) ? info.transfer : [];
        for (const t of arr) {
          const link = t && t.link;
          const code = t && t.code;
          if (typeof link === "string" && link) out.add(link);
          else if (typeof code === "string" && code) out.add(code);
        }
        return Array.from(out);
      }
      function buildIndexesFromCache(area2, line2) {
        const cached = loadAreaStationsCache(area2);
        if (!cached || !cached.stations) return null;
        let order = cached.lines && cached.lines[line2] || globalLineOrders.get(line2) || null;
        if (!Array.isArray(order) || !order.length) {
          const codes = Object.keys(cached.stations || {});
          if (!codes.length) return null;
          order = codes.sort();
          dbg("cache order fallback", { area: area2, line: line2, count: order.length });
        }
        const byCode = /* @__PURE__ */ new Map();
        order.forEach((code, idx) => {
          const rec = cached.lineStations && cached.lineStations[line2] && cached.lineStations[line2][code] || cached.stations[code] || {};
          const name = (rec == null ? void 0 : rec.name) || globalStationsByCode.get(code) || code;
          const stopTrains = Array.isArray(rec == null ? void 0 : rec.stopTrains) ? rec.stopTrains : [];
          byCode.set(String(code), { index: idx, name: String(name), code: String(code), stopTrains });
        });
        dbg("buildIndexesFromCache OK", { area: area2, line: line2, size: byCode.size });
        return { byCode, order: order.map(String) };
      }
      function populateStationFilter(indexes) {
        const sel = document.getElementById("stationFilter");
        if (!sel) return;
        sel.length = 1;
        for (const code of indexes.order) {
          const st = indexes.byCode.get(code);
          if (!st) continue;
          const opt = document.createElement("option");
          opt.value = st.code;
          opt.textContent = st.name || st.code;
          sel.appendChild(opt);
        }
        const savedStation = getSetting(`lines.${line}.station`, "");
        if (savedStation && Array.from(sel.options).some((o) => o.value === savedStation)) {
          sel.value = savedStation;
        }
        sel.addEventListener("change", () => {
          setSetting(`lines.${line}.station`, sel.value || "");
          try {
            alarmSystem == null ? void 0 : alarmSystem.clearNotified();
          } catch (e) {
          }
          refreshTrains();
        });
        const passSel = document.getElementById("passFilter");
        if (passSel) {
          const savedPass = getSetting(`lines.${line}.pass`, null);
          if (savedPass === "show" || savedPass === "hide") {
            passSel.value = savedPass;
          }
          passSel.addEventListener("change", () => {
            setSetting(`lines.${line}.pass`, passSel.value);
            refreshTrains();
          });
        }
        const refreshBtn = document.getElementById("refreshStationsBtn");
        if (refreshBtn) {
          refreshBtn.addEventListener("click", () => __async(null, null, function* () {
            try {
              refreshBtn.disabled = true;
              const oldText = refreshBtn.textContent;
              refreshBtn.textContent = "\u66F4\u65B0\u4E2D\u2026";
              clearAreaStationsCache(area);
              clearAreaCrossCache(area);
              yield buildGlobalStationsForArea(area, { force: true });
              yield refreshTrains();
              refreshBtn.textContent = oldText;
            } finally {
              refreshBtn.disabled = false;
            }
          }));
        }
      }
      function refreshTrains() {
        return __async(this, null, function* () {
          if (refreshing) return;
          refreshing = true;
          try {
            let indexes = buildIndexesFromCache(area, line);
            if (!indexes) {
              const stations = yield fetchStations(line);
              indexes = buildStationIndexes(stations);
            }
            const trains = yield fetchTrains(line);
            setUpdatedAt(trains == null ? void 0 : trains.update);
            populateStationFilter(indexes);
            renderTrains(indexes, trains, dir);
            try {
              yield updateTrafficInfo(area, line);
            } catch (e) {
            }
          } catch (err) {
            console.error("\u518D\u53D6\u5F97\u306B\u5931\u6557", err);
          } finally {
            refreshing = false;
          }
        });
      }
      var refreshTimer = null;
      var visBound = false;
      function startAutoRefresh() {
        stopAutoRefresh();
        refreshTimer = setInterval(() => {
          refreshTrains();
        }, 1e4);
        if (!visBound) {
          document.addEventListener("visibilitychange", () => {
            if (document.hidden) return;
            refreshTrains();
          });
          visBound = true;
        }
      }
      function stopAutoRefresh() {
        if (refreshTimer) {
          clearInterval(refreshTimer);
          refreshTimer = null;
        }
      }
      function setUpdatedAt(iso) {
        if (!updatedAtEl) return;
        if (!iso) {
          updatedAtEl.textContent = "";
          return;
        }
        updatedAtEl.textContent = formatJST(iso);
      }
      function formatJST(iso) {
        try {
          const dt = new Date(iso);
          if (isNaN(dt.getTime())) return "";
          const parts = new Intl.DateTimeFormat("ja-JP", {
            timeZone: "Asia/Tokyo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
          }).formatToParts(dt);
          const get = (t) => {
            var _a;
            return ((_a = parts.find((p) => p.type === t)) == null ? void 0 : _a.value) || "";
          };
          return `${get("year")}\u5E74${get("month")}\u6708${get("day")}\u65E5 ${get("hour")}\u6642${get("minute")}\u5206${get("second")}\u79D2\u66F4\u65B0`;
        } catch (e) {
          return "";
        }
      }
      function fetchTrains(line2) {
        return __async(this, null, function* () {
          const url = `${apiBase()}${line2}.json`;
          try {
            const res = yield fetch(url, { cache: "no-store" });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return yield res.json();
          } catch (err) {
            const fallbacks = [
              `/assets/data/${line2}.json`,
              `/${line2}.json`
            ];
            for (const f of fallbacks) {
              try {
                const r = yield fetch(f, { cache: "no-store" });
                if (r.ok) return yield r.json();
              } catch (e) {
              }
            }
            throw err;
          }
        });
      }
      function renderTrains(indexes, trainsData, dirParam) {
        var _a, _b, _c, _d;
        const items = Array.isArray(trainsData == null ? void 0 : trainsData.trains) ? trainsData.trains : [];
        const selectedCode = (((_a = document.getElementById("stationFilter")) == null ? void 0 : _a.value) || "").trim();
        const allowedCats = stationAllowedCategories(indexes.byCode.get(selectedCode));
        const passSetting = ((_b = document.getElementById("passFilter")) == null ? void 0 : _b.value) || "hide";
        const enhanced = items.map((t) => normalizeTrain(t)).map((t) => enhanceTrain(t, indexes.byCode));
        const parsed = enhanced.filter((t) => filterByStationSetting(t, allowedCats, passSetting));
        const stationIdx = selectedCode ? (_c = indexes.byCode.get(selectedCode)) == null ? void 0 : _c.index : null;
        const hidePassed = (arr, dir2) => {
          if (stationIdx == null) return arr;
          return arr.filter((t) => {
            if (typeof t.posIndex !== "number") return true;
            if (dir2 === 0) {
              return t.posIndex >= stationIdx;
            } else {
              return t.posIndex <= stationIdx;
            }
          });
        };
        const heading = document.getElementById("trainsHeading");
        if (heading) {
          if (selectedCode) {
            const st = indexes.byCode.get(selectedCode);
            const name = (st == null ? void 0 : st.name) || selectedCode;
            heading.textContent = `\u5217\u8ECA\u4E00\u89A7\uFF08\u99C5\u3067\u7D5E\u308A\u8FBC\u307F: ${name}\uFF09`;
          } else {
            heading.textContent = "\u5217\u8ECA\u4E00\u89A7\uFF08\u7D5E\u308A\u8FBC\u307F\u7121\u3057\uFF09";
          }
        }
        let up = hidePassed(parsed.filter((t) => t.direction === 0).sort((a, b) => a.posIndex - b.posIndex), 0);
        let down = hidePassed(parsed.filter((t) => t.direction === 1).sort((a, b) => b.posIndex - a.posIndex), 1);
        function destIndexForTrain(t) {
          try {
            const d = t && t.dest;
            if (!d) return null;
            let code = null;
            if (typeof d === "object") {
              if (d.code != null) {
                code = String(d.code);
              } else {
                const name = String(d.text || d.name || "").trim();
                if (name) {
                  for (const [c, rec] of indexes.byCode.entries()) {
                    if (String((rec == null ? void 0 : rec.name) || "").trim() === name) {
                      return typeof rec.index === "number" ? rec.index : null;
                    }
                  }
                }
              }
            } else if (typeof d === "string") {
              const name = String(d).trim();
              if (name) {
                for (const [c, rec] of indexes.byCode.entries()) {
                  if (String((rec == null ? void 0 : rec.name) || "").trim() === name) {
                    return typeof rec.index === "number" ? rec.index : null;
                  }
                }
              }
            }
            if (code) {
              const rec = indexes.byCode.get(code);
              return rec && typeof rec.index === "number" ? rec.index : null;
            }
          } catch (e) {
          }
          return null;
        }
        function hideTerminatesBeforeSelected(arr, dir2) {
          if (stationIdx == null) return arr;
          return arr.filter((t) => {
            const di = destIndexForTrain(t);
            if (typeof di !== "number") return true;
            if (dir2 === 0) {
              return di <= stationIdx;
            } else {
              return di >= stationIdx;
            }
          });
        }
        up = hideTerminatesBeforeSelected(up, 0);
        down = hideTerminatesBeforeSelected(down, 1);
        try {
          alarmSystem == null ? void 0 : alarmSystem.setLastShown({ up, down }, selectedCode, indexes);
        } catch (e) {
        }
        try {
          const passSettingNow = ((_d = document.getElementById("passFilter")) == null ? void 0 : _d.value) || "hide";
          if (passSettingNow === "show" && selectedCode) {
            const addExtrasForPass = (list, dir2) => {
              try {
                const prefs = getPrefsForDir(dir2);
                if (!prefs || !prefs.has("pass")) return list;
                const selected = String(selectedCode);
                const base = parsed.filter((t) => t.direction === dir2);
                const extras = base.filter((t) => !t.stopped && (dir2 === 0 ? String(t.nextCode || "") === selected : String(t.atCode || "") === selected));
                if (!extras.length) return list;
                const keyOf = (t) => `${t.no || "?"}:${t.pos || ""}`;
                const seen = new Set(list.map(keyOf));
                for (const t of extras) {
                  const k = keyOf(t);
                  if (!seen.has(k)) {
                    list.push(t);
                    seen.add(k);
                  }
                }
                return list;
              } catch (e) {
                return list;
              }
            };
            up = addExtrasForPass(up, 0);
            down = addExtrasForPass(down, 1);
          }
        } catch (e) {
        }
        try {
          alarmSystem == null ? void 0 : alarmSystem.renderAlarmOptions(indexes, selectedCode, allowedCats, dirParam);
        } catch (e) {
          dbg("alarm render failed", e);
        }
        try {
          const shown = dirParam === "up" ? up : dirParam === "down" ? down : up.concat(down);
          alarmSystem == null ? void 0 : alarmSystem.handleApproachAlarms(indexes, shown, selectedCode, stationIdx, allowedCats, dirParam);
        } catch (e) {
          dbg("alarm check failed", e);
        }
        try {
          const shown = dirParam === "up" ? up : dirParam === "down" ? down : up.concat(down);
          handleDelayAnnouncements(shown, indexes);
        } catch (e) {
          dbg("delay tts failed", e);
        }
        upContainer.parentElement.style.display = "";
        downContainer.parentElement.style.display = "";
        if (dirParam === "up") {
          renderTrainListJP(upContainer, up, indexes);
          downContainer.parentElement.style.display = "none";
          trainsContainer == null ? void 0 : trainsContainer.classList.add("single");
        } else if (dirParam === "down") {
          renderTrainListJP(downContainer, down, indexes);
          upContainer.parentElement.style.display = "none";
          trainsContainer == null ? void 0 : trainsContainer.classList.add("single");
        } else {
          renderTrainListJP(upContainer, up, indexes);
          renderTrainListJP(downContainer, down, indexes);
          trainsContainer == null ? void 0 : trainsContainer.classList.remove("single");
        }
      }
      function renderTrainListJP(container, list, indexes) {
        if (!container) return;
        container.innerHTML = "";
        if (!list.length) {
          container.textContent = "\u8A72\u5F53\u306A\u3057";
          return;
        }
        const table = document.createElement("table");
        table.className = "train-table";
        const colgroup = document.createElement("colgroup");
        for (let i = 0; i < 7; i++) {
          colgroup.appendChild(document.createElement("col"));
        }
        table.appendChild(colgroup);
        const thead = document.createElement("thead");
        thead.innerHTML = "<tr><th>\u5217\u756A</th><th>\u7A2E\u5225</th><th>\u611B\u79F0</th><th>\u4E21\u6570</th><th>\u884C\u5148</th><th>\u4F4D\u7F6E</th><th>\u9045\u5EF6</th></tr>";
        table.appendChild(thead);
        const tbody = document.createElement("tbody");
        for (const t of list) {
          const tr = document.createElement("tr");
          const threshold = getDelayThreshold();
          const delayText = typeof t.delayMinutes === "number" && t.delayMinutes > 0 ? t.delayMinutes >= threshold ? `<span class="delay-bad" style="color:var(--color-danger,#c00);font-weight:700;">${t.delayMinutes}\u5206</span>` : `${t.delayMinutes}\u5206` : "";
          const typeLabel = (t.displayType || "").trim();
          const __mapCls = configuredTypeTextClass(typeLabel);
          const __cat = trainCategoryFromDisplayType(t.displayType);
          const __cls = __mapCls || typeTextClass(__cat);
          const TYPE_HTML = __cls ? `<span class="${__cls}">${escapeHtml(typeLabel)}</span>` : `${escapeHtml(typeLabel)}`;
          const posPart = t.stopped ? `${escapeHtml(t.atName || "")}` : (() => {
            const from = t.direction === 0 ? t.nextName : t.atName;
            const to = t.direction === 0 ? t.atName : t.nextName;
            return `${escapeHtml(from || "")} \u2192 ${escapeHtml(to || "")}`;
          })();
          const destText = escapeHtml(getDestText(t, indexes, "dest"));
          let carsText = t.numberOfCars != null ? escapeHtml(String(t.numberOfCars)) : "";
          try {
            const th = getCarsThreshold();
            const n = Number(t.numberOfCars);
            if (Number.isFinite(n) && n >= th) {
              carsText = `<span class="cars-emph">${carsText}</span>`;
            }
          } catch (e) {
          }
          tr.innerHTML = `
      <td>${escapeHtml(t.no || "")}</td>
      <td>${TYPE_HTML}</td>
      <td>${escapeHtml(getNickname(t))}</td>
      <td>${carsText}</td>
      <td>${destText}</td>
      <td>${posPart}</td>
      <td>${delayText}</td>
    `;
          tbody.appendChild(tr);
        }
        table.appendChild(tbody);
        container.appendChild(table);
      }
      function filterByStationSetting(train, allowed, passSetting) {
        if (!allowed) return true;
        const cat = trainCategoryFromDisplayType(train.displayType);
        const stopsHere = cat !== -1 && allowed.has(cat) || cat === -1;
        if (passSetting === "show") return true;
        return stopsHere;
      }
      function enhanceTrain(t, byCode) {
        const { atCode, nextCode, stopped } = parsePos(t.pos);
        const a = byCode.get(atCode);
        const b = nextCode ? byCode.get(nextCode) : null;
        let posIndex = a ? a.index : 0;
        if (!stopped && a && b) {
          posIndex = (a.index + b.index) / 2;
        }
        const atName = (a == null ? void 0 : a.name) || getStationNameByPriority(atCode, { byCode }, "pos.at", nextCode) || atCode || "";
        const nextName = (b == null ? void 0 : b.name) || (nextCode ? getStationNameByPriority(nextCode, { byCode }, "pos.next", atCode) || nextCode : "") || "";
        return __spreadProps(__spreadValues({}, t), {
          atCode,
          nextCode,
          stopped,
          posIndex,
          atName,
          nextName
        });
      }
      function parsePos(pos) {
        const [left, right] = String(pos || "").split("_");
        if (right === "####" || !right) {
          return { atCode: left, nextCode: null, stopped: true };
        }
        return { atCode: left, nextCode: right, stopped: false };
      }
      function escapeHtml(str) {
        return String(str || "").replace(/[&<>\"]/g, (s) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[s]);
      }
      function getDestText(t, indexes, tag) {
        const d = t && t.dest;
        if (d == null) return "";
        if (typeof d === "string") return d;
        if (typeof d === "object") {
          const code = d.code != null ? String(d.code) : "";
          const text = d.text || d.name || "";
          if (text && String(text).trim()) return String(text);
          if (code) {
            const name = getStationNameByPriority(code, indexes, tag || "dest");
            if (name) return name;
            return code;
          }
          return "";
        }
        return String(d);
      }
      function getStationNameByPriority(code, indexes, tag, neighborCode) {
        var _a;
        const c = String(code);
        if (indexes && indexes.byCode && indexes.byCode.has(c)) {
          const hit = String(((_a = indexes.byCode.get(c)) == null ? void 0 : _a.name) || "");
          dbg("station hit [line]", { tag, line, area, code: c, name: hit });
          return hit;
        }
        const areaObj = loadAreaStationsCache(area);
        if (areaObj) {
          const ls = areaObj.lineStations && areaObj.lineStations[line];
          if (ls && ls[c]) {
            const v = ls[c];
            const hit = typeof v === "string" ? v : String((v == null ? void 0 : v.name) || "");
            dbg("station hit [area-line]", { tag, line, area, code: c, name: hit });
            return hit;
          }
          if (neighborCode) {
            const neighbor = String(neighborCode);
            const linesMap = areaObj.lineStations || {};
            const orders = areaObj.lines || {};
            const pref = getCrossPreferredLine(area, line, c, neighbor);
            if (pref && linesMap[pref]) {
              const perLineP = linesMap[pref] || {};
              const orderP = orders[pref] || [];
              if (perLineP[c] && Array.isArray(orderP) && orderP.includes(neighbor)) {
                const vP = perLineP[c];
                const hit = typeof vP === "string" ? vP : String((vP == null ? void 0 : vP.name) || "");
                dbg("station hit [area-line-crosscache]", { tag, area, lineId: pref, code: c, neighbor, name: hit });
                return hit;
              }
            }
            const neighborRec = linesMap[line] && linesMap[line][neighbor] || null;
            const tLines = Array.isArray(neighborRec == null ? void 0 : neighborRec.transferLines) ? neighborRec.transferLines : [];
            for (const tl of tLines) {
              const order = orders[tl] || [];
              if (Array.isArray(order) && order.includes(neighbor)) {
                const perLine2 = linesMap[tl] || {};
                const v2 = perLine2[c];
                if (v2) {
                  const hit = typeof v2 === "string" ? v2 : String((v2 == null ? void 0 : v2.name) || "");
                  dbg("station hit [area-line-transfer]", { tag, area, lineId: tl, neighbor, code: c, name: hit });
                  setCrossPreferredLine(area, line, c, neighbor, tl);
                  return hit;
                }
              }
            }
            for (const lid of Object.keys(linesMap)) {
              const perLine = linesMap[lid] || {};
              const order = orders[lid] || [];
              if (perLine[c] && Array.isArray(order) && order.includes(neighbor)) {
                const v = perLine[c];
                const hit = typeof v === "string" ? v : String((v == null ? void 0 : v.name) || "");
                dbg("station hit [area-line-neighbor]", { tag, area, lineId: lid, code: c, neighbor, name: hit });
                setCrossPreferredLine(area, line, c, neighbor, lid);
                return hit;
              }
            }
          }
          if (areaObj.stations && areaObj.stations[c]) {
            const v = areaObj.stations[c];
            const hit = typeof v === "string" ? v : String((v == null ? void 0 : v.name) || "");
            dbg("station hit [area-flat]", { tag, area, code: c, name: hit });
            return hit;
          }
        }
        for (const a of AREA_LIST) {
          const obj = loadAreaStationsCache(a);
          if (!obj) continue;
          const lso = obj.lineStations;
          if (lso) {
            const orders = obj.lines || {};
            if (neighborCode) {
              const neighbor = String(neighborCode);
              for (const lid of Object.keys(lso)) {
                const perLine = lso[lid] || {};
                const order = orders[lid] || [];
                if (perLine[c] && Array.isArray(order) && order.includes(neighbor)) {
                  const v = perLine[c];
                  const hit = typeof v === "string" ? v : String((v == null ? void 0 : v.name) || "");
                  dbg("station hit [other-area-line-neighbor]", { tag, area: a, lineId: lid, code: c, neighbor, name: hit });
                  return hit;
                }
              }
            }
            for (const lid of Object.keys(lso)) {
              const v = lso[lid] && lso[lid][c];
              if (v) {
                const hit = typeof v === "string" ? v : String((v == null ? void 0 : v.name) || "");
                dbg("station hit [other-area-line]", { tag, area: a, lineId: lid, code: c, name: hit });
                return hit;
              }
            }
          }
          if (obj.stations && obj.stations[c]) {
            const v = obj.stations[c];
            const hit = typeof v === "string" ? v : String((v == null ? void 0 : v.name) || "");
            dbg("station hit [other-area-flat]", { tag, area: a, code: c, name: hit });
            return hit;
          }
        }
        if (globalStationsByCode.has(c)) {
          const hit = String(globalStationsByCode.get(c));
          dbg("station hit [global]", { tag, code: c, name: hit });
          return hit;
        }
        warn("station miss", { tag, line, area, code: c });
        return "";
      }
      function clearAreaStationsCache(a) {
        try {
          localStorage.removeItem(areaCacheKey(a));
        } catch (e) {
        }
      }
      function clearAreaCrossCache(a) {
        try {
          localStorage.removeItem(areaCrossKey(a));
        } catch (e) {
        }
      }
      var SETTINGS_ROOT_KEY = "tid:v1:settings";
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
          for (const s of segs) {
            if (!cur || typeof cur !== "object") return void 0;
            cur = cur[s];
          }
          return cur;
        } catch (e) {
          return void 0;
        }
      }
      function setPath(obj, path, val) {
        try {
          const segs = String(path || "").split(".");
          let cur = obj;
          for (let i = 0; i < segs.length - 1; i++) {
            const k = segs[i];
            if (!cur[k] || typeof cur[k] !== "object") cur[k] = {};
            cur = cur[k];
          }
          cur[segs[segs.length - 1]] = val;
        } catch (e) {
        }
      }
      function getSetting(path, fallback) {
        const root = loadSettingsRoot();
        const v = getPath(root, path);
        return v === void 0 ? fallback : v;
      }
      function setSetting(path, val) {
        const root = loadSettingsRoot();
        setPath(root, path, val);
        saveSettingsRoot(root);
      }
      function ensureLineConfig(lineId) {
        const root = loadSettingsRoot();
        if (!root.lines) root.lines = {};
        if (!root.lines[lineId]) root.lines[lineId] = {};
        saveSettingsRoot(root);
        return root.lines[lineId];
      }
      function getLineConfig(lineId) {
        const root = loadSettingsRoot();
        return root.lines && root.lines[lineId] || {};
      }
      function migrateLegacySettings() {
        try {
          const root = loadSettingsRoot();
          const open = localStorage.getItem("tid:settings:open");
          if (open != null) {
            setPath(root, "ui.settingsOpen", open);
            try {
              localStorage.removeItem("tid:settings:open");
            } catch (e) {
            }
          }
          const aud = localStorage.getItem("tid:audio:unlocked");
          if (aud != null) {
            setPath(root, "ui.audioUnlocked", aud);
            try {
              localStorage.removeItem("tid:audio:unlocked");
            } catch (e) {
            }
          }
          const v = localStorage.getItem("tid:tts:voice");
          if (v != null) {
            setPath(root, "tts.voice", v);
            try {
              localStorage.removeItem("tid:tts:voice");
            } catch (e) {
            }
          }
          const th = localStorage.getItem("tid:delay:threshold");
          if (th != null) {
            setPath(root, "delay.threshold", Number(th));
            try {
              localStorage.removeItem("tid:delay:threshold");
            } catch (e) {
            }
          }
          const bg = localStorage.getItem("tid:bgnotify");
          if (bg != null) {
            setPath(root, "bg.notify", bg);
          }
          const wl = localStorage.getItem("tid:wakelock");
          if (wl != null) {
            setPath(root, "bg.wakelock", wl);
            try {
              localStorage.removeItem("tid:wakelock");
            } catch (e) {
            }
          }
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (!k) continue;
              const mStation = k.match(/^tid:station:(.+)$/);
              if (mStation) {
                const lineId = mStation[1];
                const val = localStorage.getItem(k) || "";
                if (val) {
                  ensureLineConfig(lineId);
                  setSetting(`lines.${lineId}.station`, val);
                }
                continue;
              }
              const mPass = k.match(/^tid:pass:(.+)$/);
              if (mPass) {
                const lineId = mPass[1];
                const val = localStorage.getItem(k) || "";
                if (val) {
                  ensureLineConfig(lineId);
                  setSetting(`lines.${lineId}.pass`, val);
                }
                continue;
              }
            }
          } catch (e) {
          }
          try {
            for (let i = 0; i < localStorage.length; i++) {
              const k = localStorage.key(i);
              if (!k) continue;
              let m;
              m = k.match(/^tid:alarm:disable:([^:]+):([^:]+):(up|down)$/);
              if (m) {
                const [_, lineId, st, dir2] = m;
                const val = localStorage.getItem(k) === "1";
                setSetting(`lines.${lineId}.alarms.${st}.${dir2}.disabled`, val);
                continue;
              }
              m = k.match(/^tid:alarm:([^:]+):([^:]+):(up|down)$/);
              if (m) {
                const [_, lineId, st, dir2] = m;
                try {
                  const arr = JSON.parse(localStorage.getItem(k) || "[]");
                  if (Array.isArray(arr)) setSetting(`lines.${lineId}.alarms.${st}.${dir2}.prefs`, arr);
                } catch (e) {
                }
                continue;
              }
              m = k.match(/^tid:alarm:target:([^:]+):([^:]+):(up|down)$/);
              if (m) {
                const [_, lineId, st, dir2] = m;
                try {
                  const obj = JSON.parse(localStorage.getItem(k) || "{}");
                  if (obj && typeof obj === "object") setSetting(`lines.${lineId}.alarms.${st}.${dir2}.targets`, obj);
                } catch (e) {
                }
                continue;
              }
            }
          } catch (e) {
          }
          saveSettingsRoot(root);
        } catch (e) {
        }
      }
      function initDebugPanel() {
        const panel = document.createElement("div");
        panel.id = "tidDebugPanel";
        panel.style.cssText = `
    position: fixed; bottom: 10px; right: 10px; width: 400px; max-height: 500px;
    overflow-y: auto; background: rgba(0,0,0,0.9); color: #0f0;
    font-family: monospace; font-size: 11px; padding: 10px;
    border: 2px solid #0f0; z-index: 9999; border-radius: 5px;
  `;
        const title = document.createElement("div");
        title.textContent = "\u{1F41B} TID Debug Panel";
        title.style.cssText = "font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #ff0;";
        panel.appendChild(title);
        const logContainer = document.createElement("div");
        logContainer.id = "tidDebugLog";
        panel.appendChild(logContainer);
        document.body.appendChild(panel);
        const originalDbg = window.dbg || dbg;
        window.dbg = function(...args) {
          originalDbg.apply(this, args);
          try {
            const logEl = document.getElementById("tidDebugLog");
            if (!logEl) return;
            const entry = document.createElement("div");
            entry.style.cssText = "margin: 3px 0; padding: 3px; border-bottom: 1px solid #333;";
            const timestamp = (/* @__PURE__ */ new Date()).toLocaleTimeString("ja-JP");
            entry.textContent = `[${timestamp}] ${JSON.stringify(args)}`;
            const msg = args.join(" ");
            if (msg.includes("ALARM_TRIGGER")) entry.style.color = "#0f0";
            else if (msg.includes("ALARM_SKIP") || msg.includes("ALARM_NO")) entry.style.color = "#f80";
            else if (msg.includes("ALARM_QUEUED")) entry.style.color = "#0ff";
            else if (msg.includes("ALARM_PREFS")) entry.style.color = "#ff0";
            logEl.appendChild(entry);
            if (logEl.children.length > 100) logEl.removeChild(logEl.firstChild);
            logEl.scrollTop = logEl.scrollHeight;
          } catch (e) {
          }
        };
      }
      if (TID_DEBUG) {
        window.tidTestAlarm = function(trainNo, direction, targetCode) {
          console.log("[TID][TEST] Simulating alarm", trainNo, direction, targetCode);
          const dir2 = direction === "up" ? 0 : 1;
          const key = `${trainNo}:${dir2}:${targetCode}`;
          const msg = `\u30C6\u30B9\u30C8: ${trainNo}\u53F7\u3001${direction}\u3001${targetCode}\u99C5\u63A5\u8FD1`;
          const meta = {
            area,
            line,
            dir: direction,
            direction: dir2,
            trainNo,
            atCode: targetCode,
            nextCode: "",
            targetCode,
            stopped: true,
            displayType: "\u5FEB\u901F",
            nickname: "\u30C6\u30B9\u30C8\u5217\u8ECA",
            delay: 0,
            dest: "\u30C6\u30B9\u30C8\u884C\u304D",
            triggerReason: "manual-test"
          };
          alarmSystem == null ? void 0 : alarmSystem.notifyOnce(direction, key, msg, () => {
          }, meta);
        };
        console.log("[TID][DEBUG] Test function: tidTestAlarm(trainNo, direction, targetCode)");
      }
    }
  });

  // assets/js/pwa.js
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
  function subscribePush(reg) {
    return __async(this, null, function* () {
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
        try {
          yield fetch(subscribeUrl, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(sub) });
        } catch (e) {
        }
        return sub;
      } catch (err) {
        console.warn("[PWA] push subscribe failed", err);
        return null;
      }
    });
  }
  (function init() {
    return __async(this, null, function* () {
      const reg = yield registerServiceWorker();
      if (!reg) return;
      try {
        const bg = localStorage.getItem("tid:bgnotify") === "1";
        if (!bg) return;
      } catch (e) {
      }
      if ("Notification" in window && Notification.permission === "granted") {
        try {
          yield subscribePush(reg);
        } catch (e) {
        }
      }
    });
  })();

  // assets/js/legacy-entry-tid.js
  var import_tid = __toESM(require_tid());
})();
