-- Customers who placed guest orders with their phone number can link those
-- orders after proving ownership with a one-time code. Nothing is linked
-- automatically.

CREATE TABLE order_link_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_order_link_codes_user ON order_link_codes(user_id, used_at);
