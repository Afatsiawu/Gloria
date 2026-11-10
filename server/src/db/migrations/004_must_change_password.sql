-- Staff accounts created by an administrator can be forced to choose a new
-- password before using any other page.

ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0
  CHECK (must_change_password IN (0, 1));
