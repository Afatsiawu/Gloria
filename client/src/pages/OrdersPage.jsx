import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { EmptyState, ErrorState, Loading, Pagination, StatusBadge } from '../components/UI.jsx';
import { formatDate, formatMoney } from '../utils/format.js';

export default function OrdersPage() {
  usePageTitle('Orders');
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');
  const { data, loading, error, reload } = useFetch(`/orders?page=${page}&pageSize=10`, [page]);

  const reorder = async (order) => {
    setActionError('');
    setBusyId(order.id);
    try {
      await api(`/orders/${order.id}/reorder`, { method: 'POST' });
      window.dispatchEvent(new Event('cart:changed'));
      navigate('/cart');
    } catch (err) {
      setActionError(err.message || 'Could not reorder these items.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;

  const items = data?.items || [];

  return (
    <>
      <h1 className="page-heading">Orders</h1>
      {actionError && <p className="error-text">{actionError}</p>}

      {items.length === 0 && (
        <EmptyState
          title="No orders yet"
          action={
            <Link to="/medicines" className="btn btn-primary">
              Find medicines
            </Link>
          }
        >
          Search for a medicine to place your first order.
        </EmptyState>
      )}

      {items.length > 0 && (
        <ul className="order-list">
          {items.map((order) => (
            <li key={order.id}>
              <div className="order-main">
                <strong>{order.reference}</strong>
                <span className="small muted">{formatDate(order.created_at)}</span>
              </div>
              <div className="order-side">
                <span className="order-total">{formatMoney(order.total)}</span>
                <StatusBadge status={order.status} />
              </div>
              <div className="order-actions">
                <Link to={`/orders/${order.id}`} className="btn btn-secondary btn-sm">
                  View
                </Link>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => reorder(order)}
                  disabled={busyId === order.id}
                >
                  {busyId === order.id ? 'Please wait…' : 'Reorder'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination pagination={data?.pagination} onPage={setPage} />
    </>
  );
}
