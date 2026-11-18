import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { DataTable, ErrorState, Loading, Pagination, StatusBadge } from '../../components/UI.jsx';
import { formatMoney } from '../../utils/format.js';

const STATUSES = [
  ['', 'All'],
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
  usePageTitle('Orders');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const status = params.get('status') || '';
  const page = params.get('page') || '1';
  const [term, setTerm] = useState(q);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const query = new URLSearchParams({ page, pageSize: '20' });
  if (q) query.set('q', q);
  if (status) query.set('status', status);
  if (isAdmin) query.set('pharmacyId', pharmacyId);
  const { data, loading, error, reload } = useFetch(`/orders?${query.toString()}`, [pharmacyId]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, String(value));
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const run = async (key, fn, message) => {
    setBusy(key);
    setNotice('');
    setActionError('');
    try {
      await fn();
      setNotice(message);
      await reload();
    } catch (err) {
      setActionError(err.message || 'Could not update the order.');
    } finally {
      setBusy(null);
    }
  };

  const move = (order, nextStatus) =>
    run(
      `status-${order.id}`,
      () => api(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: nextStatus } }),
      `${order.reference} moved to ${nextStatus.replace(/_/g, ' ')}.`
    );

  const cancel = (order) => {
    const reason = window.prompt(`Cancel ${order.reference}? Reason (optional).`);
    if (reason === null) return;
    run(
      `cancel-${order.id}`,
      () =>
        api(`/orders/${order.id}/status`, {
          method: 'PATCH',
          body: { status: 'cancelled', note: reason || undefined },
        }),
      `${order.reference} cancelled.`
    );
  };

  const items = data?.items || [];

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Orders</h1>
          <p>{items.length} shown</p>
        </div>
      </div>

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <p className="success-text">{notice}</p>}
      {actionError && <p className="error-text">{actionError}</p>}

      <div className="toolbar">
        <form className="toolbar-search" role="search" onSubmit={(event) => { event.preventDefault(); update('q', term.trim()); }}>
          <label className="sr-only" htmlFor="order-q">
            Search orders
          </label>
          <input
            id="order-q"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Reference, customer or phone"
          />
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
        <select
          aria-label="Filter by status"
          value={status}
          onChange={(event) => update('status', event.target.value)}
        >
          {STATUSES.map(([value, label]) => (
            <option key={value || 'all'} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {error && <ErrorState error={error} retry={reload} />}
      {loading && <Loading />}

      {!loading && !error && (
        <>
          <DataTable
            rows={items}
            empty="No orders match these filters."
            columns={[
              {
                key: 'reference',
                label: 'Order',
                render: (order) => (
                  <>
                    <Link to={`/orders/${order.id}`}>
                      <strong>{order.reference}</strong>
                    </Link>
                    {order.pending_prescriptions > 0 && <div className="small muted">Rx pending</div>}
                  </>
                ),
              },
              {
                key: 'customer',
                label: 'Customer',
                render: (order) => (
                  <>
                    {order.customer_name || 'Walk-in'}
                    <div className="small muted">{order.customer_phone}</div>
                  </>
                ),
              },
              { key: 'status', label: 'Status', render: (order) => <StatusBadge status={order.status} /> },
              {
                key: 'total',
                label: 'Total',
                align: 'right',
                render: (order) => formatMoney(order.total),
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (order) => (
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
                    {order.status === 'awaiting_prescription' && (
                      <Link to="/staff/prescriptions" className="btn btn-secondary btn-sm">
                        Prescriptions
                      </Link>
                    )}
                    {!['completed', 'cancelled'].includes(order.status) && (
                      <button
                        type="button"
                        className="link"
                        disabled={busy === `cancel-${order.id}`}
                        onClick={() => cancel(order)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                ),
              },
            ]}
          />
          <Pagination pagination={data?.pagination} onPage={(next) => update('page', next)} />
        </>
      )}
    </>
  );
}
