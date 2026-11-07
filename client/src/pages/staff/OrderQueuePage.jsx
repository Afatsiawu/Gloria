import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import {
  Alert,
  Badge,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
  StatusBadge,
} from '../../components/UI.jsx';
import { formatDateTime, formatMoney, paymentLabel } from '../../utils/format.js';

const STATUSES = [
  ['', 'All open and closed'],
  ['placed', 'Placed'],
  ['awaiting_prescription', 'Awaiting prescription'],
  ['verified', 'Verified'],
  ['ready', 'Ready'],
  ['out_for_delivery', 'Out for delivery'],
  ['completed', 'Completed'],
  ['cancelled', 'Cancelled'],
];

const NEXT = {
  placed: [{ status: 'verified', label: 'Verify' }],
  verified: [{ status: 'ready', label: 'Mark ready' }],
  ready: [{ status: 'completed', label: 'Complete' }],
  out_for_delivery: [{ status: 'completed', label: 'Complete' }],
};

export default function OrderQueuePage() {
  usePageTitle('Order queue');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState(params.get('status') || '');
  const [channel, setChannel] = useState(params.get('channel') || '');
  const page = params.get('page') || '1';
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);

  const query = new URLSearchParams({ page, pageSize: '20' });
  if (q) query.set('q', q);
  if (status) query.set('status', status);
  if (channel) query.set('channel', channel);
  if (isAdmin) query.set('pharmacyId', pharmacyId);
  const { data, loading, error, reload } = useFetch(`/orders?${query.toString()}`);

  const syncParams = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value) next.set(key, String(value));
      else next.delete(key);
    });
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: true });
  };

  const run = async (key, fn, message) => {
    setBusy(key);
    setNotice(null);
    setActionError(null);
    try {
      await fn();
      setNotice(message);
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
    }
  };

  const move = (order, nextStatus) =>
    run(`status-${order.id}`, () =>
      api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: nextStatus } }),
      `${order.reference} moved to ${nextStatus.replace(/_/g, ' ')}.`
    );

  const cancel = (order) => {
    const reason = window.prompt(`Cancel ${order.reference}? Enter a reason (optional).`);
    if (reason === null) return;
    run(`cancel-${order.id}`, () => api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: 'cancelled', note: reason || undefined } }), `${order.reference} cancelled.`);
  };

  const items = data?.items || [];

  return (
    <>
      <PageHeader
        eyebrow="Fulfilment"
        title="Order queue"
        subtitle="Verify, pick, dispatch and complete orders. Prescription-only items cannot be verified until a pharmacist approves the prescription."
        actions={<button type="button" className="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>}
      />

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert tone="error">{actionError.message}</Alert>}

      <div className="card mb-2">
        <div className="card-body">
          <form
            className="form-grid"
            onSubmit={(event) => { event.preventDefault(); syncParams({ q, status, channel }); }}
          >
            <div className="field">
              <label htmlFor="order-q">Search</label>
              <input id="order-q" value={q} onChange={(event) => setQ(event.target.value)} placeholder="Reference, customer or phone" />
            </div>
            <div className="field">
              <label htmlFor="order-status">Status</label>
              <select id="order-status" value={status} onChange={(event) => { setStatus(event.target.value); syncParams({ status: event.target.value, channel, q }); }}>
                {STATUSES.map(([value, label]) => <option key={value || 'all'} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="field">
              <label htmlFor="order-channel">Channel</label>
              <select id="order-channel" value={channel} onChange={(event) => { setChannel(event.target.value); syncParams({ channel: event.target.value, status, q }); }}>
                <option value="">All channels</option>
                <option value="online">Online</option>
                <option value="walk_in">Walk-in</option>
              </select>
            </div>
            <div className="field">
              <label>&nbsp;</label>
              <button type="submit" className="btn btn-primary">Apply filters</button>
            </div>
          </form>
        </div>
      </div>

      {error && <ErrorState error={error} retry={reload} />}
      {loading && <Skeleton lines={8} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState title="No orders match these filters">
          Try clearing the search or choosing a different status.
        </EmptyState>
      )}

      {!loading && !error && items.length > 0 && (
        <>
          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Fulfilment</th>
                  <th className="text-right">Total</th>
                  <th>Placed</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/orders/${order.id}`}><strong>{order.reference}</strong></Link>
                      {order.pending_prescriptions > 0 && <div className="tiny tone-warning">Rx pending</div>}
                    </td>
                    <td>
                      {order.customer_name || 'Walk-in'}
                      <div className="tiny muted">{order.customer_phone}</div>
                    </td>
                    <td><StatusBadge status={order.status} /></td>
                    <td>
                      <Badge tone={order.payment_status === 'success' ? 'success' : order.payment_status === 'failed' ? 'danger' : 'warning'}>
                        {paymentLabel(order.payment_status)}
                      </Badge>
                    </td>
                    <td className="small">
                      {order.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}
                      {order.rider_name && <div className="tiny muted">{order.rider_name}</div>}
                    </td>
                    <td className="text-right nowrap">{formatMoney(order.total)}</td>
                    <td className="small muted nowrap">{formatDateTime(order.created_at)}</td>
                    <td>
                      <div className="table-actions">
                        {(NEXT[order.status] || []).map((action) => (
                          <button
                            key={action.status}
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={busy === `status-${order.id}`}
                            onClick={() => move(order, action.status)}
                          >
                            {action.label}
                          </button>
                        ))}
                        {order.status === 'ready' && order.fulfilment === 'delivery' && (
                          <Link to="/staff/deliveries" className="btn btn-secondary btn-sm">Dispatch</Link>
                        )}
                        {order.status === 'awaiting_prescription' && (
                          <Link to="/staff/prescriptions" className="btn btn-secondary btn-sm">Prescriptions</Link>
                        )}
                        {!['completed', 'cancelled'].includes(order.status) && (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={busy === `cancel-${order.id}`}
                            onClick={() => cancel(order)}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={data.pagination} onPage={(next) => syncParams({ page: next })} />
        </>
      )}
    </>
  );
}
