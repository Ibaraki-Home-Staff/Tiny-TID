(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
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
  function stationAllowedCategories(stationData) {
    if (!Array.isArray(stationData == null ? void 0 : stationData.stopTrains)) return null;
    const categories = new Set(stationData.stopTrains.map((value) => Number(value)));
    categories.add(CATEGORY.LOCAL);
    return categories;
  }
  var CATEGORY, CATEGORY_MATCHERS, CATEGORY_LABELS, CATEGORY_COLOR_CLASS;
  var init_tid_category = __esm({
    "assets/js/tid-category.js"() {
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
      init_tid_render();
      init_tid_settings();
      loadComponents();
      var paramsView = document.getElementById("paramsView");
      var trainsContainer = document.getElementById("trainsContainer");
      var trainsUp = document.getElementById("trainsUp");
      var trainsDown = document.getElementById("trainsDown");
      var updatedAtEl = document.getElementById("updatedAt");
      var trafficInfoEl = document.getElementById("trafficInfo");
      var stationFilter = document.getElementById("stationFilter");
      var passFilter = document.getElementById("passFilter");
      var refreshStationsBtn = document.getElementById("refreshStationsBtn");
      var debugPanel = document.getElementById("debugPanel");
      function meta(name) {
        var _a;
        return (((_a = document.querySelector(`meta[name="tid:${name}"]`)) == null ? void 0 : _a.getAttribute("content")) || "").trim();
      }
      function getArea() {
        return meta("fixedArea");
      }
      function getLines() {
        return meta("fixedLines");
      }
      function getFixedStationName() {
        return meta("fixedStationName");
      }
      var currentData = null;
      var selectedCode = "";
      var currentDir = "both";
      var refreshing = false;
      var typeColorsMap = /* @__PURE__ */ new Map();
      var debugLogEl = null;
      var apiBaseUrl = "";
      var alarmAudio = document.createElement("audio");
      alarmAudio.src = "/assets/sound/alarm.mp3";
      alarmAudio.preload = "auto";
      alarmAudio.loop = false;
      document.body.appendChild(alarmAudio);
      var audioUnlocked = false;
      var audioUnlockBound = false;
      function getAudioUnlocked() {
        return audioUnlocked;
      }
      function performAudioUnlock() {
        return __async(this, null, function* () {
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const buf = ctx.createBuffer(1, 1, 22050);
            const src = ctx.createBufferSource();
            src.buffer = buf;
            src.connect(ctx.destination);
            src.start(0);
            yield ctx.resume();
            src.stop();
            ctx.close();
          } catch (e) {
          }
          alarmAudio.muted = false;
          try {
            yield alarmAudio.play();
            alarmAudio.pause();
            alarmAudio.currentTime = 0;
          } catch (e) {
          }
          audioUnlocked = true;
        });
      }
      function bindAudioUnlockOnce() {
        if (audioUnlockBound) return;
        audioUnlockBound = true;
        const events = ["click", "touchstart", "keydown"];
        function unlock() {
          return __async(this, null, function* () {
            if (audioUnlocked) {
              events.forEach((e) => document.removeEventListener(e, unlock, { once: true, capture: true }));
              return;
            }
            yield performAudioUnlock();
            events.forEach((e) => document.removeEventListener(e, unlock, { once: true, capture: true }));
          });
        }
        events.forEach((e) => document.addEventListener(e, unlock, { once: true, capture: true }));
      }
      var unlockOverlay = document.getElementById("audioUnlockOverlay");
      var unlockBtn = document.getElementById("audioUnlockBtn");
      var unlockClose = document.getElementById("audioUnlockClose");
      var unlockLater = document.getElementById("audioUnlockLater");
      var unlockHint = document.getElementById("audioUnlockHint");
      if (unlockBtn) {
        unlockBtn.addEventListener("click", () => __async(null, null, function* () {
          yield performAudioUnlock();
          unlockOverlay == null ? void 0 : unlockOverlay.classList.add("is-hidden");
          unlockOverlay == null ? void 0 : unlockOverlay.setAttribute("aria-hidden", "true");
          try {
            alarmSystem.flushPendingAudio();
          } catch (e) {
          }
        }));
      }
      if (unlockClose || unlockLater) {
        const hide = () => {
          unlockOverlay == null ? void 0 : unlockOverlay.classList.add("is-hidden");
          unlockOverlay == null ? void 0 : unlockOverlay.setAttribute("aria-hidden", "true");
        };
        unlockClose == null ? void 0 : unlockClose.addEventListener("click", hide);
        unlockLater == null ? void 0 : unlockLater.addEventListener("click", hide);
      }
      var TID_DEBUG = !!getSetting("ui.debug", false) || new URL(window.location.href).searchParams.has("debug");
      function dbg(...args) {
        if (!TID_DEBUG) return;
        console.log("[TID]", ...args);
      }
      function initDebugPanel() {
        if (!TID_DEBUG) return;
        let panel = document.getElementById("tidDebugPanel");
        if (!panel) {
          panel = document.createElement("div");
          panel.id = "tidDebugPanel";
          Object.assign(panel.style, {
            position: "fixed",
            left: "10px",
            bottom: "10px",
            zIndex: "2147483646",
            background: "rgba(0,0,0,.82)",
            color: "#0f0",
            padding: "10px 14px",
            borderRadius: "8px",
            font: "12px/1.4 monospace",
            maxWidth: "520px",
            maxHeight: "340px",
            overflowY: "auto",
            whiteSpace: "pre-wrap",
            pointerEvents: "auto"
          });
          document.body.appendChild(panel);
        }
        debugLogEl = panel;
      }
      function debugLog(msg) {
        if (!TID_DEBUG || !debugLogEl) return;
        const dt = /* @__PURE__ */ new Date();
        const hh = String(dt.getHours()).padStart(2, "0");
        const mm = String(dt.getMinutes()).padStart(2, "0");
        const ss = String(dt.getSeconds()).padStart(2, "0");
        debugLogEl.textContent = `[${hh}:${mm}:${ss}] ${msg}
` + debugLogEl.textContent;
      }
      function getDestText(train) {
        return String((train == null ? void 0 : train.destName) || (train == null ? void 0 : train.dest) || "").trim();
      }
      function buildAlarmMessage(train, indexes, stationIdx, stopped) {
        const type = String((train == null ? void 0 : train.displayType) || "");
        const nick = String((train == null ? void 0 : train.nickname) || "");
        const typePart = nick ? `${type} ${nick}` : type;
        const dest = getDestText(train);
        const destPart = dest ? `${dest}\u884C\u304D` : "";
        const stoppedPart = stopped ? "\uFF08\u505C\u8ECA\uFF09" : "";
        return `${typePart} ${destPart} ${stoppedPart}`.trim();
      }
      function configuredTypeTextClass(typeLabel) {
        if (!typeLabel) return "";
        const trimmed = String(typeLabel).trim();
        const exact = typeColorsMap.get(trimmed);
        if (exact) return exact;
        for (const [key, cls] of typeColorsMap.entries()) {
          if (trimmed.includes(key) || key.includes(trimmed)) return cls;
        }
        return "";
      }
      function getDelayThreshold() {
        try {
          const v = getSetting("delay.threshold", null);
          if (v !== null && v !== void 0) return Number(v) || 0;
          const el = document.getElementById("delayThreshold");
          return el ? Number(el.value) || 4 : 4;
        } catch (e) {
          return 4;
        }
      }
      function getCarsThreshold() {
        try {
          const v = getSetting("cars.threshold", null);
          if (v !== null && v !== void 0) return Number(v) || 0;
          const el = document.getElementById("carsThreshold");
          return el ? Number(el.value) || 9 : 9;
        } catch (e) {
          return 9;
        }
      }
      function isCarsFilterEnabled() {
        try {
          const v = getSetting("cars.filterEnabled", null);
          if (v === "1" || v === 1 || v === true) return true;
          const cb = document.getElementById("carsFilterEnable");
          return cb ? !!cb.checked : false;
        } catch (e) {
          return false;
        }
      }
      function playAlarmSound() {
        return __async(this, null, function* () {
          try {
            alarmAudio.currentTime = 0;
            yield alarmAudio.play();
            return alarmAudio.duration * 1e3;
          } catch (e) {
            return 0;
          }
        });
      }
      function playBeep() {
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.value = 800;
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(1e-3, ctx.currentTime + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.3);
          return 350;
        } catch (e) {
          return 0;
        }
      }
      var alarmSystem = createAlarmSystem({
        get area() {
          return getArea();
        },
        get line() {
          var _a, _b, _c;
          return selectedCode ? ((_c = (_b = (_a = currentData == null ? void 0 : currentData.stations) == null ? void 0 : _a.byCode) == null ? void 0 : _b[selectedCode]) == null ? void 0 : _c.line) || "" : "";
        },
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
        notifyIfBackground,
        playAlarmSound,
        playBeep,
        bindAudioUnlockOnce,
        getAudioUnlocked
      });
      function fetchView() {
        return __async(this, null, function* () {
          const lines = getLines();
          const station = selectedCode || "";
          if (!lines || !station) return null;
          const params = new URLSearchParams({ area: getArea(), lines, station, dir: currentDir });
          const base = apiBaseUrl || "/";
          try {
            const resp = yield fetch(`${base}api/view?${params}`, { cache: "no-store" });
            if (!resp.ok) throw new Error(`${resp.status}`);
            return yield resp.json();
          } catch (e) {
            console.warn("Failed to fetch /api/view:", e);
            return null;
          }
        });
      }
      function resolveStation(name) {
        return __async(this, null, function* () {
          if (!name) return "";
          const base = apiBaseUrl || "/";
          try {
            const resp = yield fetch(`${base}api/resolve-station?area=${encodeURIComponent(getArea())}&name=${encodeURIComponent(name)}`, { cache: "no-store" });
            if (resp.ok) {
              const data = yield resp.json();
              return data.code || "";
            }
          } catch (e) {
          }
          return "";
        });
      }
      function renderAll(data) {
        var _a, _b, _c;
        if (!data) return;
        const stationInfo = data.station;
        const indexes = data.stations;
        const upTrains = ((_a = data.trains) == null ? void 0 : _a.up) || [];
        const downTrains = ((_b = data.trains) == null ? void 0 : _b.down) || [];
        typeColorsMap.clear();
        if (data.typeColors) {
          for (const [k, v] of Object.entries(data.typeColors)) {
            typeColorsMap.set(k, v);
          }
        }
        const passSetting = (passFilter == null ? void 0 : passFilter.value) || "hide";
        let displayUp = upTrains;
        let displayDown = downTrains;
        if (passSetting === "hide") {
          displayUp = upTrains.filter((t) => t.stopped);
          displayDown = downTrains.filter((t) => t.stopped);
        }
        const upEl = trainsUp == null ? void 0 : trainsUp.querySelector(".train-items");
        const dnEl = trainsDown == null ? void 0 : trainsDown.querySelector(".train-items");
        if (upEl) renderTrainList(upEl, displayUp, indexes, { typeColorTextClassFn: configuredTypeTextClass });
        if (dnEl) renderTrainList(dnEl, displayDown, indexes, { typeColorTextClassFn: configuredTypeTextClass });
        if (trainsUp) trainsUp.style.display = currentDir === "both" || currentDir === "up" ? "" : "none";
        if (trainsDown) trainsDown.style.display = currentDir === "both" || currentDir === "down" ? "" : "none";
        if (trafficInfoEl && data.trafficInfo) {
          renderTrafficInfo(trafficInfoEl, getLines().split(",").filter(Boolean), data.trafficInfo);
        }
        if (paramsView && stationInfo) {
          paramsView.textContent = `${stationInfo.name}\u99C5`;
        }
        if (updatedAtEl && data.update) {
          updatedAtEl.textContent = `\u66F4\u65B0: ${new Date(data.update).toLocaleTimeString("ja-JP")}`;
        }
        if (stationFilter && ((_c = indexes == null ? void 0 : indexes.order) == null ? void 0 : _c.length)) {
          const currentValue = stationFilter.value;
          const options = indexes.order.map((code) => {
            const info = indexes.byCode[code];
            return `<option value="${code}"${code === currentValue ? " selected" : ""}>${(info == null ? void 0 : info.name) || code}</option>`;
          });
          if (!stationFilter.innerHTML.includes('option value="' + indexes.order[0] + '"')) {
            const placeholder = stationFilter.querySelector('option[value=""]');
            stationFilter.innerHTML = (placeholder ? placeholder.outerHTML : '<option value="">\uFF08\u672A\u9078\u629E\uFF09</option>') + options.join("");
          }
        }
      }
      function refreshTrains() {
        return __async(this, null, function* () {
          var _a, _b, _c, _d;
          if (refreshing) return;
          refreshing = true;
          try {
            if (!selectedCode) return;
            currentData = yield fetchView();
            if (currentData) {
              renderAll(currentData);
              debugLog(`fetched trains: up=${((_b = (_a = currentData.trains) == null ? void 0 : _a.up) == null ? void 0 : _b.length) || 0} down=${((_d = (_c = currentData.trains) == null ? void 0 : _c.down) == null ? void 0 : _d.length) || 0}`);
            }
          } catch (e) {
            debugLog(`refresh failed: ${e}`);
          } finally {
            refreshing = false;
          }
        });
      }
      function checkAlarms() {
        var _a, _b, _c, _d, _e, _f, _g;
        if (!currentData || !selectedCode) return;
        const indexes = currentData.stations;
        const stationIdx = (_b = (_a = indexes == null ? void 0 : indexes.byCode) == null ? void 0 : _a[selectedCode]) == null ? void 0 : _b.index;
        const stationInfo = (_c = indexes == null ? void 0 : indexes.byCode) == null ? void 0 : _c[selectedCode];
        const allowedCats = stationAllowedCategories(stationInfo);
        const dirParam = currentDir === "both" ? "" : currentDir;
        const allTrains = [
          ...((_d = currentData.trains) == null ? void 0 : _d.up) || [],
          ...((_e = currentData.trains) == null ? void 0 : _e.down) || []
        ];
        try {
          alarmSystem.setLastShown(((_f = currentData.trains) == null ? void 0 : _f.up) || [], ((_g = currentData.trains) == null ? void 0 : _g.down) || [], indexes);
          alarmSystem.handleApproachAlarms(indexes, allTrains, selectedCode, stationIdx, allowedCats, dirParam);
        } catch (e) {
          debugLog(`alarm check failed: ${e}`);
        }
      }
      function doRefresh() {
        return __async(this, null, function* () {
          yield refreshTrains();
          checkAlarms();
        });
      }
      function bindControls() {
        if (stationFilter) {
          stationFilter.addEventListener("change", () => __async(null, null, function* () {
            var _a, _b;
            selectedCode = stationFilter.value;
            if (selectedCode) {
              setSetting(`lines.${selectedCode}.station`, selectedCode);
            }
            try {
              alarmSystem.initAlarmControls();
            } catch (e) {
            }
            yield doRefresh();
            try {
              const stationInfo = (_b = (_a = currentData == null ? void 0 : currentData.stations) == null ? void 0 : _a.byCode) == null ? void 0 : _b[selectedCode];
              const allowedCats = stationAllowedCategories(stationInfo);
              alarmSystem.renderAlarmOptions(currentData == null ? void 0 : currentData.stations, selectedCode, allowedCats, currentDir === "both" ? "" : currentDir);
            } catch (e) {
            }
          }));
        }
        if (passFilter) {
          passFilter.addEventListener("change", () => {
            if (currentData) renderAll(currentData);
          });
        }
        if (refreshStationsBtn) {
          refreshStationsBtn.addEventListener("click", () => __async(null, null, function* () {
            try {
              clearAreaCache();
            } catch (e) {
            }
            yield doRefresh();
          }));
        }
        const delayEl = document.getElementById("delayThreshold");
        const carsEl = document.getElementById("carsThreshold");
        const carsFilterEl = document.getElementById("carsFilterEnable");
        if (delayEl) {
          delayEl.value = getDelayThreshold();
          delayEl.addEventListener("change", () => setSetting("delay.threshold", delayEl.value));
        }
        if (carsEl) {
          carsEl.value = getCarsThreshold();
          carsEl.addEventListener("change", () => setSetting("cars.threshold", carsEl.value));
        }
        if (carsFilterEl) {
          carsFilterEl.checked = isCarsFilterEnabled();
          carsFilterEl.addEventListener("change", () => setSetting("cars.filterEnabled", carsFilterEl.checked ? "1" : "0"));
        }
        initBackgroundControls({ getSetting, setSetting, dbg });
      }
      function clearAreaCache() {
        const area = getArea();
        try {
          for (const key of Object.keys(localStorage)) {
            if (key.startsWith(`tid:areaStations:${area}`) || key.startsWith(`tid:cross:${area}`)) {
              localStorage.removeItem(key);
            }
          }
        } catch (e) {
        }
      }
      var refreshTimer = null;
      function startAutoRefresh() {
        stopAutoRefresh();
        doRefresh();
        refreshTimer = setInterval(doRefresh, 1e4);
        document.addEventListener("visibilitychange", () => {
          if (!document.hidden) doRefresh();
        });
      }
      function stopAutoRefresh() {
        if (refreshTimer) {
          clearInterval(refreshTimer);
          refreshTimer = null;
        }
      }
      function init2() {
        return __async(this, null, function* () {
          migrateLegacySettings();
          initDebugPanel();
          debugLog("init started");
          const fixedStationName = getFixedStationName();
          if (fixedStationName && !selectedCode) {
            selectedCode = yield resolveStation(fixedStationName);
            debugLog(`resolved ${fixedStationName} -> ${selectedCode}`);
          }
          if (stationFilter && selectedCode) {
            stationFilter.value = selectedCode;
          }
          bindControls();
          try {
            alarmSystem.initAlarmControls();
          } catch (e) {
          }
          if (!audioUnlocked && unlockOverlay) {
            unlockOverlay.classList.remove("is-hidden");
            unlockOverlay.removeAttribute("aria-hidden");
            if (unlockHint) unlockHint.textContent = "\u30AF\u30EA\u30C3\u30AF\u307E\u305F\u306F\u30BF\u30C3\u30D7\u3067\u8A31\u53EF";
          }
          bindAudioUnlockOnce();
          startAutoRefresh();
          debugLog("init done");
        });
      }
      init2();
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
