import PDFDocument from 'pdfkit';
import * as reportsRepo from '../repositories/reports.js';
import * as ordersRepo from '../repositories/orders.js';
import { toCsv } from '../utils/csv.js';
import { badRequest, forbidden, notFound } from '../utils/http.js';
import { config } from '../config.js';
import { getDb } from '../db/index.js';

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
};

function scopedPharmacy(user, requested) {
  if (user.role === 'pharmacist') return user.pharmacy_id;
  return requested ? Number(requested) : null;
}

function range(query) {
  const from = query.from || monthStart();
  const to = query.to || today();
  if (from > to) throw badRequest('The start date must be before the end date.');
  return { from, to };
}

function money(value) {
  return `GHS ${Number(value || 0).toFixed(2)}`;
}

export function salesReport(user, query) {
  const { from, to } = range(query);
  const pharmacyId = scopedPharmacy(user, query.pharmacyId);
  const rows = reportsRepo.salesRows({ from, to, pharmacyId });
  const total = rows.filter((r) => r.status !== 'cancelled').reduce((sum, r) => sum + r.total, 0);
  return {
    filename: `sales-report-${from}-to-${to}.csv`,
    title: 'Sales report',
    subtitle: `Period ${from} to ${to}${pharmacyId ? ` · pharmacy #${pharmacyId}` : ' · all pharmacies'}`,
    summary: [`${rows.length} orders`, `Net sales ${money(total)}`],
    headers: [
      { label: 'Reference', key: 'reference' },
      { label: 'Date', key: 'date' },
      { label: 'Pharmacy', key: 'pharmacy' },
      { label: 'Community', key: 'community' },
      { label: 'Customer', key: 'customer' },
      { label: 'Channel', key: 'channel' },
      { label: 'Fulfilment', key: 'fulfilment' },
      { label: 'Status', key: 'status' },
      { label: 'Subtotal', key: 'subtotal', format: money },
      { label: 'Delivery', key: 'delivery_fee', format: money },
      { label: 'Total', key: 'total', format: money },
      { label: 'Payment', key: 'payment_status' },
    ],
    rows,
  };
}

export function stockReport(user, query) {
  const pharmacyId = scopedPharmacy(user, query.pharmacyId);
  const rows = reportsRepo.stockRows({ pharmacyId });
  const value = rows.reduce((sum, r) => sum + r.stock_value, 0);
  return {
    filename: `stock-report-${today()}.csv`,
    title: 'Stock report',
    subtitle: pharmacyId ? `Pharmacy #${pharmacyId} · ${today()}` : `All pharmacies · ${today()}`,
    summary: [`${rows.length} pharmacy-medicine rows`, `Stock value ${money(value)}`],
    headers: [
      { label: 'Pharmacy', key: 'pharmacy' },
      { label: 'Community', key: 'community' },
      { label: 'Brand', key: 'brand_name' },
      { label: 'Generic', key: 'generic_name' },
      { label: 'Strength', key: 'strength' },
      { label: 'Price', key: 'price', format: money },
      { label: 'Stock', key: 'stock' },
      { label: 'Reorder level', key: 'reorder_level' },
      { label: 'Stock value', key: 'stock_value', format: money },
    ],
    rows,
  };
}

export function expiryReport(user, query) {
  const pharmacyId = scopedPharmacy(user, query.pharmacyId);
  const days = Number(query.days) || config.expiryAlertDays;
  const rows = reportsRepo.expiryRows({ pharmacyId, days });
  return {
    filename: `expiry-report-${today()}.csv`,
    title: 'Expiry report',
    subtitle: `Batches expiring within ${days} days (including expired) · ${today()}`,
    summary: [`${rows.length} batches`, `${rows.filter((r) => r.state === 'EXPIRED').length} expired`],
    headers: [
      { label: 'Pharmacy', key: 'pharmacy' },
      { label: 'Community', key: 'community' },
      { label: 'Brand', key: 'brand_name' },
      { label: 'Generic', key: 'generic_name' },
      { label: 'Batch', key: 'batch_no' },
      { label: 'Supplier', key: 'supplier' },
      { label: 'Expiry', key: 'expiry_date' },
      { label: 'Days left', key: 'days_left' },
      { label: 'Quantity', key: 'quantity_on_hand' },
      { label: 'State', key: 'state' },
    ],
    rows,
  };
}

export function ordersReport(user, query) {
  const { from, to } = range(query);
  const pharmacyId = scopedPharmacy(user, query.pharmacyId);
  const rows = reportsRepo.ordersRows({ from, to, pharmacyId, status: query.status, channel: query.channel });
  return {
    filename: `orders-report-${from}-to-${to}.csv`,
    title: 'Orders report',
    subtitle: `Period ${from} to ${to}${query.status ? ` · status ${query.status}` : ''}`,
    summary: [`${rows.length} orders`],
    headers: [
      { label: 'Reference', key: 'reference' },
      { label: 'Date', key: 'date' },
      { label: 'Pharmacy', key: 'pharmacy' },
      { label: 'Customer', key: 'customer' },
      { label: 'Channel', key: 'channel' },
      { label: 'Fulfilment', key: 'fulfilment' },
      { label: 'Items', key: 'items' },
      { label: 'Status', key: 'status' },
      { label: 'Payment', key: 'payment_status' },
      { label: 'Total', key: 'total', format: money },
    ],
    rows,
  };
}

