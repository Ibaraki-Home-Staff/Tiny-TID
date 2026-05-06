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
  function isBgNotifyEnabled(getSetting2) {
    try {
      const v = getSetting2 ? getSetting2("bg.notify", null) : null;
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
  function notifyIfBackground(message, tag, { getSetting: getSetting2, dbg } = {}) {
    try {
      if (!document.hidden) return;
      const _get = typeof getSetting2 === "function" ? getSetting2 : () => null;
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
      getSetting: getSetting2,
      setSetting: setSetting2,
      getLineConfig: getLineConfig2,
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
      buildAlarmMessage,
      notifyIfBackground: notifyIfBackground2,
      playAlarmSound,
      playBeep,
      bindAudioUnlockOnce,
      getAudioUnlocked
    } = deps || {};
    const alarmNotified = { up: /* @__PURE__ */ new Set(), down: /* @__PURE__ */ new Set() };
    const pendingAudioQueue = [];
    const pendingAudioKeys = /* @__PURE__ */ new Set();
    const alarmPlayQueue = [];
    const alarmQueueKeys = /* @__PURE__ */ new Set();
    let alarmPlaying = false;
    let upScopeBound = false;
    let downScopeBound = false;
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
        const cfg = getLineConfig2 ? getLineConfig2(line) : null;
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
        if (setSetting2) setSetting2(`lines.${line}.alarms.${stKey}.${dirKey}.prefs`, arr);
      } catch (e) {
      }
    }
    function readAlarmDisable(dir, st) {
      try {
        const stKey = String(st || "_none");
        const dirKey = dir === 0 || dir === "up" ? "up" : dir === 1 || dir === "down" ? "down" : String(dir || "up");
        const v = getSetting2 ? getSetting2(`lines.${line}.alarms.${stKey}.${dirKey}.disabled`, void 0) : void 0;
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
        if (setSetting2) setSetting2(`lines.${line}.alarms.${stKey}.${dirKey}.disabled`, !!v);
      } catch (e) {
      }
    }
    function readAlarmTargets(dir, st) {
      try {
        const stKey = String(st || "_none");
        const dirKey = dir === 0 || dir === "up" ? "up" : dir === 1 || dir === "down" ? "down" : String(dir || "up");
        const obj = getSetting2 ? getSetting2(`lines.${line}.alarms.${stKey}.${dirKey}.targets`, {}) : {};
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
        if (setSetting2) setSetting2(`lines.${line}.alarms.${stKey}.${dirKey}.targets`, obj);
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
      var _a, _b;
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
      if (!upScopeBound) {
        (_a = document.getElementById("alarmUpBox")) == null ? void 0 : _a.addEventListener("change", () => {
          const boxes = Array.from(document.querySelectorAll("[data-alarm-up]"));
          const vals = new Set(boxes.filter((box) => box.checked).map((box) => box.value));
          saveAlarmPrefs("up", vals, selectedStationCode());
        });
        upScopeBound = true;
      }
      if (!downScopeBound) {
        (_b = document.getElementById("alarmDownBox")) == null ? void 0 : _b.addEventListener("change", () => {
          const boxes = Array.from(document.querySelectorAll("[data-alarm-down]"));
          const vals = new Set(boxes.filter((box) => box.checked).map((box) => box.value));
          saveAlarmPrefs("down", vals, selectedStationCode());
        });
        downScopeBound = true;
      }
    }
    function renderAlarmOptions(indexes, selectedCode, allowedCats, dirParam) {
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
      const upDisable = document.getElementById("alarmUpDisable");
      const downDisable = document.getElementById("alarmDownDisable");
      if (upDisable) upDisable.checked = readAlarmDisable("up", selectedCode);
      if (downDisable) downDisable.checked = readAlarmDisable("down", selectedCode);
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
        var _a;
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
            var _a2;
            const o = document.createElement("option");
            o.value = code;
            o.textContent = ((_a2 = indexes.byCode.get(String(code))) == null ? void 0 : _a2.name) || String(code);
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
        const passSetting = ((_a = document.getElementById("passFilter")) == null ? void 0 : _a.value) || "hide";
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
      setDisabledForDir("up", readAlarmDisable("up", selectedCode));
      setDisabledForDir("down", readAlarmDisable("down", selectedCode));
    }
    function getPrefsForDir(dir) {
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
    function hasPassAlarmForDirection(dir) {
      return getPrefsForDir(dir).has("pass");
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
        const prefs = getPrefsForDir(dir);
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
                const msg = buildAlarmMessage ? buildAlarmMessage(t, targetCode, indexes) : "";
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
                const msg = buildAlarmMessage ? buildAlarmMessage(t, targetCode, indexes) : "";
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
      hasPassAlarmForDirection,
      isPlaying
    };
  }
  var init_tid_alarm = __esm({
    "assets/js/tid-alarm.js"() {
    }
  });

  // assets/js/tid-data.js
  function apiBase() {
    return window.TID_API_BASE && String(window.TID_API_BASE) || "/api/v3/";
  }
  function areaCacheKey(area) {
    return `tid:areaStations:${area}`;
  }
  function areaCrossKey(area) {
    return `tid:cross:${area}`;
  }
  function fetchJsonWithFallbacks(_0) {
    return __async(this, arguments, function* (url, fallbacks = []) {
      try {
        const response = yield fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return yield response.json();
      } catch (error) {
        for (const fallback of fallbacks) {
          try {
            const response = yield fetch(fallback, { cache: "no-store" });
            if (response.ok) return yield response.json();
          } catch (e) {
          }
        }
        throw error;
      }
    });
  }
  function fetchAreaMaster(area) {
    return __async(this, null, function* () {
      return yield fetchJsonWithFallbacks(
        `${apiBase()}area_${area}_master.json`,
        [
          `/assets/data/area_${area}_master.json`,
          `/area_${area}_master.json`
        ]
      );
    });
  }
  function fetchStations(line) {
    return __async(this, null, function* () {
      return yield fetchJsonWithFallbacks(
        `${apiBase()}${line}_st.json`,
        [
          `/assets/data/${line}_st.json`,
          `/${line}_st.json`
        ]
      );
    });
  }
  function fetchTrains(line) {
    return __async(this, null, function* () {
      return yield fetchJsonWithFallbacks(
        `${apiBase()}${line}.json`,
        [
          `/assets/data/${line}.json`,
          `/${line}.json`
        ]
      );
    });
  }
  function fetchTrafficInfo(area) {
    return __async(this, null, function* () {
      return yield fetchJsonWithFallbacks(
        `${apiBase()}area_${area}_trafficinfo.json`,
        [
          `/assets/data/area_${area}_trafficinfo.json`,
          `/area_${area}_trafficinfo.json`
        ]
      );
    });
  }
  function loadAreaStationsCache(area) {
    try {
      const raw = localStorage.getItem(areaCacheKey(area));
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
  function saveAreaStationsCache(area, data) {
    try {
      localStorage.setItem(areaCacheKey(area), JSON.stringify({
        updatedAt: Date.now(),
        stations: data.stations || {},
        lines: data.lines || {},
        lineStations: data.lineStations || {}
      }));
    } catch (e) {
    }
  }
  function loadAreaCrossCache(area) {
    try {
      const raw = localStorage.getItem(areaCrossKey(area));
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
  function saveAreaCrossCache(area, data) {
    try {
      localStorage.setItem(areaCrossKey(area), JSON.stringify({
        updatedAt: Date.now(),
        lines: data.lines || {}
      }));
    } catch (e) {
    }
  }
  function pairKey(left, right) {
    const a = String(left);
    const b = String(right);
    return a < b ? `${a}_${b}` : `${b}_${a}`;
  }
  function getCrossPreferredLine(area, userLine, codeA, codeB) {
    const cache = loadAreaCrossCache(area);
    if (!cache || !cache.lines) return null;
    const table = cache.lines[userLine];
    if (!table) return null;
    return table[pairKey(codeA, codeB)] || null;
  }
  function setCrossPreferredLine(area, userLine, codeA, codeB, chosenLine, dbg) {
    try {
      const cache = loadAreaCrossCache(area) || { updatedAt: Date.now(), lines: {} };
      if (!cache.lines[userLine]) cache.lines[userLine] = {};
      cache.lines[userLine][pairKey(codeA, codeB)] = String(chosenLine);
      saveAreaCrossCache(area, cache);
      dbg == null ? void 0 : dbg("cross pair cached", { area, userLine, pair: pairKey(codeA, codeB), chosenLine });
    } catch (e) {
    }
  }
  function extractTransferLinesFromInfo(info) {
    const out = /* @__PURE__ */ new Set();
    const transfers = Array.isArray(info == null ? void 0 : info.transfer) ? info.transfer : [];
    for (const transfer of transfers) {
      const link = transfer && transfer.link;
      const code = transfer && transfer.code;
      if (typeof link === "string" && link) out.add(link);
      else if (typeof code === "string" && code) out.add(code);
    }
    return Array.from(out);
  }
  function buildStationIndexes(data) {
    const byCode = /* @__PURE__ */ new Map();
    const list = Array.isArray(data == null ? void 0 : data.stations) ? data.stations : [];
    list.forEach((station, index) => {
      const info = (station == null ? void 0 : station.info) || {};
      const code = info == null ? void 0 : info.code;
      if (!code) return;
      byCode.set(String(code), {
        index,
        name: String((info == null ? void 0 : info.name) || ""),
        code: String(code),
        stopTrains: Array.isArray(info == null ? void 0 : info.stopTrains) ? info.stopTrains.slice() : null,
        transferLines: extractTransferLinesFromInfo(info)
      });
    });
    return {
      byCode,
      order: list.map((station) => {
        var _a;
        return String(((_a = station == null ? void 0 : station.info) == null ? void 0 : _a.code) || "");
      })
    };
  }
  function buildIndexesFromCache(area, line, { dbg } = {}) {
    const cached = loadAreaStationsCache(area);
    if (!cached || !cached.stations) return null;
    let order = cached.lines && cached.lines[line] || globalLineOrders.get(line) || null;
    if (!Array.isArray(order) || !order.length) {
      const codes = Object.keys(cached.stations || {});
      if (!codes.length) return null;
      order = codes.sort();
      dbg == null ? void 0 : dbg("cache order fallback", { area, line, count: order.length });
    }
    const byCode = /* @__PURE__ */ new Map();
    order.forEach((code, index) => {
      const record = cached.lineStations && cached.lineStations[line] && cached.lineStations[line][code] || cached.stations[code] || {};
      const name = (record == null ? void 0 : record.name) || globalStationsByCode.get(code) || code;
      const stopTrains = Array.isArray(record == null ? void 0 : record.stopTrains) ? record.stopTrains : [];
      byCode.set(String(code), {
        index,
        name: String(name),
        code: String(code),
        stopTrains
      });
    });
    dbg == null ? void 0 : dbg("buildIndexesFromCache OK", { area, line, size: byCode.size });
    return { byCode, order: order.map(String) };
  }
  function warmAreaFromCache(area) {
    const cached = loadAreaStationsCache(area);
    if (!cached) return;
    for (const [code, value] of Object.entries(cached.stations || {})) {
      const name = typeof value === "string" ? value : value == null ? void 0 : value.name;
      if (name) globalStationsByCode.set(String(code), String(name));
    }
    for (const [lineId, order] of Object.entries(cached.lines || {})) {
      if (Array.isArray(order)) globalLineOrders.set(lineId, order.map(String));
    }
  }
  function buildGlobalStationsForArea(_0) {
    return __async(this, arguments, function* (area, { force = false, dbg } = {}) {
      if (!area) return;
      if (!force) {
        const cached = loadAreaStationsCache(area);
        if (cached) {
          for (const [code, value] of Object.entries(cached.stations || {})) {
            const name = typeof value === "string" ? value : value == null ? void 0 : value.name;
            if (name) globalStationsByCode.set(String(code), String(name));
          }
          for (const [lineId, order] of Object.entries(cached.lines || {})) {
            if (Array.isArray(order)) globalLineOrders.set(lineId, order.map(String));
          }
          return;
        }
      }
      try {
        const master = yield fetchAreaMaster(area);
        const lineIds = Object.keys((master == null ? void 0 : master.lines) || {});
        if (!lineIds.length) return;
        const results = yield Promise.allSettled(
          lineIds.map((lineId) => fetchStations(lineId).then((data) => ({ lineId, data })))
        );
        const stationsToCache = {};
        const linesToCache = {};
        const lineStationsToCache = {};
        for (const result of results) {
          if (result.status !== "fulfilled") continue;
          const { lineId, data } = result.value;
          const stations = Array.isArray(data == null ? void 0 : data.stations) ? data.stations : [];
          const orderCodes = [];
          const perLineStations = {};
          for (const station of stations) {
            const info = (station == null ? void 0 : station.info) || {};
            const code = info == null ? void 0 : info.code;
            const name = info == null ? void 0 : info.name;
            if (!code) continue;
            const stationCode = String(code);
            orderCodes.push(stationCode);
            if (!name) continue;
            const stationName = String(name);
            const stopTrains = Array.isArray(info == null ? void 0 : info.stopTrains) ? info.stopTrains.slice() : void 0;
            const transferLines = extractTransferLinesFromInfo(info);
            globalStationsByCode.set(stationCode, stationName);
            stationsToCache[stationCode] = { name: stationName, stopTrains };
            perLineStations[stationCode] = { name: stationName, stopTrains, transferLines };
          }
          if (orderCodes.length) {
            globalLineOrders.set(lineId, orderCodes);
            linesToCache[lineId] = orderCodes;
            lineStationsToCache[lineId] = perLineStations;
          }
        }
        saveAreaStationsCache(area, {
          stations: stationsToCache,
          lines: linesToCache,
          lineStations: lineStationsToCache
        });
      } catch (error) {
        console.warn("\u30A8\u30EA\u30A2\u99C5\u540D\u306E\u69CB\u7BC9\u306B\u5931\u6557", error);
        dbg == null ? void 0 : dbg("buildGlobalStationsForArea failed", error);
      }
    });
  }
  function getStationNameByPriority(code, indexes, { area, line, dbg, warn, neighborCode } = {}) {
    var _a;
    const stationCode = String(code);
    if (indexes && indexes.byCode && indexes.byCode.has(stationCode)) {
      const hit = String(((_a = indexes.byCode.get(stationCode)) == null ? void 0 : _a.name) || "");
      dbg == null ? void 0 : dbg("station hit [line]", { line, area, code: stationCode, name: hit });
      return hit;
    }
    const areaObj = loadAreaStationsCache(area);
    if (areaObj) {
      const lineStations = areaObj.lineStations && areaObj.lineStations[line];
      if (lineStations && lineStations[stationCode]) {
        const value = lineStations[stationCode];
        const hit = typeof value === "string" ? value : String((value == null ? void 0 : value.name) || "");
        dbg == null ? void 0 : dbg("station hit [area-line]", { line, area, code: stationCode, name: hit });
        return hit;
      }
      if (neighborCode) {
        const neighbor = String(neighborCode);
        const linesMap = areaObj.lineStations || {};
        const orders = areaObj.lines || {};
        const preferredLine = getCrossPreferredLine(area, line, stationCode, neighbor);
        if (preferredLine && linesMap[preferredLine]) {
          const preferredStations = linesMap[preferredLine] || {};
          const preferredOrder = orders[preferredLine] || [];
          if (preferredStations[stationCode] && Array.isArray(preferredOrder) && preferredOrder.includes(neighbor)) {
            const value = preferredStations[stationCode];
            const hit = typeof value === "string" ? value : String((value == null ? void 0 : value.name) || "");
            dbg == null ? void 0 : dbg("station hit [area-line-crosscache]", { area, lineId: preferredLine, code: stationCode, neighbor, name: hit });
            return hit;
          }
        }
        const neighborRecord = linesMap[line] && linesMap[line][neighbor] || null;
        const transferLines = Array.isArray(neighborRecord == null ? void 0 : neighborRecord.transferLines) ? neighborRecord.transferLines : [];
        for (const transferLine of transferLines) {
          const order = orders[transferLine] || [];
          if (Array.isArray(order) && order.includes(neighbor)) {
            const perLine = linesMap[transferLine] || {};
            const value = perLine[stationCode];
            if (value) {
              const hit = typeof value === "string" ? value : String((value == null ? void 0 : value.name) || "");
              dbg == null ? void 0 : dbg("station hit [area-line-transfer]", { area, lineId: transferLine, neighbor, code: stationCode, name: hit });
              setCrossPreferredLine(area, line, stationCode, neighbor, transferLine, dbg);
              return hit;
            }
          }
        }
        for (const lineId of Object.keys(linesMap)) {
          const perLine = linesMap[lineId] || {};
          const order = orders[lineId] || [];
          if (perLine[stationCode] && Array.isArray(order) && order.includes(neighbor)) {
            const value = perLine[stationCode];
            const hit = typeof value === "string" ? value : String((value == null ? void 0 : value.name) || "");
            dbg == null ? void 0 : dbg("station hit [area-line-neighbor]", { area, lineId, code: stationCode, neighbor, name: hit });
            setCrossPreferredLine(area, line, stationCode, neighbor, lineId, dbg);
            return hit;
          }
        }
      }
      if (areaObj.stations && areaObj.stations[stationCode]) {
        const value = areaObj.stations[stationCode];
        const hit = typeof value === "string" ? value : String((value == null ? void 0 : value.name) || "");
        dbg == null ? void 0 : dbg("station hit [area-flat]", { area, code: stationCode, name: hit });
        return hit;
      }
    }
    for (const otherArea of AREA_LIST) {
      const otherCache = loadAreaStationsCache(otherArea);
      if (!otherCache) continue;
      const lineStations = otherCache.lineStations;
      if (lineStations) {
        const orders = otherCache.lines || {};
        if (neighborCode) {
          const neighbor = String(neighborCode);
          for (const lineId of Object.keys(lineStations)) {
            const perLine = lineStations[lineId] || {};
            const order = orders[lineId] || [];
            if (perLine[stationCode] && Array.isArray(order) && order.includes(neighbor)) {
              const value = perLine[stationCode];
              const hit = typeof value === "string" ? value : String((value == null ? void 0 : value.name) || "");
              dbg == null ? void 0 : dbg("station hit [other-area-line-neighbor]", { area: otherArea, lineId, code: stationCode, neighbor, name: hit });
              return hit;
            }
          }
        }
        for (const lineId of Object.keys(lineStations)) {
          const value = lineStations[lineId] && lineStations[lineId][stationCode];
          if (!value) continue;
          const hit = typeof value === "string" ? value : String((value == null ? void 0 : value.name) || "");
          dbg == null ? void 0 : dbg("station hit [other-area-line]", { area: otherArea, lineId, code: stationCode, name: hit });
          return hit;
        }
      }
      if (otherCache.stations && otherCache.stations[stationCode]) {
        const value = otherCache.stations[stationCode];
        const hit = typeof value === "string" ? value : String((value == null ? void 0 : value.name) || "");
        dbg == null ? void 0 : dbg("station hit [other-area-flat]", { area: otherArea, code: stationCode, name: hit });
        return hit;
      }
    }
    if (globalStationsByCode.has(stationCode)) {
      const hit = String(globalStationsByCode.get(stationCode));
      dbg == null ? void 0 : dbg("station hit [global]", { code: stationCode, name: hit });
      return hit;
    }
    warn == null ? void 0 : warn("station miss", { line, area, code: stationCode });
    return "";
  }
  function clearAreaStationsCache(area) {
    try {
      localStorage.removeItem(areaCacheKey(area));
    } catch (e) {
    }
  }
  function clearAreaCrossCache(area) {
    try {
      localStorage.removeItem(areaCrossKey(area));
    } catch (e) {
    }
  }
  var AREA_LIST, CACHE_TTL_MS, globalStationsByCode, globalLineOrders;
  var init_tid_data = __esm({
    "assets/js/tid-data.js"() {
      AREA_LIST = ["kinki", "hokuriku", "okayama", "hiroshima", "sanin"];
      CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1e3;
      globalStationsByCode = /* @__PURE__ */ new Map();
      globalLineOrders = /* @__PURE__ */ new Map();
      (function warmAllAreasFromCache() {
        try {
          AREA_LIST.forEach((area) => warmAreaFromCache(area));
        } catch (e) {
        }
      })();
    }
  });

  // assets/js/tid-render.js
  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"]/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;"
    })[char]);
  }
  function renderTrafficInfo(container, line, data) {
    if (!container) return;
    container.innerHTML = "";
    if (!data || typeof data !== "object") return;
    const lineIds = Array.isArray(line) ? line.map((value) => String(value || "").trim()).filter(Boolean) : [String(line || "").trim()].filter(Boolean);
    const multiLine = lineIds.length > 1;
    const lineItems = [];
    const expressItems = [];
    const seenLineItems = /* @__PURE__ */ new Set();
    const seenExpressItems = /* @__PURE__ */ new Set();
    if (data.lines && typeof data.lines === "object") {
      for (const lineId of lineIds) {
        const entry = data.lines[lineId];
        if (!entry) continue;
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
        const bodyText = `${sectionText ? sectionText + ": " : ""}${cause ? `${cause} \u306B\u3088\u308A ` : ""}${status}`.trim();
        if (!bodyText) continue;
        const text = multiLine ? `[${lineId}] ${bodyText}` : bodyText;
        const dedupeKey = `${text}|${url}`;
        if (text && !seenLineItems.has(dedupeKey)) {
          seenLineItems.add(dedupeKey);
          lineItems.push({ text, url });
        }
      }
    }
    if (data.express && typeof data.express === "object") {
      for (const lineId of lineIds) {
        const entry = data.express[lineId];
        if (!entry) continue;
        const name = entry.name || "";
        const cause = entry.cause || "";
        const status = entry.status || "";
        const url = entry.url || "";
        const bodyText = `${name ? `\u7279\u6025 ${name}: ` : ""}${cause ? `${cause} \u306B\u3088\u308A ` : ""}${status}`.trim();
        if (!bodyText) continue;
        const text = multiLine ? `[${lineId}] ${bodyText}` : bodyText;
        const dedupeKey = `${text}|${url}`;
        if (text && !seenExpressItems.has(dedupeKey)) {
          seenExpressItems.add(dedupeKey);
          expressItems.push({ text, url });
        }
      }
    }
    if (!lineItems.length && !expressItems.length) return;
    const buildSection = (title, items, kind) => {
      const section = document.createElement("section");
      section.className = "traffic-section";
      const header = document.createElement("div");
      header.className = `traffic-section__header ${kind === "express" ? "traffic-section__header--express" : "traffic-section__header--line"}`;
      header.textContent = title;
      const list = document.createElement("ul");
      list.className = "traffic-list";
      for (const item of items) {
        const li = document.createElement("li");
        li.className = `traffic-item ${kind === "express" ? "traffic-item--express" : "traffic-item--line"}`;
        if (item.url) {
          const link = document.createElement("a");
          link.href = item.url;
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          link.textContent = item.text;
          li.appendChild(link);
        } else {
          li.textContent = item.text;
        }
        list.appendChild(li);
      }
      section.appendChild(header);
      section.appendChild(list);
      container.appendChild(section);
    };
    if (lineItems.length) buildSection("\u8DEF\u7DDA\u306E\u904B\u884C\u60C5\u5831", lineItems, "line");
    if (expressItems.length) buildSection("\u7279\u6025\u306E\u904B\u884C\u60C5\u5831", expressItems, "express");
  }
  function renderTrainList(container, list, indexes, options) {
    const {
      getDelayThreshold,
      getCarsThreshold,
      getDestText,
      getNickname: getNickname2,
      configuredTypeTextClass,
      trainCategoryFromDisplayType: trainCategoryFromDisplayType2,
      typeTextClass: typeTextClass2
    } = options;
    if (!container) return;
    container.innerHTML = "";
    if (!list.length) {
      container.textContent = "\u8A72\u5F53\u306A\u3057";
      return;
    }
    const table = document.createElement("table");
    table.className = "train-table";
    const colgroup = document.createElement("colgroup");
    for (let i = 0; i < 7; i += 1) {
      colgroup.appendChild(document.createElement("col"));
    }
    table.appendChild(colgroup);
    const thead = document.createElement("thead");
    thead.innerHTML = "<tr><th>\u5217\u756A</th><th>\u7A2E\u5225</th><th>\u611B\u79F0</th><th>\u4E21\u6570</th><th>\u884C\u5148</th><th>\u4F4D\u7F6E</th><th>\u9045\u5EF6</th></tr>";
    table.appendChild(thead);
    const tbody = document.createElement("tbody");
    for (const train of list) {
      const tr = document.createElement("tr");
      const delayThreshold = getDelayThreshold();
      const typeLabel = String(train.displayType || "").trim();
      const colorClass = configuredTypeTextClass(typeLabel) || typeTextClass2(trainCategoryFromDisplayType2(train.displayType));
      const typeHtml = colorClass ? `<span class="${colorClass}">${escapeHtml(typeLabel)}</span>` : escapeHtml(typeLabel);
      const destText = escapeHtml(getDestText(train, indexes, "dest"));
      const delayText = typeof train.delayMinutes === "number" && train.delayMinutes > 0 ? train.delayMinutes >= delayThreshold ? `<span class="delay-bad" style="color:var(--color-danger,#c00);font-weight:700;">${train.delayMinutes}\u5206</span>` : `${train.delayMinutes}\u5206` : "";
      const posPart = train.stopped ? escapeHtml(train.atName || "") : escapeHtml(train.direction === 0 ? `${train.nextName || ""} \u2192 ${train.atName || ""}` : `${train.atName || ""} \u2192 ${train.nextName || ""}`);
      let carsText = train.numberOfCars != null ? escapeHtml(String(train.numberOfCars)) : "";
      try {
        const threshold = getCarsThreshold();
        const cars = Number(train.numberOfCars);
        if (Number.isFinite(cars) && cars >= threshold) {
          carsText = `<span class="cars-emph">${carsText}</span>`;
        }
      } catch (e) {
      }
      tr.innerHTML = `
      <td>${escapeHtml(train.no || "")}</td>
      <td>${typeHtml}</td>
      <td>${escapeHtml(getNickname2(train))}</td>
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
  var init_tid_render = __esm({
    "assets/js/tid-render.js"() {
    }
  });

  // assets/js/tid-settings.js
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
  var SETTINGS_ROOT_KEY, MIGRATION_DONE_KEY;
  var init_tid_settings = __esm({
    "assets/js/tid-settings.js"() {
      SETTINGS_ROOT_KEY = "tid:v1:settings";
      MIGRATION_DONE_KEY = "tid:v1:migrationDone";
    }
  });

  // assets/js/tid.js
  var require_tid = __commonJS({
    "assets/js/tid.js"(exports) {
      init_components();
      init_tid_category();
      init_tid_background();
      init_tid_alarm();
      init_tid_data();
      init_tid_render();
      init_tid_settings();
      loadComponents();
      var paramsView = document.getElementById("paramsView");
      var trainsContainer = document.getElementById("trainsContainer");
      var upContainer = document.querySelector("#trainsUp .train-items");
      var downContainer = document.querySelector("#trainsDown .train-items");
      var updatedAtEl = document.getElementById("updatedAt");
      var settingsPanel = document.getElementById("settingsPanel");
      var trafficInfoEl = document.getElementById("trafficInfo");
      var audioOverlay = document.getElementById("audioUnlockOverlay");
      var audioOverlayBtn = document.getElementById("audioUnlockBtn");
      var audioOverlayHint = document.getElementById("audioUnlockHint");
      var audioOverlayLater = document.getElementById("audioUnlockLater");
      var audioOverlayClose = document.getElementById("audioUnlockClose");
      var stationFilterEl = document.getElementById("stationFilter");
      var passFilterEl = document.getElementById("passFilter");
      var refreshStationsBtn = document.getElementById("refreshStationsBtn");
      var debugParam = new URLSearchParams(window.location.search).get("debug");
      var TID_DEBUG = debugParam === "1" || localStorage.getItem("tid:debug") === "1";
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
      function getMetaContent(name) {
        var _a2;
        try {
          return ((_a2 = document.querySelector(`meta[name="${name}"]`)) == null ? void 0 : _a2.getAttribute("content")) || "";
        } catch (e) {
          return "";
        }
      }
      function parseMetaList(name) {
        return getMetaContent(name).split(",").map((value) => String(value || "").trim()).filter(Boolean);
      }
      var alarmSystem = null;
      var audioCtx = null;
      var audioUnlocked = false;
      var audioUnlockBound = false;
      var audioOverlayBound = false;
      var refreshing = false;
      var filterControlsBound = false;
      var refreshTimer = null;
      var visBound = false;
      var searchParams = new URLSearchParams(window.location.search);
      var fixedArea = getMetaContent("tid:fixedArea").trim();
      var fixedLine = getMetaContent("tid:fixedLine").trim();
      var fixedLineIds = parseMetaList("tid:fixedLines");
      var fixedStationName = getMetaContent("tid:fixedStationName").trim();
      var fixedDir = getMetaContent("tid:fixedDir").trim();
      var area = searchParams.get("area") || fixedArea || "";
      var line = searchParams.get("line") || fixedLine || "";
      var dir = searchParams.get("dir") || fixedDir || null;
      var currentLineIds = Array.from(new Set((fixedLineIds.length ? fixedLineIds : [line]).filter(Boolean)));
      var dirLabel = dir === "up" ? "\u4E0A\u308A" : dir === "down" ? "\u4E0B\u308A" : "\u4E21\u65B9";
      var fixedStationMode = Boolean(fixedStationName);
      var multiLineFixedMode = fixedStationMode && currentLineIds.length > 1;
      var lineScope = multiLineFixedMode ? [...currentLineIds].sort().join("+") : line;
      var _a;
      if (multiLineFixedMode && line && line !== lineScope) {
        try {
          const rootKey = "tid:v1:settings";
          const raw = localStorage.getItem(rootKey);
          if (raw) {
            const root = JSON.parse(raw);
            if (((_a = root == null ? void 0 : root.lines) == null ? void 0 : _a[line]) && !root.lines[lineScope]) {
              root.lines[lineScope] = root.lines[line];
              delete root.lines[line];
              localStorage.setItem(rootKey, JSON.stringify(root));
              dbg("migrated settings to lineScope", { from: line, to: lineScope });
            }
          }
        } catch (e) {
        }
      }
      var currentLineLabel = currentLineIds.length ? currentLineIds.join(", ") : line || "(\u672A\u6307\u5B9A)";
      paramsView.textContent = fixedStationMode ? `\u9078\u629E\u4E2D\u306E\u30A8\u30EA\u30A2: ${area || "(\u672A\u6307\u5B9A)"} / \u8DEF\u7DDA: ${currentLineLabel} / \u99C5: ${fixedStationName} / \u65B9\u5411: ${dirLabel}` : `\u9078\u629E\u4E2D\u306E\u30A8\u30EA\u30A2: ${area || "(\u672A\u6307\u5B9A)"} / \u8DEF\u7DDA: ${line || "(\u672A\u6307\u5B9A)"} / \u65B9\u5411: ${dirLabel}`;
      alarmSystem = createAlarmSystem({
        area,
        line: lineScope,
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
        buildAlarmMessage,
        notifyIfBackground: (message, tag) => notifyIfBackground(message, tag, { getSetting, dbg }),
        playAlarmSound,
        playBeep,
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
          yield loadTypeColorMap();
          bindFilterControls();
          alarmSystem == null ? void 0 : alarmSystem.initAlarmControls();
          initDelayControls();
          initCarsControls();
          initBackgroundControls({ getSetting, setSetting, dbg });
          if (TID_DEBUG) {
            try {
              initDebugPanel();
            } catch (e) {
            }
          }
          const indexes = yield getIndexesForCurrentLine();
          renderStationFilter(indexes);
          const trains = yield fetchTrainsForCurrentView();
          setUpdatedAt(trains == null ? void 0 : trains.update);
          renderTrains(indexes, trains, dir);
          yield updateTrafficInfo(area, currentLineIds);
          try {
            const areaCached = loadAreaStationsCache(area);
            if (!areaCached && area) {
              buildGlobalStationsForArea(area, { dbg }).then(() => {
                try {
                  refreshTrains();
                } catch (e) {
                }
              });
            }
          } catch (e) {
          }
          startAutoRefresh();
        } catch (error) {
          console.error("\u5217\u8ECA\u60C5\u5831\u306E\u53D6\u5F97\u306B\u5931\u6557", error);
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
              if (wantOpen) settingsPanel.setAttribute("open", "");
              else settingsPanel.removeAttribute("open");
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
      var TYPE_COLOR_MAP = /* @__PURE__ */ new Map();
      function typeColorNameToClass(name) {
        const trimmed = String(name || "").trim();
        switch (trimmed) {
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
          const params = new URLSearchParams(window.location.search);
          const fromQuery = params.get("colormap") || params.get("color");
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
          for (const url of resolveColorMapUrls()) {
            try {
              const response = yield fetch(url, { cache: "no-store" });
              if (!response.ok) continue;
              parseTypeColorText(yield response.text());
              dbg("color map loaded", { url, size: TYPE_COLOR_MAP.size });
              return;
            } catch (e) {
            }
          }
          dbg("color map not found; using defaults");
        });
      }
      function parseTypeColorText(text) {
        try {
          TYPE_COLOR_MAP.clear();
          const lines = String(text || "").split(/\r?\n/);
          for (const rawLine of lines) {
            const line2 = rawLine.trim();
            if (!line2 || line2.startsWith("#")) continue;
            const parts = line2.split(",");
            if (parts.length < 2) continue;
            const type = parts[0].trim();
            const color = parts[1].trim();
            const cls = typeColorNameToClass(color);
            if (type && cls) TYPE_COLOR_MAP.set(type, cls);
          }
          dbg("parsed color map", Object.fromEntries(TYPE_COLOR_MAP));
        } catch (e) {
        }
      }
      function configuredTypeTextClass(typeLabel) {
        if (!typeLabel) return "";
        const trimmed = String(typeLabel).trim();
        const exact = TYPE_COLOR_MAP.get(trimmed);
        if (exact) return exact;
        for (const [key, cls] of TYPE_COLOR_MAP.entries()) {
          if (trimmed.includes(key) || key.includes(trimmed)) return cls;
        }
        return "";
      }
      function buildAlarmMessage(train, targetCode, indexes) {
        var _a2, _b;
        try {
          const parts = [];
          const no = String((train == null ? void 0 : train.no) || "").trim();
          const type = String((train == null ? void 0 : train.displayType) || "").trim();
          const nickname = getNickname(train);
          const dest = getDestText(train, indexes, "alarm.dest");
          const stationName = ((_a2 = indexes.byCode.get(String(targetCode))) == null ? void 0 : _a2.name) || String(targetCode);
          if (no) parts.push(no);
          if (type && nickname) parts.push(`${type} ${nickname}`);
          else if (type) parts.push(`${type}\u5217\u8ECA`);
          if (dest) parts.push(dest.endsWith("\u884C\u304D") ? dest : `${dest}\u884C\u304D`);
          parts.push(`${stationName}\u306B\u63A5\u8FD1`);
          if (typeof (train == null ? void 0 : train.delayMinutes) === "number" && train.delayMinutes > 0) {
            parts.push(`\u7D04${train.delayMinutes}\u5206\u9045\u5EF6`);
          }
          return parts.filter(Boolean).join("\u3001");
        } catch (e) {
          const stationName = ((_b = indexes.byCode.get(String(targetCode))) == null ? void 0 : _b.name) || String(targetCode);
          const no = String((train == null ? void 0 : train.no) || "\u5217\u8ECA");
          return `${no}\u3001${stationName}\u306B\u63A5\u8FD1`;
        }
      }
      function getDelayThreshold() {
        try {
          const raw = getSetting("delay.threshold", void 0);
          if (raw == null || raw === "") return 4;
          const value = Number(raw);
          if (Number.isFinite(value) && value >= 0) return Math.floor(value);
        } catch (e) {
        }
        return 4;
      }
      function initDelayControls() {
        const input = document.getElementById("delayThreshold");
        if (!input) return;
        try {
          input.value = String(getDelayThreshold());
          input.addEventListener("change", () => {
            let value = Number(input.value);
            if (!Number.isFinite(value) || value < 0) value = 4;
            try {
              setSetting("delay.threshold", Math.floor(value));
            } catch (e) {
            }
            refreshTrains();
          }, { once: false });
        } catch (e) {
        }
      }
      function getCarsThreshold() {
        try {
          const raw = getSetting("cars.threshold", void 0);
          if (raw == null || raw === "") return 9;
          const value = Number(raw);
          if (Number.isFinite(value) && value >= 0) return Math.floor(value);
        } catch (e) {
        }
        return 9;
      }
      function isCarsFilterEnabled() {
        try {
          return !!getSetting("cars.filterEnabled", false);
        } catch (e) {
          return false;
        }
      }
      function initCarsControls() {
        const thresholdInput = document.getElementById("carsThreshold");
        const filterCheckbox = document.getElementById("carsFilterEnable");
        if (thresholdInput) {
          try {
            thresholdInput.value = String(getCarsThreshold());
            thresholdInput.addEventListener("change", () => {
              let value = Number(thresholdInput.value);
              if (!Number.isFinite(value) || value < 0) value = 9;
              try {
                setSetting("cars.threshold", Math.floor(value));
              } catch (e) {
              }
              refreshTrains();
            });
          } catch (e) {
          }
        }
        if (filterCheckbox) {
          try {
            filterCheckbox.checked = isCarsFilterEnabled();
            filterCheckbox.addEventListener("change", () => {
              try {
                setSetting("cars.filterEnabled", filterCheckbox.checked);
                dbg("CARS_FILTER_ENABLED", { enabled: filterCheckbox.checked, threshold: getCarsThreshold() });
              } catch (e) {
              }
              refreshTrains();
            });
          } catch (e) {
          }
        }
      }
      function updateTrafficInfo(currentArea, currentLines) {
        return __async(this, null, function* () {
          const lineIds = Array.isArray(currentLines) ? currentLines.filter(Boolean) : [currentLines].filter(Boolean);
          if (!currentArea || !lineIds.length || !trafficInfoEl) return;
          try {
            const data = yield fetchTrafficInfo(currentArea);
            renderTrafficInfo(trafficInfoEl, lineIds, data);
          } catch (error) {
            dbg("traffic fetch fail", error);
          }
        });
      }
      var BEEP_DURATION_MS = 280;
      var ALARM_SOUND_URL = "/assets/sound/alarm.mp3";
      var alarmAudioEl = null;
      var alarmAudioPrimed = false;
      function ensureAlarmAudioEl() {
        if (alarmAudioEl) return alarmAudioEl;
        try {
          const audio = document.createElement("audio");
          audio.src = ALARM_SOUND_URL;
          audio.preload = "auto";
          audio.controls = false;
          audio.loop = false;
          audio.style.display = "none";
          audio.setAttribute("aria-hidden", "true");
          try {
            audio.setAttribute("playsinline", "");
            audio.setAttribute("webkit-playsinline", "");
          } catch (e) {
          }
          document.body.appendChild(audio);
          alarmAudioEl = audio;
        } catch (e) {
        }
        return alarmAudioEl;
      }
      function primeAlarmAudio() {
        return __async(this, null, function* () {
          try {
            const audio = ensureAlarmAudioEl();
            if (!audio || alarmAudioPrimed) return true;
            yield audio.play();
            try {
              yield new Promise((resolve) => setTimeout(resolve, 10));
            } catch (e) {
            }
            try {
              audio.pause();
              audio.currentTime = 0;
            } catch (e) {
            }
            alarmAudioPrimed = true;
            return true;
          } catch (e) {
            return false;
          }
        });
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
          if (audioCtx == null ? void 0 : audioCtx.resume) audioCtx.resume().catch(() => {
          });
        } catch (e) {
        }
        audioUnlocked = true;
        cleanupAudioUnlockListeners();
        dbg("audio unlocked", source || "");
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
      }
      function bindAudioUnlockOnce() {
        if (audioUnlocked || audioUnlockBound) return;
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
        const supported = "AudioContext" in window || "webkitAudioContext" in window;
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
          const text = isStandalone ? "\u30A2\u30D7\u30EA\u3068\u3057\u3066\u8D77\u52D5\u4E2D\u3067\u3059\u3002\u30A2\u30E9\u30FC\u30E0\u97F3\u3092\u6709\u52B9\u306B\u3059\u308B\u3068\u63A5\u8FD1\u30A2\u30E9\u30FC\u30E0\u3092\u518D\u751F\u3067\u304D\u307E\u3059\u3002" : "\u30D6\u30E9\u30A6\u30B6\u3067\u958B\u3044\u3066\u3044\u307E\u3059\u3002\u30A2\u30E9\u30FC\u30E0\u97F3\u3092\u6709\u52B9\u306B\u3059\u308B\u3068\u63A5\u8FD1\u30A2\u30E9\u30FC\u30E0\u3092\u518D\u751F\u3067\u304D\u307E\u3059\u3002";
          if (audioOverlayHint) audioOverlayHint.textContent = text;
        } catch (e) {
        }
        show();
        if (audioOverlayBound) return;
        audioOverlayBound = true;
        try {
          if (audioOverlayBtn) {
            audioOverlayBtn.addEventListener("click", () => {
              try {
                bindAudioUnlockOnce();
                performAudioUnlock("overlay-button");
              } catch (error) {
                dbg("audio unlock button failed", error);
              }
            });
          }
          if (audioOverlayLater) {
            audioOverlayLater.addEventListener("click", hide);
          }
          if (audioOverlayClose) {
            audioOverlayClose.addEventListener("click", hide);
          }
          document.addEventListener("tid:audiounlocked", hide);
        } catch (e) {
        }
      }
      function playAlarmSound() {
        return __async(this, null, function* () {
          try {
            if (!audioUnlocked) {
              bindAudioUnlockOnce();
              return 0;
            }
            const audio = ensureAlarmAudioEl();
            if (!audio) return 0;
            try {
              yield primeAlarmAudio();
            } catch (e) {
            }
            audio.currentTime = 0;
            audio.volume = 1;
            return yield new Promise((resolve) => {
              let settled = false;
              const done = (ms) => {
                if (!settled) {
                  settled = true;
                  resolve(Number.isFinite(ms) ? ms : 0);
                }
              };
              const cleanup = () => {
                try {
                  audio.removeEventListener("ended", onEnded);
                } catch (e) {
                }
                try {
                  audio.removeEventListener("error", onError);
                } catch (e) {
                }
              };
              const onEnded = () => {
                const duration = typeof audio.duration === "number" && isFinite(audio.duration) ? Math.round(audio.duration * 1e3) : 0;
                cleanup();
                done(duration);
              };
              const onError = () => {
                cleanup();
                done(0);
              };
              try {
                audio.addEventListener("ended", onEnded, { once: true });
                audio.addEventListener("error", onError, { once: true });
                try {
                  if (!audio.paused) {
                    audio.pause();
                    audio.currentTime = 0;
                  }
                } catch (e) {
                }
                const playResult = audio.play();
                if (playResult && typeof playResult.then === "function") {
                  playResult.catch(() => {
                    try {
                      audioUnlocked = false;
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
          } catch (error) {
            dbg("alarm audio failed", error);
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
          const oscillator = audioCtx.createOscillator();
          const gain = audioCtx.createGain();
          oscillator.type = "sine";
          oscillator.frequency.value = 880;
          gain.gain.setValueAtTime(1e-4, audioCtx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.02);
          gain.gain.exponentialRampToValueAtTime(1e-4, audioCtx.currentTime + BEEP_DURATION_MS / 1e3 - 0.02);
          oscillator.connect(gain).connect(audioCtx.destination);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + BEEP_DURATION_MS / 1e3);
        } catch (error) {
          dbg("beep failed", error);
        }
        return BEEP_DURATION_MS;
      }
      function getIndexesForCurrentLine() {
        return __async(this, null, function* () {
          if (multiLineFixedMode) {
            const lineStations = yield fetchStationDataForLines(currentLineIds);
            return buildMergedIndexesForLines(lineStations);
          }
          if (!fixedStationMode) {
            const cached = buildIndexesFromCache(area, line, { dbg });
            if (cached) return cached;
          }
          const stations = yield fetchStations(line);
          return buildStationIndexes(stations);
        });
      }
      function fetchStationDataForLines(lineIds) {
        return __async(this, null, function* () {
          const results = yield Promise.allSettled(
            lineIds.map((lineId) => fetchStations(lineId).then((data) => ({ lineId, data })))
          );
          return results.filter((result) => result.status === "fulfilled").map((result) => result.value);
        });
      }
      function addAdjacencyEdge(adjacency, left, right) {
        if (!left || !right || left === right) return;
        if (!adjacency.has(left)) adjacency.set(left, /* @__PURE__ */ new Set());
        if (!adjacency.has(right)) adjacency.set(right, /* @__PURE__ */ new Set());
        adjacency.get(left).add(right);
        adjacency.get(right).add(left);
      }
      function buildMergedIndexesForLines(lineStations) {
        var _a2;
        const stationsByCode = /* @__PURE__ */ new Map();
        const adjacency = /* @__PURE__ */ new Map();
        const ordersByLine = /* @__PURE__ */ new Map();
        for (const entry of lineStations) {
          const lineId = String((entry == null ? void 0 : entry.lineId) || "").trim();
          const stations = Array.isArray((_a2 = entry == null ? void 0 : entry.data) == null ? void 0 : _a2.stations) ? entry.data.stations : [];
          const order2 = [];
          let previousCode = null;
          for (const station of stations) {
            const info = (station == null ? void 0 : station.info) || {};
            const code = String((info == null ? void 0 : info.code) || "").trim();
            if (!code) continue;
            const name = String((info == null ? void 0 : info.name) || code).trim();
            order2.push(code);
            const existing = stationsByCode.get(code);
            if (existing) {
              if (!existing.name && name) existing.name = name;
              if ((!existing.stopTrains || !existing.stopTrains.length) && Array.isArray(info == null ? void 0 : info.stopTrains)) {
                existing.stopTrains = info.stopTrains.slice();
              }
              existing.lines.add(lineId);
            } else {
              stationsByCode.set(code, {
                index: 0,
                name,
                code,
                stopTrains: Array.isArray(info == null ? void 0 : info.stopTrains) ? info.stopTrains.slice() : null,
                lines: new Set(lineId ? [lineId] : [])
              });
            }
            addAdjacencyEdge(adjacency, previousCode, code);
            previousCode = code;
          }
          if (order2.length) ordersByLine.set(lineId, order2);
        }
        const probeIndexes = { byCode: stationsByCode, order: Array.from(stationsByCode.keys()) };
        const selectedStation = findStationByName(probeIndexes, fixedStationName);
        if (!selectedStation) {
          const byCode2 = /* @__PURE__ */ new Map();
          const order2 = Array.from(stationsByCode.keys()).sort();
          order2.forEach((code, index) => {
            const station = stationsByCode.get(code);
            byCode2.set(code, __spreadProps(__spreadValues({}, station), { index }));
          });
          return { byCode: byCode2, order: order2 };
        }
        let primaryOrder = ordersByLine.get(line) || ordersByLine.get(currentLineIds[0]) || ordersByLine.values().next().value || Array.from(stationsByCode.keys());
        let selectedIdx = primaryOrder.indexOf(selectedStation.code);
        if (selectedIdx < 0) {
          for (const [, order2] of ordersByLine.entries()) {
            const idx = order2.indexOf(selectedStation.code);
            if (idx >= 0) {
              primaryOrder = order2;
              selectedIdx = idx;
              break;
            }
          }
        }
        const negativeHop = selectedIdx > 0 ? primaryOrder[selectedIdx - 1] : "";
        const positiveHop = selectedIdx >= 0 && selectedIdx < primaryOrder.length - 1 ? primaryOrder[selectedIdx + 1] : "";
        const metrics = buildGraphMetrics(adjacency, selectedStation.code, { negativeHop, positiveHop });
        const withIndex = [];
        for (const [code, station] of stationsByCode.entries()) {
          const metric = metrics.get(code) || null;
          const hasMetric = metric && Number.isFinite(metric.distance);
          const distance = hasMetric ? metric.distance : Number.MAX_SAFE_INTEGER;
          const sign = Number((metric == null ? void 0 : metric.sign) || 0);
          const normalizedSign = code === selectedStation.code ? 0 : sign || 1;
          const index = code === selectedStation.code ? 0 : hasMetric ? normalizedSign * distance : 9999;
          withIndex.push(__spreadProps(__spreadValues({}, station), {
            index,
            distance,
            side: normalizedSign
          }));
        }
        withIndex.sort((left, right) => {
          if (left.index !== right.index) return left.index - right.index;
          if (left.distance !== right.distance) return left.distance - right.distance;
          const leftName = String(left.name || "");
          const rightName = String(right.name || "");
          if (leftName !== rightName) return leftName.localeCompare(rightName, "ja");
          return String(left.code).localeCompare(String(right.code), "ja");
        });
        const byCode = /* @__PURE__ */ new Map();
        const order = [];
        for (const station of withIndex) {
          byCode.set(station.code, station);
          order.push(station.code);
        }
        return { byCode, order };
      }
      function buildGraphMetrics(adjacency, selectedCode, { negativeHop, positiveHop } = {}) {
        const metrics = /* @__PURE__ */ new Map();
        metrics.set(selectedCode, { distance: 0, sign: 0, firstHop: selectedCode });
        const queue = [selectedCode];
        for (let i = 0; i < queue.length; i += 1) {
          const code = queue[i];
          const current = metrics.get(code);
          const neighbors = Array.from(adjacency.get(code) || []);
          for (const neighbor of neighbors) {
            if (metrics.has(neighbor)) continue;
            const firstHop = code === selectedCode ? neighbor : current.firstHop;
            let sign = 0;
            if (firstHop === negativeHop) sign = -1;
            else if (firstHop === positiveHop) sign = 1;
            else sign = current.sign || 0;
            metrics.set(neighbor, {
              distance: Number(current.distance || 0) + 1,
              sign,
              firstHop
            });
            queue.push(neighbor);
          }
        }
        return metrics;
      }
      function parseIsoTime(value) {
        const ms = Date.parse(String(value || ""));
        return Number.isFinite(ms) ? ms : null;
      }
      function mergeTrainPayloads(payloads) {
        var _a2;
        const trains = [];
        const seen = /* @__PURE__ */ new Set();
        let latestMs = null;
        let latestRaw = "";
        for (const payload of payloads) {
          const updateMs = parseIsoTime(payload == null ? void 0 : payload.update);
          if (updateMs != null && (latestMs == null || updateMs > latestMs)) {
            latestMs = updateMs;
            latestRaw = String(payload.update || "");
          }
          const list = Array.isArray(payload == null ? void 0 : payload.trains) ? payload.trains : [];
          for (const train of list) {
            const key = `${(train == null ? void 0 : train.no) || ""}|${(train == null ? void 0 : train.pos) || ""}|${(_a2 = train == null ? void 0 : train.direction) != null ? _a2 : ""}`;
            if (seen.has(key)) continue;
            seen.add(key);
            trains.push(train);
          }
        }
        return {
          update: latestRaw,
          trains
        };
      }
      function fetchTrainsForCurrentView() {
        return __async(this, null, function* () {
          if (currentLineIds.length <= 1) {
            return yield fetchTrains(line);
          }
          const results = yield Promise.allSettled(
            currentLineIds.map((lineId) => fetchTrains(lineId))
          );
          const payloads = results.filter((result) => result.status === "fulfilled").map((result) => result.value);
          return mergeTrainPayloads(payloads);
        });
      }
      function normalizeStationName(value) {
        return String(value || "").trim().replace(/\s+/g, "");
      }
      function findStationByName(indexes, stationName) {
        const target = normalizeStationName(stationName);
        if (!target) return null;
        for (const code of indexes.order) {
          const station = indexes.byCode.get(code);
          if (!station) continue;
          if (normalizeStationName(station.name) === target) {
            return station;
          }
        }
        return null;
      }
      function bindFilterControls() {
        if (filterControlsBound) return;
        filterControlsBound = true;
        stationFilterEl == null ? void 0 : stationFilterEl.addEventListener("change", () => {
          try {
            setSetting(`lines.${lineScope}.station`, stationFilterEl.value || "");
          } catch (e) {
          }
          try {
            alarmSystem == null ? void 0 : alarmSystem.clearNotified();
          } catch (e) {
          }
          refreshTrains();
        });
        passFilterEl == null ? void 0 : passFilterEl.addEventListener("change", () => {
          try {
            setSetting(`lines.${lineScope}.pass`, passFilterEl.value);
          } catch (e) {
          }
          try {
            alarmSystem == null ? void 0 : alarmSystem.clearNotified();
          } catch (e) {
          }
          refreshTrains();
        });
        refreshStationsBtn == null ? void 0 : refreshStationsBtn.addEventListener("click", () => __async(null, null, function* () {
          const originalText = refreshStationsBtn.textContent;
          try {
            refreshStationsBtn.disabled = true;
            refreshStationsBtn.textContent = "\u66F4\u65B0\u4E2D\u2026";
            clearAreaStationsCache(area);
            clearAreaCrossCache(area);
            yield buildGlobalStationsForArea(area, { force: true, dbg });
            yield refreshTrains();
          } finally {
            refreshStationsBtn.disabled = false;
            refreshStationsBtn.textContent = originalText;
          }
        }));
      }
      function renderStationFilter(indexes) {
        if (!stationFilterEl) return;
        const savedStation = getSetting(`lines.${lineScope}.station`, "");
        const savedPass = getSetting(`lines.${lineScope}.pass`, null);
        stationFilterEl.length = 0;
        if (fixedStationMode) {
          const station = findStationByName(indexes, fixedStationName);
          const option = document.createElement("option");
          if (station) {
            option.value = station.code;
            option.textContent = station.name || fixedStationName;
            stationFilterEl.appendChild(option);
            stationFilterEl.value = station.code;
            try {
              setSetting(`lines.${lineScope}.station`, station.code);
            } catch (e) {
            }
          } else {
            option.value = "";
            option.textContent = `${fixedStationName} \u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093`;
            stationFilterEl.appendChild(option);
            stationFilterEl.value = "";
          }
          stationFilterEl.disabled = true;
        } else {
          const blankOption = document.createElement("option");
          blankOption.value = "";
          blankOption.textContent = "\uFF08\u672A\u9078\u629E\uFF09";
          stationFilterEl.appendChild(blankOption);
          for (const code of indexes.order) {
            const station = indexes.byCode.get(code);
            if (!station) continue;
            const option = document.createElement("option");
            option.value = station.code;
            option.textContent = station.name || station.code;
            stationFilterEl.appendChild(option);
          }
          if (savedStation && Array.from(stationFilterEl.options).some((option) => option.value === savedStation)) {
            stationFilterEl.value = savedStation;
          } else {
            stationFilterEl.value = "";
          }
          stationFilterEl.disabled = false;
        }
        if (passFilterEl) {
          if (savedPass === "show" || savedPass === "hide") {
            passFilterEl.value = savedPass;
          } else {
            passFilterEl.value = "hide";
          }
        }
      }
      function refreshTrains() {
        return __async(this, null, function* () {
          if (refreshing) return;
          refreshing = true;
          try {
            const indexes = yield getIndexesForCurrentLine();
            const trains = yield fetchTrainsForCurrentView();
            setUpdatedAt(trains == null ? void 0 : trains.update);
            renderStationFilter(indexes);
            renderTrains(indexes, trains, dir);
            yield updateTrafficInfo(area, currentLineIds);
          } catch (error) {
            console.error("\u518D\u53D6\u5F97\u306B\u5931\u6557", error);
          } finally {
            refreshing = false;
          }
        });
      }
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
        updatedAtEl.textContent = iso ? formatJST(iso) : "";
      }
      function formatJST(iso) {
        try {
          const date = new Date(iso);
          if (isNaN(date.getTime())) return "";
          const parts = new Intl.DateTimeFormat("ja-JP", {
            timeZone: "Asia/Tokyo",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false
          }).formatToParts(date);
          const get = (type) => {
            var _a2;
            return ((_a2 = parts.find((part) => part.type === type)) == null ? void 0 : _a2.value) || "";
          };
          return `${get("year")}\u5E74${get("month")}\u6708${get("day")}\u65E5 ${get("hour")}\u6642${get("minute")}\u5206${get("second")}\u79D2\u66F4\u65B0`;
        } catch (e) {
          return "";
        }
      }
      function renderTrains(indexes, trainsData, dirParam) {
        var _a2;
        const items = Array.isArray(trainsData == null ? void 0 : trainsData.trains) ? trainsData.trains : [];
        const selectedCode = ((stationFilterEl == null ? void 0 : stationFilterEl.value) || "").trim();
        if (fixedStationMode && !selectedCode) {
          upContainer.textContent = `${fixedStationName} \u306E\u99C5\u30B3\u30FC\u30C9\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F`;
          downContainer.textContent = `${fixedStationName} \u306E\u99C5\u30B3\u30FC\u30C9\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F`;
          upContainer.parentElement.style.display = dirParam === "down" ? "none" : "";
          downContainer.parentElement.style.display = dirParam === "up" ? "none" : "";
          trainsContainer == null ? void 0 : trainsContainer.classList.toggle("single", dirParam === "up" || dirParam === "down");
          return;
        }
        const allowedCats = stationAllowedCategories(indexes.byCode.get(selectedCode));
        const passSetting = (passFilterEl == null ? void 0 : passFilterEl.value) || "hide";
        const enhanced = items.map((train) => normalizeTrain(train)).map((train) => enhanceTrain(train, indexes.byCode));
        const parsed = enhanced.filter((train) => filterByStationSetting(train, allowedCats, passSetting));
        const stationIdx = selectedCode ? (_a2 = indexes.byCode.get(selectedCode)) == null ? void 0 : _a2.index : null;
        const heading = document.getElementById("trainsHeading");
        if (heading) {
          if (selectedCode) {
            const station = indexes.byCode.get(selectedCode);
            heading.textContent = `\u5217\u8ECA\u4E00\u89A7\uFF08\u99C5\u3067\u7D5E\u308A\u8FBC\u307F: ${(station == null ? void 0 : station.name) || selectedCode}\uFF09`;
          } else {
            heading.textContent = "\u5217\u8ECA\u4E00\u89A7\uFF08\u7D5E\u308A\u8FBC\u307F\u7121\u3057\uFF09";
          }
        }
        const hidePassed = (list, direction) => {
          if (stationIdx == null) return list;
          return list.filter((train) => {
            if (typeof train.posIndex !== "number") return true;
            return direction === 0 ? train.posIndex >= stationIdx : train.posIndex <= stationIdx;
          });
        };
        const destIndexForTrain = (train) => {
          try {
            const dest = train == null ? void 0 : train.dest;
            if (!dest) return null;
            let code = null;
            if (typeof dest === "object") {
              if (dest.code != null) {
                code = String(dest.code);
              } else {
                const name = String(dest.text || dest.name || "").trim();
                if (name) {
                  for (const [, record] of indexes.byCode.entries()) {
                    if (String((record == null ? void 0 : record.name) || "").trim() === name) {
                      return typeof record.index === "number" ? record.index : null;
                    }
                  }
                }
              }
            } else if (typeof dest === "string") {
              const name = String(dest).trim();
              if (name) {
                for (const [, record] of indexes.byCode.entries()) {
                  if (String((record == null ? void 0 : record.name) || "").trim() === name) {
                    return typeof record.index === "number" ? record.index : null;
                  }
                }
              }
            }
            if (code) {
              const record = indexes.byCode.get(code);
              return record && typeof record.index === "number" ? record.index : null;
            }
          } catch (e) {
          }
          return null;
        };
        const hideTerminatesBeforeSelected = (list, direction) => {
          if (stationIdx == null) return list;
          return list.filter((train) => {
            const destIndex = destIndexForTrain(train);
            if (typeof destIndex !== "number") return true;
            return direction === 0 ? destIndex <= stationIdx : destIndex >= stationIdx;
          });
        };
        let up = hidePassed(parsed.filter((train) => train.direction === 0).sort((a, b) => a.posIndex - b.posIndex), 0);
        let down = hidePassed(parsed.filter((train) => train.direction === 1).sort((a, b) => b.posIndex - a.posIndex), 1);
        up = hideTerminatesBeforeSelected(up, 0);
        down = hideTerminatesBeforeSelected(down, 1);
        try {
          alarmSystem == null ? void 0 : alarmSystem.setLastShown({ up, down }, selectedCode, indexes);
        } catch (e) {
        }
        try {
          if (passSetting === "show" && selectedCode) {
            const addExtrasForPass = (list, direction) => {
              var _a3;
              try {
                if (!((_a3 = alarmSystem == null ? void 0 : alarmSystem.hasPassAlarmForDirection) == null ? void 0 : _a3.call(alarmSystem, direction))) return list;
                const selected = String(selectedCode);
                const base = parsed.filter((train) => train.direction === direction);
                const extras = base.filter((train) => !train.stopped && (direction === 0 ? String(train.nextCode || "") === selected : String(train.atCode || "") === selected));
                if (!extras.length) return list;
                const keyOf = (train) => `${train.no || "?"}:${train.pos || ""}`;
                const seen = new Set(list.map(keyOf));
                for (const train of extras) {
                  const key = keyOf(train);
                  if (!seen.has(key)) {
                    list.push(train);
                    seen.add(key);
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
        } catch (error) {
          dbg("alarm render failed", error);
        }
        try {
          const shown = dirParam === "up" ? up : dirParam === "down" ? down : up.concat(down);
          alarmSystem == null ? void 0 : alarmSystem.handleApproachAlarms(indexes, shown, selectedCode, stationIdx, allowedCats, dirParam);
        } catch (error) {
          dbg("alarm check failed", error);
        }
        upContainer.parentElement.style.display = "";
        downContainer.parentElement.style.display = "";
        const renderOptions = {
          getDelayThreshold,
          getCarsThreshold,
          getDestText,
          getNickname,
          configuredTypeTextClass,
          trainCategoryFromDisplayType,
          typeTextClass
        };
        if (dirParam === "up") {
          renderTrainList(upContainer, up, indexes, renderOptions);
          downContainer.parentElement.style.display = "none";
          trainsContainer == null ? void 0 : trainsContainer.classList.add("single");
        } else if (dirParam === "down") {
          renderTrainList(downContainer, down, indexes, renderOptions);
          upContainer.parentElement.style.display = "none";
          trainsContainer == null ? void 0 : trainsContainer.classList.add("single");
        } else {
          renderTrainList(upContainer, up, indexes, renderOptions);
          renderTrainList(downContainer, down, indexes, renderOptions);
          trainsContainer == null ? void 0 : trainsContainer.classList.remove("single");
        }
      }
      function filterByStationSetting(train, allowed, passSetting) {
        if (!allowed) return true;
        const category = trainCategoryFromDisplayType(train.displayType);
        const stopsHere = category !== -1 && allowed.has(category) || category === -1;
        if (passSetting === "show") return true;
        return stopsHere;
      }
      function enhanceTrain(train, byCode) {
        const { atCode, nextCode, stopped } = parsePos(train.pos);
        const at = byCode.get(atCode);
        const next = nextCode ? byCode.get(nextCode) : null;
        let posIndex = at ? at.index : 0;
        if (!stopped && at && next) {
          posIndex = (at.index + next.index) / 2;
        }
        const stationLookup = { area, line, dbg, warn };
        const atName = (at == null ? void 0 : at.name) || getStationNameByPriority(atCode, { byCode }, __spreadProps(__spreadValues({}, stationLookup), { neighborCode: nextCode })) || atCode || "";
        const nextName = (next == null ? void 0 : next.name) || (nextCode ? getStationNameByPriority(nextCode, { byCode }, __spreadProps(__spreadValues({}, stationLookup), { neighborCode: atCode })) || nextCode : "") || "";
        return __spreadProps(__spreadValues({}, train), {
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
      function getDestText(train, indexes, tag) {
        const dest = train && train.dest;
        if (dest == null) return "";
        if (typeof dest === "string") return dest;
        if (typeof dest === "object") {
          const code = dest.code != null ? String(dest.code) : "";
          const text = dest.text || dest.name || "";
          if (text && String(text).trim()) return String(text);
          if (code) {
            return getStationNameByPriority(code, indexes, { area, line, dbg, warn, tag }) || code;
          }
          return "";
        }
        return String(dest);
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
        title.textContent = "TID Debug Panel";
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
            const message = args.join(" ");
            if (message.includes("ALARM_TRIGGER")) entry.style.color = "#0f0";
            else if (message.includes("ALARM_SKIP") || message.includes("ALARM_NO")) entry.style.color = "#f80";
            else if (message.includes("ALARM_QUEUED")) entry.style.color = "#0ff";
            else if (message.includes("ALARM_PREFS")) entry.style.color = "#ff0";
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
          const dirNum = direction === "up" ? 0 : 1;
          const key = `${trainNo}:${dirNum}:${targetCode}`;
          const msg = `\u30C6\u30B9\u30C8: ${trainNo}\u53F7\u3001${direction}\u3001${targetCode}\u99C5\u63A5\u8FD1`;
          const meta = {
            area,
            line,
            dir: direction,
            direction: dirNum,
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
