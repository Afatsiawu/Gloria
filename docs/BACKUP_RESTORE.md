# Backup & Restore

## What is backed up

- The SQLite database file: `server/data/pharmacy.db` (with WAL side files `server/data/pharmacy.db-wm`/`-wal`/`-shm` while running).
- Prescription uploads live under `server/uploads/prescriptions/` (git-ignored).

## Automatic backup

- Scheduled via `node-cron`: `BACKUP_CRON` (default `0 2 * * *` — 02:00 daily).
- Retention: `BACKUP_RETENTION_DAYS` (default 14 days). Older backups are pruned.
- Trigger manual backup: `POST /api/admin/backups` (admin).

## Manual backup procedure

1. Ensure the API is stopped or in a quiescent state (`server` shutdown closes DB cleanly).
2. Copy `server/data/pharmacy.db` (+ `-wal` if present) to the backup location configured in the backup service.
3. Optionally copy `server/uploads/` for prescription files.
4. Record the backup timestamp and retention settings.

## Restore procedure

1. Stop the server.
2. Replace `server/data/pharmacy.db` with the chosen backup file (including WAL side files as per SQLite requirements).
3. Restart the server; migrations run idempotently; the app validates the schema.
4. Re-apply prescription uploads if they were part of the backup.
5. Verify: `GET /api/health` and a smoke login.

## Restore in tests / ephemeral environments

- Tests use an isolated in-memory SQLite database; no file restore needed.
- Backup service supports in-memory DB mode (`{ file: null, message: 'In-memory database is not backed up.' }`).

## Disaster recovery checklist

- [ ] Backup schedule enabled (`ENABLE_CRON=true`, `BACKUP_CRON`).
- [ ] Backup retention configured.
- [ ] `JWT_SECRET` rotated post-restore.
- [ ] Prescription file directory present.
