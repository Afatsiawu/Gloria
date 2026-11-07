import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { Alert, Badge, EmptyState, ErrorState, PageHeader, Skeleton, statusText } from '../../components/UI.jsx';
import { formatMoney } from '../../utils/format.js';

export default function DeliveriesPage() {
  usePageTitle('Deliveries');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const query = isAdmin ? `?pharmacyId=${pharmacyId}` : '';
  const deliveries = useFetch(`/deliveries${query}`);
  const riders = useFetch(`/riders${query}`);
  const [choice, setChoice] = useState({});
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const run = async (key, fn, message) => {
    setBusy(key);
    setNotice(null);
    setError(null);
    try {
      await fn();
      setNotice(message);
      deliveries.reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  const assign = (delivery) => {
    const riderId = Number(choice[delivery.order_id] || riders.data?.items?.[0]?.id);
    if (!riderId) {
      setError(new Error('No active rider is available for this pharmacy.'));
      return;
    }
    run(`assign-${delivery.order_id}`, () => api(`/orders/${delivery.order_id}/assign-rider`, {
      method: 'POST',
      body: { riderId },
    }), `Rider assigned to order ${delivery.reference}.`);
  };

  const dispatch = (delivery) =>
    run(`dispatch-${delivery.order_id}`, () => api(`/orders/${delivery.order_id}/status`, {
      method: 'PATCH',
      body: { status: 'out_for_delivery' },
    }), `Order ${delivery.reference} dispatched.`);

  const complete = (delivery) =>
    run(`complete-${delivery.order_id}`, () => api(`/orders/${delivery.order_id}/status`, {
      method: 'PATCH',
      body: { status: 'completed' },
    }), `Order ${delivery.reference} completed.`);

  const items = deliveries.data?.items || [];
  const riderList = riders.data?.items || [];

  return (
    <>
      <PageHeader
        eyebrow="Fulfilment"
        title="Deliveries"
        subtitle="Assign riders to delivery orders, dispatch them and confirm completed deliveries."
        actions={<button type="button" className="btn btn-ghost btn-sm" onClick={() => { deliveries.reload(); riders.reload(); }}>Refresh</button>}
      />

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && <Alert tone="error">{error.message}</Alert>}

      {deliveries.error && <ErrorState error={deliveries.error} retry={deliveries.reload} />}
      {deliveries.loading && <Skeleton lines={5} />}

      {!deliveries.loading && !deliveries.error && items.length === 0 && (
        <EmptyState title="No delivery orders">Delivery orders will appear here when customers choose community delivery.</EmptyState>
      )}

      {!deliveries.loading && items.length > 0 && (
        <div className="stack">
          {items.map((delivery) => (
            <article className="card" key={delivery.order_id}>
              <div className="card-body">
                <div className="row between">
                  <div>
                    <div className="row">
                      <Link to={`/orders/${delivery.order_id}`}><strong>{delivery.reference}</strong></Link>
                      <Badge tone={delivery.status === 'delivered' ? 'success' : delivery.status === 'failed' ? 'danger' : 'info'}>{statusText(delivery.status)}</Badge>
                      <Badge tone="neutral">{statusText(delivery.order_status)}</Badge>
                    </div>
                    <p className="small muted mb-0 mt-1">
                      {delivery.customer_name} · {delivery.customer_phone} · {delivery.zone_name || 'Zone not recorded'}
                    </p>
                    <p className="small mb-0">{delivery.delivery_address} {delivery.digital_address_code ? `(${delivery.digital_address_code})` : ''}</p>
                    <p className="small mb-0"><strong>Rider:</strong> {delivery.rider_name || 'Not assigned'}{delivery.rider_name ? ` · ${delivery.rider_phone || ''}` : ''}</p>
                  </div>
                  <div className="text-right">
                    <div className="price">{formatMoney(delivery.total)}</div>
                    <div className="tiny muted">Total order value</div>
                  </div>
                </div>
                <div className="row mt-2">
                  {riderList.length > 0 ? (
                    <>
                      <label className="sr-only" htmlFor={`rider-${delivery.order_id}`}>Choose a rider</label>
                      <select
                        id={`rider-${delivery.order_id}`}
                        value={choice[delivery.order_id] ?? delivery.rider_id ?? ''}
                        onChange={(event) => setChoice((current) => ({ ...current, [delivery.order_id]: event.target.value }))}
                      >
                        <option value="">Choose a rider</option>
                        {riderList.map((rider) => (
                          <option key={rider.id} value={rider.id}>{rider.full_name} · {rider.phone}</option>
                        ))}
                      </select>
                      <button type="button" className="btn btn-secondary btn-sm" disabled={busy === `assign-${delivery.order_id}`} onClick={() => assign(delivery)}>
                        {delivery.rider_id ? 'Reassign' : 'Assign rider'}
                      </button>
                    </>
                  ) : (
                    <span className="small muted">No active riders for this pharmacy.</span>
                  )}
                  {delivery.rider_id && ['assigned', 'picked_up'].includes(delivery.status) && (
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy === `dispatch-${delivery.order_id}`} onClick={() => dispatch(delivery)}>
                      Dispatch
                    </button>
                  )}
                  {['assigned', 'picked_up', 'out_for_delivery'].includes(delivery.status) && (
                    <button type="button" className="btn btn-secondary btn-sm" disabled={busy === `complete-${delivery.order_id}`} onClick={() => complete(delivery)}>
                      Mark delivered
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
