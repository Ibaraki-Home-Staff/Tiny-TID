import { loadComponents } from './components.js';
import {
  trainCategoryFromDisplayType,
  getCategoryLabel,
  typeTextClass,
  stationAllowedCategories,
  getNickname
} from './tid-category.js';
import { initBackgroundControls, notifyIfBackground } from './tid-background.js';
import { createAlarmSystem } from './tid-alarm.js';
import { renderTrafficInfo, renderTrainList } from './tid-render.js';
import { getSetting, setSetting, getLineConfig, migrateLegacySettings } from './tid-settings.js';

loadComponents();

const paramsView = document.getElementById('paramsView');
const trainsContainer = document.getElementById('trainsContainer');
const trainsUp = document.getElementById('trainsUp');
const trainsDown = document.getElementById('trainsDown');
const updatedAtEl = document.getElementById('updatedAt');
const trafficInfoEl = document.getElementById('trafficInfo');
const stationFilter = document.getElementById('stationFilter');
const passFilter = document.getElementById('passFilter');
const refreshStationsBtn = document.getElementById('refreshStationsBtn');
const debugPanel = document.getElementById('debugPanel');

// Config from meta tags
function meta(name) {
  return (document.querySelector(`meta[name="tid:${name}"]`)?.getAttribute('content') || '').trim();
}

function getArea() { return meta('fixedArea'); }
function getLines() { return meta('fixedLines'); }
function getFixedStationName() { return meta('fixedStationName'); }
function getColorUrl() { return meta('colorUrl'); }

// State
let currentData = null;
let selectedCode = '';
let currentDir = 'both';
let refreshing = false;
let typeColorsMap = new Map();
let debugLogEl = null;
let apiBaseUrl = '';

function getApiBase() {
  return (window.TID_API_BASE && String(window.TID_API_BASE)) || '';
}

// Audio
const alarmAudio = document.createElement('audio');
alarmAudio.src = '/assets/sound/alarm.mp3';
alarmAudio.preload = 'auto';
alarmAudio.loop = false;
document.body.appendChild(alarmAudio);

let audioUnlocked = false;
let audioUnlockBound = false;

function getAudioUnlocked() { return audioUnlocked; }

async function performAudioUnlock() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    await ctx.resume();
    src.stop();
    ctx.close();
  } catch (e) { /* ignore */ }
  alarmAudio.muted = false;
  try { await alarmAudio.play(); alarmAudio.pause(); alarmAudio.currentTime = 0; } catch (e) { /* ignore */ }
  audioUnlocked = true;
}

function bindAudioUnlockOnce() {
  if (audioUnlockBound) return;
  audioUnlockBound = true;
  const events = ['click', 'touchstart', 'keydown'];
  async function unlock() {
    if (audioUnlocked) {
      events.forEach(e => document.removeEventListener(e, unlock, { once: true, capture: true }));
      return;
    }
    await performAudioUnlock();
    events.forEach(e => document.removeEventListener(e, unlock, { once: true, capture: true }));
  }
  events.forEach(e => document.addEventListener(e, unlock, { once: true, capture: true }));
}

// Audio unlock UI
const unlockOverlay = document.getElementById('audioUnlockOverlay');
const unlockBtn = document.getElementById('audioUnlockBtn');
const unlockClose = document.getElementById('audioUnlockClose');
const unlockLater = document.getElementById('audioUnlockLater');
const unlockHint = document.getElementById('audioUnlockHint');

if (unlockBtn) {
  unlockBtn.addEventListener('click', async () => {
    await performAudioUnlock();
    unlockOverlay?.classList.add('is-hidden');
    unlockOverlay?.setAttribute('aria-hidden', 'true');
    try { alarmSystem.flushPendingAudio(); } catch (e) { /* ignore */ }
  });
}
if (unlockClose || unlockLater) {
  const hide = () => {
    unlockOverlay?.classList.add('is-hidden');
    unlockOverlay?.setAttribute('aria-hidden', 'true');
  };
  unlockClose?.addEventListener('click', hide);
  unlockLater?.addEventListener('click', hide);
}

