// sw.js — Service Worker لتطبيق "مُعين"
// مبني على Web Push API الأصلي (VAPID) مباشرة عبر Cloudflare Worker —
// لا يحتاج Firebase SDK إطلاقًا داخل الـ Service Worker.

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'مُعين', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'مُعين';
  const options = {
    body: payload.body || '',
    icon: payload.icon || 'icon.svg',
    badge: payload.badge || 'icon.svg',
    tag: payload.tag || payload.itemId || 'mueen-reminder', // يمنع ظهور نفس التذكير كإشعارين
    dir: 'rtl',
    lang: 'ar',
    data: { url: payload.url || './', itemId: payload.itemId || '' }
    // لا يوجد خيار "صوت مخصص" بمعيار الويب على أي متصفح — صوت النظام الافتراضي دايمًا.
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// الضغط على الإشعار يفتح مُعين (يركّز نافذة مفتوحة إن وجدت بدل نسخة جديدة)
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
