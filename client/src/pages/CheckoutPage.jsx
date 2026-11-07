import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, ErrorState, Field, PageHeader, Skeleton } from '../components/UI.jsx';
import { formatMoney } from '../utils/format.js';

export default function CheckoutPage() {
  usePageTitle('Checkout');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch('/cart');
  const cart = data?.cart;
  const zones = useFetch(cart?.pharmacy?.id ? `/pharmacies/${cart.pharmacy.id}/delivery-zones` : null);

  const [form, setForm] = useState({
    fulfilment: 'pickup',
    deliveryZoneId: '',
    deliveryAddress: user?.delivery_address || '',
    digitalAddressCode: user?.digital_address_code || '',
    paymentMethod: 'cash',
    network: 'MTN',
    phone: user?.phone || '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const update = (key) => (event) => {
    const value = event.target.value;
    setForm((current) => ({
      ...current,
      [key]: value,
      ...(key === 'fulfilment' && value === 'pickup' ? { deliveryZoneId: '' } : {}),
    }));
  };

  if (loading) return <Skeleton lines={8} />;
  if (error) return <ErrorState error={error} retry={reload} />;

  const items = cart?.items || [];
  if (!items.length) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <h2>Your cart is empty</h2>
          <p className="muted">Add medicines before checking out.</p>
          <Link to="/search" className="btn btn-primary">Find medicines</Link>
        </div>
      </div>
    );
  }

  const zone = (zones.data?.items || []).find((row) => String(row.id) === String(form.deliveryZoneId));
  const deliveryFee = form.fulfilment === 'delivery' && zone ? Number(zone.fee) : 0;
  const total = Number(cart.subtotal) + deliveryFee;
  const requiresPrescription = items.some((item) => item.requires_prescription);

  const submit = async (event) => {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      const body = {
        fulfilment: form.fulfilment,
        paymentMethod: form.paymentMethod,
        notes: form.notes || undefined,
      };
      if (form.fulfilment === 'delivery') {
        body.deliveryZoneId = Number(form.deliveryZoneId);
        body.deliveryAddress = form.deliveryAddress;
        body.digitalAddressCode = form.digitalAddressCode;
      }
      if (form.paymentMethod === 'momo') {
        body.network = form.network;
        body.phone = form.phone;
      }
      const result = await api('/orders', { method: 'POST', body });
      navigate(`/orders/${result.order.id}`, { replace: true, state: { justPlaced: true } });
    } catch (err) {
      setFormError(err);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Checkout step 2 of 2"
        title="How would you like to receive your order?"
        subtitle={`Ordering from ${cart.pharmacy?.name}, ${cart.pharmacy?.community}.`}
        actions={<Link to="/cart" className="btn btn-ghost btn-sm">Back to cart</Link>}
      />

      {formError && <Alert tone="error">{formError.message}</Alert>}
      {requiresPrescription && (
        <Alert tone="warning">
          This order contains prescription-only medicine. You can upload a prescription after placing the order;
          the pharmacy will not release it until a pharmacist approves it.
        </Alert>
      )}

      <form onSubmit={submit}>
        <div className="detail-grid">
          <div className="stack">
            <section className="card">
              <div className="card-header"><h2>Fulfilment</h2></div>
              <div className="card-body">
                <div className="option-cards">
                  <label className="option-card">
                    <input type="radio" name="fulfilment" value="pickup" checked={form.fulfilment === 'pickup'} onChange={update('fulfilment')} />
                    <strong>Pickup at pharmacy</strong>
                    <span>Free · Collect when the pharmacy marks your order ready.</span>
                  </label>
                  <label className="option-card">
                    <input type="radio" name="fulfilment" value="delivery" checked={form.fulfilment === 'delivery'} onChange={update('fulfilment')} />
                    <strong>Community delivery</strong>
                    <span>Choose a zone below. A rider brings it to your address.</span>
                  </label>
                </div>

                {form.fulfilment === 'delivery' && (
                  <div className="form-grid mt-2">
                    <Field label="Delivery zone" htmlFor="deliveryZoneId" required>
                      <select id="deliveryZoneId" value={form.deliveryZoneId} onChange={update('deliveryZoneId')} required>
                        <option value="">Choose a zone</option>
                        {(zones.data?.items || []).map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name} · {formatMoney(row.fee)}{row.rules ? ` · ${row.rules}` : ''}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Mobile money phone" htmlFor="phone" hint="Only required when paying by mobile money.">
                      <input id="phone" value={form.phone} onChange={update('phone')} autoComplete="tel" />
                    </Field>
                    <Field label="Delivery address or landmark" htmlFor="deliveryAddress" required className="full">
                      <textarea id="deliveryAddress" rows={2} value={form.deliveryAddress} onChange={update('deliveryAddress')} required />
                    </Field>
                    <Field label="Ghana Post GPS digital address" htmlFor="digitalAddressCode" required hint="Format: GA-123-4567.">
                      <input id="digitalAddressCode" value={form.digitalAddressCode} onChange={update('digitalAddressCode')} placeholder="GA-123-4567" required />
                    </Field>
                  </div>
                )}
              </div>
            </section>

            <section className="card">
              <div className="card-header"><h2>Payment</h2></div>
              <div className="card-body">
                <div className="option-cards">
                  <label className="option-card">
                    <input type="radio" name="paymentMethod" value="cash" checked={form.paymentMethod === 'cash'} onChange={update('paymentMethod')} />
                    <strong>Cash on pickup or delivery</strong>
                    <span>Pay the pharmacy when you receive the medicine.</span>
                  </label>
                  <label className="option-card">
                    <input type="radio" name="paymentMethod" value="momo" checked={form.paymentMethod === 'momo'} onChange={update('paymentMethod')} />
                    <strong>Mobile money</strong>
                    <span>MTN, Telecel or AT. A payment prompt is simulated in this demo.</span>
                  </label>
                </div>
                {form.paymentMethod === 'momo' && (
                  <div className="form-grid mt-2">
                    <Field label="Network" htmlFor="network" required>
                      <select id="network" value={form.network} onChange={update('network')}>
                        <option value="MTN">MTN MoMo</option>
                        <option value="Telecel">Telecel Cash</option>
                        <option value="AT">AT Money</option>
                      </select>
                    </Field>
                    <Field label="Phone to charge" htmlFor="momoPhone" required hint="Ghana mobile number, for example 024 123 4567.">
                      <input id="momoPhone" value={form.phone} onChange={update('phone')} required autoComplete="tel" />
                    </Field>
                  </div>
                )}
                <Field label="Notes for the pharmacy (optional)" htmlFor="notes">
                  <textarea id="notes" rows={2} maxLength={500} value={form.notes} onChange={update('notes')} />
                </Field>
              </div>
            </section>
          </div>

          <aside>
            <div className="card sticky-summary">
              <div className="card-header"><h2>Order summary</h2></div>
              <div className="card-body">
                <div className="receipt-lines">
                  {items.map((item) => (
                    <div key={item.id}>
                      <span>{item.quantity} × {item.brand_name}{item.strength ? ` ${item.strength}` : ''}</span>
                      <span>{formatMoney(item.line_total)}</span>
                    </div>
                  ))}
                </div>
                <div className="summary-row mt-2">
                  <span>Subtotal</span>
                  <span>{formatMoney(cart.subtotal)}</span>
                </div>
                <div className="summary-row">
                  <span>Delivery {zone ? `(${zone.name})` : ''}</span>
                  <span>{formatMoney(deliveryFee)}</span>
                </div>
                <div className="summary-row total">
                  <span>Total</span>
                  <span>{formatMoney(total)}</span>
                </div>
                <button type="submit" className="btn btn-primary btn-block mt-2" disabled={submitting}>
                  {submitting ? 'Placing order…' : 'Place order'}
                </button>
                <p className="hint mt-2 mb-0">
                  Stock is reserved when you place the order. If a mobile money payment fails, the order is
                  cancelled and stock is released automatically.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </form>
    </>
  );
}
