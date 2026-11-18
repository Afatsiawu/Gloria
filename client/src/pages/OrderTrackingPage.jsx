import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, download, openProtectedFile } from '../api/client.js';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import Timeline from '../components/Timeline.jsx';
import { Alert, ErrorState, Field, Loading, StatusBadge } from '../components/UI.jsx';
import { formatDateTime, formatMoney, paymentLabel, statusLabel } from '../utils/format.js';

export default function OrderTrackingPage() {
  const { reference } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(`/orders/${reference}`);
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState(
    location.state?.uploadFailed ? 'The order was placed but the prescription did not upload. Try again below.' : ''
  );
  const [uploading, setUploading] = useState(false);

  usePageTitle(data?.order?.reference ? `Order ${data.order.reference}` : 'Order');

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  if (!data?.order) return null;

  const order = data.order;
  const isCustomer = user?.role === 'customer' && order.customer_id === user.id;
  const pendingPayment = order.payments?.find((payment) => payment.status === 'pending');
  const approvedPrescription = order.prescriptions?.some((prescription) => prescription.status === 'approved');
  const openPrescription = order.prescriptions?.find((prescription) => prescription.status === 'pending');
  const needsPrescription = order.items?.some((item) => item.requires_prescription);
  const issue = (order.prescriptions || [])
    .filter((prescription) => ['queried', 'rejected'].includes(prescription.status) && prescription.remarks)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  const canUpload =
    isCustomer &&
    needsPrescription &&
    !approvedPrescription &&
    !openPrescription &&
    !['cancelled', 'completed'].includes(order.status);

  const run = async (key, fn, successMessage) => {
    setBusy(key);
    setNotice('');
    setActionError('');
    try {
      await fn();
      setNotice(successMessage || 'Done.');
      reload();
    } catch (err) {
      setActionError(err.message || 'That action could not be completed.');
    } finally {
      setBusy(null);
    }
  };

  const verifyPayment = () =>
    run(
      'verify',
      async () => {
        const payments = await api(`/payments/order/${order.id}`);
        const pending = payments.items.find((payment) => payment.status === 'pending');
        if (!pending) throw new Error('There is no pending payment for this order.');
        await api(`/payments/${pending.id}/verify`, { method: 'POST' });
      },
      'Payment status checked.'
    );

  const cancel = () => {
    const reason = window.prompt('Why are you cancelling this order? (optional)') ?? '';
    if (reason === null) return;
    run(
      'cancel',
      () => api(`/orders/${order.id}/cancel`, { method: 'POST', body: { reason } }),
      'Order cancelled.'
    );
  };

  const reorder = () =>
    run('reorder', async () => {
      await api(`/orders/${order.id}/reorder`, { method: 'POST' });
      window.dispatchEvent(new Event('cart:changed'));
      navigate('/cart');
    });

  const uploadPrescription = async (event) => {
    event.preventDefault();
    const file = event.target.elements.prescription.files?.[0];
    if (!file) return;
    setUploading(true);
    setActionError('');
    setNotice('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api(`/orders/${order.id}/prescriptions`, { method: 'POST', formData });
      setNotice('Prescription uploaded. A pharmacist will review it.');
      event.target.reset();
      reload();
    } catch (err) {
      setActionError(err.message || 'Could not upload the prescription.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <p className="back-link">
        <Link to="/orders">Back to orders</Link>
      </p>

      <h1 className="page-heading">Order {order.reference}</h1>
      <p className="status-line">
        <span>
          Status: <strong>{statusLabel(order.status)}</strong>
        </span>
        <span className="small muted">
          Placed {formatDateTime(order.created_at)} · {order.pharmacy_name}
        </span>
      </p>

      <p className="muted">
        {order.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'} · {formatMoney(order.total)} ·{' '}
        {paymentLabel(order.payment_status)}
      </p>

      {location.state?.justPlaced && !location.state?.uploadFailed && (
        <Alert tone="success">Order placed. Keep this page to track it.</Alert>
      )}
      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && <p className="error-text">{actionError}</p>}

      <section className="tracking-progress card">
        <Timeline order={order} />
      </section>

      <section className="checkout-section card">
        <h2>Items</h2>
        <div className="receipt-lines">
          {order.items?.map((item) => (
            <div key={item.id}>
              <span>
                {item.quantity} × {item.medicine_name_snapshot || item.brand_name}
              </span>
              <span>{formatMoney(item.quantity * item.unit_price)}</span>
            </div>
          ))}
        </div>
        <div className="summary-row">
          <span>Subtotal</span>
          <span>{formatMoney(order.subtotal)}</span>
        </div>
        {Number(order.delivery_fee) > 0 && (
          <div className="summary-row">
            <span>Delivery</span>
            <span>{formatMoney(order.delivery_fee)}</span>
          </div>
        )}
        <div className="summary-row total">
          <span>Total</span>
          <span>{formatMoney(order.total)}</span>
        </div>
        {order.notes && <p className="small muted">Note: {order.notes}</p>}
      </section>

      {needsPrescription && (
        <section className="checkout-section card">
          <h2>Prescription</h2>
          {issue && (
            <>
              <p className="rx-note">{issue.remarks}</p>
              <p className="small muted">A pharmacist marked the prescription as {issue.status}.</p>
            </>
          )}
          {order.prescriptions?.length ? (
            <ul className="prescription-list">
              {order.prescriptions.map((prescription) => (
                <li key={prescription.id}>
                  <div>
                    <strong>{prescription.original_name || `Prescription ${prescription.id}`}</strong>
                    <span className="small muted">
                      Uploaded {formatDateTime(prescription.created_at)}
                    </span>
                    {prescription.remarks && <p className="small">Remarks: {prescription.remarks}</p>}
                  </div>
                  <div className="prescription-actions">
                    <StatusBadge status={prescription.status} />
                    <button
                      type="button"
                      className="link"
                      onClick={() => openProtectedFile(`/prescriptions/${prescription.id}/file`)}
                    >
                      View file
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No prescription uploaded yet.</p>
          )}

          {canUpload && (
            <form onSubmit={uploadPrescription}>
              <Field label={issue ? 'Upload a new photo or PDF' : 'Upload a photo or PDF'} htmlFor="prescription">
                <input
                  id="prescription"
                  name="prescription"
                  type="file"
                  accept="image/*,application/pdf"
                  required
                />
              </Field>
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading ? 'Please wait…' : 'Upload prescription'}
              </button>
            </form>
          )}
        </section>
      )}

      <section className="checkout-section card">
        <h2>Pharmacy</h2>
        <dl className="facts">
          <div>
            <dt>Name</dt>
            <dd>{order.pharmacy_name}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd>
              <a href={`tel:${order.pharmacy_phone}`}>{order.pharmacy_phone}</a>
            </dd>
          </div>
          <div>
            <dt>Address</dt>
            <dd>{order.pharmacy_address}</dd>
          </div>
          {order.delivery && (
            <>
              <div>
                <dt>Delivery</dt>
                <dd>{order.delivery.status.replace(/_/g, ' ')}</dd>
              </div>
              <div>
                <dt>Rider</dt>
                <dd>{order.delivery.rider_name || 'Not assigned'}</dd>
              </div>
              <div>
                <dt>Rider phone</dt>
                <dd>{order.delivery.rider_phone || '—'}</dd>
              </div>
            </>
          )}
        </dl>
      </section>

      <section className="checkout-section card">
        <h2>Actions</h2>
        <div className="detail-actions">
          {pendingPayment && !pendingPayment.reference && (
            <button type="button" className="btn btn-secondary" onClick={verifyPayment} disabled={busy === 'verify'}>
              {busy === 'verify' ? 'Please wait…' : 'Check payment'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => download(`/orders/${order.id}/receipt`, `${order.reference}-receipt.pdf`)}
          >
            Download receipt
          </button>
          {isCustomer && (
            <button type="button" className="btn btn-secondary" onClick={reorder} disabled={busy === 'reorder'}>
              {busy === 'reorder' ? 'Please wait…' : 'Reorder'}
            </button>
          )}
          <Link to="/refills" className="btn btn-secondary">
            Refill reminder
          </Link>
          {isCustomer && ['placed', 'awaiting_prescription'].includes(order.status) && (
            <button type="button" className="btn btn-danger" onClick={cancel} disabled={busy === 'cancel'}>
              {busy === 'cancel' ? 'Please wait…' : 'Cancel order'}
            </button>
          )}
        </div>
      </section>
    </>
  );
}
