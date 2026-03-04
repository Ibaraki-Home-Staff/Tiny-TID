// Tiny-TID Service Worker
// Scope: /
// Responsibilities:
// - Receive Web Push events and show user-visible notifications
// - Keep simple lifecycle (no aggressive caching here)

self.addEventListener('install', function(event){
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(self.clients.claim());
});

function showApproachNotification(payload){
  var title = payload.title || '列車接近';
  var body = payload.body || '';
  var tag = payload.tag || '';
  var icon = payload.icon || '/assets/img/placeholder.svg';
  var url = payload.url || '/TID.html';
  var data = { url: url };
  return self.registration.showNotification(title, {
    body: body,
    tag: tag,
    renotify: true,
    icon: icon,
    data: data
  });
}

self.addEventListener('push', function(event){
  if(!event) return;
  var payload = {};
  try{
    if(event.data){
      try{ payload = event.data.json(); }
      catch(_err){ payload = { body: String(event.data.text()||'') }; }
    }
  }catch(_err){}
  event.waitUntil(showApproachNotification(payload));
});

self.addEventListener('notificationclick', function(event){
  var n = event.notification;
  var url = (n && n.data && n.data.url) ? n.data.url : '/';
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(allClients){
      for(var i = 0; i < allClients.length; i += 1){
        var c = allClients[i];
        if(c.url && c.url.indexOf(url) !== -1){ return c.focus(); }
      }
      return self.clients.openWindow(url);
    })
  );
});

