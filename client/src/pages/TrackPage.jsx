import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { usePageTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Field, Icon, Loading, Stepper } from '../components/UI.jsx';
import { formatDateTime, formatMoney, paymentLabel, statusLabel } from '../utils/format.js';

function stepsFor(order) {
  const needsPrescription = order.items?.some((item) => item.requires_prescription);
  const steps = needsPrescription
    ? [
        { key: 'placed', label: 'Order placed' },
        { key: 'prescription', label: 'Prescription checked' },
        { key: 'verified', label: 'Order confirmed' },
        { key: 'ready', label: order.fulfilment === 'delivery' ? 'Ready for delivery' : 'Ready for pickup' },
        { key: 'completed', label: 'Completed' },
      ]
    : [
        { key: 'placed', label: 'Order placed' },
        { key: 'verified', label: 'Order confirmed' },
        { key: 'ready', label: order.fulfilment === 'delivery' ? 'Ready for delivery' : 'Ready for pickup' },
        { key: 'completed', label: 'Completed' },
      ];

  const offsets = needsPrescription
    ? { placed: 1, awaiting_prescription: 1, verified: 3, ready: 4, out_for_delivery: 4, completed: 5 }
    : { placed: 1, verified: 2, ready: 3, out_for_delivery: 3, completed: 4 };
  const doneCount = order.status === 'cancelled' ? 1 : offsets[order.status] ?? 0;
  const events = order.events || [];
  const timeFor = (key) => {
    if (key === 'placed') return order.created_at;
    const status = key === 'prescription' ? 'awaiting_prescription' : key;
    return events.find((event) => event.status === status)?.created_at;
  };

  return steps.map((step, index) => ({
    ...step,
    time: timeFor(step.key) ? formatDateTime(timeFor(step.key)) : null,
    state: index < doneCount ? 'done' : index === doneCount && order.status !== 'cancelled' ? 'current' : 'todo',
  }));
}

