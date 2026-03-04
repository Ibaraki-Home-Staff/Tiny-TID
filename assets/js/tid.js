import { loadComponents } from '/assets/js/components.js?v=39';
import { U_TOKEN_TYPE_MAP } from '/assets/js/tid-rules.js?v=39';
// tid-category.js: カテゴリ判定とデータ正規化
import {
  trainCategoryFromDisplayType,
  getCategoryLabel,
  typeTextClass,
  normalizeTrain,
  stationAllowedCategories,
  getNickname,
  CATEGORY
} from '/assets/js/tid-category.js?v=39';
import { initBackgroundControls, notifyIfBackground } from '/assets/js/tid-background.js?v=39';
import { createAlarmSystem } from '/assets/js/tid-alarm.js?v=39';

// Init
loadComponents();

const paramsView = document.getElementById('paramsView');
const trainsContainer = document.getElementById('trainsContainer');
const upContainer = document.querySelector('#trainsUp .train-items');
const downContainer = document.querySelector('#trainsDown .train-items');
const updatedAtEl = document.getElementById('updatedAt');
const settingsPanel = document.getElementById('settingsPanel');
const audioOverlay = document.getElementById('audioUnlockOverlay');
const audioOverlayBtn = document.getElementById('audioUnlockBtn');
const audioOverlayHint = document.getElementById('audioUnlockHint');
const audioOverlayLater = document.getElementById('audioUnlockLater');
const audioOverlayClose = document.getElementById('audioUnlockClose');

// Debug helpers (enable with ?debug=1 or localStorage tid:debug=1)
const __dbgParam = new URLSearchParams(window.location.search).get('debug');
const TID_DEBUG = (__dbgParam === '1') || (localStorage.getItem('tid:debug') === '1');
function dbg(){ try{ if(TID_DEBUG) console.log('[TID]', ...arguments); }catch{} }
function warn(){ try{ console.warn('[TID]', ...arguments); }catch{} }

// Alarm preferences and runtime state (must be declared before usage in async IIFE)
let alarmSystem = null;
let audioCtx = null;
let audioUnlocked = false;
let audioUnlockBound = false;
let delayTtsPlaying = false;
let refreshing = false;

const sp = new URLSearchParams(window.location.search);
const area = sp.get('area') || '';
const line = sp.get('line') || '';
const dir = sp.get('dir');
const dirLabel = dir === 'up' ? '上り' : dir === 'down' ? '下り' : '両方';
paramsView.textContent = `選択中のエリア: ${area || '(未指定)'} / 路線: ${line || '(未指定)'} / 方向: ${dirLabel}`;

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

(async () => {
  // migrate legacy localStorage keys once
  try{ migrateLegacySettings(); }catch{}
  // iOS/iPadOS の自動再生制限対策:
  // ユーザー操作前に AudioContext を起動しない（警告・失敗回避）。
  try{ bindAudioUnlockOnce(); }catch{}
  try{ setupAudioUnlockOverlay(); }catch{}
  if(!line){
    upContainer.textContent = '路線が未指定です';
    downContainer.textContent = '';
    return;
  }
  try{
    // Load optional type color mapping (assets/color.txt)
    try{ await loadTypeColorMap(); }catch{}
    try{ await loadYomiageMap(); }catch{}
    // 1) Try to use localStorage cache only (no network)
    let indexes = buildIndexesFromCache(area, line);
    // 2) As last resort, fetch this line's stations only (no area-wide prefetch)
    if(!indexes){
      const stations = await fetchStations(line);
      indexes = buildStationIndexes(stations);
    }
    populateStationFilter(indexes);
    alarmSystem?.initAlarmControls();
    initTTSControls();
    initDelayControls();
    initCarsControls();
    initBackgroundControls({ getSetting, setSetting, dbg });
    if(TID_DEBUG){ try{ initDebugPanel(); }catch{} }
    const trains = await fetchTrains(line);
    setUpdatedAt(trains?.update);
    renderTrains(indexes, trains, dir);
    try{ await updateTrafficInfo(area, line); }catch(e){ dbg('traffic info failed', e); }
    // If area cache is not present, prefetch entire area in background to enable cross-line name resolution
    try{
      const areaCached = loadAreaStationsCache(area);
      if(!areaCached && area){
        buildGlobalStationsForArea(area).then(() => { try{ refreshTrains(); }catch{} });
      }
    }catch{}
    startAutoRefresh();
  }catch(err){
    console.error('列車情報の取得に失敗', err);
    upContainer.textContent = '取得に失敗しました';
    downContainer.textContent = '';
  }
})();

// Persist settings panel open/close state
if(settingsPanel){
  try{
    const applySettingsOpenFromStorage = () => {
      const saved = String(getSetting('ui.settingsOpen','1'));
      const wantOpen = (saved !== '0');
      try{
        settingsPanel.open = wantOpen; // property first
        if(wantOpen){ settingsPanel.setAttribute('open',''); }
        else{ settingsPanel.removeAttribute('open'); }
      }catch{}
    };
    // Apply immediately and once more after paint to override default markup
    applySettingsOpenFromStorage();
    try{ requestAnimationFrame(() => { applySettingsOpenFromStorage(); }); }catch{}
    try{ window.addEventListener('load', applySettingsOpenFromStorage, { once: true }); }catch{}
    settingsPanel.addEventListener('toggle', () => {
      try{ setSetting('ui.settingsOpen', settingsPanel.open ? '1' : '0'); }catch{}
    });
  }catch{}
}

function apiBase(){
  return (window.TID_API_BASE && String(window.TID_API_BASE)) || '/api/v3/';
}

// Optional: type color mapping from assets/color.txt
const TYPE_COLOR_MAP = new Map(); // displayType -> css class
function typeColorNameToClass(name){
  const n = String(name||'').trim();
  switch(n){
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
    // URLパラメータ優先（例: ?colormap=/assets/custom.txt）
    const sp2 = new URLSearchParams(window.location.search);
    const fromQuery = sp2.get('colormap') || sp2.get('color');
    if(fromQuery) urls.push(String(fromQuery));
  }catch{}
  try{
    // TID.htmlの<meta name="tid:colorUrl" content="..."> を参照
    const meta = document.querySelector('meta[name="tid:colorUrl"]');
    const fromMeta = meta && meta.getAttribute('content');
    if(fromMeta) urls.push(String(fromMeta));
  }catch{}
  // 既定パス
  urls.push('/assets/color.txt','/color.txt');
  return urls;
}
async function loadTypeColorMap(){
  const urls = resolveColorMapUrls();
  for(const u of urls){
    try{
      const res = await fetch(u, { cache: 'no-store' });
      if(!res.ok) continue;
      const text = await res.text();
      parseTypeColorText(text);
      try{ dbg('color map loaded', { url: u, size: TYPE_COLOR_MAP.size }); }catch{}
      return;
    }catch{}
  }
  try{ dbg('color map not found; using defaults'); }catch{}
}
function parseTypeColorText(text){
  try{
    TYPE_COLOR_MAP.clear();
    const lines = String(text||'').split(/\r?\n/);
    for(const ln of lines){
      const line = ln.trim();
      if(!line || line.startsWith('#')) continue;
      const parts = line.split(',');
      if(parts.length < 2) continue;
      const type = parts[0].trim();
      const color = parts[1].trim();
      const cls = typeColorNameToClass(color);
      if(type && cls) TYPE_COLOR_MAP.set(type, cls);
    }
    try{ dbg('parsed color map', Object.fromEntries(TYPE_COLOR_MAP)); }catch{}
  }catch{}
}
function configuredTypeTextClass(typeLabel){
  if(!typeLabel) return '';
  const t = String(typeLabel).trim();
  // exact match first
  const exact = TYPE_COLOR_MAP.get(t);
  if(exact) return exact;
  // fallback: substring match (e.g., 大和路快速 vs 大和路快)
  for(const [key, cls] of TYPE_COLOR_MAP.entries()){
    if(!key) continue;
    if(t.includes(key) || key.includes(t)) return cls;
  }
  return '';
}

// Optional: yomiage mapping (exact match) for type and destination
const YOMI_MAP = new Map(); // label -> reading
function resolveYomiUrls(){
  const urls = [];
  try{
    const sp2 = new URLSearchParams(window.location.search);
    const fromQuery = sp2.get('yomiage') || sp2.get('yomi');
    if(fromQuery) urls.push(String(fromQuery));
  }catch{}
  try{
    const meta = document.querySelector('meta[name="tid:yomiUrl"]');
    const fromMeta = meta && meta.getAttribute('content');
    if(fromMeta) urls.push(String(fromMeta));
  }catch{}
  urls.push('/assets/yomiage.txt','/yomiage.txt');
  return urls;
}
async function loadYomiageMap(){
  const urls = resolveYomiUrls();
  for(const u of urls){
    try{
      const res = await fetch(u, { cache: 'no-store' });
      if(!res.ok) continue;
      const text = await res.text();
      parseYomiageText(text);
      try{ dbg('yomiage map loaded', { url: u, size: YOMI_MAP.size }); }catch{}
      return;
    }catch{}
  }
  try{ dbg('yomiage map not found; using defaults'); }catch{}
}
function parseYomiageText(text){
  try{
    YOMI_MAP.clear();
    const lines = String(text||'').split(/\r?\n/);
    for(const ln of lines){
      const s = ln.trim();
      if(!s || s.startsWith('#')) continue;
      const parts = s.split(',');
      if(parts.length < 2) continue;
      const key = parts[0].trim();
      const val = parts[1].trim();
      if(key && val) YOMI_MAP.set(key, val);
    }
    try{ dbg('parsed yomiage map', Object.fromEntries(YOMI_MAP)); }catch{}
  }catch{}
}
function yomiFor(text){
  if(text == null) return '';
  const t = String(text).trim();
  return YOMI_MAP.get(t) || t;
}

