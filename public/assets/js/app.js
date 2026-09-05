// Tiny-TID display-only client for the Cloudflare Worker backend.
import { loadComponents } from './components.js';
import { migrateLegacySettings, getSetting, setSetting, getLineConfig } from './tid-settings.js';
import { initAlarm, requestUnlock, evaluateAndNotify, bindLineConfig, renderAlarmOptions, bindAlarmControls } from './app-alarm.js';
import { subscribePush } from './pwa.js';
import { initBackgroundControls } from './tid-background.js';

loadComponents();
migrateLegacySettings();
bindLineConfig(getLineConfig);
initBackgroundControls({ getSetting, setSetting });

const meta = (n) => document.querySelector(`meta[name="${n}"]`)?.getAttribute('content')?.trim() || '';
const area = meta('tid:fixedArea');
const line = meta('tid:fixedLine');
const lineIds = meta('tid:fixedLines').split(',').map((s) => s.trim()).filter(Boolean);
const stationName = meta('tid:fixedStationName');
const lineScope = [...lineIds].sort().join('+');
initAlarm({ scope: lineScope, areaId: area, lineId: line });

const paramsView = document.getElementById('paramsView');
const updatedAtEl = document.getElementById('updatedAt');
const trafficEl = document.getElementById('trafficInfo');
const upEl = document.querySelector('#trainsUp') || document.querySelector('#trainsUp .train-items');
const downEl = document.querySelector('#trainsDown') || document.querySelector('#trainsDown .train-items');
const stationFilter = document.getElementById('stationFilter');
const passFilter = document.getElementById('passFilter');

paramsView.textContent = '読み込み中…';

let currentCode = '';
let refreshing = false;

function esc(v) {
  return String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function renderStations(stations) {
  if (!stationFilter || stationFilter.dataset.bound === '1') return;
  stationFilter.dataset.bound = '1';
  stationFilter.innerHTML = '';
  for (const s of stations) {
    const opt = document.createElement('option');
    opt.value = s.code;
    opt.textContent = s.name;
    stationFilter.appendChild(opt);
  }
  stationFilter.value = currentCode;
  stationFilter.addEventListener('change', () => {
    currentCode = stationFilter.value;
    void refresh(true);
  });
}

function renderTraffic(items) {
  if (!trafficEl) return;
  trafficEl.innerHTML = '';
  const sections = [['路線の運行情報', items.lines], ['特急の運行情報', items.express]];
  for (const [title, list] of sections) {
    if (!list.length) continue;
    const sec = document.createElement('section');
    sec.className = 'traffic-section';
    const head = document.createElement('div');
    head.className = 'traffic-section__header';
    head.textContent = title;
    const ul = document.createElement('ul');
    ul.className = 'traffic-list';
    for (const item of list) {
      const li = document.createElement('li');
      li.className = 'traffic-item';
      if (item.url) {
        const a = document.createElement('a');
        a.href = item.url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.textContent = item.text;
        li.appendChild(a);
      } else li.textContent = item.text;
      ul.appendChild(li);
    }
    sec.appendChild(head); sec.appendChild(ul); trafficEl.appendChild(sec);
  }
}

function trainRow(t, delayThreshold, carsThreshold) {
  const tr = document.createElement('tr');
  const typeCls = t.colorClass || '';
  const typeHtml = typeCls ? `<span class="${esc(typeCls)}">${esc(t.displayType)}</span>` : esc(t.displayType);
  const delayHtml = t.delayMinutes > 0
    ? (t.delayMinutes >= delayThreshold
      ? `<span class="delay-bad" style="color:var(--color-danger,#c00);font-weight:700;">${t.delayMinutes}分</span>`
      : `${t.delayMinutes}分`)
    : '';
  let carsText = t.cars != null ? String(t.cars) : '';
  if (Number.isFinite(Number(t.cars)) && Number(t.cars) >= carsThreshold) carsText = `<span class="cars-emph">${carsText}</span>`;
  tr.innerHTML = `<td>${esc(t.no)}</td><td>${typeHtml}</td><td>${esc(t.nickname)}</td>` +
    `<td>${carsText}</td><td>${esc(t.destText)}</td><td>${esc(t.posLabel)}</td><td>${delayHtml}</td>`;
  return tr;
}

function renderTrains(resp) {
  const table = (list) => {
    const wrap = document.createElement('table');
    wrap.className = 'train-table';
    const colgroup = document.createElement('colgroup');
    for (let i = 0; i < 7; i += 1) colgroup.appendChild(document.createElement('col'));
    wrap.appendChild(colgroup);
    wrap.innerHTML = '<thead><tr><th>列番</th><th>種別</th><th>愛称</th><th>両数</th><th>行先</th><th>位置</th><th>遅延</th></tr></thead>';
    const tbody = document.createElement('tbody');
    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="7">該当する列車はありません</td></tr>';
    } else {
      const dTh = Number(getSetting('delay.threshold', 4)) || 4;
      const cTh = Number(getSetting('cars.threshold', 9)) || 9;
      for (const t of list) tbody.appendChild(trainRow(t, dTh, cTh));
    }
    wrap.appendChild(tbody);
    return wrap;
  };
  const fill = (el, list, label) => {
    if (!el) return;
    el.innerHTML = '';
    el.appendChild(table(list));
    const h3 = el.closest('section')?.querySelector('h3');
    if (h3 && label) h3.textContent = label;
  };
  fill(upEl, resp.up, resp.up.length ? `上り（${resp.up.length}本）` : '上り');
  fill(downEl, resp.down, resp.down.length ? `下り（${resp.down.length}本）` : '下り');
}

