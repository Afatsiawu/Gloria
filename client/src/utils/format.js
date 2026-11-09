export const formatMoney = (value) => `GHS ${Number(value || 0).toFixed(2)}`;

export const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-GH', { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-GH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const titleCase = (value = '') =>
  String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const ORDER_STATUS_LABELS = {
  placed: 'Placed',
  awaiting_prescription: 'Awaiting prescription',
  verified: 'Verified',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const statusLabel = (status) => ORDER_STATUS_LABELS[status] || titleCase(status);

export const statusTone = (status) => {
  if (['completed', 'approved', 'success', 'ready', 'delivered', 'sent', 'active'].includes(status)) return 'success';
  if (['cancelled', 'rejected', 'failed', 'expired', 'suspended'].includes(status)) return 'danger';
  if (['awaiting_prescription', 'pending', 'queried', 'expiring', 'low'].includes(status)) return 'warning';
  if (['verified'].includes(status)) return 'primary';
  if (['placed', 'out_for_delivery', 'picked_up', 'cash_on_pickup', 'assigned'].includes(status)) return 'info';
  return 'neutral';
};

export const paymentLabel = (status) =>
  ({
    pending: 'Payment pending',
    success: 'Paid',
    cash_on_pickup: 'Cash on pickup/delivery',
    failed: 'Payment failed',
  })[status] || titleCase(status);
