import { listAudit } from '../repositories/audit.js';
import * as settingsService from '../services/settingsService.js';
import * as backupService from '../services/backupService.js';
import * as userService from '../services/userService.js';
import * as notificationService from '../services/notificationService.js';
import * as cronJobs from '../services/cronJobs.js';
import * as refillService from '../services/refillService.js';
import { pagination } from '../utils/pagination.js';
import { asyncHandler } from '../utils/http.js';

export const settings = (_req, res) => res.json(settingsService.getSettings());
export const updateSettings = (req, res) => res.json(settingsService.updateSettings(req.user, req.body));

export const audit = (req, res) => {
  const { page, pageSize, offset } = pagination(req.query);
  const result = listAudit({ ...req.query, page, pageSize, offset });
  res.json({
    items: result.items,
    pagination: { page, pageSize, total: result.total, totalPages: Math.max(1, Math.ceil(result.total / pageSize)) },
  });
};

export const backups = (_req, res) => res.json({ items: backupService.listBackups() });
export const backupNow = asyncHandler(async (_req, res) => {
  res.status(201).json({ backup: await backupService.createBackup() });
});

export const dataRequests = (_req, res) => res.json({ items: userService.dataRequests() });
export const processDataRequest = (req, res) => {
  res.json({ request: userService.processDataRequest(req.params.id, req.user.id, req.ip) });
};

export const outbox = (req, res) => {
  res.json({ items: notificationService.outbox({ channel: req.query.channel, pageSize: 200 }) });
};
export const runAlerts = asyncHandler(async (_req, res) => {
  res.json({ sent: await cronJobs.runStockAlerts() });
});
export const runRefills = asyncHandler(async (_req, res) => {
  res.json({ sent: await refillService.runDueReminders() });
});
