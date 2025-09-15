// PWA and Push setup for Tiny-TID

const isLocalhost = () => /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
const isSecure = () => location.protocol === 'https:' || isLocalhost();

async function registerServiceWorker(){
  try{
    if(!('serviceWorker' in navigator)) return null;
    if(!isSecure()) return null;
    const vMeta = document.querySelector('meta[name="app:version"]');
    const v = vMeta && vMeta.getAttribute('content');
    const swUrl = v ? `/service-worker.js?v=${encodeURIComponent(v)}` : '/service-worker.js';
    const reg = await navigator.serviceWorker.register(swUrl);
    return reg;
  }catch(err){
    console.warn('[PWA] SW register failed', err);
    return null;
  }
}

async function ensureNotificationPermission(){
  try{
    if(!('Notification' in window)) return false;
    if(Notification.permission === 'granted') return true;
    const res = await Notification.requestPermission();
    return res === 'granted';
  }catch{ return false; }
}

function urlB64ToUint8Array(base64String){
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
  return outputArray;
}

async function subscribePush(reg){
  try{
    if(!reg || !('pushManager' in reg)) return null;
    // Read config from meta tags
    const metaKey = document.querySelector('meta[name="push:publicKey"]');
    const metaEndpoint = document.querySelector('meta[name="push:subscribeUrl"]');
    const pubKey = metaKey && metaKey.getAttribute('content');
    const subscribeUrl = metaEndpoint && metaEndpoint.getAttribute('content');
    if(!pubKey || !subscribeUrl) return null;
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(pubKey) });
    }
    // send to app server
    try{
      await fetch(subscribeUrl, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(sub) });
    }catch{}
    return sub;
  }catch(err){ console.warn('[PWA] push subscribe failed', err); return null; }
}

(async function init(){
  const reg = await registerServiceWorker();
  if(!reg) return;
  // Avoid prompting on page load. Respect user's in-app toggle instead.
  try{
    const bg = (localStorage.getItem('tid:bgnotify') === '1');
    if(!bg) return;
  }catch{}
  // If already granted, proceed to subscribe silently. Otherwise do nothing here;
  // the UI toggle in TID page handles prompting.
  if('Notification' in window && Notification.permission === 'granted'){
    try{ await subscribePush(reg); }catch{}
  }
})();