// TTS (Web Speech API) controls
function ttsVoiceKey(){ return 'tid:tts:voice'; }
function getJapaneseVoices(){
  try{
    const synth = window.speechSynthesis;
    if(!synth || !synth.getVoices) return [];
    const list = synth.getVoices() || [];
    return list.filter(v => /^ja([-_]|$)/i.test(v.lang) || /japanese/i.test(v.name));
  }catch{ return []; }
}
function fixTtsText(raw){
  try{
    let s = String(raw||'');
    // 読み上げ補正: 数字+M を「エム」と読ませる（例: 4049M → 4049エム）
    // 半角/全角の M に対応。
    s = s.replace(/(\d+)\s*[mMＭ]\b/g, '$1エム');
    return s;
  }catch{ return String(raw||''); }
}

function speakText(text){
  try{
    if(!audioUnlocked) return;
    if(!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const voice = getSelectedVoice();
    const u = new SpeechSynthesisUtterance(fixTtsText(text));
    if(voice){ u.voice = voice; u.lang = voice.lang || 'ja-JP'; }
    else { u.lang = 'ja-JP'; }
    u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;
    synth.speak(u);
  }catch{}
}

// Delay highlight and periodic TTS
function delayThresholdKey(){ return 'tid:delay:threshold'; }
function getDelayThreshold(){
  try{
    const raw = getSetting('delay.threshold', undefined);
    if(raw == null || raw === '') return 4;
    const v = Number(raw);
    if(Number.isFinite(v) && v >= 0) return Math.floor(v);
  }catch{}
  return 4; // default 4 minutes
}
function initDelayControls(){
  const el = document.getElementById('delayThreshold');
  if(!el) return;
  try{
    const v = getDelayThreshold();
    el.value = String(v);
    el.addEventListener('change', () => {
      let n = Number(el.value);
      if(!Number.isFinite(n) || n < 0) n = 4;
      try{ setSetting('delay.threshold', Math.floor(n)); }catch{}
      refreshTrains();
    });
  }catch{}
}

// Cars highlight threshold and UI
function getCarsThreshold(){
  try{
    const raw = getSetting('cars.threshold', undefined);
    if(raw == null || raw === '') return 9;
    const v = Number(raw);
    if(Number.isFinite(v) && v >= 0) return Math.floor(v);
  }catch{}
  return 9;
}
function isCarsFilterEnabled(){
  try{
    const v = getSetting('cars.filterEnabled', false);
    return !!v;
  }catch{}
  return false;
}
function initCarsControls(){
  const el = document.getElementById('carsThreshold');
  const filterCb = document.getElementById('carsFilterEnable');
  if(!el) return;
  try{
    const v = getCarsThreshold();
    el.value = String(v);
    el.addEventListener('change', () => {
      let n = Number(el.value);
      if(!Number.isFinite(n) || n < 0) n = 9;
      try{ setSetting('cars.threshold', Math.floor(n)); }catch{}
      refreshTrains();
    });
  }catch{}
  if(filterCb){
    try{
      filterCb.checked = isCarsFilterEnabled();
      filterCb.addEventListener('change', () => {
        try{
          setSetting('cars.filterEnabled', filterCb.checked);
          dbg('CARS_FILTER_ENABLED', { enabled: filterCb.checked, threshold: getCarsThreshold() });
        }catch{}
      });
    }catch{}
  }
}

const delayAnnouncedAt = new Map(); // key -> timestamp
const DELAY_TTS_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

function buildDelayTtsMessage(t, indexes){
  try{
    const segs = [];
    const no = (t && t.no) ? String(t.no).trim() : '';
    if(no) segs.push(no);
    let type = (t && t.displayType) ? String(t.displayType).trim() : '';
    type = yomiFor(type);
    const nick = getNickname(t);
    if(type){
      if(nick){ segs.push(`${type} ${nick}`); }
      else { segs.push(`${type}列車`); }
    }
    let dest = getDestText(t, indexes, 'tts.dest');
    if(dest){
      dest = yomiFor(String(dest).trim());
      if(dest && !dest.endsWith('行き')) dest = `${dest}行き`;
      segs.push(dest);
    }
    const delay = (t && typeof t.delayMinutes === 'number') ? t.delayMinutes : null;
    if(delay && delay > 0){ segs.push(`約${delay}分遅延`); }
    return segs.filter(Boolean).join('、');
  }catch{ return ''; }
}

function handleDelayAnnouncements(list, indexes){
  // 背景状態では読み上げを行わない（復帰時の一斉再生を防止）
  try{ if(document.hidden) return; }catch{}
  // iOS Safari等の自動再生制限: ユーザー操作でアンロック済みでない場合は何もしない
  // （初回ロード時に読み上げ“失敗”として抑制フラグだけ付くのを防ぐ）
  if(!audioUnlocked){
    try{ bindAudioUnlockOnce(); }catch{}
    return;
  }
  const threshold = getDelayThreshold();
  const now = Date.now();
  for(const t of list){
    const delay = (typeof t.delayMinutes === 'number') ? t.delayMinutes : 0;
    if(delay < threshold) continue;
    const key = `delay:${line}:${t.no||'?'}:${t.direction}`;
    const last = delayAnnouncedAt.get(key) || 0;
    if(now - last < DELAY_TTS_INTERVAL_MS) continue;
    const msg = buildDelayTtsMessage(t, indexes);
    if(msg){
      queueDelayTts(msg, key);
    }
  }
}

function buildTtsMessage(t, targetCode, indexes){
  try{
    const segs = [];
    const no = (t && t.no) ? String(t.no).trim() : '';
    if(no) segs.push(no);
    let type = (t && t.displayType) ? String(t.displayType).trim() : '';
    type = yomiFor(type);
    const nick = getNickname(t);
    if(type){
      if(nick){
        // 種別 + 愛称（例: 特急 サンダーバード49号）
        segs.push(`${type} ${nick}`);
      }else{
        // 愛称なし → 「種別＋列車」（例: 普通列車）
        segs.push(`${type}列車`);
      }
    }
    // destination
    let dest = getDestText(t, indexes, 'tts.dest');
    if(dest){
      dest = yomiFor(String(dest).trim());
      if(dest && !dest.endsWith('行き')) dest = `${dest}行き`;
      segs.push(dest);
    }
    const stationName = indexes.byCode.get(String(targetCode))?.name || String(targetCode);
    segs.push(`${yomiFor(stationName)}に接近`);
    const delay = (t && typeof t.delayMinutes === 'number') ? t.delayMinutes : null;
    if(delay && delay > 0){
      segs.push(`約${delay}分遅延`);
    }
    return segs.filter(Boolean).join('、');
  }catch{
    const stationName = indexes.byCode.get(String(targetCode))?.name || String(targetCode);
    const no = (t && t.no) ? String(t.no) : '列車';
    return `${no}、${stationName}に接近`;
  }
}
function getSelectedVoice(){
  try{
    const name = getSetting('tts.voice','') || document.getElementById('ttsVoice')?.value || '';
    const voices = getJapaneseVoices();
    return voices.find(v => v.name === name) || voices[0] || null;
  }catch{ return null; }
}
function populateTTSSelect(){
  const sel = document.getElementById('ttsVoice');
  if(!sel) return;
  const voices = getJapaneseVoices();
  sel.innerHTML = '';
  if(!voices.length){
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '日本語音声が見つかりません';
    sel.appendChild(opt);
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '（未選択）';
  sel.appendChild(none);
  const saved = getSetting('tts.voice','') || '';
  for(const v of voices){
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.textContent = `${v.name} (${v.lang})`;
    if(saved && saved === v.name) opt.selected = true;
    sel.appendChild(opt);
  }
}

// Traffic info (area-level)
async function fetchTrafficInfo(area){
  const url = `${apiBase()}area_${area}_trafficinfo.json`;
  try{
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }catch(err){
    const fallbacks = [
      `/assets/data/area_${area}_trafficinfo.json`,
      `/area_${area}_trafficinfo.json`
    ];
    for(const f of fallbacks){
      try{
        const r = await fetch(f, { cache: 'no-store' });
        if(r.ok) return await r.json();
      }catch{}
    }
    throw err;
  }
}

function renderTrafficInfo(area, line, data){
  try{
    const box = document.getElementById('trafficInfo');
    if(!box) return;
    box.innerHTML = '';

    if(!data || typeof data !== 'object') return;

    const lineItems = [];
    const expressItems = [];

    // Collect line info
    if(data.lines && typeof data.lines === 'object'){
      const entry = data.lines[line];
      if(entry){
        const section = entry.section;
        let sectionText = '';
        if(typeof section === 'string') sectionText = section;
        else if(section && typeof section === 'object'){
          const from = section.from || section.start || '';
          const to = section.to || section.end || '';
          if(from || to) sectionText = `${from || ''} ~ ${to || ''}`.trim();
        }
        const cause = entry.cause || '';
        const status = entry.status || '';
        const url = entry.url || '';
        const text = `${sectionText ? sectionText + ': ' : ''}${cause ? (cause + ' により ') : ''}${status}`.trim();
        if(text) lineItems.push({ text, url });
      }
    }

    // Collect express info
    if(data.express && typeof data.express === 'object'){
      const e = data.express[line];
      if(e){
        const name = e.name || '';
        const cause = e.cause || '';
        const status = e.status || '';
        const url = e.url || '';
        const text = `${name ? '特急 ' + name + ': ' : ''}${cause ? (cause + ' により ') : ''}${status}`.trim();
        if(text) expressItems.push({ text, url });
      }
    }

    // Nothing to show
    if(!lineItems.length && !expressItems.length) return;

    // Helper: build a section
    const buildSection = (title, items, kind) => {
      const sec = document.createElement('section');
      sec.className = 'traffic-section';
      const h = document.createElement('div');
      h.className = `traffic-section__header ${kind === 'express' ? 'traffic-section__header--express' : 'traffic-section__header--line'}`;
      h.textContent = title;
      const ul = document.createElement('ul');
      ul.className = 'traffic-list';
      for(const it of items){
        const li = document.createElement('li');
        li.className = `traffic-item ${kind === 'express' ? 'traffic-item--express' : 'traffic-item--line'}`;
        if(it.url){
          const a = document.createElement('a');
          a.href = it.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
          a.textContent = it.text;
          li.appendChild(a);
        }else{
          li.textContent = it.text;
        }
        ul.appendChild(li);
      }
      sec.appendChild(h);
      sec.appendChild(ul);
      box.appendChild(sec);
    };

    if(lineItems.length) buildSection('路線の運行情報', lineItems, 'line');
    if(expressItems.length) buildSection('特急の運行情報', expressItems, 'express');
  }catch(err){ dbg('renderTrafficInfo error', err); }
}

async function updateTrafficInfo(area, line){
  if(!area || !line) return;
  try{
    const data = await fetchTrafficInfo(area);
    renderTrafficInfo(area, line, data);
  }catch(err){ dbg('traffic fetch fail', err); }
}
function initTTSControls(){
  const sel = document.getElementById('ttsVoice');
  const btn = document.getElementById('ttsTestBtn');
  if(!sel) return;
  try{
    bindAudioUnlockOnce();
    populateTTSSelect();
    // Some browsers populate voices asynchronously
    if('speechSynthesis' in window){
      window.speechSynthesis.onvoiceschanged = () => {
        const saved = getSetting('tts.voice','') || '';
        populateTTSSelect();
        if(saved){
          const s = document.getElementById('ttsVoice');
          if(s && Array.from(s.options).some(o=>o.value===saved)) s.value = saved;
        }
      };
    }
    sel.addEventListener('change', ()=>{
      try{ setSetting('tts.voice', sel.value || ''); }catch{}
    });
    // Restore saved
    const saved = getSetting('tts.voice','');
    if(saved && Array.from(sel.options).some(o=>o.value===saved)) sel.value = saved;

    // Test playback button
    if(btn){
      if(!('speechSynthesis' in window)){
        btn.disabled = true; btn.textContent = '音声未対応';
      }else{
        btn.addEventListener('click', async () => {
          try{
            bindAudioUnlockOnce();
            const synth = window.speechSynthesis;
            if(synth.speaking || synth.pending){
              synth.cancel();
              btn.textContent = 'テスト再生';
              return;
            }
            audioUnlocked = true; // clear user gesture
            btn.textContent = '停止';
            // Use the same stabilized path as alarms for iOS reliability
            // 種別と愛称の間にスペースを入れて読み上げ確認
            await speakTextAsync('4049M、特急 サンダーバード49号、大阪行き、千里丘に接近');
            btn.textContent = 'テスト再生';
          }catch(e){ btn.textContent = 'エラー'; }
        });
      }
    }
  }catch{}
}

const BEEP_DURATION_MS = 280; // duration of the approach alarm beep (fallback)
const ALARM_SOUND_URL = '/assets/sound/alarm.mp3';
let alarmAudioEl = null;
let alarmAudioPrimed = false;

function ensureAlarmAudioEl(){
  if(alarmAudioEl) return alarmAudioEl;
  try{
    const el = document.createElement('audio');
    el.src = ALARM_SOUND_URL;
    el.preload = 'auto';
    el.controls = false;
    el.loop = false;
    el.style.display = 'none';
    el.setAttribute('aria-hidden','true');
    // iOS Safari 互換のため（無害）
    try{ el.setAttribute('playsinline',''); el.setAttribute('webkit-playsinline',''); }catch{}
    document.body.appendChild(el);
    alarmAudioEl = el;
  }catch{}
  return alarmAudioEl;
}

async function primeAlarmAudio(){
  try{
    const el = ensureAlarmAudioEl();
    if(!el || alarmAudioPrimed === true) return true;
    // iOS: ユーザー操作内で一度再生→即停止で以後の再生を許可させる
    await el.play();
    // 短時間で停止
    try{ await new Promise(r => setTimeout(r, 10)); }catch{}
    try{ el.pause(); el.currentTime = 0; }catch{}
    alarmAudioPrimed = true;
    return true;
  }catch{ return false; }
}

// Background notification and wake lock preferences moved to tid-background.js

// Low-priority TTS queue for delay announcements (preemptable by alarms)
const delayTtsQueue = [];
const delayTtsKeys = new Set();
// delayTtsPlaying moved to top of file (line 48)
function queueDelayTts(message, key){
  try{
    const k = String(key||'');
    if(k && delayTtsKeys.has(k)) return;
    delayTtsQueue.push({ message, key: k });
    if(k) delayTtsKeys.add(k);
    if(!delayTtsPlaying){
      try{ drainDelayTts(); }catch{}
    }
  }catch{}
}
async function drainDelayTts(){
  if(delayTtsPlaying) return;
  delayTtsPlaying = true;
  try{
    while(delayTtsQueue.length){
      if(alarmSystem?.isPlaying && alarmSystem.isPlaying()) break;
      const it = delayTtsQueue[0];
      await speakTextAsync(it.message);
      delayTtsQueue.shift();
      if(it.key){
        delayTtsKeys.delete(it.key);
        try{ delayAnnouncedAt.set(it.key, Date.now()); }catch{}
      }
    }
  }finally{
    delayTtsPlaying = false;
  }
}
function preemptDelayTts(){
  try{
    if('speechSynthesis' in window){ window.speechSynthesis.cancel(); }
  }catch{}
  // Also reset TTS test button UI if it was showing "停止"
  try{
    const btn = document.getElementById('ttsTestBtn');
    if(btn){ btn.textContent = 'テスト再生'; }
  }catch{}
}

function cleanupAudioUnlockListeners(){
  // Listeners registered with { once: true } are automatically removed after firing
  // Just reset the flag to allow re-binding if needed
  audioUnlockBound = false;
}
function handleAudioUnlockGesture(){
  performAudioUnlock('gesture');
}
function performAudioUnlock(source){
  if(audioUnlocked) return;
  try{
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx && audioCtx.resume){ audioCtx.resume().catch(()=>{}); }
  }catch{}
  audioUnlocked = true;
  try{ setSetting('ui.audioUnlocked','1'); sessionStorage.setItem('tid:audio:session','1'); }catch{}
  cleanupAudioUnlockListeners();
  try{ dbg('audio unlocked', source||''); }catch{}
  try{ document.dispatchEvent(new CustomEvent('tid:audiounlocked')); }catch{}
  try{ primeAlarmAudio(); }catch{}
  try{ alarmSystem?.flushPendingAudio(); }catch{}
  try{ refreshTrains(); }catch{}
  try{ drainDelayTts(); }catch{}
}

function bindAudioUnlockOnce(){
  if(audioUnlocked) return;
  if(audioUnlockBound) return;
  audioUnlockBound = true;
  try{
    // Touch devices: touchstart is most reliable
    document.addEventListener('touchstart', handleAudioUnlockGesture, { once: true, passive: true });
    // Desktop: keyboard and mouse
    document.addEventListener('keydown', handleAudioUnlockGesture, { once: true });
    // Modern browsers with pointer events (may not work on older iPad Safari)
    if('PointerEvent' in window){
      document.addEventListener('pointerdown', handleAudioUnlockGesture, { once: true, passive: true });
    } else {
      // Fallback for browsers without pointer events
      document.addEventListener('mousedown', handleAudioUnlockGesture, { once: true, passive: true });
    }
  }catch{}
}

function setupAudioUnlockOverlay(){
  // Show overlay until first user gesture unlocks audio/TTS
  if(!audioOverlay) return;
  const supported = ('speechSynthesis' in window) || ('AudioContext' in window) || ('webkitAudioContext' in window);
  if(!supported){ audioOverlay.classList.add('is-hidden'); audioOverlay.setAttribute('aria-hidden','true'); return; }
  const hide = () => { try{ audioOverlay.classList.add('is-hidden'); audioOverlay.setAttribute('aria-hidden','true'); }catch{} };
  const show = () => { try{ audioOverlay.classList.remove('is-hidden'); audioOverlay.removeAttribute('aria-hidden'); }catch{} };
  // Environment hint
  try{
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || (window.navigator && window.navigator.standalone === true);
    const text = isStandalone
      ? 'アプリとして起動中です。音声を有効にするとアラート通知やテスト音声を確認できます。'
      : 'ブラウザで開いています。音声を有効にするとテスト音声やアラート通知が行えるようになります。';
    if(audioOverlayHint){ audioOverlayHint.textContent = text; }
  }catch{}
  show();
  // Bind unlock attempt to button; do not hijack background clicks (non-modal floating)
  try{
    if(audioOverlayBtn){
      audioOverlayBtn.addEventListener('click', () => {
        try{
          bindAudioUnlockOnce();
          performAudioUnlock('overlay-button');
          runAudioUnlockTestPlayback();
        }catch(err){ dbg('audio unlock button failed', err); }
      });
    }
    if(audioOverlayLater){ audioOverlayLater.addEventListener('click', () => { try{ audioOverlay.classList.add('is-hidden'); audioOverlay.setAttribute('aria-hidden','true'); }catch{} }); }
    if(audioOverlayClose){ audioOverlayClose.addEventListener('click', () => { try{ audioOverlay.classList.add('is-hidden'); audioOverlay.setAttribute('aria-hidden','true'); }catch{} }); }
    document.addEventListener('tid:audiounlocked', hide, { once: true });
  }catch{}
}

async function runAudioUnlockTestPlayback(){
  try{
    if(!audioUnlocked) return;
    preemptDelayTts();
    const waitMs = playBeep();
    if(waitMs > 0){
      try{ await new Promise(r => setTimeout(r, waitMs)); }catch{}
    }
    await speakTextAsync('テスト音声です。');
  }catch(err){ dbg('audio unlock test failed', err); }
}
async function playAlarmSound(){
  try{
    if(!audioUnlocked){ bindAudioUnlockOnce(); return 0; }
    const el = ensureAlarmAudioEl();
    if(!el){ return 0; }
    // try prime (best-effort)
    try{ await primeAlarmAudio(); }catch{}
    el.currentTime = 0;
    el.volume = 1.0;
    return await new Promise((resolve) => {
      let settled = false;
      const done = (ms) => { if(!settled){ settled = true; resolve(Number.isFinite(ms)? ms : 0); } };
      const onEnded = () => {
        const durMs = (typeof el.duration === 'number' && isFinite(el.duration)) ? Math.round(el.duration*1000) : 0;
        cleanup();
        done(durMs);
      };
      const onError = () => { cleanup(); done(0); };
      const cleanup = () => {
        try{ el.removeEventListener('ended', onEnded); }catch{}
        try{ el.removeEventListener('error', onError); }catch{}
      };
      try{
        el.addEventListener('ended', onEnded, { once: true });
        el.addEventListener('error', onError, { once: true });
        // If already playing something, restart
        try{ if(!el.paused){ el.pause(); el.currentTime = 0; } }catch{}
        const p = el.play();
        if(p && typeof p.then === 'function'){
          p.catch(()=> {
            try{
              audioUnlocked = false;
              sessionStorage.removeItem('tid:audio:session');
              setSetting('ui.audioUnlocked','0');
              bindAudioUnlockOnce();
              setupAudioUnlockOverlay();
            }catch{}
            cleanup();
            done(0);
          });
        }
      }catch{ cleanup(); done(0); }
      setTimeout(() => { cleanup(); done(0); }, 6000); // safety timeout
    });
  }catch(e){ dbg('alarm audio failed', e); return 0; }
}

function playBeep(){
  try{
    // Avoid attempting to start/resume audio before user gesture
    if(!audioUnlocked){ bindAudioUnlockOnce(); return 0; }
    audioCtx = audioCtx || new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state === 'suspended' && audioCtx.resume) audioCtx.resume().catch(()=>{});
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = 880; // A5
    g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.22, audioCtx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + (BEEP_DURATION_MS/1000)-0.02);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + (BEEP_DURATION_MS/1000));
  }catch(err){ dbg('beep failed', err); }
  return BEEP_DURATION_MS;
}
async function speakTextAsync(text){
  try{
    if(!audioUnlocked) return;
    if(!('speechSynthesis' in window)) return;
    const synth = window.speechSynthesis;
    const voice = getSelectedVoice();
    return await new Promise((resolve) => {
      try{
        // iOS Safari reliability tweaks
        try{ synth.cancel(); }catch{}
        try{ if(synth.paused && synth.resume) synth.resume(); }catch{}
        const startSpeak = () => {
          try{
            const u = new SpeechSynthesisUtterance(fixTtsText(text));
            if(voice){ u.voice = voice; u.lang = voice.lang || 'ja-JP'; }
            else { u.lang = 'ja-JP'; }
            u.rate = 1.0; u.pitch = 1.0; u.volume = 1.0;
            u.onend = () => resolve();
            u.onerror = () => resolve();
            synth.speak(u);
          }catch{ resolve(); }
        };
        // slight defer after cancel/resume to prevent being swallowed on iOS
        setTimeout(startSpeak, 30);
      }catch{ resolve(); }
    });
  }catch{}
}