function TrackResult({ order, justPlaced, onReset, reference, phone, onUploaded }) {
  const { user } = useAuth();
  const steps = stepsFor(order);
  const needsPrescription = order.items?.some((item) => item.requires_prescription);
  const issue = (order.prescriptions || [])
    .filter((prescription) => ['queried', 'rejected'].includes(prescription.status) && prescription.remarks)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0];
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadMessage, setUploadMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(order.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const upload = async (event) => {
    event.preventDefault();
    if (!file) return;
    setUploading(true);
    setUploadError('');
    setUploadMessage('');
    const formData = new FormData();
    formData.append('reference', reference);
    formData.append('phone', phone);
    formData.append('file', file);
    try {
      await api(`/guest/orders/${order.id}/prescription`, { method: 'POST', formData });
      setUploadMessage('Prescription uploaded. A pharmacist will check it.');
      setFile(null);
      event.target.reset();
      onUploaded();
    } catch (err) {
      setUploadError(err.message || 'Could not upload the prescription.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div id="tracked-order">
      {justPlaced && (
        <section className="order-confirmation" aria-live="polite">
          <span className="confirmation-mark" aria-hidden="true">
            <Icon name="Check" size={26} />
          </span>
          <p className="confirmation-eyebrow">Order received</p>
          <p className="track-reference">{order.reference}</p>
          <button type="button" className="btn btn-secondary copy-button" onClick={copyReference}>
            {copied ? 'Copied' : 'Copy reference'}
          </button>
          <p className="confirmation-status">
            Status: <strong>{statusLabel(order.status)}</strong>
          </p>
          <ul className="confirmation-steps">
            <li>Save your order reference and phone number to check your order later.</li>
            <li>Follow each stage below as the pharmacy prepares your order.</li>
          </ul>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => document.getElementById('track-progress')?.scrollIntoView()}
          >
            Track this order
          </button>
          {!user && (
            <p className="small confirmation-account">
              Want to save your details for next time? <Link to="/register">Create an account</Link>
            </p>
          )}
        </section>
      )}

      {!justPlaced && (
        <section className="track-head">
          <h1 className="page-heading">Order {order.reference}</h1>
          <p>
            Status: <strong>{statusLabel(order.status)}</strong>
          </p>
          <p className="small muted">
            Placed {formatDateTime(order.created_at)} · {order.pharmacy?.name}
          </p>
        </section>
      )}

      <section className="tracking-progress card" id="track-progress" aria-label="Order progress">
        {order.status === 'cancelled' && <p className="alert alert-error">This order was cancelled.</p>}
        <Stepper steps={steps} />
      </section>

      {issue && (
        <section className="checkout-section card">
          <h2>Prescription remark</h2>
          <p className="rx-note">{issue.remarks}</p>
          <p className="small muted">A pharmacist marked the prescription as {issue.status}.</p>
          <form onSubmit={upload}>
            <Field label="Upload a new prescription" htmlFor="new-prescription">
              <input
                id="new-prescription"
                type="file"
                accept="image/*,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] || null)}
                required
              />
            </Field>
            {uploadError && <p className="error-text">{uploadError}</p>}
            {uploadMessage && <p className="badge-success">{uploadMessage}</p>}
            <button type="submit" className="btn btn-primary" disabled={uploading || !file}>
              {uploading ? 'Please wait…' : 'Upload prescription'}
            </button>
          </form>
        </section>
      )}

      {needsPrescription && !issue && order.status === 'awaiting_prescription' && (
        <p className="rx-note">Waiting for prescription check. A pharmacist will review the file before release.</p>
      )}

      <section className="checkout-section card">
        <h2>Items</h2>
        <div className="receipt-lines">
          {(order.items || []).map((item) => (
            <div key={item.id}>
              <span>
                {item.quantity} × {item.brand_name}
                {item.strength ? ` ${item.strength}` : ''}
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
        <p className="small muted">{paymentLabel(order.payment_status)}</p>
      </section>

      <section className="checkout-section card">
        <h2>Pharmacy</h2>
        <p>
          {order.pharmacy?.name}, {order.pharmacy?.community}
        </p>
        <p className="small">{order.pharmacy?.phone}</p>
        {order.fulfilment === 'delivery' && order.delivery_address && (
          <p className="small muted">Deliver to: {order.delivery_address}</p>
        )}
        {order.fulfilment === 'delivery' && order.delivery_time && (
          <p className="small muted">Preferred delivery time: {order.delivery_time}</p>
        )}
      </section>

      <button type="button" className="link" onClick={onReset}>
        Track another order
      </button>
    </div>
  );
}

export default function TrackPage() {
  const { reference: routeReference } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const queryReference = routeReference || params.get('reference') || '';
  const queryPhone = params.get('phone') || location.state?.phone || '';
  const [reference, setReference] = useState(queryReference);
  const [phone, setPhone] = useState(queryPhone);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [justPlaced, setJustPlaced] = useState(Boolean(location.state?.justPlaced));
  const autoRan = useRef(false);

  usePageTitle(order ? `Order ${order.reference}` : 'Track order');

  const lookup = useCallback(async (ref, phoneNumber) => {
    setLoading(true);
    setError('');
    try {
      const data = await api('/orders/track', {
        method: 'POST',
        body: { reference: ref.trim().toUpperCase(), phone: phoneNumber.trim() },
      });
      setOrder(data.order);
      setReference(ref.trim().toUpperCase());
      setPhone(phoneNumber.trim());
    } catch (err) {
      setOrder(null);
      setJustPlaced(false);
      setError(err.message || 'We could not find an order with that reference and phone number.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoRan.current) return;
    if (queryReference && queryPhone) {
      autoRan.current = true;
      lookup(queryReference, queryPhone);
    }
  }, [queryReference, queryPhone, lookup]);

  const submit = (event) => {
    event.preventDefault();
    if (!reference.trim() || !phone.trim()) {
      setError('Enter the order reference and the phone number used for the order.');
      return;
    }
    lookup(reference, phone);
  };

  const reset = () => {
    setOrder(null);
    setJustPlaced(false);
    setError('');
    setReference('');
    setPhone('');
    autoRan.current = true;
  };

  const refreshOrder = () => {
    lookup(reference, phone);
  };

  return (
    <>
      {justPlaced && location.state?.uploadFailed && (
        <div className="alert alert-error" role="alert">
          The order was placed but the prescription did not upload. Upload it below.
        </div>
      )}

      {order ? (
        <TrackResult
          order={order}
          justPlaced={justPlaced}
          onReset={reset}
          reference={reference}
          phone={phone}
          onUploaded={refreshOrder}
        />
      ) : (
        <>
          <h1 className="page-heading">Track your order</h1>
          <p className="muted">Enter the reference we gave you and the phone number used for the order.</p>
          {error && (
            <div className="alert alert-error" role="alert">
              {error}
            </div>
          )}
          <form className="track-form card" onSubmit={submit}>
            <Field label="Order reference" htmlFor="reference" required>
              <input
                id="reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="PH-123456"
                autoComplete="off"
                required
              />
            </Field>
            <Field label="Phone number" htmlFor="phone" required>
              <input
                id="phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                required
              />
            </Field>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Please wait…' : 'Track order'}
            </button>
          </form>
          {loading && <Loading />}
        </>
      )}
    </>
  );
}
