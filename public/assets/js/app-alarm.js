// Client approach-alarm engine (display-only app).
// Port of tid-alarm.js trigger rules; geometry inputs come from /api/view.
import { getSetting, setSetting } from './tid-settings.js';

const SUPPRESS_MS = 3 * 60 * 1000;
const STORE_KEY = 'tid:v1:alarm:approachSuppression';
const CATEGORY_LABELS = { 0:'普通',1:'新快速',2:'快速',3:'区間快速',4:'直通快速',5:'特急',6:'急行',7:'寝台',8:'SL',9:'観光列車',10:'瑞風' };

let lineScope = '';
let area = 'kinki';
let line = 'kyoto';
let audioEl = null;
let audioUnlocked = false;
let pendingQueue = [];

export function initAlarm({ scope, areaId, lineId }) {
  lineScope = scope; area = areaId; line = lineId;
}

export function unlocked() { return audioUnlocked; }

export function requestUnlock(onReady) {
  const overlay = document.getElementById('audioUnlockOverlay');
  const btn = document.getElementById('audioUnlockBtn');
  const later = document.getElementById('audioUnlockLater');
  const close = document.getElementById('audioUnlockClose');
  if (!overlay || overlay.dataset.bound === '1') return;
  overlay.dataset.bound = '1';
  const show = () => { overlay.classList.remove('is-hidden'); overlay.removeAttribute('aria-hidden'); };
  const hide = () => { overlay.classList.add('is-hidden'); overlay.setAttribute('aria-hidden','true'); };
  window.__tidShowAudioOverlay = show;
  btn?.addEventListener('click', async () => {
    try {
      await prime();
      audioUnlocked = true;
    } catch {}
    hide();
    onReady && onReady();
    flush();
  });
  later?.addEventListener('click', hide);
  close?.addEventListener('click', hide);
  show();
}

async function prime() {
  if (!audioEl) {
    audioEl = document.createElement('audio');
    audioEl.src = '/assets/sound/alarm.mp3';
    audioEl.preload = 'auto';
    audioEl.setAttribute('playsinline','');
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);
  }
  try { await audioEl.play(); audioEl.pause(); audioEl.currentTime = 0; } catch {}
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      const ctx = new Ctx();
      await ctx.resume();
      const osc = ctx.createOscillator(), g = ctx.createGain();
      g.gain.value = 0.0001; osc.connect(g); g.connect(ctx.destination);
      osc.start(); osc.stop(ctx.currentTime + 0.01);
      setTimeout(() => ctx.close?.(), 300);
    }
  } catch {}
}

function approachKey(no, st, dir) {
  return `approach:${area}:${line}:${st || '_none'}:${dir}:${no || '?'}`;
}

function loadStore() {
  try {
    const obj = JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
    const now = Date.now();
    let changed = false;
    for (const k of Object.keys(obj)) {
      const ts = Number(obj[k]);
      if (!Number.isFinite(ts) || now - ts >= SUPPRESS_MS) { delete obj[k]; changed = true; }
    }
    if (changed) localStorage.setItem(STORE_KEY, JSON.stringify(obj));
    return obj;
  } catch { return {}; }
}

function recentlyAnnounced(no, st, dir) {
  const k = approachKey(no, st, dir);
  const ts = Number(loadStore()[k]);
  return Number.isFinite(ts) && Date.now() - ts < SUPPRESS_MS;
}

function markAnnounced(no, st, dir) {
  const obj = loadStore();
  obj[approachKey(no, st, dir)] = Date.now();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(obj)); } catch {}
}

async function playAlarm() {
  if (!audioEl) await prime();
  try { audioEl.currentTime = 0; await audioEl.play(); return; } catch {}
  // WebAudio beep fallback (280ms)
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx(); await ctx.resume();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.frequency.value = 880; g.gain.value = 0.2;
    osc.connect(g); g.connect(ctx.destination);
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close?.(); }, 280);
  } catch {}
}

