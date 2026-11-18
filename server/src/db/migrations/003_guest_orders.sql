-- Guest checkout: orders can be placed without an account.
-- Existing account orders keep using customer_id; guest orders store contact
-- details on the order itself so staff and riders still know who to call.

ALTER TABLE orders ADD COLUMN guest_name TEXT;
ALTER TABLE orders ADD COLUMN guest_phone TEXT;
ALTER TABLE orders ADD COLUMN guest_email TEXT;
ALTER TABLE orders ADD COLUMN consent_given_at TEXT;

CREATE INDEX ix_orders_guest_phone ON orders(guest_phone, created_at DESC);
