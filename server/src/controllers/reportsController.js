import * as reports from '../services/reportsService.js';

const respond = (res, report, format) => {
  if (format === 'pdf') return reports.streamPdf(res, report);
  return reports.streamCsv(res, report);
};

export const sales = (req, res) => respond(res, reports.salesReport(req.user, req.query), req.query.format);
export const stock = (req, res) => respond(res, reports.stockReport(req.user, req.query), req.query.format);
export const expiry = (req, res) => respond(res, reports.expiryReport(req.user, req.query), req.query.format);
export const orders = (req, res) => respond(res, reports.ordersReport(req.user, req.query), req.query.format);
export const receipt = (req, res) => reports.streamReceipt(res, req.params.id, req.user);