// Global station index for the whole area(s) (code -> name)
const globalStationsByCode = new Map();
const AREA_LIST = ['kinki','hokuriku','okayama','hiroshima','sanin'];
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // ~30 days

function areaCacheKey(a){ return `tid:areaStations:${a}`; }
function areaCrossKey(a){ return `tid:cross:${a}`; }

function loadAreaStationsCache(a){
  try{
    const raw = localStorage.getItem(areaCacheKey(a));
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(!obj || !obj.updatedAt || !obj.stations) return null;
    const age = Date.now() - Number(obj.updatedAt);
    if(age > CACHE_TTL_MS) return null;
    return obj; // { updatedAt, stations: { code: {name, stopTrains?} }, lines?: { lineId: [codes] } }
  }catch{ return null; }
}

  function saveAreaStationsCache(a, data){
    try{
      const payload = {
        updatedAt: Date.now(),
        stations: data.stations || {},
        lines: data.lines || {},
        lineStations: data.lineStations || {}
      };
      localStorage.setItem(areaCacheKey(a), JSON.stringify(payload));
    }catch{ /* ignore quota */ }
  }

  function loadAreaCrossCache(a){
    try{
      const raw = localStorage.getItem(areaCrossKey(a));
      if(!raw) return null;
      const obj = JSON.parse(raw);
      if(!obj || !obj.updatedAt || !obj.lines) return null;
      const age = Date.now() - Number(obj.updatedAt);
      if(age > CACHE_TTL_MS) return null;
      return obj; // { updatedAt, lines: { lineId: { '0400_0401': 'hokurikubiwako', ... } } }
    }catch{ return null; }
  }

  function saveAreaCrossCache(a, data){
    try{
      const payload = { updatedAt: Date.now(), lines: data.lines || {} };
      localStorage.setItem(areaCrossKey(a), JSON.stringify(payload));
    }catch{}
  }

  function pairKey(a,b){ const x=String(a), y=String(b); return x<y ? `${x}_${y}` : `${y}_${x}`; }

  function getCrossPreferredLine(a, userLine, codeA, codeB){
    const obj = loadAreaCrossCache(a);
    if(!obj || !obj.lines) return null;
    const table = obj.lines[userLine];
    if(!table) return null;
    return table[pairKey(codeA, codeB)] || null;
  }

  function setCrossPreferredLine(a, userLine, codeA, codeB, chosenLine){
    try{
      const obj = loadAreaCrossCache(a) || { updatedAt: Date.now(), lines: {} };
      if(!obj.lines[userLine]) obj.lines[userLine] = {};
      obj.lines[userLine][pairKey(codeA, codeB)] = String(chosenLine);
      saveAreaCrossCache(a, obj);
      dbg('cross pair cached', { area: a, userLine, pair: pairKey(codeA, codeB), chosenLine });
    }catch{}
  }