// Debug
const TID_DEBUG = !!getSetting('ui.debug', false) || (new URL(window.location.href)).searchParams.has('debug');

function dbg(...args) {
  if (!TID_DEBUG) return;
  console.log('[TID]', ...args);
}

function initDebugPanel() {
  if (!TID_DEBUG) return;
  let panel = document.getElementById('tidDebugPanel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'tidDebugPanel';
    Object.assign(panel.style, {
      position: 'fixed', left: '10px', bottom: '10px', zIndex: '2147483646',
      background: 'rgba(0,0,0,.82)', color: '#0f0', padding: '10px 14px',
      borderRadius: '8px', font: '12px/1.4 monospace', maxWidth: '520px',
      maxHeight: '340px', overflowY: 'auto', whiteSpace: 'pre-wrap',
      pointerEvents: 'auto'
    });
    document.body.appendChild(panel);
  }
  debugLogEl = panel;
}

function debugLog(msg) {
  if (!TID_DEBUG || !debugLogEl) return;
  const dt = new Date();
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  const ss = String(dt.getSeconds()).padStart(2, '0');
  debugLogEl.textContent = `[${hh}:${mm}:${ss}] ${msg}\n` + debugLogEl.textContent;
}

// Alarm message building
function getDestText(train) {
  return String(train?.destName || train?.dest || '').trim();
}

function buildAlarmMessage(train, indexes, stationIdx, stopped) {
  const type = String(train?.displayType || '');
  const nick = String(train?.nickname || '');
  const typePart = nick ? `${type} ${nick}` : type;
  const dest = getDestText(train);
  const destPart = dest ? `${dest}行き` : '';
  const stoppedPart = stopped ? '（停車）' : '';
  return `${typePart} ${destPart} ${stoppedPart}`.trim();
}

function configuredTypeTextClass(typeLabel) {
  if (!typeLabel) return '';
  const trimmed = String(typeLabel).trim();
  const exact = typeColorsMap.get(trimmed);
  if (exact) return exact;
  for (const [key, cls] of typeColorsMap.entries()) {
    if (trimmed.includes(key) || key.includes(trimmed)) return cls;
  }
  return '';
}

// Delay/cars thresholds
function getDelayThreshold() {
  try {
    const v = getSetting('delay.threshold', null);
    if (v !== null && v !== undefined) return Number(v) || 0;
    const el = document.getElementById('delayThreshold');
    return el ? Number(el.value) || 4 : 4;
  } catch (e) { return 4; }
}

function getCarsThreshold() {
  try {
    const v = getSetting('cars.threshold', null);
    if (v !== null && v !== undefined) return Number(v) || 0;
    const el = document.getElementById('carsThreshold');
    return el ? Number(el.value) || 9 : 9;
  } catch (e) { return 9; }
}

function isCarsFilterEnabled() {
  try {
    const v = getSetting('cars.filterEnabled', null);
    if (v === '1' || v === 1 || v === true) return true;
    const cb = document.getElementById('carsFilterEnable');
    return cb ? !!cb.checked : false;
  } catch (e) { return false; }
}

// Alarm sound
async function playAlarmSound() {
  try {
    alarmAudio.currentTime = 0;
    await alarmAudio.play();
    return alarmAudio.duration * 1000;
  } catch (e) { return 0; }
}

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
    return 350;
  } catch (e) { return 0; }
}

