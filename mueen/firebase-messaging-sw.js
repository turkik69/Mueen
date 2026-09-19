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
messaging.onBackgroundMessage(payload=>{
  const n=payload.notification||{};
  self.registration.showNotification(n.title||'مُعين',{body:n.body||'لديك تذكير جديد',icon:'./icon.svg',badge:'./icon.svg',data:payload.data||{}});
});