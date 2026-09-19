importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');
firebase.initializeApp({
  apiKey:"AIzaSyDZ5MYN5z1FiSVe9LoYXmER4NUUkW6C0us",
  authDomain:"fitness-coach-21b40.firebaseapp.com",
  databaseURL:"https://fitness-coach-21b40-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:"fitness-coach-21b40",
  storageBucket:"fitness-coach-21b40.firebasestorage.app",
  messagingSenderId:"162393884721",
  appId:"1:162393884721:web:d0d5768c827b997c322d10"
});
const messaging=firebase.messaging();
const CACHE='mueen-v9';
const ASSETS=['./','./index.html','./manifest.webmanifest','./icon.svg','./firebase-adapter.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(res=>{const copy=res.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return res}).catch(()=>caches.match('./index.html'))))});
messaging.onBackgroundMessage(payload=>{
  const n=payload.notification||{};
  self.registration.showNotification(n.title||'مُعين',{body:n.body||'لديك تذكير جديد',icon:'./icon.svg',badge:'./icon.svg',data:payload.data||{}});
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c)return c.focus()}if(clients.openWindow)return clients.openWindow('./')}))});