// ---------------------------------------------------------------------------
// Push subscription sync (background approach notifications)
// ---------------------------------------------------------------------------

function buildPushPrefs() {
  const dir = (d) => {
    const cfg = getLineConfig(lineScope);
    const st = cfg?.alarms?.[currentCode]?.[d] || {};
    if (st.disabled) return { cats: [], pass: false, carsMin: 0, carsFilter: false, targets: {} };
    const cats = (Array.isArray(st.prefs) ? st.prefs : [])
      .map((v) => (typeof v === 'string' && v.startsWith('cat:') ? Number(v.slice(4)) : NaN))
      .filter((n) => Number.isFinite(n));
    const targets = (st.targets && typeof st.targets === 'object') ? st.targets : {};
    return {
      cats,
      pass: Array.isArray(st.prefs) && st.prefs.includes('pass'),
      carsMin: Number(getSetting('cars.threshold', 9)) || 0,
      carsFilter: !!getSetting('cars.filterEnabled', false),
      targets,
    };
  };
  return JSON.stringify({ up: dir('up'), down: dir('down') });
}

let pushSynced = false;
let lastSyncKey = '';
async function syncPushSubscription() {
  try {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (getSetting('bg.notify', null) !== '1') return;
    const prefsJson = buildPushPrefs();
    const syncKey = `${currentCode}\n${prefsJson}`;
    if (pushSynced && syncKey === lastSyncKey) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    await subscribePush(reg, { stationCode: currentCode, prefsJson });
    pushSynced = true;
    lastSyncKey = syncKey;
  } catch (err) { console.warn('push subscribe failed', err); }
}

function formatJST(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const p = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    }).formatToParts(d);
    const g = (t) => p.find((x) => x.type === t)?.value || '';
    return `${g('year')}年${g('month')}月${g('day')}日 ${g('hour')}時${g('minute')}分${g('second')}秒更新`;
  } catch { return ''; }
}

async function refresh(immediate = false) {
  if (refreshing) return;
  refreshing = true;
  try {
    const pass = passFilter?.value || 'hide';
    const q = new URLSearchParams({ station: currentCode || stationName, pass });
    const res = await fetch(`/api/view?${q}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const resp = await res.json();
    if (!currentCode) {
      currentCode = resp.station.code;
      renderStations(resp.stations);
    }
    const areaName = resp.areaName || area;
    const lineNames = resp.lineNames || {};
    paramsView.textContent = `エリア: ${areaName} / 路線: ${lineIds.map((id) => lineNames[id] || id).join(', ')} / 駅: ${stationName}`;
    updatedAtEl.textContent = formatJST(resp.update || resp.serverTime);
    renderTraffic(resp.traffic);
    renderTrains(resp);
    renderAlarmOptions({
      stations: resp.stations,
      stationCode: currentCode,
      allowedCats: resp.stationAllowedCats,
      dirParam: 'both',
    });
    try { localStorage.setItem('tid:lastStationCode', currentCode); } catch {}
    void syncPushSubscription();
    evaluateAndNotify({
      stations: resp.stations,
      trains: [...resp.up, ...resp.down],
      stationCode: currentCode,
    });
  } catch (err) {
    console.error('取得に失敗', err);
    if (updatedAtEl && !immediate) updatedAtEl.textContent = '更新に失敗しました（再試行中）';
  } finally {
    refreshing = false;
  }
}

function initControls() {
  const delayInput = document.getElementById('delayThreshold');
  if (delayInput) {
    delayInput.value = String(Number(getSetting('delay.threshold', 4)) || 4);
    delayInput.addEventListener('change', () => {
      let v = Number(delayInput.value);
      if (!Number.isFinite(v) || v < 0) v = 4;
      setSetting('delay.threshold', Math.floor(v));
      void refresh(true);
    });
  }
  const carsInput = document.getElementById('carsThreshold');
  if (carsInput) {
    carsInput.value = String(Number(getSetting('cars.threshold', 9)) || 9);
    carsInput.addEventListener('change', () => {
      let v = Number(carsInput.value);
      if (!Number.isFinite(v) || v < 0) v = 9;
      setSetting('cars.threshold', Math.floor(v));
    });
  }
  const carsFilter = document.getElementById('carsFilterEnable');
  if (carsFilter) {
    carsFilter.checked = !!getSetting('cars.filterEnabled', false);
    carsFilter.addEventListener('change', () => setSetting('cars.filterEnabled', carsFilter.checked));
  }
  passFilter?.addEventListener('change', () => void refresh(true));
  document.getElementById('bgNotifyEnable')?.addEventListener('change', () => {
    pushSynced = false;
    setTimeout(() => void syncPushSubscription(), 500);
  });
}

function startPolling() {
  void refresh();
  setInterval(() => { if (!document.hidden) void refresh(); }, 10000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void refresh();
  });
}

requestUnlock(() => {});
initControls();
startPolling();
