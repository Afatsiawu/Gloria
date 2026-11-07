import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { Alert, EmptyState, ErrorState, PageHeader, Skeleton } from '../components/UI.jsx';
import { formatMoney } from '../utils/format.js';

export default function CartPage() {
  usePageTitle('Your cart');
  const { data, loading, error, reload } = useFetch('/cart');
  const [busy, setBusy] = useState(null);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);

  const run = async (key, fn) => {
    setBusy(key);
    setActionError(null);
    setNotice(null);
    try {
      await fn();
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(null);
    }
  };

  const setQuantity = (item, quantity) => {
    if (quantity < 1 || quantity > 50) return;
    run(`qty-${item.id}`, () =>
      api(`/cart/items/${item.id}`, { method: 'PATCH', body: { quantity } })
    );
  };

  const remove = (item) =>
    run(`remove-${item.id}`, () => api(`/cart/items/${item.id}`, { method: 'DELETE' }));

  const clear = () => run('clear', () => api('/cart', { method: 'DELETE' }));

  if (loading) return <Skeleton lines={8} />;
  if (error) return <ErrorState error={error} retry={reload} />;

  const cart = data?.cart;
  const items = cart?.items || [];

  if (!items.length) {
    return (
      <EmptyState
        title="Your cart is empty"
        action={<Link to="/search" className="btn btn-primary">Find medicines</Link>}
      >
        Browse the catalogue, compare live stock across the 10 pharmacies and add what you need.
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Checkout step 1 of 2"
        title="Your cart"
        subtitle={`Ordering from ${cart.pharmacy?.name} in ${cart.pharmacy?.community}. A cart can contain medicines from one pharmacy at a time.`}
        actions={<button type="button" className="btn btn-ghost btn-sm" onClick={clear} disabled={busy === 'clear'}>Clear cart</button>}
      />

      {actionError && <Alert tone="error">{actionError.message}</Alert>}
      {notice && <Alert tone="success">{notice}</Alert>}

      <div className="detail-grid">
        <div className="card">
          <div className="card-body">
            {items.map((item) => (
              <div className="cart-item" key={item.id}>
                <div className="cart-item-info">
                  <strong>{item.brand_name}{item.strength ? ` ${item.strength}` : ''}</strong>
                  <div className="small muted">
                    {item.generic_name} · {item.dosage_form || 'Medicine'}
                    {item.requires_prescription ? ' · Prescription required' : ''}
                  </div>
                  <div className="small muted">
                    {formatMoney(item.price)} each · {item.available} available
                  </div>
                </div>
                <div className="qty" aria-label={`Quantity for ${item.brand_name}`}>
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    disabled={busy === `qty-${item.id}` || item.quantity <= 1}
                    onClick={() => setQuantity(item, item.quantity - 1)}
                  >
                    −
                  </button>
                  <input
                    value={item.quantity}
                    readOnly
                    aria-label={`${item.brand_name} quantity`}
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    disabled={busy === `qty-${item.id}` || item.quantity >= Math.min(50, item.available)}
                    onClick={() => setQuantity(item, item.quantity + 1)}
                  >
                    +
                  </button>
                </div>
                <div className="text-right">
                  <div className="price">{formatMoney(item.line_total)}</div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => remove(item)}
                    disabled={busy === `remove-${item.id}`}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside>
          <div className="card sticky-summary">
            <div className="card-header"><h2>Order summary</h2></div>
            <div className="card-body">
              <div className="summary-row">
                <span>Subtotal ({cart.item_count} item{cart.item_count === 1 ? '' : 's'})</span>
                <span>{formatMoney(cart.subtotal)}</span>
              </div>
              <div className="summary-row">
                <span>Delivery</span>
                <span>Calculated at checkout</span>
              </div>
              <div className="summary-row total">
                <span>Estimated total</span>
                <span>{formatMoney(cart.subtotal)}</span>
              </div>
              <Link to="/checkout" className="btn btn-primary btn-block mt-2">Continue to checkout</Link>
              <Link to="/search" className="btn btn-ghost btn-block mt-1">Add more medicines</Link>
              <p className="hint mt-2 mb-0">
                Prescription-only items are reserved now and released only after a pharmacist approves your
                prescription.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
