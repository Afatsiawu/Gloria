import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, download, openProtectedFile } from '../api/client.js';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import Timeline from '../components/Timeline.jsx';
import {
  Alert,
  Badge,
  DefinitionList,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
} from '../components/UI.jsx';
import { formatDateTime, formatMoney, paymentLabel } from '../utils/format.js';

export default function OrderTrackingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(`/orders/${id}`);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [uploading, setUploading] = useState(false);

  usePageTitle(data?.order?.reference ? `Order ${data.order.reference}` : 'Order');

  if (loading) return <Skeleton lines={10} />;
  if (error) return <ErrorState error={error} retry={reload} />;
  if (!data?.order) return null;

  const order = data.order;
  const isCustomer = user?.role === 'customer' && order.customer_id === user.id;
  const pendingPayment = order.payments?.find((payment) => payment.status === 'pending');
  const approvedPrescription = order.prescriptions?.some((prescription) => prescription.status === 'approved');
  const openPrescription = order.prescriptions?.find((prescription) => ['pending', 'queried'].includes(prescription.status));
  const canUpload = isCustomer && order.items?.some((item) => item.requires_prescription) && !approvedPrescription && !openPrescription && !['cancelled', 'completed'].includes(order.status);

  const run = async (key, fn, successMessage) => {
    setBusy(key);
    setNotice(null);
    setActionError(null);
    try {
      await fn();
      setNotice(successMessage || 'Done.');
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
    }
  };

  const verifyPayment = () =>
    run('verify', async () => {
      const payments = await api(`/payments/order/${order.id}`);
      const pending = payments.items.find((payment) => payment.status === 'pending');
      if (!pending) throw new Error('There is no pending payment for this order.');
      await api(`/payments/${pending.id}/verify`, { method: 'POST' });
    }, 'Payment status checked.');

  const cancel = () => {
    const reason = window.prompt('Why are you cancelling this order? (optional)') ?? '';
    if (reason === null) return;
    run('cancel', () => api(`/orders/${order.id}/cancel`, { method: 'POST', body: { reason } }), 'Order cancelled and stock released.');
  };

  const reorder = () =>
    run('reorder', async () => {
      const result = await api(`/orders/${order.id}/reorder`, { method: 'POST' });
      navigate('/cart');
      return result;
    });

  const uploadPrescription = async (event) => {
    event.preventDefault();
    const file = event.target.elements.prescription.files?.[0];
    if (!file) return;
    setUploading(true);
    setActionError(null);
    setNotice(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api(`/orders/${order.id}/prescriptions`, { method: 'POST', formData });
      setNotice('Prescription uploaded. A pharmacist will review it.');
      event.target.reset();
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="mb-2 small">
        <Link to="/orders">← All orders</Link>
      </div>
      <PageHeader
        eyebrow={order.pharmacy_name}
        title={`Order ${order.reference}`}
        subtitle={`Placed ${formatDateTime(order.created_at)} · ${order.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}`}
        actions={
          <div className="row">
            <StatusBadge status={order.status} />
            <Badge tone={order.payment_status === 'success' ? 'success' : order.payment_status === 'failed' ? 'danger' : 'warning'}>
              {paymentLabel(order.payment_status)}
            </Badge>
          </div>
        }
      />

      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <Alert tone="error">{actionError.message || 'That action could not be completed.'}</Alert>}

      <div className="detail-grid">
        <div className="stack">
          <section className="card">
            <div className="card-header"><h2>Progress</h2></div>
            <div className="card-body">
              <Timeline order={order} />
              {order.status === 'cancelled' && (
                <p className="small muted mb-0">This order was cancelled. Any reserved stock has been released.</p>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card-header"><h2>Items</h2></div>
            <div className="card-body">
              <div className="receipt-lines">
                {order.items?.map((item) => (
                  <div key={item.id}>
                    <span>
                      {item.quantity} × {item.medicine_name_snapshot || item.brand_name}
                      {item.requires_prescription ? ' (Rx)' : ''}
                    </span>
                    <span>{formatMoney(item.quantity * item.unit_price)}</span>
                  </div>
                ))}
              </div>
              <div className="summary-row mt-2">
                <span>Subtotal</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
              <div className="summary-row">
                <span>Delivery {order.delivery_zone_name ? `(${order.delivery_zone_name})` : ''}</span>
                <span>{formatMoney(order.delivery_fee)}</span>
              </div>
              <div className="summary-row total">
                <span>Total</span>
                <span>{formatMoney(order.total)}</span>
              </div>
              {order.notes && <p className="small muted mt-2 mb-0"><strong>Notes:</strong> {order.notes}</p>}
            </div>
          </section>

          {order.items?.some((item) => item.requires_prescription) && (
            <section className="card">
              <div className="card-header">
                <h2>Prescription</h2>
                {approvedPrescription && <Badge tone="success">Approved</Badge>}
              </div>
              <div className="card-body">
                {order.prescriptions?.length ? (
                  <div className="stack-sm">
                    {order.prescriptions.map((prescription) => (
                      <div className="alert-item" key={prescription.id}>
                        <div className="row between">
                          <div>
                            <strong>{prescription.original_name || `Prescription #${prescription.id}`}</strong>
                            <div className="small muted">
                              Uploaded {formatDateTime(prescription.created_at)}
                              {prescription.reviewed_by_name ? ` · Reviewed by ${prescription.reviewed_by_name}` : ''}
                            </div>
                            {prescription.remarks && <p className="small mb-0">Pharmacist remarks: {prescription.remarks}</p>}
                          </div>
                          <div className="row">
                            <StatusBadge status={prescription.status} />
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => openProtectedFile(`/prescriptions/${prescription.id}/file`)}
                            >
                              View file
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="muted">No prescription has been uploaded for this order yet.</p>
                )}

                {canUpload && (
                  <form onSubmit={uploadPrescription} className="mt-2">
                    <div className="field">
                      <label htmlFor="prescription">Upload a photo or PDF of your prescription</label>
                      <input id="prescription" name="prescription" type="file" accept="image/*,application/pdf" required />
                      <p className="hint">JPG, PNG, WebP or PDF, up to 5 MB. Images are compressed and stored privately.</p>
                    </div>
                    <button type="submit" className="btn btn-primary" disabled={uploading}>
                      {uploading ? 'Uploading…' : 'Upload prescription'}
                    </button>
                  </form>
                )}
                {!isCustomer && <p className="small muted">Prescription files are only visible to the customer, the pharmacy and administrators.</p>}
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-header"><h2>Event history</h2></div>
            <div className="card-body">
              <div className="alert-list">
                {order.events?.map((event) => (
                  <div className="alert-item" key={event.id}>
                    <div>
                      <strong>{event.status.replace(/_/g, ' ')}</strong>
                      {event.note && <p className="small mb-0">{event.note}</p>}
                      <span className="tiny muted">
                        {formatDateTime(event.created_at)}{event.actor_name ? ` · ${event.actor_name}` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <aside>
          <div className="card sticky-summary">
            <div className="card-header"><h2>Pharmacy &amp; payment</h2></div>
            <div className="card-body">
              <DefinitionList
                items={[
                  { label: 'Pharmacy', value: order.pharmacy_name },
                  { label: 'Community', value: order.pharmacy_community },
                  { label: 'Phone', value: order.pharmacy_phone },
                  { label: 'Address', value: `${order.pharmacy_address}${order.pharmacy_landmark ? ` (${order.pharmacy_landmark})` : ''}` },
                  { label: 'Payment', value: paymentLabel(order.payment_status) },
                  ...(order.delivery
                    ? [
                        { label: 'Delivery status', value: order.delivery.status.replace(/_/g, ' ') },
                        { label: 'Rider', value: order.delivery.rider_name || 'Not assigned' },
                        { label: 'Rider phone', value: order.delivery.rider_phone || '—' },
                      ]
                    : []),
                ]}
              />

              <div className="stack mt-2">
                {pendingPayment && !pendingPayment.reference && (
                  <button type="button" className="btn btn-primary btn-block" onClick={verifyPayment} disabled={busy === 'verify'}>
                    {busy === 'verify' ? 'Checking…' : 'Check mobile money payment'}
                  </button>
                )}
                {order.status === 'ready' && order.fulfilment === 'pickup' && (
                  <Alert tone="success">Your order is ready to collect at {order.pharmacy_name}.</Alert>
                )}
                {isCustomer && order.status === 'completed' && (
                  <button type="button" className="btn btn-secondary btn-block" onClick={reorder} disabled={busy === 'reorder'}>
                    {busy === 'reorder' ? 'Preparing cart…' : 'Reorder these items'}
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-block" onClick={() => download(`/orders/${order.id}/receipt`, `${order.reference}-receipt.pdf`)}>
                  Download receipt (PDF)
                </button>
                {isCustomer && ['placed', 'awaiting_prescription'].includes(order.status) && (
                  <button type="button" className="btn btn-danger btn-block" onClick={cancel} disabled={busy === 'cancel'}>
                    {busy === 'cancel' ? 'Cancelling…' : 'Cancel order'}
                  </button>
                )}
                <Link to="/refills" className="btn btn-ghost btn-block">Set a refill reminder</Link>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
