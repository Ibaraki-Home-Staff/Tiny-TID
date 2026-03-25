import { loadComponents } from './components.js';
import {
  trainCategoryFromDisplayType,
  getCategoryLabel,
  typeTextClass,
  normalizeTrain,
  stationAllowedCategories,
  getNickname
} from './tid-category.js';
import { initBackgroundControls, notifyIfBackground } from './tid-background.js';
import { createAlarmSystem } from './tid-alarm.js';
import {
  fetchTrains,
  fetchStations,
  fetchTrafficInfo,
  buildStationIndexes,
  buildIndexesFromCache,
  buildGlobalStationsForArea,
  loadAreaStationsCache,
  getStationNameByPriority,
  clearAreaStationsCache,
  clearAreaCrossCache
} from './tid-data.js';
import { renderTrafficInfo, renderTrainList } from './tid-render.js';
import { getSetting, setSetting, getLineConfig, migrateLegacySettings } from './tid-settings.js';

loadComponents();

const paramsView = document.getElementById('paramsView');
const trainsContainer = document.getElementById('trainsContainer');
const upContainer = document.querySelector('#trainsUp .train-items');
const downContainer = document.querySelector('#trainsDown .train-items');
const updatedAtEl = document.getElementById('updatedAt');
const settingsPanel = document.getElementById('settingsPanel');
const trafficInfoEl = document.getElementById('trafficInfo');
const audioOverlay = document.getElementById('audioUnlockOverlay');
const audioOverlayBtn = document.getElementById('audioUnlockBtn');
const audioOverlayHint = document.getElementById('audioUnlockHint');
const audioOverlayLater = document.getElementById('audioUnlockLater');
const audioOverlayClose = document.getElementById('audioUnlockClose');
const stationFilterEl = document.getElementById('stationFilter');
const passFilterEl = document.getElementById('passFilter');
const refreshStationsBtn = document.getElementById('refreshStationsBtn');

const debugParam = new URLSearchParams(window.location.search).get('debug');
const TID_DEBUG = (debugParam === '1') || (localStorage.getItem('tid:debug') === '1');

function dbg(){
  try{
    if(TID_DEBUG) console.log('[TID]', ...arguments);
  }catch{}
}

function warn(){
  try{
    console.warn('[TID]', ...arguments);
  }catch{}
}

function getMetaContent(name){
  try{
    return document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
  }catch{
    return '';
  }
}

function parseMetaList(name){
  return getMetaContent(name)
    .split(',')
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

let alarmSystem = null;
let audioCtx = null;
let audioUnlocked = false;
let audioUnlockBound = false;
let audioOverlayBound = false;
let refreshing = false;
let filterControlsBound = false;
let refreshTimer = null;
let visBound = false;

const searchParams = new URLSearchParams(window.location.search);
const fixedArea = getMetaContent('tid:fixedArea').trim();
const fixedLine = getMetaContent('tid:fixedLine').trim();
const fixedLineIds = parseMetaList('tid:fixedLines');
const fixedStationName = getMetaContent('tid:fixedStationName').trim();
const fixedDir = getMetaContent('tid:fixedDir').trim();
const area = searchParams.get('area') || fixedArea || '';
const line = searchParams.get('line') || fixedLine || '';
const dir = searchParams.get('dir') || fixedDir || null;
const currentLineIds = Array.from(new Set((fixedLineIds.length ? fixedLineIds : [line]).filter(Boolean)));
const dirLabel = dir === 'up' ? '上り' : dir === 'down' ? '下り' : '両方';
const fixedStationMode = Boolean(fixedStationName);
const multiLineFixedMode = fixedStationMode && currentLineIds.length > 1;
const currentLineLabel = currentLineIds.length ? currentLineIds.join(', ') : line || '(未指定)';
paramsView.textContent = fixedStationMode
  ? `選択中のエリア: ${area || '(未指定)'} / 路線: ${currentLineLabel} / 駅: ${fixedStationName} / 方向: ${dirLabel}`
  : `選択中のエリア: ${area || '(未指定)'} / 路線: ${line || '(未指定)'} / 方向: ${dirLabel}`;

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
  buildAlarmMessage,
  notifyIfBackground: (message, tag) => notifyIfBackground(message, tag, { getSetting, dbg }),
  playAlarmSound,
  playBeep,
  bindAudioUnlockOnce,
  getAudioUnlocked: () => audioUnlocked
});

