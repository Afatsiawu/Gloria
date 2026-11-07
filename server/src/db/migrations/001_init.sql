-- Data-Driven Integrated Pharmacy and Customer Order System
-- Initial schema. All timestamps are UTC ISO-8601 strings.

CREATE TABLE pharmacies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  community TEXT NOT NULL CHECK (community IN ('Doryumu', 'Kordibe')),
  address TEXT NOT NULL,
  landmark TEXT,
  phone TEXT NOT NULL,
  license_no TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK (role IN ('customer', 'pharmacist', 'admin', 'rider')),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  email TEXT,
  password_hash TEXT NOT NULL,
  pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE SET NULL,
  community TEXT CHECK (community IS NULL OR community IN ('Doryumu', 'Kordibe')),
  delivery_address TEXT,
  digital_address_code TEXT,
  consent_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX ux_users_email ON users(email) WHERE email IS NOT NULL;
CREATE INDEX ix_users_role ON users(role);
CREATE INDEX ix_users_pharmacy ON users(pharmacy_id);

CREATE TABLE password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_password_resets_user ON password_resets(user_id, created_at DESC);

CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT
);

CREATE TABLE medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_name TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  strength TEXT,
  dosage_form TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  requires_prescription INTEGER NOT NULL DEFAULT 0 CHECK (requires_prescription IN (0, 1)),
  description TEXT,
  image_path TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_medicines_brand ON medicines(brand_name);
CREATE INDEX ix_medicines_generic ON medicines(generic_name);
CREATE INDEX ix_medicines_category ON medicines(category_id);

CREATE TABLE pharmacy_medicines (
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  price REAL NOT NULL CHECK (price >= 0),
  reorder_level INTEGER NOT NULL DEFAULT 10 CHECK (reorder_level >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (pharmacy_id, medicine_id)
);
CREATE INDEX ix_pharmacy_medicines_medicine ON pharmacy_medicines(medicine_id);

CREATE TABLE suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_suppliers_pharmacy ON suppliers(pharmacy_id);

CREATE TABLE delivery_zones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fee REAL NOT NULL CHECK (fee >= 0),
  rules TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  UNIQUE (pharmacy_id, name)
);
CREATE INDEX ix_delivery_zones_pharmacy ON delivery_zones(pharmacy_id);

CREATE TABLE purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received', 'cancelled')),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  received_at TEXT
);
CREATE INDEX ix_purchase_orders_pharmacy ON purchase_orders(pharmacy_id, status);

CREATE TABLE purchase_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
  quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
  unit_cost REAL NOT NULL DEFAULT 0 CHECK (unit_cost >= 0)
);
CREATE INDEX ix_po_items_po ON purchase_order_items(purchase_order_id);

CREATE TABLE batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  batch_no TEXT NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  expiry_date TEXT NOT NULL,
  quantity_received INTEGER NOT NULL CHECK (quantity_received >= 0),
  quantity_on_hand INTEGER NOT NULL CHECK (quantity_on_hand >= 0),
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  purchase_order_id INTEGER REFERENCES purchase_orders(id) ON DELETE SET NULL,
  UNIQUE (pharmacy_id, medicine_id, batch_no)
);
CREATE INDEX ix_batches_fefo ON batches(pharmacy_id, medicine_id, expiry_date, quantity_on_hand);
CREATE INDEX ix_batches_expiry ON batches(expiry_date, quantity_on_hand);

CREATE TABLE carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id INTEGER NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  UNIQUE (cart_id, medicine_id)
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT NOT NULL UNIQUE,
  customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  pharmacy_id INTEGER NOT NULL REFERENCES pharmacies(id),
  channel TEXT NOT NULL DEFAULT 'online' CHECK (channel IN ('online', 'walk_in')),
  fulfilment TEXT NOT NULL CHECK (fulfilment IN ('pickup', 'delivery')),
  delivery_zone_id INTEGER REFERENCES delivery_zones(id) ON DELETE SET NULL,
  delivery_fee REAL NOT NULL DEFAULT 0 CHECK (delivery_fee >= 0),
  delivery_address TEXT,
  digital_address_code TEXT,
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed', 'awaiting_prescription', 'verified', 'ready', 'out_for_delivery', 'completed', 'cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'success', 'cash_on_pickup', 'failed')),
  subtotal REAL NOT NULL CHECK (subtotal >= 0),
  total REAL NOT NULL CHECK (total >= 0),
  notes TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_orders_pharmacy_created ON orders(pharmacy_id, created_at);
CREATE INDEX ix_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX ix_orders_status ON orders(status);
CREATE INDEX ix_orders_reference ON orders(reference);

CREATE TABLE order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price REAL NOT NULL CHECK (unit_price >= 0),
  medicine_name_snapshot TEXT NOT NULL
);
CREATE INDEX ix_order_items_order ON order_items(order_id);
CREATE INDEX ix_order_items_medicine ON order_items(medicine_id);

CREATE TABLE order_item_allocations (
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  batch_id INTEGER NOT NULL REFERENCES batches(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  PRIMARY KEY (order_item_id, batch_id)
);
CREATE INDEX ix_allocations_batch ON order_item_allocations(batch_id);

CREATE TABLE prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  file_path TEXT NOT NULL,
  original_name TEXT,
  mime_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'queried')),
  reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  remarks TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_prescriptions_order ON prescriptions(order_id);
CREATE INDEX ix_prescriptions_status ON prescriptions(status);

CREATE TABLE payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('momo', 'cash')),
  network TEXT CHECK (network IS NULL OR network IN ('MTN', 'Telecel', 'AT')),
  phone TEXT,
  reference TEXT,
  provider TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  amount REAL NOT NULL CHECK (amount >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_payments_order ON payments(order_id);
CREATE INDEX ix_payments_reference ON payments(reference);

CREATE TABLE deliveries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  rider_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'picked_up', 'out_for_delivery', 'delivered', 'failed')),
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_deliveries_rider ON deliveries(rider_id, status);

CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'in_app')),
  event TEXT NOT NULL,
  recipient TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX ix_notifications_channel ON notifications(channel, created_at DESC);

CREATE TABLE refill_reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medicine_id INTEGER NOT NULL REFERENCES medicines(id) ON DELETE CASCADE,
  interval_days INTEGER NOT NULL CHECK (interval_days BETWEEN 1 AND 365),
  next_due_at TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, medicine_id)
);
CREATE INDEX ix_refills_due ON refill_reminders(next_due_at, is_active);

CREATE TABLE stock_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id INTEGER NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_stock_adjustments_batch ON stock_adjustments(batch_id);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id INTEGER,
  before_json TEXT,
  after_json TEXT,
  ip TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_audit_created ON audit_log(created_at DESC);
CREATE INDEX ix_audit_user ON audit_log(user_id);

CREATE TABLE unmet_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pharmacy_id INTEGER REFERENCES pharmacies(id) ON DELETE SET NULL,
  medicine_id INTEGER REFERENCES medicines(id) ON DELETE SET NULL,
  searched_term TEXT NOT NULL,
  community TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX ix_unmet_created ON unmet_requests(created_at DESC);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT
);

CREATE TABLE data_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('export', 'delete')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  processed_at TEXT
);

INSERT INTO app_settings (key, value, description) VALUES
  ('expiry_alert_days', '90', 'Days ahead used by expiry alerts'),
  ('forecast_window_weeks', '4', 'Moving-average demand window in weeks'),
  ('forecast_lead_time_days', '7', 'Supplier lead time used in reorder suggestions'),
  ('safety_stock_days', '3', 'Days of demand held as safety stock'),
  ('backup_retention_days', '14', 'How many daily backups to keep');