// line orders cache in-memory
const globalLineOrders = new Map(); // lineId -> [codes]

async function buildGlobalStationsForArea(a, { force = false } = {}){
  if(!a) return; // fallback to per-line only
  // try cache first
  if(!force){
    const cached = loadAreaStationsCache(a);
    if(cached){
      const stations = cached.stations || {};
      for(const [code, v] of Object.entries(stations)){
        const name = typeof v === 'string' ? v : v?.name;
        if(name){
          globalStationsByCode.set(String(code), String(name));
        }
      }
      const lines = cached.lines || {};
      for(const [lid, arr] of Object.entries(lines)){
        if(Array.isArray(arr)) globalLineOrders.set(lid, arr.map(String));
      }
      return;
    }
  }
  try{
    const master = await fetchAreaMaster(a);
    const lineIds = Object.keys(master?.lines || {});
    if(!lineIds.length) return;
    const results = await Promise.allSettled(
      lineIds.map(l => fetchStations(l).then(data => ({ lineId: l, data })))
    );
      const toCacheStations = {};
      const toCacheLines = {};
      const toCacheLineStations = {};
    for(const r of results){
      if(r.status !== 'fulfilled') continue;
      const { lineId, data } = r.value;
        const list = Array.isArray(data?.stations) ? data.stations : [];
        const orderCodes = [];
        const perLine = {};
      for(const s of list){
        const info = s?.info || {};
        const code = info?.code;
        const name = info?.name;
        if(code){
          const c = String(code);
            if(name){
              const n = String(name);
              globalStationsByCode.set(c, n);
              const stopTrains = Array.isArray(info?.stopTrains) ? info.stopTrains.slice() : undefined;
              const transferLines = extractTransferLinesFromInfo(info);
              toCacheStations[c] = { name: n, stopTrains };
              perLine[c] = { name: n, stopTrains, transferLines };
            }
            orderCodes.push(c);
          }
        }
        if(lineId && orderCodes.length){
          globalLineOrders.set(lineId, orderCodes);
          toCacheLines[lineId] = orderCodes;
          toCacheLineStations[lineId] = perLine;
        }
      }
      saveAreaStationsCache(a, { stations: toCacheStations, lines: toCacheLines, lineStations: toCacheLineStations });
  }catch(err){
    // best-effort; ignore
    console.warn('エリア駅名の構築に失敗', err);
  }
}

