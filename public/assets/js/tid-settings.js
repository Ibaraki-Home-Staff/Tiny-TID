const SETTINGS_ROOT_KEY = 'tid:v1:settings';
const MIGRATION_DONE_KEY = 'tid:v1:migrationDone';

function isMigrationDone(){
  try{ return localStorage.getItem(MIGRATION_DONE_KEY) === '1'; }catch{ return false; }
}

function markMigrationDone(){
  try{ localStorage.setItem(MIGRATION_DONE_KEY, '1'); }catch{}
}

function loadSettingsRoot(){
  try{
    const raw = localStorage.getItem(SETTINGS_ROOT_KEY);
    if(!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  }catch{
    return {};
  }
}

function saveSettingsRoot(obj){
  try{
    localStorage.setItem(SETTINGS_ROOT_KEY, JSON.stringify(obj || {}));
  }catch{}
}

function getPath(obj, path){
  try{
    const segs = String(path || '').split('.');
    let cur = obj;
    for(const seg of segs){
      if(!cur || typeof cur !== 'object') return undefined;
      cur = cur[seg];
    }
    return cur;
  }catch{
    return undefined;
  }
}

function setPath(obj, path, value){
  try{
    const segs = String(path || '').split('.');
    let cur = obj;
    for(let i = 0; i < segs.length - 1; i += 1){
      const seg = segs[i];
      if(!cur[seg] || typeof cur[seg] !== 'object') cur[seg] = {};
      cur = cur[seg];
    }
    cur[segs[segs.length - 1]] = value;
  }catch{}
}

function ensureLineConfig(root, lineId){
  if(!root.lines) root.lines = {};
  if(!root.lines[lineId]) root.lines[lineId] = {};
}

export function getSetting(path, fallback){
  const root = loadSettingsRoot();
  const value = getPath(root, path);
  return value === undefined ? fallback : value;
}

export function setSetting(path, value){
  const root = loadSettingsRoot();
  setPath(root, path, value);
  saveSettingsRoot(root);
}

export function getLineConfig(lineId){
  const root = loadSettingsRoot();
  return (root.lines && root.lines[lineId]) || {};
}

export function migrateLegacySettings(){
  try{
    if(isMigrationDone()) return;
    const root = loadSettingsRoot();

    const open = localStorage.getItem('tid:settings:open');
    if(open != null){
      setPath(root, 'ui.settingsOpen', open);
      try{ localStorage.removeItem('tid:settings:open'); }catch{}
    }

    try{ localStorage.removeItem('tid:audio:unlocked'); }catch{}
    try{ localStorage.removeItem('tid:tts:voice'); }catch{}

    const delayThreshold = localStorage.getItem('tid:delay:threshold');
    if(delayThreshold != null){
      setPath(root, 'delay.threshold', Number(delayThreshold));
      try{ localStorage.removeItem('tid:delay:threshold'); }catch{}
    }

    const bgNotify = localStorage.getItem('tid:bgnotify');
    if(bgNotify != null){
      setPath(root, 'bg.notify', bgNotify);
    }

    const wakeLock = localStorage.getItem('tid:wakelock');
    if(wakeLock != null){
      setPath(root, 'bg.wakelock', wakeLock);
      try{ localStorage.removeItem('tid:wakelock'); }catch{}
    }

    try{
      for(let i = 0; i < localStorage.length; i += 1){
        const key = localStorage.key(i);
        if(!key) continue;

        const stationMatch = key.match(/^tid:station:(.+)$/);
        if(stationMatch){
          const lineId = stationMatch[1];
          const value = localStorage.getItem(key) || '';
          if(value){
            ensureLineConfig(root, lineId);
            setPath(root, `lines.${lineId}.station`, value);
          }
          continue;
        }

        const passMatch = key.match(/^tid:pass:(.+)$/);
        if(passMatch){
          const lineId = passMatch[1];
          const value = localStorage.getItem(key) || '';
          if(value){
            ensureLineConfig(root, lineId);
            setPath(root, `lines.${lineId}.pass`, value);
          }
        }
      }
    }catch{}

    try{
      for(let i = 0; i < localStorage.length; i += 1){
        const key = localStorage.key(i);
        if(!key) continue;

        let match = key.match(/^tid:alarm:disable:([^:]+):([^:]+):(up|down)$/);
        if(match){
          const [, lineId, stationCode, dir] = match;
          setPath(root, `lines.${lineId}.alarms.${stationCode}.${dir}.disabled`, localStorage.getItem(key) === '1');
          continue;
        }

        match = key.match(/^tid:alarm:([^:]+):([^:]+):(up|down)$/);
        if(match){
          const [, lineId, stationCode, dir] = match;
          try{
            const prefs = JSON.parse(localStorage.getItem(key) || '[]');
            if(Array.isArray(prefs)){
              setPath(root, `lines.${lineId}.alarms.${stationCode}.${dir}.prefs`, prefs);
            }
          }catch{}
          continue;
        }

        match = key.match(/^tid:alarm:target:([^:]+):([^:]+):(up|down)$/);
        if(match){
          const [, lineId, stationCode, dir] = match;
          try{
            const targets = JSON.parse(localStorage.getItem(key) || '{}');
            if(targets && typeof targets === 'object'){
              setPath(root, `lines.${lineId}.alarms.${stationCode}.${dir}.targets`, targets);
            }
          }catch{}
        }
      }
    }catch{}

    saveSettingsRoot(root);
    markMigrationDone();
  }catch{}
}