(async () => {
  try{ migrateLegacySettings(); }catch{}
  try{ bindAudioUnlockOnce(); }catch{}
  try{ setupAudioUnlockOverlay(); }catch{}

  if(!line){
    upContainer.textContent = '路線が未指定です';
    downContainer.textContent = '';
    return;
  }

  try{
    await loadTypeColorMap();
    bindFilterControls();
    alarmSystem?.initAlarmControls();
    initDelayControls();
    initCarsControls();
    initBackgroundControls({ getSetting, setSetting, dbg });
    if(TID_DEBUG){ try{ initDebugPanel(); }catch{} }

    const indexes = await getIndexesForCurrentLine();
    renderStationFilter(indexes);

    const trains = await fetchTrainsForCurrentView();
    setUpdatedAt(trains?.update);
    renderTrains(indexes, trains, dir);
    await updateTrafficInfo(area, currentLineIds);

    try{
      const areaCached = loadAreaStationsCache(area);
      if(!areaCached && area){
        buildGlobalStationsForArea(area, { dbg }).then(() => {
          try{ refreshTrains(); }catch{}
        });
      }
    }catch{}

    startAutoRefresh();
  }catch(error){
    console.error('列車情報の取得に失敗', error);
    upContainer.textContent = '取得に失敗しました';
    downContainer.textContent = '';
  }
})();

if(settingsPanel){
  try{
    const applySettingsOpenFromStorage = () => {
      const saved = String(getSetting('ui.settingsOpen', '1'));
      const wantOpen = saved !== '0';
      try{
        settingsPanel.open = wantOpen;
        if(wantOpen) settingsPanel.setAttribute('open', '');
        else settingsPanel.removeAttribute('open');
      }catch{}
    };

    applySettingsOpenFromStorage();
    try{ requestAnimationFrame(() => { applySettingsOpenFromStorage(); }); }catch{}
    try{ window.addEventListener('load', applySettingsOpenFromStorage, { once: true }); }catch{}
    settingsPanel.addEventListener('toggle', () => {
      try{ setSetting('ui.settingsOpen', settingsPanel.open ? '1' : '0'); }catch{}
    });
  }catch{}
}

const TYPE_COLOR_MAP = new Map();

function typeColorNameToClass(name){
  const trimmed = String(name || '').trim();
  switch(trimmed){
    case '赤': return 'type-text-red';
    case '青': return 'type-text-blue';
    case '青灰': return 'type-text-bluegray';
    case '橙': return 'type-text-orange';
    case '緑': return 'type-text-green';
    case 'エメラルドグリーン': return 'type-text-emerald';
    default: return '';
  }
}

function resolveColorMapUrls(){
  const urls = [];
  try{
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('colormap') || params.get('color');
    if(fromQuery) urls.push(String(fromQuery));
  }catch{}
  try{
    const meta = document.querySelector('meta[name="tid:colorUrl"]');
    const fromMeta = meta && meta.getAttribute('content');
    if(fromMeta) urls.push(String(fromMeta));
  }catch{}
  urls.push('/assets/color.txt', '/color.txt');
  return urls;
}

async function loadTypeColorMap(){
  for(const url of resolveColorMapUrls()){
    try{
      const response = await fetch(url, { cache: 'no-store' });
      if(!response.ok) continue;
      parseTypeColorText(await response.text());
      dbg('color map loaded', { url, size: TYPE_COLOR_MAP.size });
      return;
    }catch{}
  }
  dbg('color map not found; using defaults');
}

function parseTypeColorText(text){
  try{
    TYPE_COLOR_MAP.clear();
    const lines = String(text || '').split(/\r?\n/);
    for(const rawLine of lines){
      const line = rawLine.trim();
      if(!line || line.startsWith('#')) continue;
      const parts = line.split(',');
      if(parts.length < 2) continue;
      const type = parts[0].trim();
      const color = parts[1].trim();
      const cls = typeColorNameToClass(color);
      if(type && cls) TYPE_COLOR_MAP.set(type, cls);
    }
    dbg('parsed color map', Object.fromEntries(TYPE_COLOR_MAP));
  }catch{}
}

function configuredTypeTextClass(typeLabel){
  if(!typeLabel) return '';
  const trimmed = String(typeLabel).trim();
  const exact = TYPE_COLOR_MAP.get(trimmed);
  if(exact) return exact;
  for(const [key, cls] of TYPE_COLOR_MAP.entries()){
    if(trimmed.includes(key) || key.includes(trimmed)) return cls;
  }
  return '';
}

function buildAlarmMessage(train, targetCode, indexes){
  try{
    const parts = [];
    const no = String(train?.no || '').trim();
    const type = String(train?.displayType || '').trim();
    const nickname = getNickname(train);
    const dest = getDestText(train, indexes, 'alarm.dest');
    const stationName = indexes.byCode.get(String(targetCode))?.name || String(targetCode);

    if(no) parts.push(no);
    if(type && nickname) parts.push(`${type} ${nickname}`);
    else if(type) parts.push(`${type}列車`);
    if(dest) parts.push(dest.endsWith('行き') ? dest : `${dest}行き`);
    parts.push(`${stationName}に接近`);
    if(typeof train?.delayMinutes === 'number' && train.delayMinutes > 0){
      parts.push(`約${train.delayMinutes}分遅延`);
    }

    return parts.filter(Boolean).join('、');
  }catch{
    const stationName = indexes.byCode.get(String(targetCode))?.name || String(targetCode);
    const no = String(train?.no || '列車');
    return `${no}、${stationName}に接近`;
  }
}