function showAlarmModal(meta) {
  let wrap = document.querySelector('.tid-alert-overlay');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'tid-alert-overlay is-hidden';
    wrap.setAttribute('role','dialog'); wrap.setAttribute('aria-modal','true');
    wrap.innerHTML = `<div class="tid-alert__panel" role="document">
      <h2 id="tidAlertTitle" class="tid-alert__title">列車接近</h2>
      <div class="tid-alert__groups">
        <div class="tid-alert__row"><div class="tid-alert__label">列番</div><div class="tid-alert__value" data-alert-no>-</div></div>
        <div class="tid-alert__row"><div class="tid-alert__label">行先</div><div class="tid-alert__value" data-alert-dest>-</div></div>
        <div class="tid-alert__row"><div class="tid-alert__label">種別</div><div class="tid-alert__value" data-alert-type>-</div></div>
        <div class="tid-alert__row"><div class="tid-alert__label">愛称</div><div class="tid-alert__value" data-alert-nick>-</div></div>
        <div class="tid-alert__row"><div class="tid-alert__label">遅れ</div><div class="tid-alert__value" data-alert-delay>-</div></div>
      </div>
      <div class="tid-alert__actions"><button type="button" class="btn" data-alert-ok>確認</button></div></div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('[data-alert-ok]')?.addEventListener('click', () => hide());
  }
  const titleEl = wrap.querySelector('#tidAlertTitle');
  if (titleEl) titleEl.textContent = meta.direction === 0 ? '上り列車接近' : meta.direction === 1 ? '下り列車接近' : '列車接近';
  const set = (sel, text) => { const el = wrap.querySelector(sel); if (el) el.textContent = text || '-'; };
  set('[data-alert-no]', meta.no); set('[data-alert-dest]', meta.destText);
  set('[data-alert-type]', meta.displayType); set('[data-alert-nick]', meta.nickname);
  set('[data-alert-delay]', meta.delayMinutes > 0 ? `${meta.delayMinutes}分` : 'なし');
  wrap.classList.remove('is-hidden');
  clearTimeout(showAlarmModal._t);
  showAlarmModal._t = setTimeout(hide, 10000);
}
function hide() {
  document.querySelector('.tid-alert-overlay')?.classList.add('is-hidden');
}

export function evaluateAndNotify({ stations, trains, stationCode }) {
  const order = stations.map((s) => s.code);
  const idxOf = new Map(stations.map((s) => [s.code, s.index]));
  const pos = order.indexOf(stationCode);

  for (const t of trains) {
    let stopFired = false;
    const dirKey = t.direction === 0 ? 'up' : 'down';
    const cfg = getLineConfigSafe();
    const stCfg = cfg?.alarms?.[stationCode]?.[dirKey] || {};
    if (stCfg.disabled) continue;
    const prefs = new Set(Array.isArray(stCfg.prefs) ? stCfg.prefs : []);
    if (getSetting('cars.filterEnabled', false)) {
      const cars = Number(t.cars);
      const min = Number(getSetting('cars.threshold', 9));
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
    const target = readTarget(dirKey, stationCode, t.category) || ahead[0];
    if (!target) continue;

    const selIdx = idxOf.get(stationCode);
    const tgtIdx = idxOf.get(target);
    const stoppedAt = t.stopped && t.atUnit === target;
    const movingOn = !t.stopped && (t.direction === 0 ? t.nextUnit === target : t.atUnit === target);
    const boundary = stoppedAt || movingOn;
    let range = false;
    if (selIdx != null && tgtIdx != null) {
      if (!((t.direction === 0 && tgtIdx < selIdx) || (t.direction === 1 && tgtIdx > selIdx))) {
        const lo = Math.min(selIdx, tgtIdx), hi = Math.max(selIdx, tgtIdx);
        range = lo === hi ? t.posIndex === lo
          : t.direction === 0 ? t.posIndex >= selIdx && t.posIndex <= hi
          : t.direction === 1 ? t.posIndex <= selIdx && t.posIndex >= lo
          : true;
      }
    }

    if ((boundary || range) && prefs.has(`cat:${t.category}`)) {
      fire(t, target, stationCode, dirKey, range ? 'range' : 'segment');
      stopFired = true;
      continue;
    }
    if (!stopFired && prefs.has('pass')) {
      const passTarget = stCfg.targets?.pass ? String(stCfg.targets.pass) : ahead[0];
      if (passTarget && (stoppedAt || movingOn) && t.willStopHere === false) {
        fire(t, passTarget, stationCode, dirKey, 'pass');
      }
    }
  }
}

function fire(t, target, stationCode, dirKey, reason) {
  const no = t.no || '?';
  if (recentlyAnnounced(no, stationCode, t.direction)) return;
  markAnnounced(no, stationCode, t.direction);
  if (!audioUnlocked) {
    window.__tidShowAudioOverlay?.();
    pendingQueue.push(t);
    return;
  }
  void playAlarm();
  showAlarmModal({ ...t, reason });
  try {
    if (getSetting('bg.notify', null) === '1' && document.hidden && 'Notification' in window
        && Notification.permission === 'granted') {
      new Notification('列車接近', { body: `${no}、${t.destText || ''}接近`, tag: approachKey(no, stationCode, t.direction), renotify: true, icon: '/assets/img/placeholder.svg' });
    }
  } catch {}
}

async function flush() {
  const q = pendingQueue.splice(0);
  for (const t of q) {
    await playAlarm();
    showAlarmModal(t);
  }
}

function getLineConfigSafe() {
  try {
    // tid-settings exports getLineConfig; re-imported lazily to avoid cycles.
    return getLineConfigRef ? getLineConfigRef(lineScope) : undefined;
  } catch { return undefined; }
}
function readTarget(dirKey, st, cat) {
  const cfg = getLineConfigSafe();
  const obj = cfg?.alarms?.[st]?.[dirKey]?.targets;
  const v = obj && obj[`cat:${cat}`];
  return v ? String(v) : null;
}

let getLineConfigRef = null;
export function bindLineConfig(fn) { getLineConfigRef = fn; }

// ---------------------------------------------------------------------------
// Alarm preference UI (port of ver1 renderAlarmOptions / initAlarmControls)
// ---------------------------------------------------------------------------

const CAT_LABELS = { 0:'普通',1:'新快速',2:'快速',3:'区間快速',4:'直通快速',5:'特急',6:'急行',7:'寝台',8:'SL',9:'観光列車',10:'瑞風' };
let controlsBound = false;

function readDisable(dir, stCode) {
  try {
    const cfg = getLineConfigSafe();
    const v = cfg?.alarms?.[stCode]?.[dir]?.disabled;
    return v === undefined ? false : !!v;
  } catch { return false; }
}
function saveDisable(dir, stCode, v) {
  try { setSetting(`lines.${lineScope}.alarms.${stCode}.${dir}.disabled`, !!v); } catch {}
}
function readPrefs(dir, stCode) {
  try {
    const cfg = getLineConfigSafe();
    const arr = cfg?.alarms?.[stCode]?.[dir]?.prefs;
    return new Set(Array.isArray(arr) ? arr : []);
  } catch { return new Set(); }
}
function savePrefs(dir, stCode, values) {
  try { setSetting(`lines.${lineScope}.alarms.${stCode}.${dir}.prefs`, Array.from(values || [])); } catch {}
}
function readTargets(dir, stCode) {
  try {
    const cfg = getLineConfigSafe();
    const obj = cfg?.alarms?.[stCode]?.[dir]?.targets;
    return (obj && typeof obj === 'object') ? obj : {};
  } catch { return {}; }
}
function saveTarget(dir, stCode, catKey, code) {
  try {
    const obj = readTargets(dir, stCode);
    obj[catKey] = String(code || '');
    setSetting(`lines.${lineScope}.alarms.${stCode}.${dir}.targets`, obj);
  } catch {}
}

function setDisabledForDir(dir, disabled) {
  const sel = dir === 'up' ? '[data-alarm-up]' : '[data-alarm-down]';
  document.querySelectorAll(sel).forEach((b) => {
    b.disabled = !!disabled;
    const p = b.parentElement;
    if (p && p.style) p.style.opacity = disabled ? '0.5' : '';
  });
  const fs = document.getElementById(dir === 'up' ? 'alarmUpBox' : 'alarmDownBox');
  if (fs) fs.querySelectorAll('select').forEach((s2) => { s2.disabled = !!disabled || s2.options.length === 0 || s2.value === ''; });
}

export function bindAlarmControls(stationCode) {
  const upDis = document.getElementById('alarmUpDisable');
  const dnDis = document.getElementById('alarmDownDisable');
  if (upDis) {
    upDis.checked = readDisable('up', stationCode);
    setDisabledForDir('up', upDis.checked);
    upDis.onchange = () => { saveDisable('up', stationCode, upDis.checked); setDisabledForDir('up', upDis.checked); };
  }
  if (dnDis) {
    dnDis.checked = readDisable('down', stationCode);
    setDisabledForDir('down', dnDis.checked);
    dnDis.onchange = () => { saveDisable('down', stationCode, dnDis.checked); setDisabledForDir('down', dnDis.checked); };
  }
  if (!controlsBound) {
    document.getElementById('alarmUpBox')?.addEventListener('change', () => {
      const vals = new Set(Array.from(document.querySelectorAll('[data-alarm-up]')).filter((b) => b.checked).map((b) => b.value));
      savePrefs('up', stationCode, vals);
    });
    document.getElementById('alarmDownBox')?.addEventListener('change', () => {
      const vals = new Set(Array.from(document.querySelectorAll('[data-alarm-down]')).filter((b) => b.checked).map((b) => b.value));
      savePrefs('down', stationCode, vals);
    });
    controlsBound = true;
  }
}

export function renderAlarmOptions({ stations, stationCode, allowedCats, dirParam }) {
  const upBox = document.getElementById('alarmUpOptions');
  const dnBox = document.getElementById('alarmDownOptions');
  const row = document.getElementById('alarmRow');
  const upFs = document.getElementById('alarmUpBox');
  const dnFs = document.getElementById('alarmDownBox');
  if (!upBox || !dnBox || !row) return;
  if (!stationCode) { row.style.display = 'none'; upBox.innerHTML = ''; dnBox.innerHTML = ''; return; }
  row.style.display = 'flex';
  if (dirParam === 'up') { if (upFs) upFs.style.display = ''; if (dnFs) dnFs.style.display = 'none'; }
  else if (dirParam === 'down') { if (upFs) upFs.style.display = 'none'; if (dnFs) dnFs.style.display = ''; }
  else { if (upFs) upFs.style.display = ''; if (dnFs) dnFs.style.display = ''; }

  bindAlarmControls(stationCode);
  const upDisable = document.getElementById('alarmUpDisable');
  const dnDisable = document.getElementById('alarmDownDisable');
  if (upDisable) upDisable.checked = readDisable('up', stationCode);
  if (dnDisable) dnDisable.checked = readDisable('down', stationCode);

  const cats = (Array.isArray(allowedCats) ? allowedCats : Object.keys(CAT_LABELS).map(Number))
    .slice().sort((x, y) => x - y);
  const order = stations.map((s) => s.code);
  const pos = order.indexOf(stationCode);
  const ahead = (dir) => {
    const out = [];
    if (pos < 0) return out;
    const step = dir === 'up' ? 1 : -1;
    for (let k = 1; k <= 3; k += 1) {
      const i = pos + step * k;
      if (i >= 0 && i < order.length) out.push(order[i]);
    }
    return out;
  };
  const nameOf = (code) => stations.find((s) => s.code === code)?.name || code;

  const build = (container, attr, dir) => {
    container.innerHTML = '';
    const saved = readPrefs(dir, stationCode);
    const targets = readTargets(dir, stationCode);
    cats.forEach((cat) => {
      const catKey = `cat:${cat}`;
      const wrap = document.createElement('label');
      Object.assign(wrap.style, {
        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1.1rem',
        margin: '0.35rem 0', border: '1px solid #e0e0e0', borderRadius: '0.5rem',
        fontSize: '1.15rem', minHeight: '52px', cursor: 'pointer',
      });
      const input = document.createElement('input');
      input.type = 'checkbox'; input.setAttribute(attr, ''); input.value = catKey;
      input.checked = saved.has(catKey);
      input.style.transform = 'scale(1.35)'; input.style.transformOrigin = 'left center';
      wrap.appendChild(input);
      const text = document.createElement('span'); text.textContent = CAT_LABELS[cat] || `種別${cat}`;
      wrap.appendChild(text);
      const sel = document.createElement('select');
      Object.assign(sel.style, { marginLeft: 'auto', fontSize: '1rem', padding: '.4rem .6rem', minWidth: '11rem' });
      const aheadList = ahead(dir);
      if (aheadList.length) {
        aheadList.forEach((code) => {
          const o = document.createElement('option'); o.value = code; o.textContent = nameOf(code);
          sel.appendChild(o);
        });
        sel.value = targets[catKey] && aheadList.includes(targets[catKey]) ? targets[catKey] : aheadList[0];
      } else {
        const o = document.createElement('option'); o.value = ''; o.textContent = '候補なし';
        sel.appendChild(o); sel.disabled = true;
      }
      sel.addEventListener('change', () => saveTarget(dir, stationCode, catKey, sel.value));
      wrap.appendChild(sel);
      container.appendChild(wrap);
    });
    // pass checkbox
    const passWrap = document.createElement('label');
    Object.assign(passWrap.style, {
      display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.9rem 1.1rem',
      margin: '0.35rem 0', border: '1px solid #e0e0e0', borderRadius: '0.5rem',
      fontSize: '1.15rem', minHeight: '52px', cursor: 'pointer',
    });
    const pass = document.createElement('input');
    pass.type = 'checkbox'; pass.setAttribute(attr, ''); pass.value = 'pass';
    pass.checked = saved.has('pass');
    pass.style.transform = 'scale(1.35)'; pass.style.transformOrigin = 'left center';
    passWrap.appendChild(pass);
    const pt = document.createElement('span'); pt.textContent = '通過列車アラーム（停車しない列車が来たとき）';
    passWrap.appendChild(pt);
    container.appendChild(passWrap);
  };
  build(upBox, 'data-alarm-up', 'up');
  build(dnBox, 'data-alarm-down', 'down');
}

// Debug helper (ver1 parity): simulate an approach alarm from the console.
export function testAlarm(trainNo, direction, targetCode) {
  fire({ no: trainNo || 'テスト', direction: direction === 'up' ? 0 : 1, displayType: '快速',
         nickname: 'テスト列車', destText: 'テスト行き', delayMinutes: 0 },
       targetCode || '', 'debug', direction === 'up' ? 'up' : 'down', 'manual-test');
}