export function streamCsv(res, report) {
  const csv = toCsv(report.headers, report.rows);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
  res.send(csv);
}

function cellValue(header, row) {
  const value = typeof header.value === 'function' ? header.value(row) : row[header.key];
  return header.format ? header.format(value) : value ?? '';
}

export function streamPdf(res, report) {
  const landscape = report.headers.length > 6;
  const doc = new PDFDocument({ margin: 32, size: 'A4', layout: landscape ? 'landscape' : 'portrait' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${report.filename.replace(/\.csv$/, '.pdf')}"`
  );
  doc.pipe(res);

  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colWidth = width / report.headers.length;
  const rowHeight = 16;
  const bottom = () => doc.page.height - doc.page.margins.bottom - 24;

  const drawHeader = () => {
    doc.fillColor('#0f5132').fontSize(16).text('PharmaLink', { continued: true });
    doc.fillColor('#475569').fontSize(9).text('   Data-Driven Integrated Pharmacy and Customer Order System');
    doc.moveDown(0.3);
    doc.fillColor('#0f172a').fontSize(14).text(report.title);
    doc.fillColor('#475569').fontSize(8).text(report.subtitle);
    if (report.summary?.length) {
      doc.fillColor('#334155').fontSize(8).text(report.summary.join('   ·   '));
    }
    doc.moveDown(0.6);
    const top = doc.y;
    doc.rect(doc.page.margins.left, top, width, rowHeight).fill('#0f766e');
    doc.fillColor('#ffffff').fontSize(7.2);
    report.headers.forEach((h, i) => {
      doc.text(String(h.label), doc.page.margins.left + i * colWidth + 3, top + 4, {
        width: colWidth - 6,
        height: rowHeight - 4,
        ellipsis: true,
        lineBreak: false,
      });
    });
    doc.y = top + rowHeight;
    doc.fillColor('#0f172a');
  };

  drawHeader();
  report.rows.forEach((row, index) => {
    if (doc.y + rowHeight > bottom()) {
      doc.addPage();
      drawHeader();
    }
    const y = doc.y;
    if (index % 2 === 1) doc.rect(doc.page.margins.left, y, width, rowHeight).fill('#f0fdf4');
    doc.fillColor('#0f172a').fontSize(7);
    report.headers.forEach((header, i) => {
      const text = String(cellValue(header, row) ?? '');
      doc.text(text, doc.page.margins.left + i * colWidth + 3, y + 4, {
        width: colWidth - 6,
        height: rowHeight - 3,
        ellipsis: true,
        lineBreak: false,
      });
    });
    doc.y = y + rowHeight;
  });

  doc.moveDown(1);
  doc
    .fillColor('#64748b')
    .fontSize(7)
    .text(
      `Generated ${new Date().toISOString()} · This report supports, and does not replace, the professional judgement of a pharmacist.`
    );
  doc.end();
}

export function streamReceipt(res, orderId, user) {
  const order = reportsRepo.ordersForReceipt(orderId);
  if (!order) throw notFound('Order not found.');
  const raw = ordersRepo.findRaw(orderId);
  if (!ordersRepo.canUserAccessOrder(raw, user)) throw forbidden();
  const items = ordersRepo.items(orderId);
  const payments = ordersRepo.payments(orderId);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="receipt-${order.reference}.pdf"`);
  const doc = new PDFDocument({ margin: 48, size: 'A6' });
  doc.pipe(res);

  doc.fillColor('#0f5132').fontSize(16).text(order.pharmacy_name, { align: 'center' });
  doc.fillColor('#475569').fontSize(8).text(order.pharmacy_address || '', { align: 'center' });
  doc.text(`Tel: ${order.pharmacy_phone || ''}`, { align: 'center' });
  doc.moveDown();
  doc.fillColor('#0f172a').fontSize(12).text('Sales receipt', { align: 'center' });
  doc.fontSize(8).text(`Reference: ${order.reference}`);
  doc.text(`Date: ${order.created_at}`);
  doc.text(`Customer: ${order.customer_name || 'Walk-in customer'}`);
  doc.text(`Fulfilment: ${order.fulfilment}`);
  doc.text(`Payment: ${payments[0]?.method || 'cash'} (${payments[0]?.status || 'recorded'})`);
  doc.moveDown();
  doc.fontSize(9).fillColor('#0f766e').text('Items');
  doc.fillColor('#0f172a').fontSize(8);
  for (const item of items) {
    doc.text(`${item.medicine_name_snapshot}  x${item.quantity}`, { continued: true });
    doc.text(money(item.unit_price * item.quantity), { align: 'right' });
  }
  doc.moveDown(0.5);
  doc.text('Subtotal', { continued: true }).text(money(order.subtotal), { align: 'right' });
  doc.text('Delivery fee', { continued: true }).text(money(order.delivery_fee), { align: 'right' });
  doc.fontSize(10).text('TOTAL', { continued: true }).text(money(order.total), { align: 'right' });
  doc.moveDown();
  doc
    .fillColor('#64748b')
    .fontSize(7)
    .text(
      'This receipt supports the pharmacist\'s professional role and does not replace pharmacist advice. Keep medicines out of reach of children.',
      { align: 'center' }
    );
  doc.end();
}

export function logReportExport() {
  // Reports are read-only exports; the audit trail records the user by default
  // through API access logs. Kept as a hook for future report-specific auditing.
  return getDb().prepare('SELECT date(\'now\') AS today').get().today;
}