function getDelayThreshold(){
  try{
    const raw = getSetting('delay.threshold', undefined);
    if(raw == null || raw === '') return 4;
    const value = Number(raw);
    if(Number.isFinite(value) && value >= 0) return Math.floor(value);
  }catch{}
  return 4;
}

function initDelayControls(){
  const input = document.getElementById('delayThreshold');
  if(!input) return;
  try{
    input.value = String(getDelayThreshold());
    input.addEventListener('change', () => {
      let value = Number(input.value);
      if(!Number.isFinite(value) || value < 0) value = 4;
      try{ setSetting('delay.threshold', Math.floor(value)); }catch{}
      refreshTrains();
    }, { once: false });
  }catch{}
}

function getCarsThreshold(){
  try{
    const raw = getSetting('cars.threshold', undefined);
    if(raw == null || raw === '') return 9;
    const value = Number(raw);
    if(Number.isFinite(value) && value >= 0) return Math.floor(value);
  }catch{}
  return 9;
}

function isCarsFilterEnabled(){
  try{
    return !!getSetting('cars.filterEnabled', false);
  }catch{
    return false;
  }
}

function initCarsControls(){
  const thresholdInput = document.getElementById('carsThreshold');
  const filterCheckbox = document.getElementById('carsFilterEnable');

  if(thresholdInput){
    try{
      thresholdInput.value = String(getCarsThreshold());
      thresholdInput.addEventListener('change', () => {
        let value = Number(thresholdInput.value);
        if(!Number.isFinite(value) || value < 0) value = 9;
        try{ setSetting('cars.threshold', Math.floor(value)); }catch{}
        refreshTrains();
      });
    }catch{}
  }

  if(filterCheckbox){
    try{
      filterCheckbox.checked = isCarsFilterEnabled();
      filterCheckbox.addEventListener('change', () => {
        try{
          setSetting('cars.filterEnabled', filterCheckbox.checked);
          dbg('CARS_FILTER_ENABLED', { enabled: filterCheckbox.checked, threshold: getCarsThreshold() });
        }catch{}
      });
    }catch{}
  }
}

async function updateTrafficInfo(currentArea, currentLines){
  const lineIds = Array.isArray(currentLines) ? currentLines.filter(Boolean) : [currentLines].filter(Boolean);
  if(!currentArea || !lineIds.length || !trafficInfoEl) return;
  try{
    const data = await fetchTrafficInfo(currentArea);
    renderTrafficInfo(trafficInfoEl, lineIds, data);
  }catch(error){
    dbg('traffic fetch fail', error);
  }
}

const BEEP_DURATION_MS = 280;
const ALARM_SOUND_URL = '/assets/sound/alarm.mp3';
let alarmAudioEl = null;
let alarmAudioPrimed = false;

function ensureAlarmAudioEl(){
  if(alarmAudioEl) return alarmAudioEl;
  try{
    const audio = document.createElement('audio');
    audio.src = ALARM_SOUND_URL;
    audio.preload = 'auto';
    audio.controls = false;
    audio.loop = false;
    audio.style.display = 'none';
    audio.setAttribute('aria-hidden', 'true');
    try{
      audio.setAttribute('playsinline', '');
      audio.setAttribute('webkit-playsinline', '');
    }catch{}
    document.body.appendChild(audio);
    alarmAudioEl = audio;
  }catch{}
  return alarmAudioEl;
}

async function primeAlarmAudio(){
  try{
    const audio = ensureAlarmAudioEl();
    if(!audio || alarmAudioPrimed) return true;
    await audio.play();
    try{ await new Promise((resolve) => setTimeout(resolve, 10)); }catch{}
    try{
      audio.pause();
      audio.currentTime = 0;
    }catch{}
    alarmAudioPrimed = true;
    return true;
  }catch{
    return false;
  }
}

function cleanupAudioUnlockListeners(){
  audioUnlockBound = false;
}

function handleAudioUnlockGesture(){
  performAudioUnlock('gesture');
}

function performAudioUnlock(source){
  if(audioUnlocked) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx?.resume) audioCtx.resume().catch(() => {});
  }catch{}
  audioUnlocked = true;
  cleanupAudioUnlockListeners();
  dbg('audio unlocked', source || '');
  try{ document.dispatchEvent(new CustomEvent('tid:audiounlocked')); }catch{}
  try{ primeAlarmAudio(); }catch{}
  try{ alarmSystem?.flushPendingAudio(); }catch{}
}

function bindAudioUnlockOnce(){
  if(audioUnlocked || audioUnlockBound) return;
  audioUnlockBound = true;
  try{
    document.addEventListener('touchstart', handleAudioUnlockGesture, { once: true, passive: true });
    document.addEventListener('keydown', handleAudioUnlockGesture, { once: true });
    if('PointerEvent' in window){
      document.addEventListener('pointerdown', handleAudioUnlockGesture, { once: true, passive: true });
    }else{
      document.addEventListener('mousedown', handleAudioUnlockGesture, { once: true, passive: true });
    }
  }catch{}
}

