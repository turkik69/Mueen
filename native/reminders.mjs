const MAX_PENDING = 60; // Leave space below iOS's 64 pending notification limit.
export function notificationBody(item, offset) {
  const when = offset === 0 ? 'الآن' : offset === 60 ? 'بعد ساعة' : offset === 120 ? 'بعد ساعتين' : offset === 1440 ? 'غدًا' : offset === 2880 ? 'بعد يومين' : `بعد ${offset} دقيقة`;
  return `${offset === 0 ? 'أذكّرك:' : 'لا تنسَ:'} ${item.title} — ${when}${offset > 0 && item.time ? `، الساعة ${item.time}` : ''}`;
}
export function buildNotifications(items, now = Date.now()) {
  const candidates = [];
  for (const item of items || []) {
    if (!item || item.done || item.type === 'idea' || !item.id || !item.date || !item.time) continue;
    const eventAt = new Date(`${item.date}T${item.time}`).getTime();
    if (!Number.isFinite(eventAt)) continue;
    const offsets = Array.isArray(item.reminders) ? item.reminders : [0];
    for (const offset of new Set(offsets)) {
      if (typeof offset !== 'number' || !Number.isFinite(offset) || offset < 0) continue;
      const at = eventAt - offset * 60000;
      if (at <= now) continue;
      candidates.push({ key: `${item.id}:${offset}`, item, offset, at });
    }
  }
  candidates.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
  const used = new Set();
  return candidates.slice(0, MAX_PENDING).map(({ key, item, offset, at }) => {
    let id = 2166136261;
    for (const c of key) id = Math.imul(id ^ c.charCodeAt(0), 16777619) >>> 0;
    id = 100000 + id % 2000000000;
    while (used.has(id)) id = id === 2000099999 ? 100000 : id + 1;
    used.add(id);
    return { id, title: 'مُعين — تذكير', body: notificationBody(item, offset),
      schedule: { at: new Date(at), allowWhileIdle: true },
      extra: { mueen: true, key, itemId: String(item.id), at }, channelId: 'mueen-reminders' };
  });
}
export function createReminderScheduler(plugin) {
  let queue = Promise.resolve();
  return function sync(items) {
    const snapshot = JSON.parse(JSON.stringify(items || []));
    const task = queue.catch(() => {}).then(async () => {
      if ((await plugin.checkPermissions()).display !== 'granted') return { enabled: false, count: 0 };
      const desired = buildNotifications(snapshot);
      const { notifications: pending } = await plugin.getPending();
      const managed = pending.filter(n => n.extra?.mueen);
      const wanted = new Map(desired.map(n => [n.id, n]));
      const same = (a, b) => a.extra?.key === b.extra?.key && a.extra?.at === b.extra?.at && a.title === b.title && a.body === b.body;
      const cancel = managed.filter(n => !wanted.has(n.id) || !same(n, wanted.get(n.id)));
      if (cancel.length) await plugin.cancel({ notifications: cancel.map(n => ({ id: n.id })) });
      const existing = new Map(managed.map(n => [n.id, n]));
      const add = desired.filter(n => !existing.has(n.id) || !same(n, existing.get(n.id)));
      if (add.length) await plugin.schedule({ notifications: add });
      return { enabled: true, count: desired.length };
    });
    queue = task;
    return task;
  };
}
