// sw.js — Service Worker لتطبيق "مُعين"
// المهمة الوحيدة المهمة هنا: استقبال إشعارات Push وعرضها حتى لو
// التطبيق مقفول تمامًا (مو بس بالخلفية). هذا هو الجزء اللي كان ناقص.

importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js');

// ⚠️ انسخي نفس القيم بالضبط من firebase-adapter.js (نفس إعدادات المشروع
// المستخدمة هناك). هذي القيم عمومًا علنية بتصميم Firebase وليست أسرار،
// لكن لازم تكون نفسها بالضبط حتى يشتغل الاستقبال.
firebase.initializeApp({
  apiKey: "PASTE_FROM_firebase-adapter.js",
  authDomain: "PASTE_FROM_firebase-adapter.js",
  databaseURL: "PASTE_FROM_firebase-adapter.js",
  projectId: "PASTE_FROM_firebase-adapter.js",
  storageBucket: "PASTE_FROM_firebase-adapter.js",
  messagingSenderId: "PASTE_FROM_firebase-adapter.js",
  appId: "PASTE_FROM_firebase-adapter.js"
});

const messaging = firebase.messaging();

// إشعار وصل والتطبيق مقفول/بالخلفية — هذا الكود يشتغل مستقل عن أي
// صفحة مفتوحة، فيعرض الإشعار حتى لو ما فيه أي تبويب لـمُعين شغّال.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || 'مُعين';
  const body = data.body || '';

  self.registration.showNotification(title, {
    body,
    icon: 'icon.svg',
    badge: 'icon.svg',
    tag: data.itemId || 'mueen-reminder', // يمنع تكرار نفس التذكير كإشعارين
    dir: 'rtl',
    lang: 'ar',
    data: { url: data.url || './', itemId: data.itemId || '' }
    // ملاحظة: لا يوجد خيار "صوت مخصص" بمعيار الويب على أي متصفح —
    // الجهاز يستخدم صوت النظام الافتراضي دائمًا لإشعارات الويب.
  });
});

// الضغط على الإشعار يفتح مُعين مباشرة (يركّز نافذة مفتوحة إن وجدت
// بدل ما يفتح نسخة ثانية)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) if ('focus' in c) return c.focus();
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
