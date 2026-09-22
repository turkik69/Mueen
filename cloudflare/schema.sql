CREATE TABLE IF NOT EXISTS subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  text TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  event_at INTEGER,
  created_at INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'siri'
);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);

CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  notify_at INTEGER NOT NULL,
  offset_minutes INTEGER NOT NULL DEFAULT 0,
  sent INTEGER NOT NULL DEFAULT 0,
  sent_at INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  FOREIGN KEY(item_id) REFERENCES items(id)
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(sent, notify_at);

CREATE TABLE IF NOT EXISTS shortcut_links (
  uid TEXT PRIMARY KEY,
  link_key TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
