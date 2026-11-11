const V='lg-ledger-v23-daily-gold-validation';
const CORE=['./','index.html','app-extras.js','google-drive.js','manifest.json','icon-180.png','icon-192.png','icon-512.png'];
const CDN=[
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2/dist/chartjs-plugin-datalabels.min.js',
  'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap'
];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(async c=>{
    await c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})));   // always the fresh files, never a stale browser copy
    await Promise.allSettled(CDN.map(u=>fetch(u).then(r=>r.ok&&c.put(u,r))));
  }));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
/* Serve from cache instantly, refresh the cache in the background. */
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  if(!(u.origin===location.origin||/(^|\.)(jsdelivr\.net|googleapis\.com|gstatic\.com)$/.test(u.hostname)))return;   // never cache Sheets traffic
  const fresh=/\.(?:html|js)$/.test(u.pathname)||r.mode==='navigate';
  e.respondWith(caches.match(r).then(hit=>{
    const net=fetch(r).then(res=>{
      if(res&&(res.ok||res.type==='opaque')){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));}
      return res;
    }).catch(()=>hit||(r.mode==='navigate'?caches.match('./'):undefined));
    return fresh?net.catch(()=>hit):hit||net;
  }));
});

self.addEventListener('notificationclick',e=>{e.notification.close();const url=e.notification.data?.url||self.registration.scope;e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async list=>{for(const c of list){if(c.url.startsWith(self.registration.scope)){await c.focus();return c.navigate(url);}}return clients.openWindow(url);}));});
self.addEventListener('push',e=>{let data={};try{data=e.data?.json()||{};}catch{};e.waitUntil(self.registration.showNotification('Savings Ledger · Monthly report',{body:'Your savings report is ready. Tap to view it.',icon:'icon-192.png',tag:'savings-ledger-monthly',data:{url:new URL('./#report='+String(data.month||''),self.registration.scope).href}}));});
