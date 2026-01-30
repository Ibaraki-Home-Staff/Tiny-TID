// Background notification + wake lock utilities for TID

const BG_NOTIFY_KEY = 'tid:bgnotify';
const WAKE_LOCK_KEY = 'tid:wakelock';

function isBgNotifyEnabled(getSetting){
  try{
    const v = getSetting ? getSetting('bg.notify', null) : null;
    if(v === '1' || v === 1 || v === true) return true;
    // fallback to legacy key if not set
    return localStorage.getItem(BG_NOTIFY_KEY) === '1';
  }catch{ return false; }
}

let screenWakeLock = null;
async function enableWakeLock(){
  try{
    if(!('wakeLock' in navigator)) return false;
    screenWakeLock = await navigator.wakeLock.request('screen');
    screenWakeLock.addEventListener('release', () => { /* no-op */ });
    return true;
  }catch{ return false; }
}
async function disableWakeLock(){
  try{ if(screenWakeLock){ await screenWakeLock.release(); screenWakeLock = null; } }catch{}
}
async function tryReacquireWakeLock(){
  try{
    if(localStorage.getItem(WAKE_LOCK_KEY) === '1' && document.visibilityState === 'visible'){
      if(!screenWakeLock) await enableWakeLock();
    }
  }catch{}
}

export function initBackgroundControls({ getSetting, setSetting, dbg } = {}){
  try{
    const ncb = document.getElementById('bgNotifyEnable');
    const wcb = document.getElementById('wakeLockEnable');
    const _get = (typeof getSetting === 'function') ? getSetting : () => null;
    const _set = (typeof setSetting === 'function') ? setSetting : () => {};

    if(ncb){
      ncb.checked = isBgNotifyEnabled(_get);
      // If permission was reset/denied, reflect the true state
      try{
        if(ncb.checked && (!('Notification' in window) || Notification.permission !== 'granted')){
          ncb.checked = false;
          _set('bg.notify','0');
          try{ localStorage.setItem(BG_NOTIFY_KEY, '0'); }catch{}
        }
      }catch{}
      ncb.addEventListener('change', async () => {
        try{
          if(ncb.checked){
            if('Notification' in window){
              let perm = Notification.permission;
              if(perm !== 'granted'){
                try{ perm = await Notification.requestPermission(); }catch{}
              }
              if(perm === 'granted'){
                _set('bg.notify','1');
                try{ localStorage.setItem(BG_NOTIFY_KEY, '1'); }catch{}
              }else{
                ncb.checked = false; _set('bg.notify','0'); try{ localStorage.setItem(BG_NOTIFY_KEY, '0'); }catch{}
              }
            }else{
              ncb.checked = false; _set('bg.notify','0'); try{ localStorage.setItem(BG_NOTIFY_KEY, '0'); }catch{}
            }
          }else{
            _set('bg.notify','0'); try{ localStorage.setItem(BG_NOTIFY_KEY, '0'); }catch{}
          }
        }catch(err){ try{ dbg && dbg('bg notify toggle failed', err); }catch{} }
      });
    }
    if(wcb){
      const saved = (_get('bg.wakelock', null) === '1') || (localStorage.getItem(WAKE_LOCK_KEY) === '1');
      wcb.checked = saved;
      if(saved) enableWakeLock();
      wcb.addEventListener('change', async () => {
        try{
          if(wcb.checked){
            _set('bg.wakelock','1'); try{ localStorage.setItem(WAKE_LOCK_KEY, '1'); }catch{}
            await enableWakeLock();
          }else{
            _set('bg.wakelock','0'); try{ localStorage.setItem(WAKE_LOCK_KEY, '0'); }catch{}
            await disableWakeLock();
          }
        }catch(err){ try{ dbg && dbg('wakelock toggle failed', err); }catch{} }
      });
      // Reacquire on visibility change
      document.addEventListener('visibilitychange', tryReacquireWakeLock);
    }
  }catch(err){ try{ dbg && dbg('init background controls failed', err); }catch{} }
}

export function notifyIfBackground(message, tag, { getSetting, dbg } = {}){
  try{
    if(!document.hidden) return;
    const _get = (typeof getSetting === 'function') ? getSetting : () => null;
    if(!isBgNotifyEnabled(_get)) return;
    if(!('Notification' in window) || Notification.permission !== 'granted') return;
    const opts = { body: String(message||''), tag: String(tag||''), renotify: true, icon: '/assets/img/placeholder.svg' };
    new Notification('列車接近', opts);
  }catch(err){ try{ dbg && dbg('notifyIfBackground failed', err); }catch{} }
}
