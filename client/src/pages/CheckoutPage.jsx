import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { Field, Loading } from '../components/UI.jsx';
import { formatMoney } from '../utils/format.js';

const DRAFT_KEY = 'pharmalink_checkout_draft_v1';

function readDraft() {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearDraft() {
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    // Storage may be blocked; the order still completes.
  }
}

export default function CheckoutPage() {
  usePageTitle('Checkout');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { cart, loading, clearCart } = useCart();
  const isCustomer = user?.role === 'customer';
  const zones = useFetch(cart?.pharmacy?.id ? `/pharmacies/${cart.pharmacy.id}/delivery-zones` : null);

  const [form, setForm] = useState(() => {
    const draft = readDraft();
    return {
      name: draft?.name || user?.full_name || '',
      phone: draft?.phone || user?.phone || '',
      email: draft?.email || user?.email || '',
      fulfilment: draft?.fulfilment || 'pickup',
      deliveryZoneId: draft?.deliveryZoneId || '',
      landmark: draft?.landmark || user?.delivery_address || '',
      digitalAddressCode: draft?.digitalAddressCode || user?.digital_address_code || '',
      deliveryTime: draft?.deliveryTime || '',
      paymentMethod: draft?.paymentMethod || 'cash',
      network: draft?.network || 'MTN',
      momoPhone: draft?.momoPhone || user?.phone || '',
      notes: draft?.notes || '',
    };
  });
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    try {
      window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      // Storage may be blocked; the form still works for this visit.
    }
  }, [form]);

  useEffect(() => {
    if (!user) return;
    setForm((current) => ({
      ...current,
      name: current.name || user.full_name || '',
      phone: current.phone || user.phone || '',
      email: current.email || user.email || '',
      landmark: current.landmark || user.delivery_address || '',
      digitalAddressCode: current.digitalAddressCode || user.digital_address_code || '',
      momoPhone: current.momoPhone || user.phone || '',
    }));
  }, [user]);

  useEffect(() => {
    if (!prescriptionFile || !prescriptionFile.type.startsWith('image/')) {
      setPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(prescriptionFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [prescriptionFile]);

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'fulfilment' && value === 'pickup' ? { deliveryZoneId: '' } : {}),
    }));
  };

  if (loading) return <Loading />;

  const items = cart?.items || [];
  if (!items.length) {
    return (
      <div className="empty">
        <h1>Your cart is empty</h1>
        <p>Add medicines before checking out.</p>
        <Link to="/medicines" className="btn btn-primary">
          Find medicines
        </Link>
      </div>
    );
  }

  const zone = (zones.data?.items || []).find((row) => String(row.id) === String(form.deliveryZoneId));
  const deliveryFee = form.fulfilment === 'delivery' && zone ? Number(zone.fee) : 0;
  const total = Number(cart.subtotal) + deliveryFee;
  const requiresPrescription = items.some((item) => item.requires_prescription);

  const uploadPrescription = async (order, guestProof) => {
    if (!prescriptionFile) return true;
    const upload = new FormData();
    if (guestProof) {
      upload.append('reference', order.reference);
      upload.append('phone', guestProof.phone);
    }
    upload.append('file', prescriptionFile);
    try {
      await api(guestProof ? `/guest/orders/${order.id}/prescription` : `/orders/${order.id}/prescriptions`, {
        method: 'POST',
        formData: upload,
      });
      return true;
    } catch {
      return false;
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setFormError('');
    if (!consent) {
      setFormError('Please agree to the privacy notice before placing the order.');
      return;
    }
    if (form.fulfilment === 'delivery' && !form.deliveryZoneId) {
      setFormError('Choose a delivery zone.');
      return;
    }
    setSubmitting(true);
    try {
      if (isCustomer) {
        const body = {
          fulfilment: form.fulfilment,
          paymentMethod: form.paymentMethod,
          notes: form.notes || undefined,
        };
        if (form.fulfilment === 'delivery') {
          body.deliveryZoneId = Number(form.deliveryZoneId);
          body.deliveryAddress = form.landmark;
          body.digitalAddressCode = form.digitalAddressCode;
          if (form.deliveryTime) body.deliveryTime = form.deliveryTime;
        }
        if (form.paymentMethod === 'momo') {
          body.network = form.network;
          body.phone = form.momoPhone;
        }
        const result = await api('/orders', { method: 'POST', body });
        const order = result.order;
        const uploaded = await uploadPrescription(order, null);
        await clearCart();
        clearDraft();
        navigate(`/orders/${order.id}`, {
          replace: true,
          state: { justPlaced: true, uploadFailed: !uploaded },
        });
        return;
      }

      const body = {
        name: form.name,
        phone: form.phone,
        email: form.email || '',
        pharmacyId: cart.pharmacy.id,
        items: items.map((item) => ({ medicineId: item.medicine_id, quantity: item.quantity })),
        fulfilment: form.fulfilment,
        paymentMethod: form.paymentMethod,
        notes: form.notes || undefined,
        consent: true,
      };
      if (form.fulfilment === 'delivery') {
        body.deliveryZoneId = Number(form.deliveryZoneId);
        body.deliveryAddress = form.landmark;
        body.digitalAddressCode = form.digitalAddressCode;
        if (form.deliveryTime) body.deliveryTime = form.deliveryTime;
      }
      if (form.paymentMethod === 'momo') {
        body.network = form.network;
        body.momoPhone = form.momoPhone || form.phone;
      }
      const result = await api('/guest/orders', { method: 'POST', body });
      const order = result.order;
      const uploaded = await uploadPrescription(order, { phone: form.phone });
      await clearCart();
      clearDraft();
      navigate(`/orders/${order.reference}`, {
        replace: true,
        state: { justPlaced: true, phone: form.phone, uploadFailed: !uploaded },
      });
    } catch (err) {
      setFormError(err.message || 'Could not place the order.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <p className="back-link">
        <Link to="/cart">Back to cart</Link>
      </p>
      <h1 className="page-heading">Checkout</h1>
      <p className="muted page-subline">
        From {cart.pharmacy?.name}, {cart.pharmacy?.community}
      </p>

      {formError && (
        <div className="alert alert-error" role="alert">
          {formError}
        </div>
      )}

      <form className="checkout-form" onSubmit={submit}>
        <div className="checkout-layout">
          <div className="checkout-main">
            <section className="checkout-step card">
              <h2 className="step-title">
                <span className="section-number" aria-hidden="true">
                  1
                </span>
                Your details
              </h2>
              {isCustomer ? (
                <p className="muted">
                  Ordering as {user.full_name} · {user.phone}. <Link to="/account">Change details</Link>
                </p>
              ) : (
                <div className="form-grid">
                  <Field label="Full name" htmlFor="name" required>
                    <input id="name" value={form.name} onChange={update('name')} autoComplete="name" required />
                  </Field>
                  <Field label="Phone number" htmlFor="phone" required hint="We use this to contact you about the order.">
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      value={form.phone}
                      onChange={update('phone')}
                      autoComplete="tel"
                      required
                    />
                  </Field>
                  <Field label="Email (optional)" htmlFor="email" className="full">
                    <input
                      id="email"
                      type="email"
                      inputMode="email"
                      value={form.email}
                      onChange={update('email')}
                      autoComplete="email"
                    />
                  </Field>
                </div>
              )}
            </section>

            <section className="checkout-step card">
              <h2 className="step-title">
                <span className="section-number" aria-hidden="true">
                  2
                </span>
                Delivery
              </h2>
              <div className="option-cards" role="radiogroup" aria-label="Pickup or delivery">
                <label className={`option-card ${form.fulfilment === 'pickup' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="fulfilment"
                    value="pickup"
                    checked={form.fulfilment === 'pickup'}
                    onChange={update('fulfilment')}
                  />
                  <span>Pickup at the pharmacy</span>
                </label>
                <label className={`option-card ${form.fulfilment === 'delivery' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="fulfilment"
                    value="delivery"
                    checked={form.fulfilment === 'delivery'}
                    onChange={update('fulfilment')}
                  />
                  <span>Delivery</span>
                </label>
              </div>

              {form.fulfilment === 'delivery' && (
                <div className="form-grid">
                  <Field label="Delivery zone" htmlFor="deliveryZoneId" required>
                    <select id="deliveryZoneId" value={form.deliveryZoneId} onChange={update('deliveryZoneId')} required>
                      <option value="">Choose a zone</option>
                      {(zones.data?.items || []).map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.name} · {formatMoney(row.fee)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Digital address code" htmlFor="digitalAddressCode" required hint="Example: GA-123-4567.">
                    <input
                      id="digitalAddressCode"
                      value={form.digitalAddressCode}
                      onChange={update('digitalAddressCode')}
                      placeholder="GA-123-4567"
                      required
                    />
                  </Field>
                  <Field label="Landmark" htmlFor="landmark" required className="full">
                    <input
                      id="landmark"
                      value={form.landmark}
                      onChange={update('landmark')}
                      autoComplete="street-address"
                      required
                    />
                  </Field>
                  <Field label="Preferred delivery time" htmlFor="deliveryTime" hint="Optional time you would like the delivery.">
                    <input
                      id="deliveryTime"
                      type="time"
                      value={form.deliveryTime}
                      onChange={update('deliveryTime')}
                    />
                  </Field>
                </div>
              )}
            </section>

            <section className="checkout-step card">
              <h2 className="step-title">
                <span className="section-number" aria-hidden="true">
                  3
                </span>
                Payment
              </h2>
              <div className="option-cards" role="radiogroup" aria-label="Payment method">
                <label className={`option-card ${form.paymentMethod === 'momo' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="momo"
                    checked={form.paymentMethod === 'momo'}
                    onChange={update('paymentMethod')}
                  />
                  <span>Mobile money</span>
                </label>
                <label className={`option-card ${form.paymentMethod === 'cash' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={form.paymentMethod === 'cash'}
                    onChange={update('paymentMethod')}
                  />
                  <span>Cash</span>
                </label>
              </div>

              {form.paymentMethod === 'momo' && (
                <div className="form-grid">
                  <Field label="Network" htmlFor="network" required>
                    <select id="network" value={form.network} onChange={update('network')}>
                      <option value="MTN">MTN MoMo</option>
                      <option value="Telecel">Telecel Cash</option>
                      <option value="AT">AT Money</option>
                    </select>
                  </Field>
                  <Field label="Mobile money number" htmlFor="momoPhone" required>
                    <input
                      id="momoPhone"
                      type="tel"
                      inputMode="tel"
                      value={form.momoPhone}
                      onChange={update('momoPhone')}
                      autoComplete="tel"
                      required
                    />
                  </Field>
                </div>
              )}

              <Field label="Note for the pharmacy (optional)" htmlFor="notes">
                <textarea id="notes" rows={2} maxLength={500} value={form.notes} onChange={update('notes')} />
              </Field>
            </section>

            {requiresPrescription && (
              <section className="checkout-step card">
                <h2 className="step-title">
                  <span className="section-number" aria-hidden="true">
                    4
                  </span>
                  Prescription
                </h2>
                <p className="rx-note">
                  This order needs a prescription. The order will wait for a pharmacist to check the file you upload.
                </p>
                <Field label="Upload a photo or PDF" htmlFor="prescription">
                  <input
                    id="prescription"
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => setPrescriptionFile(event.target.files?.[0] || null)}
                  />
                </Field>
                {prescriptionFile && (
                  <div className="file-preview">
                    {previewUrl ? (
                      <img src={previewUrl} alt="Prescription preview" />
                    ) : (
                      <span className="small muted">PDF selected</span>
                    )}
                    <div>
                      <p className="small">{prescriptionFile.name}</p>
                      <button type="button" className="link" onClick={() => setPrescriptionFile(null)}>
                        Remove file
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
          </div>

          <aside className="checkout-summary card" aria-label="Order summary">
            <h2>Order summary</h2>
            <div className="receipt-lines">
              {items.map((item) => (
                <div key={item.id}>
                  <span>
                    {item.quantity} × {item.brand_name}
                    {item.strength ? ` ${item.strength}` : ''}
                  </span>
                  <span>{formatMoney(item.line_total)}</span>
                </div>
              ))}
            </div>
            <div className="summary-row">
              <span>Subtotal</span>
              <span>{formatMoney(cart.subtotal)}</span>
            </div>
            <div className="summary-row">
              <span>Delivery</span>
              <span>{formatMoney(deliveryFee)}</span>
            </div>
            <div className="summary-row total">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>

            <label className="checkbox consent">
              <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
              <span>
                I agree to the privacy notice. My details are used only to process this order under the Data
                Protection Act.
              </span>
            </label>

            <button type="submit" className="btn btn-primary btn-block checkout-submit" disabled={submitting}>
              {submitting ? 'Please wait…' : 'Place order'}
            </button>
          </aside>
        </div>

        <div className="checkout-sticky">
          <span className="checkout-sticky-total">
            Total <strong>{formatMoney(total)}</strong>
          </span>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Please wait…' : 'Place order'}
          </button>
        </div>
      </form>
    </>
  );
}
