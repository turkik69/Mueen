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
messaging.onBackgroundMessage(payload=>{
  const n=payload.notification||{};
  self.registration.showNotification(n.title||'مُعين',{body:n.body||'لديك تذكير جديد',icon:'./icon.svg',badge:'./icon.svg',data:payload.data||{}});
});