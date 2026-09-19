importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey:"AIzaSyBsnryD1ZtvjzumatCCVN-QpRAMR4_IG7M",
  authDomain:"world-cup-2026-d3091.firebaseapp.com",
  databaseURL:"https://world-cup-2026-d3091-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:"world-cup-2026-d3091",
  storageBucket:"world-cup-2026-d3091.firebasestorage.app",
  messagingSenderId:"830204361101",
  appId:"1:830204361101:web:f3a23c0fa41bb809d365c4"
});
const messaging=firebase.messaging();
const CACHE='mueen-v2';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./firebase-adapter.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return res}).catch(()=>caches.match('./index.html'))))});
messaging.onBackgroundMessage(payload=>{
  const n=payload.notification||{};
  self.registration.showNotification(n.title||'مُعين',{body:n.body||'لديك تذكير جديد',icon:'./icon.svg',badge:'./icon.svg',data:payload.data||{}});
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c)return c.focus()}if(clients.openWindow)return clients.openWindow('./')}))});