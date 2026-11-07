import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, Skeleton, StatusBadge, Tabs } from '../components/UI.jsx';
import { formatDate, formatMoney, paymentLabel } from '../utils/format.js';

const TABS = [
  { value: '', label: 'All orders' },
  { value: 'awaiting_prescription', label: 'Needs prescription' },
  { value: 'verified', label: 'Verified' },
  { value: 'ready', label: 'Ready' },
  { value: 'out_for_delivery', label: 'On the way' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function OrdersPage() {
  usePageTitle('My orders');
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  const page = params.get('page') || '1';
  const [active, setActive] = useState(status);

  const path = `/orders?page=${page}&pageSize=10${status ? `&status=${status}` : ''}`;
  const { data, loading, error, reload } = useFetch(path);

  const changeTab = (value) => {
    setActive(value);
    const next = new URLSearchParams();
    if (value) next.set('status', value);
    setParams(next, { replace: true });
  };

  const setPage = (next) => {
    const query = new URLSearchParams(params);
    query.set('page', String(next));
    setParams(query, { replace: true });
  };

  return (
    <>
      <PageHeader
        eyebrow="Your account"
        title="My orders"
        subtitle="Track live status, upload prescriptions, pay mobile money or reorder previous items."
        actions={<Link to="/search" className="btn btn-primary btn-sm">Order again</Link>}
      />

      <Tabs tabs={TABS} active={active} onChange={changeTab} label="Filter orders by status" />

      {error && <ErrorState error={error} retry={reload} />}
      {loading && <Skeleton lines={6} />}

      {!loading && !error && (data?.items?.length || 0) === 0 && (
        <EmptyState
          title={status ? 'No orders in this stage' : 'No orders yet'}
          action={<Link to="/search" className="btn btn-primary">Start an order</Link>}
        >
          {status
            ? 'Try another status tab or view all orders.'
            : 'Search for a medicine, choose a nearby pharmacy and place your first order.'}
        </EmptyState>
      )}

      {!loading && !error && data?.items?.length > 0 && (
        <div className="stack">
          {data.items.map((order) => (
            <article className="card" key={order.id}>
              <div className="card-body">
                <div className="row between">
                  <div>
                    <div className="row">
                      <strong>{order.reference}</strong>
                      <StatusBadge status={order.status} />
                      <Badge tone={order.payment_status === 'success' ? 'success' : order.payment_status === 'failed' ? 'danger' : 'warning'}>
                        {paymentLabel(order.payment_status)}
                      </Badge>
                    </div>
                    <p className="small muted mb-0 mt-1">
                      {order.pharmacy_name} · {order.pharmacy_community} · {formatDate(order.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="price">{formatMoney(order.total)}</div>
                    <div className="tiny muted">
                      {order.item_count} item{order.item_count === 1 ? '' : 's'} · {order.fulfilment === 'delivery' ? 'Delivery' : 'Pickup'}
                    </div>
                  </div>
                </div>
                {order.pending_prescriptions > 0 && (
                  <p className="small tone-warning mb-0 mt-1">
                    {order.pending_prescriptions} prescription awaiting pharmacist review.
                  </p>
                )}
                <div className="row mt-2">
                  <Link to={`/orders/${order.id}`} className="btn btn-secondary btn-sm">View &amp; track</Link>
                  {order.status === 'ready' && <span className="badge badge-success">Ready for pickup</span>}
                  {order.out_for_delivery && <span className="small muted">Rider: {order.rider_name || 'being assigned'}</span>}
                </div>
              </div>
            </article>
          ))}
          <Pagination pagination={data.pagination} onPage={setPage} />
        </div>
      )}
    </>
  );
}