// Warm global maps from localStorage cache only (no network)
function warmAreaFromCache(a){
  const cached = loadAreaStationsCache(a);
  if(!cached) return;
  for(const [code, v] of Object.entries(cached.stations || {})){
    const name = typeof v === 'string' ? v : v?.name;
    if(name) globalStationsByCode.set(String(code), String(name));
  }
  for(const [lid, arr] of Object.entries(cached.lines || {})){
    if(Array.isArray(arr)) globalLineOrders.set(lid, arr.map(String));
  }
}

// Only warm from cache to avoid unexpected network fetches for other areas
(function warmAllAreasFromCache(){
  try{
    AREA_LIST.forEach(a => warmAreaFromCache(a));
  }catch{ /* ignore */ }
})();

async function fetchAreaMaster(area){
  const url = `${apiBase()}area_${area}_master.json`;
  try{
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }catch(err){
    // local fallbacks for development only
    const fallbacks = [
      `/assets/data/area_${area}_master.json`,
      `/area_${area}_master.json`
    ];
    for(const f of fallbacks){
      try{
        const r = await fetch(f, { cache: 'no-store' });
        if(r.ok) return await r.json();
      }catch{}
    }
    throw err;
  }
}

async function fetchStations(line){
  const url = `${apiBase()}${line}_st.json`;
  try{
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }catch(err){
    // Local fallbacks for development only
    const fallbacks = [
      `/assets/data/${line}_st.json`,
      `/${line}_st.json`
    ];
    for(const f of fallbacks){
      try{
        const r = await fetch(f, { cache: 'no-store' });
        if(r.ok) return await r.json();
      }catch{ /* try next */ }
    }
    throw err;
  }
}

function buildStationIndexes(data){
  const byCode = new Map();
  const list = Array.isArray(data?.stations) ? data.stations : [];
  list.forEach((s, idx) => {
    const info = s?.info || {};
    const code = info?.code;
    if(code){
      byCode.set(String(code), {
        index: idx,
        name: String(info?.name || ''),
        code: String(code),
        stopTrains: Array.isArray(info?.stopTrains) ? info.stopTrains.slice() : null,
        transferLines: extractTransferLinesFromInfo(info)
      });
    }
  });
  const order = list.map(s => String(s?.info?.code || ''));
  return { byCode, order };
}

function extractTransferLinesFromInfo(info){
  const out = new Set();
  const arr = Array.isArray(info?.transfer) ? info.transfer : [];
  for(const t of arr){
    const link = t && t.link;
    const code = t && t.code;
    if(typeof link === 'string' && link) out.add(link);
    else if(typeof code === 'string' && code) out.add(code);
  }
  return Array.from(out);
}

function buildIndexesFromCache(area, line){
  const cached = loadAreaStationsCache(area);
  if(!cached || !cached.stations) return null;
  let order = (cached.lines && cached.lines[line]) || globalLineOrders.get(line) || null;
  if(!Array.isArray(order) || !order.length){
    const codes = Object.keys(cached.stations || {});
    if(!codes.length) return null;
    order = codes.sort();
    dbg('cache order fallback', { area, line, count: order.length });
  }
  const byCode = new Map();
  order.forEach((code, idx) => {
    const rec = (cached.lineStations && cached.lineStations[line] && cached.lineStations[line][code])
      || cached.stations[code] || {};
    const name = rec?.name || globalStationsByCode.get(code) || code;
    const stopTrains = Array.isArray(rec?.stopTrains) ? rec.stopTrains : [];
    byCode.set(String(code), { index: idx, name: String(name), code: String(code), stopTrains });
  });
  dbg('buildIndexesFromCache OK', { area, line, size: byCode.size });
  return { byCode, order: order.map(String) };
}

function populateStationFilter(indexes){
  const sel = document.getElementById('stationFilter');
  if(!sel) return;
  // clear
  sel.length = 1;
  for(const code of indexes.order){
    const st = indexes.byCode.get(code);
    if(!st) continue;
    const opt = document.createElement('option');
    opt.value = st.code;
    opt.textContent = st.name || st.code;
    sel.appendChild(opt);
  }
  // restore saved selection per line (consolidated settings)
  const savedStation = getSetting(`lines.${line}.station`, '');
  if(savedStation && Array.from(sel.options).some(o => o.value === savedStation)){
    sel.value = savedStation;
  }
  sel.addEventListener('change', () => {
    setSetting(`lines.${line}.station`, sel.value || '');
    // retrigger render by refetching latest trains
    try{ alarmSystem?.clearNotified(); }catch{}
    refreshTrains();
  });
  const passSel = document.getElementById('passFilter');
  if(passSel){
    const savedPass = getSetting(`lines.${line}.pass`, null);
    if(savedPass === 'show' || savedPass === 'hide'){
      passSel.value = savedPass;
    }
    passSel.addEventListener('change', () => {
      setSetting(`lines.${line}.pass`, passSel.value);
      refreshTrains();
    });
  }
  const refreshBtn = document.getElementById('refreshStationsBtn');
  if(refreshBtn){
    refreshBtn.addEventListener('click', async () => {
      try{
        refreshBtn.disabled = true;
        const oldText = refreshBtn.textContent;
        refreshBtn.textContent = '更新中…';
        clearAreaStationsCache(area);
        clearAreaCrossCache(area);
        await buildGlobalStationsForArea(area, { force: true });
        await refreshTrains();
        refreshBtn.textContent = oldText;
      }finally{
        refreshBtn.disabled = false;
      }
    });
  }
}

async function refreshTrains(){
  if(refreshing) return;
  refreshing = true;
  try{
    let indexes = buildIndexesFromCache(area, line);
    if(!indexes){
      const stations = await fetchStations(line);
      indexes = buildStationIndexes(stations);
    }
    const trains = await fetchTrains(line);
    setUpdatedAt(trains?.update);
    populateStationFilter(indexes);
    renderTrains(indexes, trains, dir);
    try{ await updateTrafficInfo(area, line); }catch{}
  }catch(err){
    console.error('再取得に失敗', err);
  }finally{
    refreshing = false;
  }
}

