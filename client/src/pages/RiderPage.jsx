import { useState } from 'react';
import { api } from '../api/client.js';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, EmptyState, ErrorState, PageHeader, Skeleton, StatCard, StatusBadge, Tabs } from '../components/UI.jsx';
import { formatMoney } from '../utils/format.js';

export default function RiderPage() {
  usePageTitle('My deliveries');
  const { user } = useAuth();
  const [tab, setTab] = useState('active');
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const path = tab === 'active' ? '/rider/deliveries' : `/rider/deliveries?status=${tab}`;
  const { data, loading, error: loadError, reload } = useFetch(path);

  const run = async (orderId, status, notes) => {
    setBusy(orderId);
    setNotice(null);
    setError(null);
    try {
      await api(`/rider/deliveries/${orderId}`, { method: 'PATCH', body: { status, notes } });
      setNotice(`Delivery updated to ${status.replace(/_/g, ' ')}.`);
      reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const fail = (delivery) => {
    const notes = window.prompt('Why could the delivery not be completed?');
    if (notes === null) return;
    run(delivery.order_id, 'failed', notes || undefined);
  };

  const items = data?.items || [];

  return (
    <>
      <PageHeader
        eyebrow={user?.pharmacy_name || 'Rider'}
        title="My deliveries"
        subtitle="Update each delivery as you pick it up, head out and hand it over. The customer is notified at every step."
        actions={<button type="button" className="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>}
      />

      <div className="stat-grid">
        <StatCard label="Active deliveries" value={tab === 'active' ? items.length : '—'} hint="Assigned to you" tone="info" icon="Delivery" />
        <StatCard label="Delivered" value={tab === 'delivered' ? items.length : '—'} hint="In this completed list" tone="success" icon="Check" />
      </div>

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error.message}</Alert>}

      <Tabs
        tabs={[
          { value: 'active', label: 'Active' },
          { value: 'delivered', label: 'Delivered' },
          { value: 'failed', label: 'Failed' },
        ]}
        active={tab}
        onChange={setTab}
        label="Delivery status"
      />

      {loadError && <ErrorState error={loadError} retry={reload} />}
      {loading && <Skeleton lines={6} />}

      {!loading && !loadError && items.length === 0 && (
        <EmptyState title={tab === 'active' ? 'No active deliveries' : 'Nothing here yet'}>
          {tab === 'active'
            ? 'When the pharmacy assigns you an order it will appear here with the customer address and phone number.'
            : 'Completed or failed deliveries appear here for your records.'}
        </EmptyState>
      )}

      {!loading && items.length > 0 && (
        <div className="stack">
          {items.map((delivery) => (
            <article className="card" key={delivery.order_id}>
              <div className="card-body">
                <div className="row between">
                  <div>
                    <div className="row">
                      <strong>{delivery.reference}</strong>
                      <Badge tone={delivery.status === 'delivered' ? 'success' : delivery.status === 'failed' ? 'danger' : 'info'}>
                        {delivery.status.replace(/_/g, ' ')}
                      </Badge>
                      <StatusBadge status={delivery.order_status} />
                    </div>
                    <p className="small muted mb-0 mt-1">{delivery.pharmacy_name} · {delivery.zone_name || 'Delivery zone'}</p>
                  </div>
                  <div className="text-right">
                    <div className="price">{formatMoney(delivery.total)}</div>
                    <div className="tiny muted">Collect on delivery</div>
                  </div>
                </div>

                <div className="definition-list mt-2">
                  <div><dt>Customer</dt><dd>{delivery.customer_name || 'Walk-in customer'}</dd></div>
                  <div><dt>Phone</dt><dd>{delivery.customer_phone ? <a href={`tel:${delivery.customer_phone}`}>{delivery.customer_phone}</a> : '—'}</dd></div>
                  <div><dt>Address</dt><dd>{delivery.delivery_address || '—'}</dd></div>
                  <div><dt>Digital address</dt><dd>{delivery.digital_address_code || '—'}</dd></div>
                  <div><dt>Pharmacy contact</dt><dd>{delivery.pharmacy_phone}</dd></div>
                </div>

                {tab === 'active' && (
                  <div className="row mt-2">
                    {delivery.status === 'assigned' && (
                      <button type="button" className="btn btn-secondary" disabled={busy === delivery.order_id} onClick={() => run(delivery.order_id, 'picked_up')}>
                        Mark picked up
                      </button>
                    )}
                    {['assigned', 'picked_up'].includes(delivery.status) && (
                      <button type="button" className="btn btn-primary" disabled={busy === delivery.order_id} onClick={() => run(delivery.order_id, 'out_for_delivery')}>
                        Start delivery
                      </button>
                    )}
                    <button type="button" className="btn btn-primary" disabled={busy === delivery.order_id} onClick={() => run(delivery.order_id, 'delivered')}>
                      Mark delivered
                    </button>
                    <button type="button" className="btn btn-ghost" disabled={busy === delivery.order_id} onClick={() => fail(delivery)}>
                      Could not deliver
                    </button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
