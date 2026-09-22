-- schema.sql — قاعدة بيانات مُعين (Cloudflare D1)
-- للنشر من جديد بالكامل فقط (wrangler d1 execute mueen-reminders --remote --file=./schema.sql).
-- لترقية القاعدة الموجودة فعليًا استخدمي migration_add_uid.sql بدل هذا الملف.

CREATE TABLE IF NOT EXISTS shortcut_links (
  uid TEXT PRIMARY KEY,
  link_key TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS subscriptions (
  endpoint TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  text TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  event_at INTEGER,
  created_at INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'siri'
);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  uid TEXT NOT NULL,
  notify_at INTEGER NOT NULL,
  offset_minutes INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  FOREIGN KEY(item_id) REFERENCES items(id)
);

CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(sent, notify_at);
CREATE INDEX IF NOT EXISTS idx_items_uid_created ON items(uid, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_uid ON subscriptions(uid);
