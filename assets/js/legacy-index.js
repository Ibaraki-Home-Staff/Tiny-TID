(() => {
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

  // assets/js/components.js
  var APP_VERSION_META_SELECTOR = 'meta[name="app:version"]';
  var COMPONENTS = Object.freeze([
    { selector: '[data-include="header"]', path: "/components/header.html" },
    { selector: '[data-include="footer"]', path: "/components/footer.html" }
  ]);
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

  // assets/js/area.js
  var API_BASE = typeof window !== "undefined" && window.TID_API_BASE || "/api/v3/";
  var AREA_ENDPOINT = (area) => `${API_BASE}area_${area}_master.json`;
  var FALLBACK_AREA_ENDPOINTS = (area) => [
    `/assets/data/area_${area}_master.json`,
    `/area_${area}_master.json`
  ];
  var STORAGE_KEYS = Object.freeze({
    selectedArea: "selectedArea",
    selectedLine: (area) => `selectedLine:${area}`,
    selectedDirection: (area, line) => `selectedDirection:${area}:${line}`
  });
  function storageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }
  function storageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
    }
  }
  function initAreaAndLineSelectors() {
    const areaSelect = document.getElementById("areaSelect");
    const lineSelect = document.getElementById("lineSelect");
    const showButton = document.getElementById("showBtn");
    const directionInputs = Array.from(document.querySelectorAll('input[name="direction"]'));
    if (!areaSelect || !lineSelect) return;
    updateShowButtonState(showButton, false);
    restoreInitialSelection({ areaSelect, lineSelect, directionInputs, showButton });
    areaSelect.addEventListener("change", () => __async(null, null, function* () {
      const area = areaSelect.value;
      storageSet(STORAGE_KEYS.selectedArea, area);
      yield populateLinesForArea(area, lineSelect);
      const restored = restoreSavedLine(area, lineSelect);
      if (restored) {
        restoreSavedDirection(area, lineSelect.value, directionInputs);
      } else {
        setDirection(directionInputs, "both");
      }
      updateShowButtonState(showButton, Boolean(areaSelect.value && lineSelect.value));
    }));
    lineSelect.addEventListener("change", () => {
      const area = areaSelect.value;
      const line = lineSelect.value;
      if (area && line) {
        storageSet(STORAGE_KEYS.selectedLine(area), line);
        if (!restoreSavedDirection(area, line, directionInputs)) {
          setDirection(directionInputs, "both");
        }
      }
      updateShowButtonState(showButton, Boolean(area && line));
    });
    showButton == null ? void 0 : showButton.addEventListener("click", () => {
      const area = areaSelect.value;
      const line = lineSelect.value;
      if (!area || !line) return;
      const url = new URL("/TID.html", window.location.origin);
      url.searchParams.set("area", area);
      url.searchParams.set("line", line);
      const direction = getDirection(directionInputs);
      if (direction !== "both") {
        url.searchParams.set("dir", direction);
      }
      window.location.assign(url.toString());
    });
  }
  function restoreInitialSelection(_0) {
    return __async(this, arguments, function* ({ areaSelect, lineSelect, directionInputs, showButton }) {
      const savedArea = storageGet(STORAGE_KEYS.selectedArea);
      if (!savedArea || !hasOption(areaSelect, savedArea)) return;
      areaSelect.value = savedArea;
      yield populateLinesForArea(savedArea, lineSelect);
      const hasRestoredLine = restoreSavedLine(savedArea, lineSelect);
      if (hasRestoredLine) {
        restoreSavedDirection(savedArea, lineSelect.value, directionInputs);
        updateShowButtonState(showButton, true);
        return;
      }
      setDirection(directionInputs, "both");
    });
  }
  function hasOption(select, value) {
    return Array.from(select.options).some((option) => option.value === value);
  }
  function restoreSavedLine(area, lineSelect) {
    const savedLine = storageGet(STORAGE_KEYS.selectedLine(area));
    if (!savedLine || !hasOption(lineSelect, savedLine)) return false;
    lineSelect.value = savedLine;
    return true;
  }
  function setDirection(directionInputs, value) {
    let matched = false;
    for (const input of directionInputs) {
      if (input.value === value) {
        input.checked = true;
        matched = true;
      }
    }
    if (!matched) {
      const defaultDirection = directionInputs.find((input) => input.value === "both");
      if (defaultDirection) defaultDirection.checked = true;
    }
  }
  function getDirection(directionInputs) {
    const selected = directionInputs.find((input) => input.checked);
    return (selected == null ? void 0 : selected.value) || "both";
  }
  function restoreSavedDirection(area, line, directionInputs) {
    const savedDirection = storageGet(STORAGE_KEYS.selectedDirection(area, line));
    if (!savedDirection) return false;
    setDirection(directionInputs, savedDirection);
    return true;
  }
  function updateShowButtonState(button, enabled) {
    if (!button) return;
    button.disabled = !enabled;
  }
  document.addEventListener("change", (event) => {
    var _a, _b;
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.name !== "direction") return;
    const area = (_a = document.getElementById("areaSelect")) == null ? void 0 : _a.value;
    const line = (_b = document.getElementById("lineSelect")) == null ? void 0 : _b.value;
    if (!area || !line) return;
    storageSet(STORAGE_KEYS.selectedDirection(area, line), target.value);
  });
  function populateLinesForArea(area, lineSelect) {
    return __async(this, null, function* () {
      setSelectMessage(lineSelect, "\u8AAD\u307F\u8FBC\u307F\u4E2D\u2026", { disabled: true });
      try {
        const master = yield fetchAreaMaster(area);
        const lines = normalizeLines(master == null ? void 0 : master.lines);
        if (!lines.length) {
          setSelectMessage(lineSelect, "\u8DEF\u7DDA\u30C7\u30FC\u30BF\u304C\u898B\u3064\u304B\u308A\u307E\u305B\u3093", { disabled: true });
          return;
        }
        renderLineOptions(lineSelect, lines);
      } catch (error) {
        console.error("\u30A8\u30EA\u30A2\u53D6\u5F97\u306B\u5931\u6557", error);
        setSelectMessage(lineSelect, "\u53D6\u5F97\u306B\u5931\u6557\u3057\u307E\u3057\u305F", { disabled: true });
      }
    });
  }
  function fetchAreaMaster(area) {
    return __async(this, null, function* () {
      const candidates = [AREA_ENDPOINT(area), ...FALLBACK_AREA_ENDPOINTS(area)];
      let lastError = null;
      for (const url of candidates) {
        try {
          const response = yield fetch(url, { cache: "no-store" });
          if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
          return yield response.json();
        } catch (error) {
          lastError = error;
        }
      }
      throw lastError || new Error(`Failed to load area master: ${area}`);
    });
  }
  function normalizeLines(lines) {
    if (!lines) return [];
    const normalized = Array.isArray(lines) ? lines.map((line) => {
      var _a;
      return {
        id: (line == null ? void 0 : line.id) || (line == null ? void 0 : line.line) || inferLineId(line),
        name: (line == null ? void 0 : line.name) || (line == null ? void 0 : line.label) || (line == null ? void 0 : line.id) || "",
        range: (line == null ? void 0 : line.range) || "",
        index: (_a = line == null ? void 0 : line.index) != null ? _a : 0
      };
    }) : Object.entries(lines).map(([id, line]) => {
      var _a;
      return {
        id: id || inferLineId(line),
        name: (line == null ? void 0 : line.name) || id,
        range: (line == null ? void 0 : line.range) || "",
        index: (_a = line == null ? void 0 : line.index) != null ? _a : 0
      };
    });
    return normalized.filter((line) => line.id && line.name).sort((a, b) => a.index - b.index);
  }
  function inferLineId(line) {
    var _a, _b;
    const st = typeof (line == null ? void 0 : line.st) === "string" ? line.st : "";
    const pos = typeof (line == null ? void 0 : line.pos) === "string" ? line.pos : "";
    const fromSt = (_a = st.match(/\/([^/]+)_st\.json$/)) == null ? void 0 : _a[1];
    if (fromSt) return fromSt;
    const fromPos = (_b = pos.match(/\/([^/]+)\.json$/)) == null ? void 0 : _b[1];
    return fromPos || "";
  }
  function renderLineOptions(select, lines) {
    select.innerHTML = "";
    select.disabled = false;
    select.style.color = "";
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "\u8DEF\u7DDA\u3092\u9078\u629E\u3057\u3066\u304F\u3060\u3055\u3044";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.appendChild(placeholder);
    for (const line of lines) {
      const option = document.createElement("option");
      option.value = line.id;
      option.textContent = [line.name, line.range].filter(Boolean).join(" ") || line.id;
      select.appendChild(option);
    }
  }
  function setSelectMessage(select, message, { disabled }) {
    select.disabled = disabled;
    select.style.color = "var(--color-muted)";
    select.innerHTML = `<option value="">${message}</option>`;
  }

  // assets/js/main.js
  document.addEventListener("DOMContentLoaded", () => {
    loadComponents();
    initAreaAndLineSelectors();
  });
})();
