/* Savings Ledger service worker. Pages and scripts are always asked from the site first, so a new release shows
   on the next launch; the saved copy is only used when the phone is offline. */
const V='lg-ledger-v29';
const CORE=['./','index.html','app-extras.js?v=29','google-drive.js?v=29','manifest.json','version.json','icon-180.png','icon-192.png','icon-512.png'];
const CDN=[
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js',
  'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2/dist/chartjs-plugin-datalabels.min.js',
  'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400;1,6..72,500&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap'
];
self.addEventListener('install',e=>{
  self.skipWaiting();
  e.waitUntil(caches.open(V).then(async c=>{
    await c.addAll(CORE.map(u=>new Request(u,{cache:'reload'})));
    await Promise.allSettled(CDN.map(u=>fetch(u).then(r=>r.ok&&c.put(u,r))));
  }));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k.startsWith('lg-ledger-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;
  const u=new URL(r.url);
  const own=u.origin===location.origin;
  if(!(own||/(^|\.)(jsdelivr\.net|googleapis\.com|gstatic\.com)$/.test(u.hostname)))return;   // never touch ledger or price traffic
  if(own&&u.pathname.endsWith('version.json'))return;                                          // always straight from the site
  const fresh=own&&(/\.(?:html|js|json)$/.test(u.pathname)||r.mode==='navigate');
  if(fresh){
    e.respondWith(fetch(r.url,{cache:'no-cache',credentials:'same-origin'}).then(res=>{
      if(res&&res.redirected)res=new Response(res.body,{status:res.status,statusText:res.statusText,headers:res.headers});   // a page may not be answered with a redirected reply
      if(res&&res.ok){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));}
      return res;
    }).catch(()=>caches.match(r,{ignoreSearch:r.mode==='navigate'}).then(hit=>hit||caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{
    if(res&&(res.ok||res.type==='opaque')){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp));}
    return res;
  })));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const url=(e.notification.data&&e.notification.data.url)||self.registration.scope;
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(async list=>{
    for(const c of list){if(c.url.startsWith(self.registration.scope)){await c.focus();try{return await c.navigate(url);}catch(err){return;}}}
    return clients.openWindow(url);
  }));
});
/* A push from the ledger script carries no data: it is only a knock. Ask the ledger what to show, then show it.
   Something is always shown, because iPhone withdraws push from apps that receive one silently. */
self.addEventListener('push',e=>{
  e.waitUntil((async()=>{
    let notes=[],d=null;
    try{d=e.data?e.data.json():null;}catch(err){}
    if(d&&d.title)notes=[d];
    else{
      try{
        const c=await caches.open('lg-push-cfg'),hit=await c.match(new Request('./__push-cfg')),cfg=hit?await hit.json():null;
        if(cfg&&cfg.url){
          const r=await fetch(cfg.url+(cfg.url.includes('?')?'&':'?')+'token='+encodeURIComponent(cfg.token)+'&notes=1&dev='+encodeURIComponent(cfg.dev),{cache:'no-store'});
          const j=await r.json();if(j&&Array.isArray(j.notes))notes=j.notes;
        }
      }catch(err){}
    }
    if(!notes.length)notes=[{title:'Savings Ledger',body:'There is something new in your ledger.',tag:'lg-new'}];
    for(const n of notes){
      await self.registration.showNotification(String(n.title||'Savings Ledger'),{body:String(n.body||''),icon:'icon-192.png',badge:'icon-192.png',tag:'lg-'+(n.tag||'push'),
        data:{url:new URL(n.url||'./',self.registration.scope).href}});
    }
  })());
});