function setupAudioUnlockOverlay(){
  if(!audioOverlay) return;
  const supported = ('AudioContext' in window) || ('webkitAudioContext' in window);
  if(!supported){
    audioOverlay.classList.add('is-hidden');
    audioOverlay.setAttribute('aria-hidden', 'true');
    return;
  }

  const hide = () => {
    try{
      audioOverlay.classList.add('is-hidden');
      audioOverlay.setAttribute('aria-hidden', 'true');
    }catch{}
  };

  const show = () => {
    try{
      audioOverlay.classList.remove('is-hidden');
      audioOverlay.removeAttribute('aria-hidden');
    }catch{}
  };

  try{
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
      (window.navigator && window.navigator.standalone === true);
    const text = isStandalone
      ? 'アプリとして起動中です。アラーム音を有効にすると接近アラームを再生できます。'
      : 'ブラウザで開いています。アラーム音を有効にすると接近アラームを再生できます。';
    if(audioOverlayHint) audioOverlayHint.textContent = text;
  }catch{}

  show();

  if(audioOverlayBound) return;
  audioOverlayBound = true;

  try{
    if(audioOverlayBtn){
      audioOverlayBtn.addEventListener('click', () => {
        try{
          bindAudioUnlockOnce();
          performAudioUnlock('overlay-button');
        }catch(error){
          dbg('audio unlock button failed', error);
        }
      });
    }
    if(audioOverlayLater){
      audioOverlayLater.addEventListener('click', hide);
    }
    if(audioOverlayClose){
      audioOverlayClose.addEventListener('click', hide);
    }
    document.addEventListener('tid:audiounlocked', hide);
  }catch{}
}

async function playAlarmSound(){
  try{
    if(!audioUnlocked){
      bindAudioUnlockOnce();
      return 0;
    }

    const audio = ensureAlarmAudioEl();
    if(!audio) return 0;
    try{ await primeAlarmAudio(); }catch{}

    audio.currentTime = 0;
    audio.volume = 1.0;

    return await new Promise((resolve) => {
      let settled = false;
      const done = (ms) => {
        if(!settled){
          settled = true;
          resolve(Number.isFinite(ms) ? ms : 0);
        }
      };
      const cleanup = () => {
        try{ audio.removeEventListener('ended', onEnded); }catch{}
        try{ audio.removeEventListener('error', onError); }catch{}
      };
      const onEnded = () => {
        const duration = (typeof audio.duration === 'number' && isFinite(audio.duration))
          ? Math.round(audio.duration * 1000)
          : 0;
        cleanup();
        done(duration);
      };
      const onError = () => {
        cleanup();
        done(0);
      };

      try{
        audio.addEventListener('ended', onEnded, { once: true });
        audio.addEventListener('error', onError, { once: true });
        try{
          if(!audio.paused){
            audio.pause();
            audio.currentTime = 0;
          }
        }catch{}
        const playResult = audio.play();
        if(playResult && typeof playResult.then === 'function'){
          playResult.catch(() => {
            try{
              audioUnlocked = false;
              bindAudioUnlockOnce();
              setupAudioUnlockOverlay();
            }catch{}
            cleanup();
            done(0);
          });
        }
      }catch{
        cleanup();
        done(0);
      }

      setTimeout(() => {
        cleanup();
        done(0);
      }, 6000);
    });
  }catch(error){
    dbg('alarm audio failed', error);
    return 0;
  }
}

function playBeep(){
  try{
    if(!audioUnlocked){
      bindAudioUnlockOnce();
      return 0;
    }
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(() => {});
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (BEEP_DURATION_MS / 1000) - 0.02);
    oscillator.connect(gain).connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + (BEEP_DURATION_MS / 1000));
  }catch(error){
    dbg('beep failed', error);
  }
  return BEEP_DURATION_MS;
}

async function getIndexesForCurrentLine(){
  if(multiLineFixedMode){
    const lineStations = await fetchStationDataForLines(currentLineIds);
    return buildMergedIndexesForLines(lineStations);
  }
  if(!fixedStationMode){
    const cached = buildIndexesFromCache(area, line, { dbg });
    if(cached) return cached;
  }
  const stations = await fetchStations(line);
  return buildStationIndexes(stations);
}

async function fetchStationDataForLines(lineIds){
  const results = await Promise.allSettled(
    lineIds.map((lineId) => fetchStations(lineId).then((data) => ({ lineId, data })))
  );
  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
}

function addAdjacencyEdge(adjacency, left, right){
  if(!left || !right || left === right) return;
  if(!adjacency.has(left)) adjacency.set(left, new Set());
  if(!adjacency.has(right)) adjacency.set(right, new Set());
  adjacency.get(left).add(right);
  adjacency.get(right).add(left);
}

