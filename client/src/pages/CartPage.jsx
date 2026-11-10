import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext.jsx';
import { usePageTitle } from '../hooks/useApi.js';
import { EmptyState, Loading, Toast } from '../components/UI.jsx';
import { formatMoney } from '../utils/format.js';

export default function CartPage() {
  usePageTitle('Cart');
  const { cart, loading, setQuantity, removeItem } = useCart();
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    if (!actionError) return undefined;
    const timer = setTimeout(() => setActionError(''), 4000);
    return () => clearTimeout(timer);
  }, [actionError]);

  const run = async (key, fn) => {
    setBusy(key);
    setActionError('');
    try {
      await fn();
    } catch (err) {
      setActionError(err.message || 'Could not update the cart.');
    } finally {
      setBusy(null);
    }
  };

  const changeQuantity = (item, quantity) => {
    if (quantity < 1 || quantity > 50) return;
    run(`qty-${item.id}`, () => setQuantity(item, quantity));
  };

  if (loading) return <Loading />;

  const items = cart?.items || [];

  if (!items.length) {
    return (
      <EmptyState
        title="Your cart is empty"
        icon="Cart"
        action={
          <Link to="/medicines" className="btn btn-primary">
            Find medicines
          </Link>
        }
      >
        Search for a medicine to get started.
      </EmptyState>
    );
  }

  return (
    <div className="cart-page">
      <h1 className="page-heading">Cart</h1>
      <p className="muted page-subline">
        From {cart.pharmacy?.name}, {cart.pharmacy?.community}
      </p>

      <div className="cart-layout">
        <section className="cart-main card" aria-label="Cart items">
          <div className="cart-list">
            {items.map((item) => {
              const name = `${item.brand_name}${item.strength ? ` ${item.strength}` : ''}`;
              const limit = Math.min(50, Number(item.available) || 50);
              return (
                <div className="cart-item" key={item.id}>
                  <div className="cart-item-info">
                    <span className="cart-item-thumb" aria-hidden="true">
                      {item.brand_name.charAt(0)}
                    </span>
                    <div>
                      <p className="cart-item-name">{name}</p>
                      <p className="small">{formatMoney(item.price)} each</p>
                    </div>
                  </div>
                  <div className="qty" aria-label={`Quantity for ${name}`}>
                    <button
                      type="button"
                      aria-label="Decrease quantity"
                      disabled={busy === `qty-${item.id}` || item.quantity <= 1}
                      onClick={() => changeQuantity(item, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span aria-live="polite">{item.quantity}</span>
                    <button
                      type="button"
                      aria-label="Increase quantity"
                      disabled={busy === `qty-${item.id}` || item.quantity >= limit}
                      onClick={() => changeQuantity(item, item.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                  <p className="cart-line-total">{formatMoney(item.line_total)}</p>
                  <button
                    type="button"
                    className="cart-remove"
                    onClick={() => run(`remove-${item.id}`, () => removeItem(item))}
                    disabled={busy === `remove-${item.id}`}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <aside className="cart-summary card" aria-label="Order summary">
          <h2>Order summary</h2>
          {items.map((item) => (
            <div className="summary-row summary-item" key={item.id}>
              <span>
                {item.quantity} × {item.brand_name}
                {item.strength ? ` ${item.strength}` : ''}
              </span>
              <span>{formatMoney(item.line_total)}</span>
            </div>
          ))}
          <div className="summary-row total">
            <span>
              Subtotal ({cart.item_count} item{cart.item_count === 1 ? '' : 's'})
            </span>
            <span>{formatMoney(cart.subtotal)}</span>
          </div>
          <p className="small muted">Delivery fees are added at checkout. Prices and stock are checked again when you place the order.</p>
          <Link to="/checkout" className="btn btn-primary btn-block cart-checkout-inline">
            Checkout
          </Link>
        </aside>
      </div>

      <div className="cart-sticky">
        <span className="total">{formatMoney(cart.subtotal)}</span>
        <Link to="/checkout" className="btn btn-primary">
          Checkout
        </Link>
      </div>

      <Toast tone="error" onClose={() => setActionError('')}>
        {actionError}
      </Toast>
    </div>
  );
}