let refreshTimer = null;
// refreshing moved to top of file (line 49)
let visBound = false;
function startAutoRefresh(){
  stopAutoRefresh();
  refreshTimer = setInterval(() => {
    // 10秒ごとに最新の列車一覧を取得
    refreshTrains();
  }, 10000);
  // ページが非表示の場合はスキップ（簡易節約）
  if(!visBound){
    document.addEventListener('visibilitychange', () => {
      if(document.hidden) return;
      // 復帰時に即時更新（読み上げ判定も実行）
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
  if(!iso){ updatedAtEl.textContent = ''; return; }
  updatedAtEl.textContent = formatJST(iso);
}

  function formatJST(iso){
  try{
    const dt = new Date(iso);
    if(isNaN(dt.getTime())) return '';
    const parts = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).formatToParts(dt);
    const get = (t) => parts.find(p => p.type === t)?.value || '';
    return `${get('year')}年${get('month')}月${get('day')}日 ${get('hour')}時${get('minute')}分${get('second')}秒更新`;
  }catch{ return ''; }
}

async function fetchTrains(line){
  const url = `${apiBase()}${line}.json`;
  try{
    const res = await fetch(url, { cache: 'no-store' });
    if(!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return await res.json();
  }catch(err){
    const fallbacks = [
      `/assets/data/${line}.json`,
      `/${line}.json`
    ];
    for(const f of fallbacks){
      try{
        const r = await fetch(f, { cache: 'no-store' });
        if(r.ok) return await r.json();
      }catch{}
    }
    throw err;
  }
}

function renderTrains(indexes, trainsData, dirParam){
  const items = Array.isArray(trainsData?.trains) ? trainsData.trains : [];
  const selectedCode = (document.getElementById('stationFilter')?.value || '').trim();
  const allowedCats = stationAllowedCategories(indexes.byCode.get(selectedCode));
  const passSetting = (document.getElementById('passFilter')?.value || 'hide');
  const enhanced = items
    .map(t => normalizeTrain(t))
    .map(t => enhanceTrain(t, indexes.byCode));
  const parsed = enhanced.filter(t => filterByStationSetting(t, allowedCats, passSetting));
  // If a station is selected, hide trains that have already passed the station
  const stationIdx = selectedCode ? indexes.byCode.get(selectedCode)?.index : null;
  // Note: Approach alarms must use the same set as the screen shows.
  // We will compute shown lists first and then run alarm checks on them.
  const hidePassed = (arr, dir) => {
    if(stationIdx == null) return arr;
    return arr.filter(t => {
      if(typeof t.posIndex !== 'number') return true;
      if(dir === 0) {
        // 上り: 既に通過（駅より小さい位置）は除外
        return t.posIndex >= stationIdx;
      } else {
        // 下り: 既に通過（駅より大きい位置）は除外
        return t.posIndex <= stationIdx;
      }
    });
  };
  // Update heading to reflect filter state
  const heading = document.getElementById('trainsHeading');
  if(heading){
    if(selectedCode){
      const st = indexes.byCode.get(selectedCode);
      const name = st?.name || selectedCode;
      heading.textContent = `列車一覧（駅で絞り込み: ${name}）`;
    }else{
      heading.textContent = '列車一覧（絞り込み無し）';
    }
  }
  let up = hidePassed(parsed.filter(t => t.direction === 0).sort((a,b)=>a.posIndex-b.posIndex), 0);
  let down = hidePassed(parsed.filter(t => t.direction === 1).sort((a,b)=>b.posIndex-a.posIndex), 1);

  // Additional filter: hide trains whose destination station is before the selected
  // station along the train's direction (i.e., they terminate before reaching the
  // selected station). This also implicitly suppresses their delay TTS since we
  // only announce for shown trains.
  function destIndexForTrain(t){
    try{
      const d = t && t.dest;
      if(!d) return null;
      let code = null;
      if(typeof d === 'object'){
        if(d.code != null){ code = String(d.code); }
        else{
          const name = String(d.text || d.name || '').trim();
          if(name){
            for(const [c, rec] of indexes.byCode.entries()){
              if(String(rec?.name||'').trim() === name){ return typeof rec.index === 'number' ? rec.index : null; }
            }
          }
        }
      }else if(typeof d === 'string'){
        const name = String(d).trim();
        if(name){
          for(const [c, rec] of indexes.byCode.entries()){
            if(String(rec?.name||'').trim() === name){ return typeof rec.index === 'number' ? rec.index : null; }
          }
        }
      }
      if(code){
        const rec = indexes.byCode.get(code);
        return (rec && typeof rec.index === 'number') ? rec.index : null;
      }
    }catch{}
    return null;
  }
  function hideTerminatesBeforeSelected(arr, dir){
    if(stationIdx == null) return arr;
    return arr.filter(t => {
      const di = destIndexForTrain(t);
      if(typeof di !== 'number') return true; // unknown → keep
      if(dir === 0){
        // up (indices decrease as moving): hide if destination is to the right of selected (greater index)
        return di <= stationIdx;
      }else{
        // down (indices increase as moving): hide if destination is to the left of selected (smaller index)
        return di >= stationIdx;
      }
    });
  }
  up = hideTerminatesBeforeSelected(up, 0);
  down = hideTerminatesBeforeSelected(down, 1);

  // Keep latest context for alarm queue validation
  try{ alarmSystem?.setLastShown({ up, down }, selectedCode, indexes); }catch{}

  // When pass display is "show" and pass alarm is enabled for a direction,
  // include the "just-left-of-target" segment for the selected station so that
  // the alarm can trigger even if the UI hides already-passed trains.
  // This keeps visual rules intact while aligning alarm timing expectations.
  try{
    const passSettingNow = (document.getElementById('passFilter')?.value || 'hide');
    if(passSettingNow === 'show' && selectedCode){
      const addExtrasForPass = (list, dir) => {
        try{
          const prefs = getPrefsForDir(dir);
          if(!prefs || !prefs.has('pass')) return list;
          const selected = String(selectedCode);
          // Consider trains that would trigger pass alarm at the selected station boundary:
          //  - up(dir=0): moving and nextCode === selected (segment selected -> left)
          //  - down(dir=1): moving and atCode === selected (segment selected -> right)
          const base = parsed.filter(t => t.direction === dir);
          const extras = base.filter(t => !t.stopped && (
            dir === 0 ? (String(t.nextCode||'') === selected) : (String(t.atCode||'') === selected)
          ));
          if(!extras.length) return list;
          // merge without duplicates (by train no + pos)
          const keyOf = (t) => `${t.no||'?'}:${t.pos||''}`;
          const seen = new Set(list.map(keyOf));
          for(const t of extras){ const k = keyOf(t); if(!seen.has(k)) { list.push(t); seen.add(k); } }
          return list;
        }catch{ return list; }
      };
      up = addExtrasForPass(up, 0);
      down = addExtrasForPass(down, 1);
    }
  }catch{}

  // Render alarm type options (per-direction) based on selected station and current direction filter
  try{ alarmSystem?.renderAlarmOptions(indexes, selectedCode, allowedCats, dirParam); }catch(e){ dbg('alarm render failed', e); }
  // Approach alarms: use the same trains that are shown on screen
  try{
    const shown = dirParam === 'up' ? up : dirParam === 'down' ? down : up.concat(down);
    alarmSystem?.handleApproachAlarms(indexes, shown, selectedCode, stationIdx, allowedCats, dirParam);
  }catch(e){ dbg('alarm check failed', e); }
  // run low-priority delay announcements after alarm checks
  try{
    const shown = dirParam === 'up' ? up : dirParam === 'down' ? down : up.concat(down);
    handleDelayAnnouncements(shown, indexes);
  }catch(e){ dbg('delay tts failed', e); }

  // Reset columns
  upContainer.parentElement.style.display = '';
  downContainer.parentElement.style.display = '';

  if(dirParam === 'up'){
    renderTrainListJP(upContainer, up, indexes);
    downContainer.parentElement.style.display = 'none';
    trainsContainer?.classList.add('single');
  }else if(dirParam === 'down'){
    renderTrainListJP(downContainer, down, indexes);
    upContainer.parentElement.style.display = 'none';
    trainsContainer?.classList.add('single');
  }else{
    renderTrainListJP(upContainer, up, indexes);
    renderTrainListJP(downContainer, down, indexes);
    trainsContainer?.classList.remove('single');
  }
}

function renderTrainListJP(container, list, indexes){
  if(!container) return;
  container.innerHTML = '';
  if(!list.length){
    container.textContent = '該当なし';
    return;
  }
  const table = document.createElement('table');
  table.className = 'train-table';
  const colgroup = document.createElement('colgroup');
  for(let i=0;i<7;i++){ colgroup.appendChild(document.createElement('col')); }
  table.appendChild(colgroup);
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr>'+
    '<th>列番</th>'+
    '<th>種別</th>'+
    '<th>愛称</th>'+
    '<th>両数</th>'+
    '<th>行先</th>'+
    '<th>位置</th>'+
    '<th>遅延</th>'+
  '</tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for(const t of list){
    const tr = document.createElement('tr');
    const threshold = getDelayThreshold();
    const delayText = (typeof t.delayMinutes === 'number' && t.delayMinutes > 0)
      ? (t.delayMinutes >= threshold
          ? `<span class="delay-bad" style="color:var(--color-danger,#c00);font-weight:700;">${t.delayMinutes}分</span>`
          : `${t.delayMinutes}分`)
      : '';
    const typeLabel = (t.displayType || '').trim();
    const __mapCls = configuredTypeTextClass(typeLabel);
    const __cat = trainCategoryFromDisplayType(t.displayType);
    const __cls = __mapCls || typeTextClass(__cat);
    const TYPE_HTML = __cls ? `<span class=\"${__cls}\">${escapeHtml(typeLabel)}</span>` : `${escapeHtml(typeLabel)}`;
    const posPart = t.stopped
      ? `${escapeHtml(t.atName || '')}`
      : (() => {
          const from = t.direction === 0 ? t.nextName : t.atName; // 上りは右→左
          const to = t.direction === 0 ? t.atName : t.nextName;
          return `${escapeHtml(from || '')} → ${escapeHtml(to || '')}`;
        })();
    const destText = escapeHtml(getDestText(t, indexes, 'dest'));
    let carsText = t.numberOfCars != null ? escapeHtml(String(t.numberOfCars)) : '';
    try{
      const th = getCarsThreshold();
      const n = Number(t.numberOfCars);
      if(Number.isFinite(n) && n >= th){ carsText = `<span class=\"cars-emph\">${carsText}</span>`; }
    }catch{}
    tr.innerHTML = `
      <td>${escapeHtml(t.no || '')}</td>
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

function typeBadgeClass(cat){
  switch(Number(cat)){
    case 5: // 特急
    case 6: // 急行
    case 7: // 寝台
    case 8: // SL
    case 9: // 観光
      return 'type-red';
    case 1: // 新快速
      return 'type-blue';
    case 4: // 直通快速
      return 'type-bluegray'; // ご要望により変更可（橙にする場合は type-orange）
    case 2: // 快速
      return 'type-orange';
    case 3: // 区間快速
      return 'type-green';
    case 10: // 瑞風
      return 'type-emerald';
    case 0: // 普通
      return 'type-white';
    default:
      return 'type-white';
  }
}

// typeTextClass() moved to tid-category.js

// normalizeTrain() moved to tid-category.js
// デバッグログを追加するためのラッパー関数
function normalizeTrainWithDebug(train){
  const result = normalizeTrain(train);
  if(result !== train && TID_DEBUG){
    const originalDisplayType = String(train.displayType || '').trim();
    if(originalDisplayType !== result.displayType){
      if(/^A[\s　]*新快/.test(originalDisplayType)){
        dbg('NORMALIZE_TRAIN', { trainNo: train.no, original: originalDisplayType, normalized: result.displayType, nickname: result.nickname, pattern: 'A新快' });
      } else if(/^う[\s　]*[^\s○◯〇×]+[\s　]*[○◯〇×]$/.test(originalDisplayType)){
        dbg('NORMALIZE_TRAIN', { trainNo: train.no, original: originalDisplayType, normalized: result.displayType, nickname: result.nickname, pattern: 'うれしート' });
      }
    }
  }
  return result;
}

function stationKey(line){
  return `tid:station:${line}`;
}
function passKey(line){
  return `tid:pass:${line}`;
}

// stationAllowedCategories() moved to tid-category.js

// trainCategoryFromDisplayType() moved to tid-category.js
// デバッグログを追加するためのラッパー関数
function trainCategoryFromDisplayTypeWithDebug(displayType){
  const cat = trainCategoryFromDisplayType(displayType);
  if(TID_DEBUG && cat >= 0){
    dbg('TRAIN_CATEGORY', { displayType, category: cat, categoryLabel: getCategoryLabel(cat) });
  }
  return cat;
}

function filterByStationSetting(train, allowed, passSetting){
  if(!allowed) return true; // no station filter → 全件
  const cat = trainCategoryFromDisplayType(train.displayType);
  const stopsHere = (cat !== -1 && allowed.has(cat)) || (cat === -1); // 不明は停車扱い
  if(passSetting === 'show') return true; // 通過も表示
  return stopsHere; // 非表示なら停車のみ
}

function enhanceTrain(t, byCode){
  const { atCode, nextCode, stopped } = parsePos(t.pos);
  const a = byCode.get(atCode);
  const b = nextCode ? byCode.get(nextCode) : null;
  let posIndex = a ? a.index : 0;
  if(!stopped && a && b){
    posIndex = (a.index + b.index) / 2;
  }
  const atName = a?.name || getStationNameByPriority(atCode, { byCode }, 'pos.at', nextCode) || atCode || '';
  const nextName = b?.name || (nextCode ? (getStationNameByPriority(nextCode, { byCode }, 'pos.next', atCode) || nextCode) : '') || '';
  return {
    ...t,
    atCode, nextCode, stopped, posIndex, atName, nextName
  };
}

function parsePos(pos){
  const [left, right] = String(pos||'').split('_');
  if(right === '####' || !right){
    return { atCode: left, nextCode: null, stopped: true };
  }
  return { atCode: left, nextCode: right, stopped: false };
}

function renderTrainList(container, list, indexes){
  if(!container) return;
  container.innerHTML = '';
  if(!list.length){
    container.textContent = '該当なし';
    return;
  }
  const table = document.createElement('table');
  table.className = 'train-table';
  const colgroup = document.createElement('colgroup');
  for(let i=0;i<7;i++){ colgroup.appendChild(document.createElement('col')); }
  table.appendChild(colgroup);
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr>'+
    '<th>車番</th>'+
    '<th>種別</th>'+
    '<th>名称</th>'+
    '<th>両数</th>'+
    '<th>行先</th>'+
    '<th>走行区間</th>'+
    '<th>遅延</th>'+
  '</tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for(const t of list){
    const tr = document.createElement('tr');
    const threshold = getDelayThreshold();
    const delayText = (typeof t.delayMinutes === 'number' && t.delayMinutes > 0)
      ? (t.delayMinutes >= threshold
          ? `<span class=\"delay-bad\" style=\"color:var(--color-danger,#c00);font-weight:700;\">${t.delayMinutes}分</span>`
          : `${t.delayMinutes}分`)
      : '';
    const typeLabel = (t.displayType || '').trim();
    const __cls = configuredTypeTextClass(typeLabel);
    const TYPE_HTML = __cls ? `<span class=\"${__cls}\">${escapeHtml(typeLabel)}</span>` : `${escapeHtml(typeLabel)}`;
    const posPart = t.stopped
      ? `${escapeHtml(t.atName || '')}`
      : (() => {
          const from = t.direction === 0 ? t.nextName : t.atName; // 上りは左右反転
          const to = t.direction === 0 ? t.atName : t.nextName;
          return `${escapeHtml(from || '')} -> ${escapeHtml(to || '')}`;
        })();
        const destText = escapeHtml(getDestText(t, indexes, 'dest'));
    let carsText = t.numberOfCars != null ? escapeHtml(String(t.numberOfCars)) : '';
    try{
      const th = getCarsThreshold();
      const n = Number(t.numberOfCars);
      if(Number.isFinite(n) && n >= th){ carsText = `<span class=\"cars-emph\">${carsText}</span>`; }
    }catch{}
    tr.innerHTML = `
      <td>${escapeHtml(t.no || '')}</td>
      <td>${typeHtml}</td>
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

function escapeHtml(str){
  return String(str||'').replace(/[&<>\"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[s]));
}

function getDestText(t, indexes, tag){
  const d = t && t.dest;
  if(d == null) return '';
  if(typeof d === 'string') return d;
  if(typeof d === 'object'){
    const code = d.code != null ? String(d.code) : '';
    const text = d.text || d.name || '';
    if(text && String(text).trim()) return String(text);
    if(code){
      const name = getStationNameByPriority(code, indexes, tag || 'dest');
      if(name) return name;
      return code;
    }
    return '';
  }
  return String(d);
}

function getStationNameByPriority(code, indexes, tag, neighborCode){
  const c = String(code);
  // 1) current line indexes
  if(indexes && indexes.byCode && indexes.byCode.has(c)){
    const hit = String(indexes.byCode.get(c)?.name || '');
    dbg('station hit [line]', { tag, line, area, code: c, name: hit });
    return hit;
  }
  // 2) current area cache
  const areaObj = loadAreaStationsCache(area);
  if(areaObj){
    // Prefer line-specific map if present
    const ls = areaObj.lineStations && areaObj.lineStations[line];
    if(ls && ls[c]){
      const v = ls[c];
      const hit = typeof v === 'string' ? v : String(v?.name || '');
      dbg('station hit [area-line]', { tag, line, area, code: c, name: hit });
      return hit;
    }
    // Neighbor-aware disambiguation within current area (prefer transfer-linked lines)
    if(neighborCode){
      const neighbor = String(neighborCode);
      const linesMap = areaObj.lineStations || {};
      const orders = areaObj.lines || {};
      // Try previously cached cross-line choice first
      const pref = getCrossPreferredLine(area, line, c, neighbor);
      if(pref && linesMap[pref]){
        const perLineP = linesMap[pref] || {};
        const orderP = orders[pref] || [];
        if(perLineP[c] && Array.isArray(orderP) && orderP.includes(neighbor)){
          const vP = perLineP[c];
          const hit = typeof vP === 'string' ? vP : String(vP?.name || '');
          dbg('station hit [area-line-crosscache]', { tag, area, lineId: pref, code: c, neighbor, name: hit });
          return hit;
        }
      }
      // Try neighbor's transfer-linked lines first
      const neighborRec = (linesMap[line] && linesMap[line][neighbor]) || null;
      const tLines = Array.isArray(neighborRec?.transferLines) ? neighborRec.transferLines : [];
      for(const tl of tLines){
        const order = orders[tl] || [];
        if(Array.isArray(order) && order.includes(neighbor)){
          const perLine2 = linesMap[tl] || {};
          const v2 = perLine2[c];
          if(v2){
            const hit = typeof v2 === 'string' ? v2 : String(v2?.name || '');
            dbg('station hit [area-line-transfer]', { tag, area, lineId: tl, neighbor, code: c, name: hit });
            setCrossPreferredLine(area, line, c, neighbor, tl);
            return hit;
          }
        }
      }
      // Then any line in area that also contains neighbor
      for(const lid of Object.keys(linesMap)){
        const perLine = linesMap[lid] || {};
        const order = orders[lid] || [];
        if(perLine[c] && Array.isArray(order) && order.includes(neighbor)){
          const v = perLine[c];
          const hit = typeof v === 'string' ? v : String(v?.name || '');
          dbg('station hit [area-line-neighbor]', { tag, area, lineId: lid, code: c, neighbor, name: hit });
          setCrossPreferredLine(area, line, c, neighbor, lid);
          return hit;
        }
      }
    }
    if(areaObj.stations && areaObj.stations[c]){
      const v = areaObj.stations[c];
      const hit = typeof v === 'string' ? v : String(v?.name || '');
      dbg('station hit [area-flat]', { tag, area, code: c, name: hit });
      return hit;
    }
  }
  // 3) all cached areas
  for(const a of AREA_LIST){
    const obj = loadAreaStationsCache(a);
    if(!obj) continue;
    const lso = obj.lineStations;
    if(lso){
      const orders = obj.lines || {};
      // If neighbor is known, try lines containing the neighbor first
      if(neighborCode){
        const neighbor = String(neighborCode);
        for(const lid of Object.keys(lso)){
          const perLine = lso[lid] || {};
          const order = orders[lid] || [];
          if(perLine[c] && Array.isArray(order) && order.includes(neighbor)){
            const v = perLine[c];
            const hit = typeof v === 'string' ? v : String(v?.name || '');
            dbg('station hit [other-area-line-neighbor]', { tag, area: a, lineId: lid, code: c, neighbor, name: hit });
            return hit;
          }
        }
      }
      // Fallback: any line that contains the code
      for(const lid of Object.keys(lso)){
        const v = lso[lid] && lso[lid][c];
        if(v){
          const hit = typeof v === 'string' ? v : String(v?.name || '');
          dbg('station hit [other-area-line]', { tag, area: a, lineId: lid, code: c, name: hit });
          return hit;
        }
      }
    }
    if(obj.stations && obj.stations[c]){
      const v = obj.stations[c];
      const hit = typeof v === 'string' ? v : String(v?.name || '');
      dbg('station hit [other-area-flat]', { tag, area: a, code: c, name: hit });
      return hit;
    }
  }
  // 4) fallback to global map
  if(globalStationsByCode.has(c)){
    const hit = String(globalStationsByCode.get(c));
    dbg('station hit [global]', { tag, code: c, name: hit });
    return hit;
  }
  warn('station miss', { tag, line, area, code: c });
  return '';
}

function clearAreaStationsCache(a){
  try{ localStorage.removeItem(areaCacheKey(a)); }catch{}
}

function clearAreaCrossCache(a){
  try{ localStorage.removeItem(areaCrossKey(a)); }catch{}
}

function guessLineIdFromStations(data){
  // Fallback heuristic: Some station payloads may include line hint; otherwise cannot infer reliably
  // Return null; caller will skip storing order if unknown.
  return (data && data.lineId) ? String(data.lineId) : null;
}

// getNickname() moved to tid-category.js





// -----------------------------
// Consolidated settings storage
// -----------------------------
const SETTINGS_ROOT_KEY = 'tid:v1:settings';
function loadSettingsRoot(){
  try{
    const raw = localStorage.getItem(SETTINGS_ROOT_KEY);
    if(!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  }catch{ return {}; }
}
function saveSettingsRoot(obj){
  try{ localStorage.setItem(SETTINGS_ROOT_KEY, JSON.stringify(obj||{})); }catch{}
}
function getPath(obj, path){
  try{
    const segs = String(path||'').split('.');
    let cur = obj;
    for(const s of segs){ if(!cur || typeof cur !== 'object') return undefined; cur = cur[s]; }
    return cur;
  }catch{ return undefined; }
}
function setPath(obj, path, val){
  try{
    const segs = String(path||'').split('.');
    let cur = obj;
    for(let i=0;i<segs.length-1;i++){
      const k = segs[i];
      if(!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
      cur = cur[k];
    }
    cur[segs[segs.length-1]] = val;
  }catch{}
}
function getSetting(path, fallback){
  const root = loadSettingsRoot();
  const v = getPath(root, path);
  return (v === undefined) ? fallback : v;
}
function setSetting(path, val){
  const root = loadSettingsRoot();
  setPath(root, path, val);
  saveSettingsRoot(root);
}
function ensureLineConfig(lineId){
  const root = loadSettingsRoot();
  if(!root.lines) root.lines = {};
  if(!root.lines[lineId]) root.lines[lineId] = {};
  saveSettingsRoot(root);
  return root.lines[lineId];
}
function getLineConfig(lineId){
  const root = loadSettingsRoot();
  return (root.lines && root.lines[lineId]) || {};
}
function migrateLegacySettings(){
  try{
    const root = loadSettingsRoot();
    // UI
    const open = localStorage.getItem('tid:settings:open'); if(open!=null){ setPath(root,'ui.settingsOpen',open); try{ localStorage.removeItem('tid:settings:open'); }catch{} }
    const aud = localStorage.getItem('tid:audio:unlocked'); if(aud!=null){ setPath(root,'ui.audioUnlocked',aud); try{ localStorage.removeItem('tid:audio:unlocked'); }catch{} }
    // TTS
    const v = localStorage.getItem('tid:tts:voice'); if(v!=null){ setPath(root,'tts.voice',v); try{ localStorage.removeItem('tid:tts:voice'); }catch{} }
    // Delay
    const th = localStorage.getItem('tid:delay:threshold'); if(th!=null){ setPath(root,'delay.threshold',Number(th)); try{ localStorage.removeItem('tid:delay:threshold'); }catch{} }
    // Background
    const bg = localStorage.getItem('tid:bgnotify'); if(bg!=null){ setPath(root,'bg.notify',bg); /* keep original for pwa.js */ }
    const wl = localStorage.getItem('tid:wakelock'); if(wl!=null){ setPath(root,'bg.wakelock',wl); try{ localStorage.removeItem('tid:wakelock'); }catch{} }
    // Per-line station/pass
    try{
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if(!k) continue;
        const mStation = k.match(/^tid:station:(.+)$/);
        if(mStation){ const lineId = mStation[1]; const val = localStorage.getItem(k)||''; if(val){ ensureLineConfig(lineId); setSetting(`lines.${lineId}.station`, val); } continue; }
        const mPass = k.match(/^tid:pass:(.+)$/);
        if(mPass){ const lineId = mPass[1]; const val = localStorage.getItem(k)||''; if(val){ ensureLineConfig(lineId); setSetting(`lines.${lineId}.pass`, val); } continue; }
      }
    }catch{}
    // Per-line+station alarms (disable, prefs, targets)
    try{
      for(let i=0;i<localStorage.length;i++){
        const k = localStorage.key(i);
        if(!k) continue;
        let m;
        m = k.match(/^tid:alarm:disable:([^:]+):([^:]+):(up|down)$/);
        if(m){ const [_, lineId, st, dir] = m; const val = localStorage.getItem(k)==='1'; setSetting(`lines.${lineId}.alarms.${st}.${dir}.disabled`, val); continue; }
        m = k.match(/^tid:alarm:([^:]+):([^:]+):(up|down)$/);
        if(m){ const [_, lineId, st, dir] = m; try{ const arr = JSON.parse(localStorage.getItem(k)||'[]'); if(Array.isArray(arr)) setSetting(`lines.${lineId}.alarms.${st}.${dir}.prefs`, arr); }catch{} continue; }
        m = k.match(/^tid:alarm:target:([^:]+):([^:]+):(up|down)$/);
        if(m){ const [_, lineId, st, dir] = m; try{ const obj = JSON.parse(localStorage.getItem(k)||'{}'); if(obj && typeof obj==='object') setSetting(`lines.${lineId}.alarms.${st}.${dir}.targets`, obj); }catch{} continue; }
      }
    }catch{}
    saveSettingsRoot(root);
  }catch{}
}

// Debug Panel (only when TID_DEBUG is enabled)
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
  title.textContent = '🐛 TID Debug Panel';
  title.style.cssText = 'font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #ff0;';
  panel.appendChild(title);

  const logContainer = document.createElement('div');
  logContainer.id = 'tidDebugLog';
  panel.appendChild(logContainer);

  document.body.appendChild(panel);

  // Hook dbg() function to display in UI
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

      // Color coding
      const msg = args.join(' ');
      if(msg.includes('ALARM_TRIGGER')) entry.style.color = '#0f0';
      else if(msg.includes('ALARM_SKIP') || msg.includes('ALARM_NO')) entry.style.color = '#f80';
      else if(msg.includes('ALARM_QUEUED')) entry.style.color = '#0ff';
      else if(msg.includes('ALARM_PREFS')) entry.style.color = '#ff0';

      logEl.appendChild(entry);
      if(logEl.children.length > 100) logEl.removeChild(logEl.firstChild);
      logEl.scrollTop = logEl.scrollHeight;
    }catch{}
  };
}

// Test alarm function (only when TID_DEBUG is enabled)
if(TID_DEBUG){
  window.tidTestAlarm = function(trainNo, direction, targetCode){
    console.log('[TID][TEST] Simulating alarm', trainNo, direction, targetCode);
    const dir = direction === 'up' ? 0 : 1;
    const key = `${trainNo}:${dir}:${targetCode}`;
    const msg = `テスト: ${trainNo}号、${direction}、${targetCode}駅接近`;
    const meta = {
      area, line, dir: direction, direction: dir, trainNo,
      atCode: targetCode, nextCode: '', targetCode, stopped: true,
      displayType: '快速', nickname: 'テスト列車', delay: 0,
      dest: 'テスト行き', triggerReason: 'manual-test'
    };
    alarmSystem?.notifyOnce(direction, key, msg, ()=>{}, meta);
  };
  console.log('[TID][DEBUG] Test function: tidTestAlarm(trainNo, direction, targetCode)');
}
