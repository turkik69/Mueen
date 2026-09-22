-- Optional one-time cleanup for older D1 databases.
-- Worker v3.6 can add missing uid columns automatically, so this file is not required
-- for normal deployment. Run it only if you want to clean legacy unowned rows manually.

DELETE FROM subscriptions WHERE uid IS NULL;
DELETE FROM reminders WHERE uid IS NULL;
DELETE FROM items WHERE uid IS NULL;

CREATE TABLE IF NOT EXISTS shortcut_links (
  uid TEXT PRIMARY KEY,
  link_key TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_uid_created ON items(uid, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_uid ON subscriptions(uid);
