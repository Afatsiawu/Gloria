import { useState } from 'react';
import { api } from '../api/client.js';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, Badge, EmptyState, ErrorState, PageTitle, StatusBadge, Tabs } from '../components/UI.jsx';
import { formatMoney } from '../utils/format.js';

const NEXT = {
  assigned: { status: 'picked_up', label: 'Mark picked up' },
  picked_up: { status: 'out_for_delivery', label: 'Start delivery' },
  out_for_delivery: { status: 'delivered', label: 'Mark delivered' },
};

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
      <PageTitle
        title="My deliveries"
        subtitle={user?.pharmacy_name || 'Update each delivery as you go.'}
      />

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

      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error.message}</Alert>}
      {loadError && <ErrorState error={loadError} retry={reload} />}
      {loading && <p className="loading">Loading…</p>}

      {!loading && !loadError && items.length === 0 && (
        <EmptyState title={tab === 'active' ? 'No active deliveries' : 'Nothing here yet'}>
          {tab === 'active'
            ? 'Assigned deliveries appear here with the customer address and phone number.'
            : 'Completed or failed deliveries are kept here.'}
        </EmptyState>
      )}

      {!loading && items.map((delivery) => {
        const next = NEXT[delivery.status];
        return (
          <article className="delivery-card" key={delivery.order_id}>
            <div className="row between">
              <h2 className="mb-0">{delivery.reference}</h2>
              <div className="row">
                <Badge tone={delivery.status === 'delivered' ? 'success' : delivery.status === 'failed' ? 'danger' : 'info'}>
                  {delivery.status.replace(/_/g, ' ')}
                </Badge>
                {delivery.order_status !== delivery.status && <StatusBadge status={delivery.order_status} />}
              </div>
            </div>
            <p className="addr">{delivery.delivery_address || 'No address recorded'}</p>
            {delivery.digital_address_code && <p className="small muted mb-0">{delivery.digital_address_code}</p>}
            <p className="small mb-0">
              {delivery.zone_name || 'Delivery zone'} · {formatMoney(delivery.total)} to collect
            </p>
            {delivery.customer_phone ? (
              <p className="phone mb-0"><a href={`tel:${delivery.customer_phone}`}>{delivery.customer_phone}</a></p>
            ) : (
              <p className="small muted mb-0">{delivery.customer_name || 'Customer phone not available'}</p>
            )}

            {tab === 'active' && next && delivery.order_status !== 'cancelled' && (
              <div className="actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy === delivery.order_id}
                  onClick={() => run(delivery.order_id, next.status)}
                >
                  {busy === delivery.order_id ? 'Please wait…' : next.label}
                </button>
              </div>
            )}

            {tab === 'active' && delivery.order_status !== 'cancelled' && (
              <details className="details-block">
                <summary>Problem with this delivery</summary>
                <button type="button" className="link" disabled={busy === delivery.order_id} onClick={() => fail(delivery)}>
                  Report as not delivered
                </button>
              </details>
            )}
          </article>
        );
      })}
    </>
  );
}
