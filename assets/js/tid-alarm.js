
// Alarm system (preferences, queueing, modal) for TID

export function createAlarmSystem(deps){
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
    trainCategoryFromDisplayType,
    getCategoryLabel,
    stationAllowedCategories,
    getNickname,
    getDestText,
    configuredTypeTextClass,
    typeTextClass,
    buildTtsMessage,
    notifyIfBackground,
    playAlarmSound,
    playBeep,
    speakTextAsync,
    preemptDelayTts,
    drainDelayTts,
    bindAudioUnlockOnce,
    getAudioUnlocked
  } = deps || {};

  const alarmNotified = { up: new Set(), down: new Set() };
  const pendingAudioQueue = [];
  const pendingAudioKeys = new Set();
  const alarmPlayQueue = [];
  const alarmQueueKeys = new Set();
  let alarmPlaying = false;

  // Track last shown trains and context to validate queued alarms
  let lastShownTrains = { up: [], down: [] };
  let lastSelectedCode = null;
  let lastIndexes = null;

  // Lightweight alarm modal (auto-dismiss ~3s with confirm button)
  let alarmModalEl = null;
  let alarmModalTimer = null;
  function ensureAlarmModal(){
    if(alarmModalEl) return alarmModalEl;
    try{
      const wrap = document.createElement('div');
      wrap.className = 'tid-alert-overlay is-hidden';
      wrap.setAttribute('role','dialog');
      wrap.setAttribute('aria-modal','true');
      wrap.setAttribute('aria-labelledby','tidAlertTitle');
      wrap.innerHTML = `
        <div class="tid-alert__panel" role="document">
          <h2 id="tidAlertTitle" class="tid-alert__title">列車接近</h2>
          <div class="tid-alert__groups">
            <div class="tid-alert__group">
              <div class="tid-alert__row"><div class="tid-alert__label">列番</div><div class="tid-alert__value" data-alert-no>-</div></div>
              <div class="tid-alert__row"><div class="tid-alert__label">行先</div><div class="tid-alert__value" data-alert-dest>-</div></div>
            </div>
            <div class="tid-alert__group">
              <div class="tid-alert__row"><div class="tid-alert__label">種別</div><div class="tid-alert__value" data-alert-type>-</div></div>
              <div class="tid-alert__row"><div class="tid-alert__label">愛称</div><div class="tid-alert__value" data-alert-nick>-</div></div>
            </div>
            <div class="tid-alert__group">
              <div class="tid-alert__row"><div class="tid-alert__label">遅れ</div><div class="tid-alert__value" data-alert-delay>-</div></div>
            </div>
          </div>
          <div class="tid-alert__actions"><button type="button" class="btn" data-alert-ok>確認</button></div>
        </div>`;
      document.body.appendChild(wrap);
      const btn = wrap.querySelector('[data-alert-ok]');
      btn?.addEventListener('click', hideAlarmModal);
      alarmModalEl = wrap;
    }catch{}
    return alarmModalEl;
  }
  function hideAlarmModal(){
    try{
      if(alarmModalTimer){ clearTimeout(alarmModalTimer); alarmModalTimer = null; }
      if(alarmModalEl){ alarmModalEl.classList.add('is-hidden'); alarmModalEl.setAttribute('aria-hidden','true'); }
    }catch{}
  }
  function showAlarmModal(meta){
    try{
      const el = ensureAlarmModal(); if(!el) return;
      // Update dynamic title by train's own direction (prefer numeric),
      // fallback to inferring from station indices or meta.dir string.
      try{
        const title = el.querySelector('#tidAlertTitle');
        let label = '列車接近';
        const numDir = (typeof meta?.direction === 'number') ? meta.direction : null;
        if(numDir === 0) label = '上り列車接近';
        else if(numDir === 1) label = '下り列車接近';
        else {
          // infer from indices
          try{
            const aIdx = lastIndexes?.byCode?.get(String(meta?.atCode||''))?.index;
            const bIdx = lastIndexes?.byCode?.get(String(meta?.nextCode||''))?.index;
            if(typeof aIdx === 'number' && typeof bIdx === 'number' && aIdx !== bIdx){
              label = (bIdx < aIdx) ? '上り列車接近' : '下り列車接近';
            }else{
              const d = String(meta?.dir||'');
              if(d === 'up') label = '上り列車接近';
              else if(d === 'down') label = '下り列車接近';
            }
          }catch{}
        }
        if(title) title.textContent = label;
      }catch{}
      const no = String(meta?.trainNo || meta?.no || '').trim();
      const type = String(meta?.displayType || meta?.type || '').trim();
      const nick = String(meta?.nickname || meta?.nick || '').trim();
      const delayNum = (typeof meta?.delay === 'number') ? meta.delay : 0;
      const delayText = (delayNum && delayNum > 0) ? `${delayNum}分` : 'なし';
      // Set values
      const root = el.querySelector('.tid-alert__groups') || el;
      const noEl = root.querySelector('[data-alert-no]') || el.querySelector('[data-alert-no]');
      const destEl = root.querySelector('[data-alert-dest]') || el.querySelector('[data-alert-dest]');
      const typeEl = root.querySelector('[data-alert-type]') || el.querySelector('[data-alert-type]');
      const nickEl = root.querySelector('[data-alert-nick]') || el.querySelector('[data-alert-nick]');
      const delayEl = root.querySelector('[data-alert-delay]') || el.querySelector('[data-alert-delay]');
      if(noEl) noEl.textContent = no || '-';
      if(destEl){ destEl.textContent = (meta?.dest && String(meta.dest).trim()) ? String(meta.dest).trim() : '-'; }
      if(typeEl){
        typeEl.textContent = type || '-';
        // Color class per train list logic
        try{
          const mapCls = configuredTypeTextClass ? configuredTypeTextClass(type) : '';
          const cat = trainCategoryFromDisplayType ? trainCategoryFromDisplayType(type) : null;
          const cls = mapCls || (typeTextClass ? typeTextClass(cat) : '');
          typeEl.className = 'tid-alert__value';
          if(cls) typeEl.classList.add(cls);
        }catch{}
      }
      if(nickEl){ nickEl.textContent = nick || '-'; }
      if(delayEl){
        delayEl.textContent = delayText;
        delayEl.className = 'tid-alert__value';
        try{
          const th = getDelayThreshold ? getDelayThreshold() : 0;
          if(delayNum && delayNum >= th){ delayEl.classList.add('tid-alert__value--delay-bad','delay-bad'); }
        }catch{}
      }
      el.classList.remove('is-hidden');
      el.removeAttribute('aria-hidden');
      if(alarmModalTimer){ clearTimeout(alarmModalTimer); }
      alarmModalTimer = setTimeout(() => { hideAlarmModal(); }, 10000);
    }catch{}
  }

  // Time-window suppression for approach alarms (persisted TTL + in-memory)
  const approachAnnouncedAt = new Map(); // key -> timestamp (in-memory)
  const APPROACH_SUPPRESS_MS = 3 * 60 * 1000; // 3 minutes
  const APPROACH_STORE_KEY = 'tid:v1:alarm:approachSuppression';
  function approachKey(trainNo, selectedCode, dir){
    const no = (trainNo != null && String(trainNo).trim()) ? String(trainNo).trim() : '?';
    const st = (selectedCode != null && String(selectedCode).trim()) ? String(selectedCode).trim() : '_none';
    const d = (dir === 0 || dir === 1) ? String(dir) : String(dir||'');
    const a = String(area||'_');
    const l = String(line||'_');
    return `approach:${a}:${l}:${st}:${d}:${no}`;
  }
  function loadApproachStore(){
    try{
      const raw = localStorage.getItem(APPROACH_STORE_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      if(!obj || typeof obj !== 'object') return {};
      // prune TTL
      const now = Date.now();
      let changed = false;
      for(const k of Object.keys(obj)){
        const ts = Number(obj[k]);
        if(!Number.isFinite(ts) || (now - ts) >= APPROACH_SUPPRESS_MS){ delete obj[k]; changed = true; }
      }
      if(changed){ try{ localStorage.setItem(APPROACH_STORE_KEY, JSON.stringify(obj)); }catch{} }
      return obj;
    }catch{ return {}; }
  }
  function saveApproachStore(obj){
    try{ localStorage.setItem(APPROACH_STORE_KEY, JSON.stringify(obj||{})); }catch{}
  }
  function approachRecentlyAnnounced(trainNo, selectedCode, dir){
    try{
      const k = approachKey(trainNo, selectedCode, dir);
      const now = Date.now();
      const mem = approachAnnouncedAt.get(k) || 0;
      if((now - mem) < APPROACH_SUPPRESS_MS) return true;
      const store = loadApproachStore();
      const ts = Number(store[k] || 0);
      if(Number.isFinite(ts) && (now - ts) < APPROACH_SUPPRESS_MS) return true;
      return false;
    }catch{ return false; }
  }
  function markApproachAnnounced(trainNo, selectedCode, dir){
    try{
      const k = approachKey(trainNo, selectedCode, dir);
      const now = Date.now();
      approachAnnouncedAt.set(k, now);
      const store = loadApproachStore();
      store[k] = now;
      saveApproachStore(store);
    }catch{}
  }

  function selectedStationCode(){
    return (document.getElementById('stationFilter')?.value || '').trim();
  }
  function alarmKey(dir, st){
    const code = (st != null ? String(st) : selectedStationCode()) || '_none';
    return `tid:alarm:${line}:${code}:${dir}`;
  }
  function alarmDisableKey(dir, st){
    const code = (st != null ? String(st) : selectedStationCode()) || '_none';
    return `tid:alarm:disable:${line}:${code}:${dir}`;
  }
  function alarmTargetKey(dir, st){
    const code = (st != null ? String(st) : selectedStationCode()) || '_none';
    return `tid:alarm:target:${line}:${code}:${dir}`;
  }
  function readAlarmPrefs(dir, st){
    try{
      const cfg = getLineConfig ? getLineConfig(line) : null;
      const stKey = String(st||'_none');
      const dirKey = (dir === 0 || dir === 'up') ? 'up' : (dir === 1 || dir === 'down') ? 'down' : String(dir||'up');
      const arr = cfg?.alarms?.[stKey]?.[dirKey]?.prefs;
      if(Array.isArray(arr)) return new Set(arr);
    }catch{}
    // legacy fallback
    try{
      const raw = localStorage.getItem(alarmKey(dir, st));
      const arr = raw ? JSON.parse(raw) : [];
      if(Array.isArray(arr)) return new Set(arr);
    }catch{}
    return new Set();
  }
  function saveAlarmPrefs(dir, values, st){
    try{
      const stKey = String(st||'_none');
      const dirKey = (dir === 0 || dir === 'up') ? 'up' : (dir === 1 || dir === 'down') ? 'down' : String(dir||'up');
      const arr = Array.from(values||[]);
      if(setSetting) setSetting(`lines.${line}.alarms.${stKey}.${dirKey}.prefs`, arr);
    }catch{}
  }
  function readAlarmDisable(dir, st){
    try{
      const stKey = String(st||'_none');
      const dirKey = (dir === 0 || dir === 'up') ? 'up' : (dir === 1 || dir === 'down') ? 'down' : String(dir||'up');
      const v = getSetting ? getSetting(`lines.${line}.alarms.${stKey}.${dirKey}.disabled`, undefined) : undefined;
      if(v === undefined) return false; // default enabled (changed from true)
      return !!v;
    }catch{ return false; } // default enabled on error (changed from true)
  }
  function saveAlarmDisable(dir, v, st){
    try{
      const stKey = String(st||'_none');
      const dirKey = (dir === 0 || dir === 'up') ? 'up' : (dir === 1 || dir === 'down') ? 'down' : String(dir||'up');
      if(setSetting) setSetting(`lines.${line}.alarms.${stKey}.${dirKey}.disabled`, !!v);
    }catch{}
  }
  function readAlarmTargets(dir, st){
    try{
      const stKey = String(st||'_none');
      const dirKey = (dir === 0 || dir === 'up') ? 'up' : (dir === 1 || dir === 'down') ? 'down' : String(dir||'up');
      const obj = getSetting ? getSetting(`lines.${line}.alarms.${stKey}.${dirKey}.targets`, {}) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch{}
    // legacy fallback
    try{
      const raw = localStorage.getItem(alarmTargetKey(dir, st));
      const obj = raw ? JSON.parse(raw) : {};
      return (obj && typeof obj === 'object') ? obj : {};
    }catch{ return {}; }
  }
  function saveAlarmTarget(dir, st, catKey, stationCode){
    try{
      const stKey = String(st||'_none');
      const dirKey = (dir === 0 || dir === 'up') ? 'up' : (dir === 1 || dir === 'down') ? 'down' : String(dir||'up');
      const obj = readAlarmTargets(dir, st);
      obj[catKey] = String(stationCode||'');
      if(setSetting) setSetting(`lines.${line}.alarms.${stKey}.${dirKey}.targets`, obj);
    }catch{}
  }
  function setDisabledForDir(dir, disabled){
    const sel = dir === 'up' ? '[data-alarm-up]' : '[data-alarm-down]';
    const boxes = document.querySelectorAll(sel);
    boxes.forEach(b => {
      b.disabled = !!disabled;
      const p = b.parentElement;
      if(p && p.style){ p.style.opacity = disabled ? '0.5' : ''; }
    });
    // Also disable dropdowns in the fieldset
    const fs = document.getElementById(dir === 'up' ? 'alarmUpBox' : 'alarmDownBox');
    if(fs){
      fs.querySelectorAll('select').forEach(s => { s.disabled = !!disabled || s.options.length === 0 || s.value === ''; });
    }
  }

  function initAlarmControls(){
    const upDis = document.getElementById('alarmUpDisable');
    const dnDis = document.getElementById('alarmDownDisable');
    if(upDis){
      upDis.checked = readAlarmDisable('up', selectedStationCode());
      setDisabledForDir('up', upDis.checked);
      upDis.onchange = ()=>{ saveAlarmDisable('up', upDis.checked, selectedStationCode()); setDisabledForDir('up', upDis.checked); };
    }
    if(dnDis){
      dnDis.checked = readAlarmDisable('down', selectedStationCode());
      setDisabledForDir('down', dnDis.checked);
      dnDis.onchange = ()=>{ saveAlarmDisable('down', dnDis.checked, selectedStationCode()); setDisabledForDir('down', dnDis.checked); };
    }
  }

  function renderAlarmOptions(indexes, selectedCode, allowedCats, dirParam){
    const upBox = document.getElementById('alarmUpOptions');
    const downBox = document.getElementById('alarmDownOptions');
    const row = document.getElementById('alarmRow');
    const upFs = document.getElementById('alarmUpBox');
    const dnFs = document.getElementById('alarmDownBox');
    if(!upBox || !downBox || !row) return;
    // Hide entire row when station is not selected
    if(!selectedCode){
      row.style.display = 'none';
      upBox.innerHTML = '';
      downBox.innerHTML = '';
      return;
    }
    row.style.display = 'flex';
    // Show/hide fieldsets by current direction filter
    if(dirParam === 'up'){
      if(upFs) upFs.style.display = '';
      if(dnFs) dnFs.style.display = 'none';
    }else if(dirParam === 'down'){
      if(upFs) upFs.style.display = 'none';
      if(dnFs) dnFs.style.display = '';
    }else{
      if(upFs) upFs.style.display = '';
      if(dnFs) dnFs.style.display = '';
    }
    upBox.innerHTML = '';
    downBox.innerHTML = '';
    const cats = allowedCats instanceof Set ? Array.from(allowedCats) : [];
    // Build checkboxes for allowed stop categories (based on station filter)
    function nextStations(indexes2, code, dirLabel, count){
      const order = indexes2.order || [];
      const idx = order.indexOf(String(code));
      const out = [];
      if(idx < 0) return out;
      if(dirLabel === 'up'){
        for(let k=1;k<=count;k++){ if(idx+k < order.length) out.push(order[idx+k]); }
      }else{
        for(let k=1;k<=count;k++){ if(idx-k >= 0) out.push(order[idx-k]); }
      }
      return out;
    }
    const build = (container, attr, saved, dirLabel) => {
      // Station-based categories
      cats.sort((a,b)=>Number(a)-Number(b)).forEach(cat => {
        const label = getCategoryLabel ? getCategoryLabel(cat) : String(cat);
        const wrap = document.createElement('label');
        Object.assign(wrap.style, {
          display:'flex', alignItems:'center', gap:'0.75rem',
          padding:'0.9rem 1.1rem', margin:'0.35rem 0',
          border:'1px solid #e0e0e0', borderRadius:'0.5rem',
          fontSize:'1.15rem', minHeight:'52px', cursor:'pointer'
        });
        const input = document.createElement('input');
        input.type = 'checkbox'; input.setAttribute(attr,''); input.value = `cat:${cat}`;
        if(saved.has(`cat:${cat}`)) input.checked = true;
        input.style.transform = 'scale(1.35)';
        input.style.transformOrigin = 'left center';
        wrap.appendChild(input);
        const text = document.createElement('span'); text.textContent = label; wrap.appendChild(text);
        // Target station dropdown（絞り込み駅は除外。進行方向側のみ）
        const sel = document.createElement('select');
        sel.style.marginLeft = 'auto';
        sel.style.fontSize = '1rem';
        sel.style.padding = '.4rem .6rem';
        sel.style.minWidth = '11rem';
        const options = [];
        const makeOpt = (code, label2) => { const o = document.createElement('option'); o.value = code; o.textContent = label2; return o; };
        const nameOf = (code) => {
          const st = indexes.byCode.get(String(code));
          return st?.name || String(code);
        };
        const ahead = nextStations(indexes, selectedCode, dirLabel, 3);
        if(ahead.length){
          ahead.forEach(code => options.push(makeOpt(code, nameOf(code))));
        }else{
          const o = document.createElement('option');
          o.value = '';
          o.textContent = '候補なし';
          sel.disabled = true;
          options.push(o);
        }
        options.forEach(o => sel.appendChild(o));
        // restore saved target
        const dirKey = (dirLabel === 'up') ? 'up' : 'down';
        const targets = readAlarmTargets(dirKey, selectedCode);
        const catKey = `cat:${cat}`;
        if(targets[catKey] && Array.from(sel.options).some(o => o.value === targets[catKey])){
          sel.value = targets[catKey];
        }
        sel.addEventListener('change', () => saveAlarmTarget(dirKey, selectedCode, catKey, sel.value));
        wrap.appendChild(sel);

        container.appendChild(wrap);
      });
      // Pass option + target dropdown
      const wrapPass = document.createElement('label');
      Object.assign(wrapPass.style, {
        display:'flex', alignItems:'center', gap:'0.75rem',
        padding:'0.9rem 1.1rem', margin:'0.35rem 0',
        border:'1px solid #e0e0e0', borderRadius:'0.5rem',
        fontSize:'1.15rem', minHeight:'52px', cursor:'pointer'
      });
      const pass = document.createElement('input'); pass.type = 'checkbox'; pass.setAttribute(attr,''); pass.value = 'pass';
      pass.style.transform = 'scale(1.35)';
      pass.style.transformOrigin = 'left center';
      if(saved.has('pass')) pass.checked = true;
      wrapPass.appendChild(pass);
      wrapPass.appendChild(document.createTextNode('通過'));
      const selPass = document.createElement('select');
      selPass.style.marginLeft = 'auto'; selPass.style.fontSize = '1rem'; selPass.style.padding = '.4rem .6rem'; selPass.style.minWidth = '11rem';
      const aheadPass = nextStations(indexes, selectedCode, dirLabel, 3);
      if(aheadPass.length){
        aheadPass.forEach(code => { const o = document.createElement('option'); o.value = code; o.textContent = indexes.byCode.get(String(code))?.name || String(code); selPass.appendChild(o); });
      }else{
        const o = document.createElement('option'); o.value = ''; o.textContent = '候補なし'; selPass.disabled = true; selPass.appendChild(o);
      }
      const dirKey2 = (dirLabel === 'up') ? 'up' : 'down';
      const targets2 = readAlarmTargets(dirKey2, selectedCode);
      if(targets2['pass'] && Array.from(selPass.options).some(o => o.value === targets2['pass'])){ selPass.value = targets2['pass']; }
      selPass.addEventListener('change', () => saveAlarmTarget(dirKey2, selectedCode, 'pass', selPass.value));
      wrapPass.appendChild(selPass);
      // Auto-disable pass alarm when pass display is hidden (gray out but keep selection)
      const passSetting = (document.getElementById('passFilter')?.value || 'hide');
      if(passSetting !== 'show'){
        pass.disabled = true;
        selPass.disabled = true;
        wrapPass.style.opacity = '0.5';
        wrapPass.style.color = 'var(--color-muted)';
        wrapPass.style.pointerEvents = 'none';
        wrapPass.title = '設定「通過列車の表示」が非表示のため、一時的に無効です';
      }else{
        pass.disabled = false;
        selPass.disabled = selPass.options.length === 0 || selPass.value === '';
        wrapPass.style.opacity = '';
        wrapPass.style.color = '';
        wrapPass.style.pointerEvents = '';
        wrapPass.removeAttribute('title');
      }
      container.appendChild(wrapPass);
    };
    const savedUp = readAlarmPrefs('up', selectedCode);
    const savedDown = readAlarmPrefs('down', selectedCode);
    build(upBox, 'data-alarm-up', savedUp, 'up');
    build(downBox, 'data-alarm-down', savedDown, 'down');
    const saveScope = (dir, selector) => {
      const boxes = Array.from(document.querySelectorAll(selector));
      const vals = new Set(boxes.filter(b => b.checked).map(b => b.value));
      saveAlarmPrefs(dir, vals, selectedCode);
    };
    document.getElementById('alarmUpBox')?.addEventListener('change', () => saveScope('up', '[data-alarm-up]'));
    document.getElementById('alarmDownBox')?.addEventListener('change', () => saveScope('down', '[data-alarm-down]'));
    // Apply disabled state to inputs after render
    setDisabledForDir('up', readAlarmDisable('up', selectedCode));
    setDisabledForDir('down', readAlarmDisable('down', selectedCode));
  }

  function getPrefsForDir(dir){
    const st = selectedStationCode();
    const disabled = readAlarmDisable(dir === 0 ? 'up' : 'down', st);
    if(disabled){
      try{ dbg && dbg('ALARM_PREFS_DISABLED', { dir: dir === 0 ? 'up' : 'down', station: st }); }catch{}
      return new Set();
    }
    const sel = dir === 0 ? '[data-alarm-up]' : '[data-alarm-down]';
    const boxes = Array.from(document.querySelectorAll(sel));
    const vals = new Set(boxes.filter(b => b.checked).map(b => b.value));
    try{ dbg && dbg('ALARM_PREFS', { dir: dir === 0 ? 'up' : 'down', station: st, disabled, prefs: Array.from(vals) }); }catch{}
    return vals;
  }

  async function drainAlarmQueue(){
    if(alarmPlaying) return;
    alarmPlaying = true;
    try{
      // Preempt any ongoing low-priority delay TTS
      try{ preemptDelayTts && preemptDelayTts(); }catch{}
      const isStale = (item) => {
        try{
          // Expect key format: `${no}:${dir}:${targetCode}` where dir is 0/1
          const parts = String(item?.key||'').split(':');
          if(parts.length < 2) return false; // unknown format -> play
          const no = parts[0];
          const dirNum = Number(parts[1]);

          // Time-based stale check: if item was queued more than 5 minutes ago, it's stale
          const queuedAt = item.queuedAt || 0;
          const age = Date.now() - queuedAt;
          const STALE_THRESHOLD = 5 * 60 * 1000; // 5 minutes
          if(age > STALE_THRESHOLD){
            try{ dbg && dbg('ALARM_SKIP_STALE_AGE', { key: item?.key, ageMs: age }); }catch{}
            return true;
          }

          const list = (dirNum === 0) ? (lastShownTrains.up || []) : (lastShownTrains.down || []);
          const found = list.some(t => String(t.no||'') === String(no));

          // Relax stale check: if train not found but queued less than 3 minutes ago, still play
          if(!found && age < 3 * 60 * 1000){
            try{ dbg && dbg('ALARM_QUEUE_NOT_STALE_YET', { key: item?.key, ageMs: age, found }); }catch{}
            return false;
          }

          if(!found){
            try{ dbg && dbg('ALARM_SKIP_STALE', {
              time: new Date().toISOString(),
              key: item?.key||'',
              dir: dirNum,
              ageMs: age,
              shownUp: lastShownTrains.up?.length||0,
              shownDown: lastShownTrains.down?.length||0
            }); }catch{}
          }
          return !found;
        }catch{ return false; }
      };
      while(alarmPlayQueue.length){
        const it = alarmPlayQueue.shift();
        if(!it) continue;
        // Skip stale items (train already passed or no longer eligible)
        if(isStale(it)){
          try{ if(it && it.key) alarmQueueKeys.delete(it.key); }catch{}
          continue;
        }
        // Show ephemeral alarm modal
        try{
          const m = it && it.meta ? it.meta : null;
          if(m){ showAlarmModal(m); }
        }catch{}
        // Debug log (playback start)
        try{
          if(TID_DEBUG){
            const dt = new Date();
            const hh = String(dt.getHours()).padStart(2,'0');
            const mm = String(dt.getMinutes()).padStart(2,'0');
            const ss = String(dt.getSeconds()).padStart(2,'0');
            if(it && it.meta){
              const m = it.meta;
              const dirJa = (m.dir === 'up') ? '上り' : (m.dir === 'down' ? '下り' : String(m.dir||''));
              const seg = m.stopped ? `${m.atName||m.atCode}（停車）` : `${m.atName||m.atCode}→${m.nextName||m.nextCode}`;
              console.log('[TID][ALARM]', `${hh}:${mm}:${ss}`, dirJa, seg, '列車', (m.trainNo || '?'));
            }else{
              console.log('[TID][ALARM]', `${hh}:${mm}:${ss}`, (it && it.key) ? it.key : '(no-key)', (it && it.message) ? it.message : '');
            }
          }
        }catch{}
        // Play alarm sound (mp3), fallback to beep
        let ms = 0;
        try{ ms = await playAlarmSound(); }catch{}
        if(ms <= 0){
          ms = playBeep ? playBeep() : 0;
          if(ms > 0){ await new Promise(r => setTimeout(r, ms)); }
        }
        // Stabilize gap before TTS on iOS
        try{ await new Promise(r => setTimeout(r, 140)); }catch{}
        if(it.message){ try{ await speakTextAsync(it.message); }catch{} }
        try{ if(typeof it.onDone === 'function') it.onDone(); }catch{}
        try{ if(it.key) alarmQueueKeys.delete(it.key); }catch{}
      }
    }finally{
      alarmPlaying = false;
      // Resume low-priority TTS after alarms
      try{ drainDelayTts && drainDelayTts(); }catch{}
    }
  }

  function doAlarmBeepAndSpeak(dirStr, key, message, afterPlay, meta){
    const set = dirStr === 'up' ? alarmNotified.up : alarmNotified.down;
    if(set.has(key)) return false;
    if(key && alarmQueueKeys.has(key)) return false;
    if(key) alarmQueueKeys.add(key);
    alarmPlayQueue.push({ key, message, meta, onDone: () => { try{ set.add(key); }catch{} try{ if(typeof afterPlay === 'function') afterPlay(); }catch{} } });
    // Kick the queue
    try{ drainAlarmQueue(); }catch{}
    return true;
  }

  function notifyOnce(dirStr, key, message, afterPlay, meta){
    const set = dirStr === 'up' ? alarmNotified.up : alarmNotified.down;
    if(set.has(key)) return false;
    const unlocked = (typeof getAudioUnlocked === 'function') ? !!getAudioUnlocked() : false;
    if(!unlocked){
      try{ bindAudioUnlockOnce && bindAudioUnlockOnce(); }catch{}
      // Visual fallback so alarms still appear even when audio is locked
      try{ if(meta) showAlarmModal(meta); }catch{}
      try{ if('vibrate' in navigator){ navigator.vibrate([120, 80, 120]); } }catch{}
      if(!pendingAudioKeys.has(key)){
        pendingAudioKeys.add(key);
        pendingAudioQueue.push({
          dirStr, key, message, afterPlay, meta,
          queuedAt: Date.now() // Timestamp for stale detection
        });
        try{ dbg && dbg('ALARM_QUEUED', { key, queuedAt: new Date().toISOString(), reason: 'audioUnlocked=false' }); }catch{}
      }
      return false;
    }
    try{ (async()=>{ await doAlarmBeepAndSpeak(dirStr, key, message, afterPlay, meta); })(); }catch{}
    return true;
  }

  function flushPendingAudio(){
    const unlocked = (typeof getAudioUnlocked === 'function') ? !!getAudioUnlocked() : false;
    if(!unlocked) return;
    try{
      while(pendingAudioQueue.length){
        const it = pendingAudioQueue.shift();
        if(!it) continue;
        pendingAudioKeys.delete(it.key);
        try{ (async()=>{ await doAlarmBeepAndSpeak(it.dirStr, it.key, it.message, it.afterPlay, it.meta); })(); }catch{}
      }
    }catch{}
  }

  function handleApproachAlarms(indexes, list, selectedCode, stationIdx, allowedCats, dirParam){
    if(!selectedCode || stationIdx == null) return;
    const byCode = indexes.byCode;
    const stationIndexOf = (code) => {
      if(code == null) return null;
      const rec = byCode.get(String(code));
      const idx = rec?.index;
      return (typeof idx === 'number') ? idx : null;
    };
    const selectedIndex = (typeof stationIdx === 'number') ? stationIdx : stationIndexOf(selectedCode);
    for(const t of list){
      if(typeof t.direction !== 'number') continue;
      if(dirParam === 'up' && t.direction !== 0) continue;
      if(dirParam === 'down' && t.direction !== 1) continue;

      // Cars filter: only trigger alarm for trains with cars >= threshold
      try{
        if(isCarsFilterEnabled && isCarsFilterEnabled()){
          const threshold = getCarsThreshold ? getCarsThreshold() : 0;
          const cars = (typeof t.cars === 'number') ? t.cars : 0;
          if(cars < threshold){
            try{ dbg && dbg('ALARM_CARS_FILTERED', { trainNo: t.no, cars, threshold }); }catch{}
            continue;
          }
        }
      }catch{}

      const dir = t.direction;
      const prefs = getPrefsForDir(dir);
      const prefsRaw = new Set(prefs);
      const posIdx = (typeof t.posIndex === 'number') ? t.posIndex : null;
      // If pass display is hidden, automatically disable pass alarm
      try{
        const passSetting = (document.getElementById('passFilter')?.value || 'hide');
        if(passSetting !== 'show') prefs.delete('pass');
      }catch{}
      if(!prefs || prefs.size === 0){
        try{ dbg && dbg('ALARM_NO_PREFS', { trainNo: t.no, direction: dir, prefs: Array.from(prefs || []) }); }catch{}
        continue;
      }
      // Determine targets for stop and pass cases
      const cat = trainCategoryFromDisplayType ? trainCategoryFromDisplayType(t.displayType) : -1;
      const st = selectedStationCode();
      const targets = readAlarmTargets(dir === 0 ? 'up' : 'down', st);
      const catKey = `cat:${cat}`;
      const ahead = (function(){
        const order = indexes.order || [];
        const idx = order.indexOf(String(selectedCode));
        const out = [];
        if(idx >= 0){
          if(dir === 0){ for(let k=1;k<=3;k++){ if(idx+k < order.length) out.push(order[idx+k]); } }
          else { for(let k=1;k<=3;k++){ if(idx-k >= 0) out.push(order[idx-k]); } }
        }
        return out;
      })();
      const fallbackTarget = ahead[0] || null;
      let alerted = false;

      // Debug log for train alarm check
      try{
        dbg && dbg('ALARM_CHECK_TRAIN', {
          trainNo: t.no,
          displayType: t.displayType,
          category: cat,
          categoryLabel: getCategoryLabel ? getCategoryLabel(cat) : String(cat),
          prefs: Array.from(prefs),
          hasCategory: prefs.has(`cat:${cat}`),
          hasPass: prefs.has('pass')
        });
      }catch{}

      // 1) Stop case
      if(prefs.has(`cat:${cat}`)){
        const targetCode = targets[catKey] || fallbackTarget;
        if(!targetCode){
          try{ dbg && dbg('ALARM_NO_TARGET', { trainNo: t.no, cat, targets, fallbackTarget }); }catch{}
        }
        if(targetCode){
          const targetIndex = stationIndexOf(targetCode);
          // Direction-aware trigger:
          //  - stopped: atCode === target
          //  - moving: up(dir=0) -> nextCode === target (segment A_target : moving toward selected side)
          //            down(dir=1) -> atCode === target  (segment target_B)
          const here = String(t.atCode||'');
          const nxt = t.nextCode != null ? String(t.nextCode) : '';
          const isStoppedAtTarget = t.stopped && here === String(targetCode);
          const isMovingOnTarget = (!t.stopped) && (
            (dir === 0 ? (nxt === String(targetCode)) : (here === String(targetCode)))
          );
          const segmentMatch = (() => {
            if(posIdx == null || selectedIndex == null || targetIndex == null) return false;
            if(dir === 0 && targetIndex < selectedIndex) return false;
            if(dir === 1 && targetIndex > selectedIndex) return false;
            const lower = Math.min(selectedIndex, targetIndex);
            const upper = Math.max(selectedIndex, targetIndex);
            if(lower === upper) return posIdx === lower;
            if(dir === 0){
              return posIdx >= selectedIndex && posIdx <= upper;
            }
            if(dir === 1){
              return posIdx <= selectedIndex && posIdx >= lower;
            }
            return posIdx >= lower && posIdx <= upper;
          })();
          const boundaryMatch = isStoppedAtTarget || isMovingOnTarget;
          const rangeMatch = segmentMatch && !boundaryMatch;
          if(boundaryMatch || rangeMatch){
            const targetAllowed = stationAllowedCategories ? stationAllowedCategories(indexes.byCode.get(String(targetCode))) : null;
            const stopsHere = (cat !== -1 && targetAllowed && targetAllowed.has(cat)) || (cat === -1);
            try{
              dbg && dbg('ALARM_TARGET_CHECK', {
                trainNo: t.no,
                cat,
                targetCode,
                targetAllowed: targetAllowed ? Array.from(targetAllowed) : null,
                stopsHere,
                boundaryMatch,
                rangeMatch
              });
            }catch{}
            if(stopsHere){
              // Suppress duplicates for same line + station filter + train no within 3 minutes
              if(approachRecentlyAnnounced(t.no, selectedCode, dir)) { alerted = true; return; }
              const key = `${t.no||'?'}:${dir}:${targetCode}`;
              const msg = buildTtsMessage ? buildTtsMessage(t, targetCode, indexes) : '';
              const afterPlay = () => { try{ markApproachAnnounced(t.no, selectedCode, dir); }catch{} };
              const meta = {
                area, line,
                dir: (dir === 0 ? 'up' : 'down'),
                direction: (typeof t.direction === 'number') ? t.direction : undefined,
                trainNo: t.no||'?',
                atCode: String(t.atCode||''), nextCode: String(t.nextCode||''),
                atName: indexes.byCode.get(String(t.atCode||''))?.name,
                nextName: indexes.byCode.get(String(t.nextCode||''))?.name,
                targetCode: String(targetCode||''),
                targetName: indexes.byCode.get(String(targetCode||''))?.name,
                stopped: !!t.stopped,
                displayType: String(t.displayType||''),
                nickname: String(getNickname ? getNickname(t) : ''),
                delay: (typeof t.delayMinutes === 'number') ? t.delayMinutes : 0,
                dest: String(getDestText ? getDestText(t, indexes, 'dest') : ''),
                triggerReason: rangeMatch ? 'range' : 'segment',
                selectedIndex: selectedIndex,
                targetIndex: targetIndex,
                posIndex: posIdx
              };
              try{
                dbg && dbg('ALARM_TRIGGER', {
                  time: new Date().toISOString(), line, area,
                  selectedStation: String(selectedCode),
                  trainNo: meta.trainNo, displayType: meta.displayType,
                  prefsRaw: Array.from(prefsRaw||[]), prefsNow: Array.from(prefs||[]),
                  target: { code: meta.targetCode, name: meta.targetName },
                  pos: { at: meta.atCode, next: meta.nextCode },
                  reason: rangeMatch ? 'stop-range' : 'stop-segment'
                });
              }catch{}
              notifyOnce(dir === 0 ? 'up' : 'down', key, msg, afterPlay, meta);
              try{
                notifyIfBackground && notifyIfBackground(msg, approachKey(t.no, selectedCode, dir));
              }catch{}
              alerted = true;
            } else {
              try{ dbg && dbg('ALARM_NOT_STOPPING', { trainNo: t.no, cat, targetCode, targetAllowed: targetAllowed ? Array.from(targetAllowed) : null }); }catch{}
            }
          } else {
            try{ dbg && dbg('ALARM_NO_MATCH', { trainNo: t.no, boundaryMatch, rangeMatch, here, nxt, targetCode, isStoppedAtTarget, isMovingOnTarget, segmentMatch }); }catch{}
          }
        }
      }
      else {
        // Category not in prefs - user hasn't checked this train type
        try{
          dbg && dbg('ALARM_CATEGORY_NOT_IN_PREFS', {
            trainNo: t.no,
            displayType: t.displayType,
            category: cat,
            categoryLabel: getCategoryLabel ? getCategoryLabel(cat) : String(cat),
            prefs: Array.from(prefs)
          });
        }catch{}
      }
      // 2) Pass case (only if not alerted)
      if(!alerted && prefs.has('pass')){
        const targetCode = targets['pass'] || fallbackTarget;
        if(targetCode){
          const here = String(t.atCode||'');
          const nxt = t.nextCode != null ? String(t.nextCode) : '';
          const isStoppedAtTarget = t.stopped && here === String(targetCode);
          const isMovingOnTarget = (!t.stopped) && (
            (dir === 0 ? (nxt === String(targetCode)) : (here === String(targetCode)))
          );
          if(isStoppedAtTarget || isMovingOnTarget){
            const targetAllowed = stationAllowedCategories ? stationAllowedCategories(indexes.byCode.get(String(targetCode))) : null;
            const stopsHere2 = (cat !== -1 && targetAllowed && targetAllowed.has(cat)) || (cat === -1);
            if(!stopsHere2){
              if(approachRecentlyAnnounced(t.no, selectedCode, dir)) { return; }
              const key = `${t.no||'?'}:${dir}:${targetCode}`;
              const msg = buildTtsMessage ? buildTtsMessage(t, targetCode, indexes) : '';
              const afterPlay = () => { try{ markApproachAnnounced(t.no, selectedCode, dir); }catch{} };
              const meta = {
                area, line,
                dir: (dir === 0 ? 'up' : 'down'),
                direction: (typeof t.direction === 'number') ? t.direction : undefined,
                trainNo: t.no||'?',
                atCode: String(t.atCode||''), nextCode: String(t.nextCode||''),
                atName: indexes.byCode.get(String(t.atCode||''))?.name,
                nextName: indexes.byCode.get(String(t.nextCode||''))?.name,
                targetCode: String(targetCode||''),
                targetName: indexes.byCode.get(String(targetCode||''))?.name,
                stopped: !!t.stopped,
                displayType: String(t.displayType||''),
                nickname: String(getNickname ? getNickname(t) : ''),
                delay: (typeof t.delayMinutes === 'number') ? t.delayMinutes : 0,
                dest: String(getDestText ? getDestText(t, indexes, 'dest') : '')
              };
              try{
                dbg && dbg('ALARM_TRIGGER', {
                  time: new Date().toISOString(), line, area,
                  selectedStation: String(selectedCode),
                  trainNo: meta.trainNo, displayType: meta.displayType,
                  prefsRaw: Array.from(prefsRaw||[]), prefsNow: Array.from(prefs||[]),
                  target: { code: meta.targetCode, name: meta.targetName },
                  pos: { at: meta.atCode, next: meta.nextCode },
                  reason: 'pass'
                });
              }catch{}
              notifyOnce(dir === 0 ? 'up' : 'down', key, msg, afterPlay, meta);
              try{
                notifyIfBackground && notifyIfBackground(msg, approachKey(t.no, selectedCode, dir));
              }catch{}
              alerted = true;
            }
          }
        }
      }
    }
  }

  function setLastShown({ up = [], down = [] } = {}, selectedCode, indexes){
    try{
      lastShownTrains = { up: up.slice(), down: down.slice() };
      lastSelectedCode = selectedCode || null;
      lastIndexes = indexes || null;
    }catch{}
  }

  function clearNotified(){
    try{ alarmNotified.up.clear(); alarmNotified.down.clear(); }catch{}
  }
  function isPlaying(){
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
