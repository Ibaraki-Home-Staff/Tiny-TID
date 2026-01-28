// Tiny-TID Service Worker
// Scope: /
// Responsibilities:
// - Receive Web Push events and show user-visible notifications
// - Keep simple lifecycle (no aggressive caching here)

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function showApproachNotification(payload){
  const title = payload.title || '列車接近';
  const body = payload.body || '';
  const tag = payload.tag || '';
  const icon = payload.icon || '/assets/img/placeholder.svg';
  const url = payload.url || '/TID.html';
  const data = { url };
  return self.registration.showNotification(title, { body, tag, renotify: true, icon, data });
}

self.addEventListener('push', (event) => {
  if(!event) return;
  let payload = {};
  try{
    if(event.data){
      try{ payload = event.data.json(); }
      catch{ payload = { body: String(event.data.text()||'') }; }
    }
  }catch{}
  event.waitUntil(showApproachNotification(payload));
});

self.addEventListener('notificationclick', (event) => {
  const n = event.notification;
  const url = (n && n.data && n.data.url) ? n.data.url : '/';
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for(const c of allClients){
      if(c.url && c.url.indexOf(url) !== -1){ c.focus(); return; }
    }
    await self.clients.openWindow(url);
  })());
});