// Create alarm system
const alarmSystem = createAlarmSystem({
  get area() { return getArea(); },
  get line() { return selectedCode ? (currentData?.stations?.byCode?.[selectedCode]?.line || '') : ''; },
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

// Fetch train data from backend
async function fetchView() {
  const lines = getLines();
  const station = selectedCode || '';
  if (!lines || !station) return null;

  const params = new URLSearchParams({ area: getArea(), lines, station, dir: currentDir });
  const base = apiBaseUrl || '/';

  try {
    const resp = await fetch(`${base}api/view?${params}`, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`${resp.status}`);
    return await resp.json();
  } catch (e) {
    console.warn('Failed to fetch /api/view:', e);
    return null;
  }
}

// Resolve station name to code
async function resolveStation(name) {
  if (!name) return '';
  const base = apiBaseUrl || '/';
  try {
    const resp = await fetch(`${base}api/resolve-station?area=${encodeURIComponent(getArea())}&name=${encodeURIComponent(name)}`, { cache: 'no-store' });
    if (resp.ok) {
      const data = await resp.json();
      return data.code || '';
    }
  } catch (e) { /* ignore */ }
  return '';
}

// Render
function renderAll(data) {
  if (!data) return;

  const stationInfo = data.station;
  const indexes = data.stations;
  const upTrains = data.trains?.up || [];
  const downTrains = data.trains?.down || [];

  // Update type colors map
  typeColorsMap.clear();
  if (data.typeColors) {
    for (const [k, v] of Object.entries(data.typeColors)) {
      typeColorsMap.set(k, v);
    }
  }

  // Render trains
  const passSetting = passFilter?.value || 'hide';
  let displayUp = upTrains;
  let displayDown = downTrains;
  if (passSetting === 'hide') {
    displayUp = upTrains.filter(t => t.stopped);
    displayDown = downTrains.filter(t => t.stopped);
  }

  const upEl = trainsUp?.querySelector('.train-items');
  const dnEl = trainsDown?.querySelector('.train-items');
  if (upEl) renderTrainList(upEl, displayUp, indexes, { typeColorTextClassFn: configuredTypeTextClass });
  if (dnEl) renderTrainList(dnEl, displayDown, indexes, { typeColorTextClassFn: configuredTypeTextClass });

  // Show/hide direction sections
  if (trainsUp) trainsUp.style.display = (currentDir === 'both' || currentDir === 'up') ? '' : 'none';
  if (trainsDown) trainsDown.style.display = (currentDir === 'both' || currentDir === 'down') ? '' : 'none';

  // Traffic info
  if (trafficInfoEl && data.trafficInfo) {
    renderTrafficInfo(trafficInfoEl, getLines().split(',').filter(Boolean), data.trafficInfo);
  }

  // Params view
  if (paramsView && stationInfo) {
    paramsView.textContent = `${stationInfo.name}駅`;
  }

  // Update time
  if (updatedAtEl && data.update) {
    updatedAtEl.textContent = `更新: ${new Date(data.update).toLocaleTimeString('ja-JP')}`;
  }

  // Populate station filter if needed
  if (stationFilter && indexes?.order?.length) {
    const currentValue = stationFilter.value;
    const options = indexes.order.map(code => {
      const info = indexes.byCode[code];
      return `<option value="${code}"${code === currentValue ? ' selected' : ''}>${info?.name || code}</option>`;
    });
    if (!stationFilter.innerHTML.includes('option value="' + indexes.order[0] + '"')) {
      const placeholder = stationFilter.querySelector('option[value=""]');
      stationFilter.innerHTML = (placeholder ? placeholder.outerHTML : '<option value="">（未選択）</option>') + options.join('');
    }
  }
}

// Main refresh
async function refreshTrains() {
  if (refreshing) return;
  refreshing = true;
  try {
    if (!selectedCode) return;
    currentData = await fetchView();
    if (currentData) {
      renderAll(currentData);
      debugLog(`fetched trains: up=${currentData.trains?.up?.length || 0} down=${currentData.trains?.down?.length || 0}`);
    }
  } catch (e) {
    debugLog(`refresh failed: ${e}`);
  } finally {
    refreshing = false;
  }
}

// Alarm check after render
function checkAlarms() {
  if (!currentData || !selectedCode) return;
  const indexes = currentData.stations;
  const stationIdx = indexes?.byCode?.[selectedCode]?.index;
  const stationInfo = indexes?.byCode?.[selectedCode];
  const allowedCats = stationAllowedCategories(stationInfo);
  const dirParam = currentDir === 'both' ? '' : currentDir;

  const allTrains = [
    ...(currentData.trains?.up || []),
    ...(currentData.trains?.down || [])
  ];

  try {
    alarmSystem.setLastShown(currentData.trains?.up || [], currentData.trains?.down || [], indexes);
    alarmSystem.handleApproachAlarms(indexes, allTrains, selectedCode, stationIdx, allowedCats, dirParam);
  } catch (e) {
    debugLog(`alarm check failed: ${e}`);
  }
}

// Refresh with alarm check
async function doRefresh() {
  await refreshTrains();
  checkAlarms();
}

// UI bindings
function bindControls() {
  if (stationFilter) {
    stationFilter.addEventListener('change', async () => {
      selectedCode = stationFilter.value;
      if (selectedCode) {
        setSetting(`lines.${selectedCode}.station`, selectedCode);
      }
      try { alarmSystem.initAlarmControls(); } catch (e) { /* ignore */ }
      await doRefresh();
      try {
        const stationInfo = currentData?.stations?.byCode?.[selectedCode];
        const allowedCats = stationAllowedCategories(stationInfo);
        alarmSystem.renderAlarmOptions(currentData?.stations, selectedCode, allowedCats, currentDir === 'both' ? '' : currentDir);
      } catch (e) { /* ignore */ }
    });
  }

  if (passFilter) {
    passFilter.addEventListener('change', () => {
      if (currentData) renderAll(currentData);
    });
  }

  if (refreshStationsBtn) {
    refreshStationsBtn.addEventListener('click', async () => {
      try { clearAreaCache(); } catch (e) { /* ignore */ }
      await doRefresh();
    });
  }

  // Settings
  const delayEl = document.getElementById('delayThreshold');
  const carsEl = document.getElementById('carsThreshold');
  const carsFilterEl = document.getElementById('carsFilterEnable');

  if (delayEl) {
    delayEl.value = getDelayThreshold();
    delayEl.addEventListener('change', () => setSetting('delay.threshold', delayEl.value));
  }
  if (carsEl) {
    carsEl.value = getCarsThreshold();
    carsEl.addEventListener('change', () => setSetting('cars.threshold', carsEl.value));
  }
  if (carsFilterEl) {
    carsFilterEl.checked = isCarsFilterEnabled();
    carsFilterEl.addEventListener('change', () => setSetting('cars.filterEnabled', carsFilterEl.checked ? '1' : '0'));
  }

  // Background controls
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
  } catch (e) { /* ignore */ }
}

// Auto refresh
let refreshTimer = null;
function startAutoRefresh() {
  stopAutoRefresh();
  doRefresh();
  refreshTimer = setInterval(doRefresh, 10000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) doRefresh();
  });
}

function stopAutoRefresh() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

// Init
async function init() {
  migrateLegacySettings();
  initDebugPanel();
  debugLog('init started');

  const fixedStationName = getFixedStationName();
  if (fixedStationName && !selectedCode) {
    selectedCode = await resolveStation(fixedStationName);
    debugLog(`resolved ${fixedStationName} -> ${selectedCode}`);
  }

  if (stationFilter && selectedCode) {
    stationFilter.value = selectedCode;
  }

  bindControls();
  try { alarmSystem.initAlarmControls(); } catch (e) { /* ignore */ }

  // Show audio unlock if needed
  if (!audioUnlocked && unlockOverlay) {
    unlockOverlay.classList.remove('is-hidden');
    unlockOverlay.removeAttribute('aria-hidden');
    if (unlockHint) unlockHint.textContent = 'クリックまたはタップで許可';
  }
  bindAudioUnlockOnce();

  startAutoRefresh();
  debugLog('init done');
}

init();
