import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { EmptyState, ErrorState, Loading, statusText } from '../../components/UI.jsx';
import { formatMoney } from '../../utils/format.js';

export default function DeliveriesPage() {
  usePageTitle('Deliveries');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const query = isAdmin ? `?pharmacyId=${pharmacyId}` : '';
  const deliveries = useFetch(`/deliveries${query}`, [pharmacyId]);
  const riders = useFetch(`/riders${query}`, [pharmacyId]);
  const [choice, setChoice] = useState({});
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const run = async (key, fn, message) => {
    setBusy(key);
    setNotice('');
    setError('');
    try {
      await fn();
      setNotice(message);
      await deliveries.reload();
    } catch (err) {
      setError(err.message || 'Could not update the delivery.');
    } finally {
      setBusy(null);
    }
  };

  const assign = (delivery) => {
    const riderId = Number(choice[delivery.order_id] || delivery.rider_id || riders.data?.items?.[0]?.id);
    if (!riderId) {
      setError('No active rider is available.');
      return;
    }
    run(
      `assign-${delivery.order_id}`,
      () => api(`/orders/${delivery.order_id}/assign-rider`, { method: 'POST', body: { riderId } }),
      `Rider assigned to ${delivery.reference}.`
    );
  };

  const dispatch = (delivery) =>
    run(
      `dispatch-${delivery.order_id}`,
      () =>
        api(`/orders/${delivery.order_id}/status`, {
          method: 'PATCH',
          body: { status: 'out_for_delivery' },
        }),
      `${delivery.reference} dispatched.`
    );

  const complete = (delivery) =>
    run(
      `complete-${delivery.order_id}`,
      () =>
        api(`/orders/${delivery.order_id}/status`, {
          method: 'PATCH',
          body: { status: 'completed' },
        }),
      `${delivery.reference} completed.`
    );

  const items = deliveries.data?.items || [];
  const riderList = riders.data?.items || [];

  return (
    <>
      <h1 className="page-heading">Deliveries</h1>

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <p className="success-text">{notice}</p>}
      {error && <p className="error-text">{error}</p>}

      {deliveries.error && <ErrorState error={deliveries.error} retry={deliveries.reload} />}
      {deliveries.loading && <Loading />}

      {!deliveries.loading && !deliveries.error && items.length === 0 && (
        <EmptyState title="No deliveries">Delivery orders will appear here.</EmptyState>
      )}

      {!deliveries.loading && items.length > 0 && (
        <ul className="delivery-list">
          {items.map((delivery) => (
            <li className="delivery-card" key={delivery.order_id}>
              <div className="delivery-head">
                <Link to={`/orders/${delivery.order_id}`}>
                  <strong>{delivery.reference}</strong>
                </Link>
                <span className="small muted">
                  {statusText(delivery.status)} · {formatMoney(delivery.total)}
                </span>
              </div>
              <p className="small">
                {delivery.customer_name} · {delivery.customer_phone}
              </p>
              <p className="small muted">
                {delivery.delivery_address}
                {delivery.digital_address_code ? ` (${delivery.digital_address_code})` : ''}
              </p>
              <p className="small muted">Rider: {delivery.rider_name || 'Not assigned'}</p>

              <div className="delivery-actions">
                {riderList.length > 0 && (
                  <>
                    <label className="sr-only" htmlFor={`rider-${delivery.order_id}`}>
                      Choose a rider
                    </label>
                    <select
                      id={`rider-${delivery.order_id}`}
                      value={choice[delivery.order_id] ?? delivery.rider_id ?? ''}
                      onChange={(event) =>
                        setChoice((current) => ({ ...current, [delivery.order_id]: event.target.value }))
                      }
                    >
                      <option value="">Choose a rider</option>
                      {riderList.map((rider) => (
                        <option key={rider.id} value={rider.id}>
                          {rider.full_name} · {rider.phone}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busy === `assign-${delivery.order_id}`}
                      onClick={() => assign(delivery)}
                    >
                      {delivery.rider_id ? 'Reassign' : 'Assign'}
                    </button>
                  </>
                )}
                {delivery.rider_id && ['assigned', 'picked_up'].includes(delivery.status) && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy === `dispatch-${delivery.order_id}`}
                    onClick={() => dispatch(delivery)}
                  >
                    Dispatch
                  </button>
                )}
                {['assigned', 'picked_up', 'out_for_delivery'].includes(delivery.status) && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy === `complete-${delivery.order_id}`}
                    onClick={() => complete(delivery)}
                  >
                    Mark delivered
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