function buildMergedIndexesForLines(lineStations){
  const stationsByCode = new Map();
  const adjacency = new Map();
  const ordersByLine = new Map();

  for(const entry of lineStations){
    const lineId = String(entry?.lineId || '').trim();
    const stations = Array.isArray(entry?.data?.stations) ? entry.data.stations : [];
    const order = [];
    let previousCode = null;

    for(const station of stations){
      const info = station?.info || {};
      const code = String(info?.code || '').trim();
      if(!code) continue;

      const name = String(info?.name || code).trim();
      order.push(code);

      const existing = stationsByCode.get(code);
      if(existing){
        if(!existing.name && name) existing.name = name;
        if((!existing.stopTrains || !existing.stopTrains.length) && Array.isArray(info?.stopTrains)){
          existing.stopTrains = info.stopTrains.slice();
        }
        existing.lines.add(lineId);
      }else{
        stationsByCode.set(code, {
          index: 0,
          name,
          code,
          stopTrains: Array.isArray(info?.stopTrains) ? info.stopTrains.slice() : null,
          lines: new Set(lineId ? [lineId] : [])
        });
      }

      addAdjacencyEdge(adjacency, previousCode, code);
      previousCode = code;
    }

    if(order.length) ordersByLine.set(lineId, order);
  }

  const probeIndexes = { byCode: stationsByCode, order: Array.from(stationsByCode.keys()) };
  const selectedStation = findStationByName(probeIndexes, fixedStationName);
  if(!selectedStation){
    const byCode = new Map();
    const order = Array.from(stationsByCode.keys()).sort();
    order.forEach((code, index) => {
      const station = stationsByCode.get(code);
      byCode.set(code, { ...station, index });
    });
    return { byCode, order };
  }

  const primaryOrder =
    ordersByLine.get(line) ||
    ordersByLine.get(currentLineIds[0]) ||
    Array.from(stationsByCode.keys());
  const selectedIdx = primaryOrder.indexOf(selectedStation.code);
  const negativeHop = selectedIdx > 0 ? primaryOrder[selectedIdx - 1] : '';
  const positiveHop = selectedIdx >= 0 && selectedIdx < primaryOrder.length - 1 ? primaryOrder[selectedIdx + 1] : '';
  const metrics = buildGraphMetrics(adjacency, selectedStation.code, { negativeHop, positiveHop });

  const withIndex = [];
  for(const [code, station] of stationsByCode.entries()){
    const metric = metrics.get(code) || null;
    const hasMetric = metric && Number.isFinite(metric.distance);
    const distance = hasMetric ? metric.distance : Number.MAX_SAFE_INTEGER;
    const sign = Number(metric?.sign || 0);
    const normalizedSign = code === selectedStation.code ? 0 : (sign || 1);
    const index = code === selectedStation.code
      ? 0
      : hasMetric
        ? normalizedSign * distance
        : 9999;
    withIndex.push({
      ...station,
      index,
      distance,
      side: normalizedSign
    });
  }

  withIndex.sort((left, right) => {
    if(left.index !== right.index) return left.index - right.index;
    if(left.distance !== right.distance) return left.distance - right.distance;
    const leftName = String(left.name || '');
    const rightName = String(right.name || '');
    if(leftName !== rightName) return leftName.localeCompare(rightName, 'ja');
    return String(left.code).localeCompare(String(right.code), 'ja');
  });

  const byCode = new Map();
  const order = [];
  for(const station of withIndex){
    byCode.set(station.code, station);
    order.push(station.code);
  }
  return { byCode, order };
}

