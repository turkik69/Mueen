-- migration_add_uid.sql — شغّليه مرة وحدة فقط على القاعدة الحالية:
-- wrangler d1 execute mueen-reminders --remote --file=./migration_add_uid.sql
--
-- الجداول الحالية ما فيها عمود uid، يعني أي بيانات فيها الآن مشتركة بين
-- كل مستخدمي التطبيق بدل ما تكون خاصة بكل شخص. هذا يضيف العمود الناقص.

ALTER TABLE items ADD COLUMN uid TEXT;
ALTER TABLE reminders ADD COLUMN uid TEXT;
ALTER TABLE subscriptions ADD COLUMN uid TEXT;

-- أي صفوف قديمة بدون uid ما راح تنتمي لأي مستخدم بعد الترقية — تنظيف بسيط:
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

-- بعد هذا: افتحي التطبيق مسجّلة دخول واضغطي "تفعيل الإشعارات" مرة ثانية
-- (اشتراك الجهاز القديم انحذف لأنه ما كان مرتبط بحساب).
