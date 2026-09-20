const CACHE='mueen-v21';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./firebase-adapter.js'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const isNavigation=e.request.mode==='navigate'||(e.request.headers.get('accept')||'').includes('text/html');
  const isFreshAppFile=url.pathname.endsWith('/index.html')||url.pathname.endsWith('/firebase-adapter.js')||url.pathname.endsWith('/sw.js');
  if(isNavigation||isFreshAppFile){
    e.respondWith(
      fetch(e.request,{cache:'no-store'}).then(res=>{
        const copy=res.clone();
        caches.open(CACHE).then(c=>c.put(e.request,copy));
        return res;
      }).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached=>cached||fetch(e.request).then(res=>{
      const copy=res.clone();
      caches.open(CACHE).then(c=>c.put(e.request,copy));
      return res;
    }))
  );
});

self.addEventListener('push',e=>{
  let data={};
  try{data=e.data?e.data.json():{}}catch(_){data={body:e.data?e.data.text():'لديك تذكير جديد'}}
  const title=data.title||'مُعين';
  const options={
    body:data.body||'لديك تذكير جديد',
    icon:'./icon.svg',
    badge:'./icon.svg',
    tag:data.itemId?('mueen-'+data.itemId):('mueen-'+Date.now()),
    data:{url:data.url||'./',itemId:data.itemId||''},
    renotify:true
  };
  e.waitUntil(self.registration.showNotification(title,options));
});

self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const target=(e.notification.data&&e.notification.data.url)||'./';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const c of list){if('focus'in c)return c.focus()}
    if(clients.openWindow)return clients.openWindow(target);
  }));
});