function buildGraphMetrics(adjacency, selectedCode, { negativeHop, positiveHop } = {}){
  const metrics = new Map();
  metrics.set(selectedCode, { distance: 0, sign: 0, firstHop: selectedCode });

  const queue = [selectedCode];
  for(let i = 0; i < queue.length; i += 1){
    const code = queue[i];
    const current = metrics.get(code);
    const neighbors = Array.from(adjacency.get(code) || []);
    for(const neighbor of neighbors){
      if(metrics.has(neighbor)) continue;
      const firstHop = code === selectedCode ? neighbor : current.firstHop;
      let sign = 0;
      if(firstHop === negativeHop) sign = -1;
      else if(firstHop === positiveHop) sign = 1;
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

function parseIsoTime(value){
  const ms = Date.parse(String(value || ''));
  return Number.isFinite(ms) ? ms : null;
}

function mergeTrainPayloads(payloads){
  const trains = [];
  const seen = new Set();
  let latestMs = null;
  let latestRaw = '';

  for(const payload of payloads){
    const updateMs = parseIsoTime(payload?.update);
    if(updateMs != null && (latestMs == null || updateMs > latestMs)){
      latestMs = updateMs;
      latestRaw = String(payload.update || '');
    }

    const list = Array.isArray(payload?.trains) ? payload.trains : [];
    for(const train of list){
      const key = `${train?.no || ''}|${train?.pos || ''}|${train?.direction ?? ''}`;
      if(seen.has(key)) continue;
      seen.add(key);
      trains.push(train);
    }
  }

  return {
    update: latestRaw,
    trains
  };
}

async function fetchTrainsForCurrentView(){
  if(currentLineIds.length <= 1){
    return await fetchTrains(line);
  }

  const results = await Promise.allSettled(
    currentLineIds.map((lineId) => fetchTrains(lineId))
  );
  const payloads = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  return mergeTrainPayloads(payloads);
}

function normalizeStationName(value){
  return String(value || '').trim().replace(/\s+/g, '');
}

function findStationByName(indexes, stationName){
  const target = normalizeStationName(stationName);
  if(!target) return null;
  for(const code of indexes.order){
    const station = indexes.byCode.get(code);
    if(!station) continue;
    if(normalizeStationName(station.name) === target){
      return station;
    }
  }
  return null;
}

function bindFilterControls(){
  if(filterControlsBound) return;
  filterControlsBound = true;

  stationFilterEl?.addEventListener('change', () => {
    try{ setSetting(`lines.${line}.station`, stationFilterEl.value || ''); }catch{}
    try{ alarmSystem?.clearNotified(); }catch{}
    refreshTrains();
  });

  passFilterEl?.addEventListener('change', () => {
    try{ setSetting(`lines.${line}.pass`, passFilterEl.value); }catch{}
    try{ alarmSystem?.clearNotified(); }catch{}
    refreshTrains();
  });

  refreshStationsBtn?.addEventListener('click', async () => {
    const originalText = refreshStationsBtn.textContent;
    try{
      refreshStationsBtn.disabled = true;
      refreshStationsBtn.textContent = '更新中…';
      clearAreaStationsCache(area);
      clearAreaCrossCache(area);
      await buildGlobalStationsForArea(area, { force: true, dbg });
      await refreshTrains();
    }finally{
      refreshStationsBtn.disabled = false;
      refreshStationsBtn.textContent = originalText;
    }
  });
}

function renderStationFilter(indexes){
  if(!stationFilterEl) return;

  const savedStation = getSetting(`lines.${line}.station`, '');
  const savedPass = getSetting(`lines.${line}.pass`, null);

  stationFilterEl.length = 0;
  if(fixedStationMode){
    const station = findStationByName(indexes, fixedStationName);
    const option = document.createElement('option');
    if(station){
      option.value = station.code;
      option.textContent = station.name || fixedStationName;
      stationFilterEl.appendChild(option);
      stationFilterEl.value = station.code;
      try{ setSetting(`lines.${line}.station`, station.code); }catch{}
    }else{
      option.value = '';
      option.textContent = `${fixedStationName} が見つかりません`;
      stationFilterEl.appendChild(option);
      stationFilterEl.value = '';
    }
    stationFilterEl.disabled = true;
  }else{
    const blankOption = document.createElement('option');
    blankOption.value = '';
    blankOption.textContent = '（未選択）';
    stationFilterEl.appendChild(blankOption);

    for(const code of indexes.order){
      const station = indexes.byCode.get(code);
      if(!station) continue;
      const option = document.createElement('option');
      option.value = station.code;
      option.textContent = station.name || station.code;
      stationFilterEl.appendChild(option);
    }

    if(savedStation && Array.from(stationFilterEl.options).some((option) => option.value === savedStation)){
      stationFilterEl.value = savedStation;
    }else{
      stationFilterEl.value = '';
    }
    stationFilterEl.disabled = false;
  }

  if(passFilterEl){
    if(savedPass === 'show' || savedPass === 'hide'){
      passFilterEl.value = savedPass;
    }else{
      passFilterEl.value = 'hide';
    }
  }
}

async function refreshTrains(){
  if(refreshing) return;
  refreshing = true;
  try{
    const indexes = await getIndexesForCurrentLine();
    const trains = await fetchTrainsForCurrentView();
    setUpdatedAt(trains?.update);
    renderStationFilter(indexes);
    renderTrains(indexes, trains, dir);
    await updateTrafficInfo(area, currentLineIds);
  }catch(error){
    console.error('再取得に失敗', error);
  }finally{
    refreshing = false;
  }
}

function startAutoRefresh(){
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    refreshTrains();
  }, 10000);

  if(!visBound){
    document.addEventListener('visibilitychange', () => {
      if(document.hidden) return;
      refreshTrains();
    });
    visBound = true;
  }
}

function stopAutoRefresh(){
  if(refreshTimer){
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

function setUpdatedAt(iso){
  if(!updatedAtEl) return;
  updatedAtEl.textContent = iso ? formatJST(iso) : '';
}

function formatJST(iso){
  try{
    const date = new Date(iso);
    if(isNaN(date.getTime())) return '';
    const parts = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value || '';
    return `${get('year')}年${get('month')}月${get('day')}日 ${get('hour')}時${get('minute')}分${get('second')}秒更新`;
  }catch{
    return '';
  }
}

function renderTrains(indexes, trainsData, dirParam){
  const items = Array.isArray(trainsData?.trains) ? trainsData.trains : [];
  const selectedCode = (stationFilterEl?.value || '').trim();
  if(fixedStationMode && !selectedCode){
    upContainer.textContent = `${fixedStationName} の駅コードを取得できませんでした`;
    downContainer.textContent = `${fixedStationName} の駅コードを取得できませんでした`;
    upContainer.parentElement.style.display = dirParam === 'down' ? 'none' : '';
    downContainer.parentElement.style.display = dirParam === 'up' ? 'none' : '';
    trainsContainer?.classList.toggle('single', dirParam === 'up' || dirParam === 'down');
    return;
  }
  const allowedCats = stationAllowedCategories(indexes.byCode.get(selectedCode));
  const passSetting = passFilterEl?.value || 'hide';

  const enhanced = items
    .map((train) => normalizeTrain(train))
    .map((train) => enhanceTrain(train, indexes.byCode));
  const parsed = enhanced.filter((train) => filterByStationSetting(train, allowedCats, passSetting));
  const stationIdx = selectedCode ? indexes.byCode.get(selectedCode)?.index : null;

  const heading = document.getElementById('trainsHeading');
  if(heading){
    if(selectedCode){
      const station = indexes.byCode.get(selectedCode);
      heading.textContent = `列車一覧（駅で絞り込み: ${station?.name || selectedCode}）`;
    }else{
      heading.textContent = '列車一覧（絞り込み無し）';
    }
  }

  const hidePassed = (list, direction) => {
    if(stationIdx == null) return list;
    return list.filter((train) => {
      if(typeof train.posIndex !== 'number') return true;
      return direction === 0 ? train.posIndex >= stationIdx : train.posIndex <= stationIdx;
    });
  };

  const destIndexForTrain = (train) => {
    try{
      const dest = train?.dest;
      if(!dest) return null;

      let code = null;
      if(typeof dest === 'object'){
        if(dest.code != null){
          code = String(dest.code);
        }else{
          const name = String(dest.text || dest.name || '').trim();
          if(name){
            for(const [, record] of indexes.byCode.entries()){
              if(String(record?.name || '').trim() === name){
                return typeof record.index === 'number' ? record.index : null;
              }
            }
          }
        }
      }else if(typeof dest === 'string'){
        const name = String(dest).trim();
        if(name){
          for(const [, record] of indexes.byCode.entries()){
            if(String(record?.name || '').trim() === name){
              return typeof record.index === 'number' ? record.index : null;
            }
          }
        }
      }

      if(code){
        const record = indexes.byCode.get(code);
        return (record && typeof record.index === 'number') ? record.index : null;
      }
    }catch{}
    return null;
  };

  const hideTerminatesBeforeSelected = (list, direction) => {
    if(stationIdx == null) return list;
    return list.filter((train) => {
      const destIndex = destIndexForTrain(train);
      if(typeof destIndex !== 'number') return true;
      return direction === 0 ? destIndex <= stationIdx : destIndex >= stationIdx;
    });
  };

  let up = hidePassed(parsed.filter((train) => train.direction === 0).sort((a, b) => a.posIndex - b.posIndex), 0);
  let down = hidePassed(parsed.filter((train) => train.direction === 1).sort((a, b) => b.posIndex - a.posIndex), 1);

  up = hideTerminatesBeforeSelected(up, 0);
  down = hideTerminatesBeforeSelected(down, 1);

  try{ alarmSystem?.setLastShown({ up, down }, selectedCode, indexes); }catch{}

  try{
    if(passSetting === 'show' && selectedCode){
      const addExtrasForPass = (list, direction) => {
        try{
          if(!alarmSystem?.hasPassAlarmForDirection?.(direction)) return list;
          const selected = String(selectedCode);
          const base = parsed.filter((train) => train.direction === direction);
          const extras = base.filter((train) => !train.stopped && (
            direction === 0 ? String(train.nextCode || '') === selected : String(train.atCode || '') === selected
          ));
          if(!extras.length) return list;
          const keyOf = (train) => `${train.no || '?'}:${train.pos || ''}`;
          const seen = new Set(list.map(keyOf));
          for(const train of extras){
            const key = keyOf(train);
            if(!seen.has(key)){
              list.push(train);
              seen.add(key);
            }
          }
          return list;
        }catch{
          return list;
        }
      };
      up = addExtrasForPass(up, 0);
      down = addExtrasForPass(down, 1);
    }
  }catch{}

  try{
    alarmSystem?.renderAlarmOptions(indexes, selectedCode, allowedCats, dirParam);
  }catch(error){
    dbg('alarm render failed', error);
  }

  try{
    const shown = dirParam === 'up' ? up : dirParam === 'down' ? down : up.concat(down);
    alarmSystem?.handleApproachAlarms(indexes, shown, selectedCode, stationIdx, allowedCats, dirParam);
  }catch(error){
    dbg('alarm check failed', error);
  }

  upContainer.parentElement.style.display = '';
  downContainer.parentElement.style.display = '';

  const renderOptions = {
    getDelayThreshold,
    getCarsThreshold,
    getDestText,
    getNickname,
    configuredTypeTextClass,
    trainCategoryFromDisplayType,
    typeTextClass
  };

  if(dirParam === 'up'){
    renderTrainList(upContainer, up, indexes, renderOptions);
    downContainer.parentElement.style.display = 'none';
    trainsContainer?.classList.add('single');
  }else if(dirParam === 'down'){
    renderTrainList(downContainer, down, indexes, renderOptions);
    upContainer.parentElement.style.display = 'none';
    trainsContainer?.classList.add('single');
  }else{
    renderTrainList(upContainer, up, indexes, renderOptions);
    renderTrainList(downContainer, down, indexes, renderOptions);
    trainsContainer?.classList.remove('single');
  }
}

function filterByStationSetting(train, allowed, passSetting){
  if(!allowed) return true;
  const category = trainCategoryFromDisplayType(train.displayType);
  const stopsHere = (category !== -1 && allowed.has(category)) || category === -1;
  if(passSetting === 'show') return true;
  return stopsHere;
}

function enhanceTrain(train, byCode){
  const { atCode, nextCode, stopped } = parsePos(train.pos);
  const at = byCode.get(atCode);
  const next = nextCode ? byCode.get(nextCode) : null;
  let posIndex = at ? at.index : 0;
  if(!stopped && at && next){
    posIndex = (at.index + next.index) / 2;
  }
  const stationLookup = { area, line, dbg, warn };
  const atName = at?.name || getStationNameByPriority(atCode, { byCode }, { ...stationLookup, neighborCode: nextCode }) || atCode || '';
  const nextName = next?.name || (nextCode
    ? (getStationNameByPriority(nextCode, { byCode }, { ...stationLookup, neighborCode: atCode }) || nextCode)
    : '') || '';
  return {
    ...train,
    atCode,
    nextCode,
    stopped,
    posIndex,
    atName,
    nextName
  };
}

function parsePos(pos){
  const [left, right] = String(pos || '').split('_');
  if(right === '####' || !right){
    return { atCode: left, nextCode: null, stopped: true };
  }
  return { atCode: left, nextCode: right, stopped: false };
}

function getDestText(train, indexes, tag){
  const dest = train && train.dest;
  if(dest == null) return '';
  if(typeof dest === 'string') return dest;
  if(typeof dest === 'object'){
    const code = dest.code != null ? String(dest.code) : '';
    const text = dest.text || dest.name || '';
    if(text && String(text).trim()) return String(text);
    if(code){
      return getStationNameByPriority(code, indexes, { area, line, dbg, warn, tag }) || code;
    }
    return '';
  }
  return String(dest);
}

function initDebugPanel(){
  const panel = document.createElement('div');
  panel.id = 'tidDebugPanel';
  panel.style.cssText = `
    position: fixed; bottom: 10px; right: 10px; width: 400px; max-height: 500px;
    overflow-y: auto; background: rgba(0,0,0,0.9); color: #0f0;
    font-family: monospace; font-size: 11px; padding: 10px;
    border: 2px solid #0f0; z-index: 9999; border-radius: 5px;
  `;

  const title = document.createElement('div');
  title.textContent = 'TID Debug Panel';
  title.style.cssText = 'font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #ff0;';
  panel.appendChild(title);

  const logContainer = document.createElement('div');
  logContainer.id = 'tidDebugLog';
  panel.appendChild(logContainer);
  document.body.appendChild(panel);

  const originalDbg = window.dbg || dbg;
  window.dbg = function(...args){
    originalDbg.apply(this, args);
    try{
      const logEl = document.getElementById('tidDebugLog');
      if(!logEl) return;
      const entry = document.createElement('div');
      entry.style.cssText = 'margin: 3px 0; padding: 3px; border-bottom: 1px solid #333;';
      const timestamp = new Date().toLocaleTimeString('ja-JP');
      entry.textContent = `[${timestamp}] ${JSON.stringify(args)}`;

      const message = args.join(' ');
      if(message.includes('ALARM_TRIGGER')) entry.style.color = '#0f0';
      else if(message.includes('ALARM_SKIP') || message.includes('ALARM_NO')) entry.style.color = '#f80';
      else if(message.includes('ALARM_QUEUED')) entry.style.color = '#0ff';
      else if(message.includes('ALARM_PREFS')) entry.style.color = '#ff0';

      logEl.appendChild(entry);
      if(logEl.children.length > 100) logEl.removeChild(logEl.firstChild);
      logEl.scrollTop = logEl.scrollHeight;
    }catch{}
  };
}

if(TID_DEBUG){
  window.tidTestAlarm = function(trainNo, direction, targetCode){
    console.log('[TID][TEST] Simulating alarm', trainNo, direction, targetCode);
    const dirNum = direction === 'up' ? 0 : 1;
    const key = `${trainNo}:${dirNum}:${targetCode}`;
    const msg = `テスト: ${trainNo}号、${direction}、${targetCode}駅接近`;
    const meta = {
      area,
      line,
      dir: direction,
      direction: dirNum,
      trainNo,
      atCode: targetCode,
      nextCode: '',
      targetCode,
      stopped: true,
      displayType: '快速',
      nickname: 'テスト列車',
      delay: 0,
      dest: 'テスト行き',
      triggerReason: 'manual-test'
    };
    alarmSystem?.notifyOnce(direction, key, msg, () => {}, meta);
  };
  console.log('[TID][DEBUG] Test function: tidTestAlarm(trainNo, direction, targetCode)');
}
