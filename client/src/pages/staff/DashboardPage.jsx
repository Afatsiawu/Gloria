import { Link } from 'react-router-dom';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import { Badge, ErrorState, PageHeader, SkeletonCards, StatCard, StatusBadge } from '../../components/UI.jsx';
import { formatDate, formatMoney } from '../../utils/format.js';

export default function DashboardPage() {
  usePageTitle('Staff dashboard');
  const { user } = useStaffPharmacy();
  const { data, loading, error, reload } = useFetch('/dashboard');

  if (loading) return <SkeletonCards count={6} />;
  if (error) return <ErrorState error={error} retry={reload} />;
  if (!data) return null;

  const isAdmin = user?.role === 'admin';

  return (
    <>
      <PageHeader
        eyebrow={isAdmin ? 'Network overview' : user?.pharmacy_name || 'Your pharmacy'}
        title={`Good day, ${user?.full_name?.split(' ')[0] || 'colleague'}`}
        subtitle={
          isAdmin
            ? 'Network-wide activity across all 10 pharmacies. Choose a pharmacy from the staff pages to manage one outlet.'
            : 'Today’s sales, orders, prescription queue and stock risks at a glance.'
        }
        actions={
          <div className="row">
            <Link to="/staff/orders" className="btn btn-secondary btn-sm">Order queue</Link>
            <Link to="/staff/prescriptions" className="btn btn-primary btn-sm">Prescription queue</Link>
          </div>
        }
      />

      <div className="stat-grid">
        <StatCard label="Sales today" value={formatMoney(data.sales.today)} hint={`${data.sales.orders_today} paid order(s)`} tone="success" icon="Money" />
        <StatCard label="Sales this month" value={formatMoney(data.sales.month)} hint="Excludes cancelled orders" icon="ChartUp" />
        <StatCard label="Active orders" value={data.orders.active} hint="Placed through out for delivery" tone="info" icon="Box" />
        <StatCard label="Prescriptions waiting" value={data.orders.pending_prescriptions} hint="Needs pharmacist review" tone={data.orders.pending_prescriptions ? 'warning' : 'success'} icon="Clipboard" />
        <StatCard label="Low stock lines" value={data.stock.low_stock} hint={`${data.stock.out_of_stock ?? 0} out of stock`} tone={data.stock.low_stock ? 'danger' : 'success'} icon="Warning" />
        <StatCard label="Expiring batches" value={data.stock.expiring_batches} hint={`${data.stock.expired_batches ?? 0} already expired`} tone={data.stock.expiring_batches ? 'warning' : 'success'} icon="Calendar" />
      </div>

      {isAdmin && data.system && (
        <div className="grid grid-4 mt-2">
          <StatCard label="Pharmacies" value={data.system.pharmacies} icon="Hospital" />
          <StatCard label="Active users" value={data.system.users} icon="Users" />
          <StatCard label="Customers" value={data.system.customers} icon="Person" />
          <StatCard label="Medicines" value={data.system.medicines} icon="Pill" />
        </div>
      )}

      {data.alerts && (data.alerts.low_stock.length > 0 || data.alerts.expiring.length > 0 || data.alerts.expired.length > 0) && (
        <section className="card mt-3">
          <div className="card-header">
            <h2>Stock risks that need attention</h2>
            <Link to="/staff/alerts" className="btn btn-ghost btn-sm">All alerts</Link>
          </div>
          <div className="card-body">
            <div className="grid grid-3">
              <div>
                <h3>Low stock</h3>
                <div className="alert-list">
                  {data.alerts.low_stock.length === 0 && <p className="small muted">Nothing below reorder level.</p>}
                  {data.alerts.low_stock.map((row) => (
                    <div className="alert-item" key={`low-${row.pharmacy_id || ''}-${row.medicine_id}`}>
                      <span className="alert-dot danger" aria-hidden="true" />
                      <div>
                        <strong>{row.brand_name}{row.strength ? ` ${row.strength}` : ''}</strong>
                        <div className="tiny muted">Stock {row.stock} · reorder at {row.reorder_level}{row.pharmacy_name ? ` · ${row.pharmacy_name}` : ''}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3>Expiring soon</h3>
                <div className="alert-list">
                  {data.alerts.expiring.length === 0 && <p className="small muted">No batches inside the alert window.</p>}
                  {data.alerts.expiring.map((row) => (
                    <div className="alert-item" key={`exp-${row.id}`}>
                      <span className="alert-dot info" aria-hidden="true" />
                      <div>
                        <strong>{row.brand_name}{row.strength ? ` ${row.strength}` : ''}</strong>
                        <div className="tiny muted">Batch {row.batch_no} · {row.quantity_on_hand} units · expires {formatDate(row.expiry_date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3>Expired</h3>
                <div className="alert-list">
                  {data.alerts.expired.length === 0 && <p className="small muted">No expired stock on hand.</p>}
                  {data.alerts.expired.map((row) => (
                    <div className="alert-item" key={`expired-${row.id}`}>
                      <span className="alert-dot danger" aria-hidden="true" />
                      <div>
                        <strong>{row.brand_name}{row.strength ? ` ${row.strength}` : ''}</strong>
                        <div className="tiny muted">Batch {row.batch_no} · {row.quantity_on_hand} units · expired {formatDate(row.expiry_date)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="card mt-3">
        <div className="card-header">
          <h2>Recent orders</h2>
          <Link to="/staff/orders" className="btn btn-ghost btn-sm">Open order queue</Link>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Reference</th>
                <th>Customer</th>
                <th>Pharmacy</th>
                <th>Status</th>
                <th className="text-right">Total</th>
                <th>Placed</th>
              </tr>
            </thead>
            <tbody>
              {data.recent_orders?.map((order) => (
                <tr key={order.id}>
                  <td><Link to={`/orders/${order.id}`}>{order.reference}</Link></td>
                  <td>{order.customer_name || 'Walk-in'}</td>
                  <td>{order.pharmacy_name}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td className="text-right">{formatMoney(order.total)}</td>
                  <td className="nowrap small muted">{formatDate(order.created_at)}</td>
                </tr>
              ))}
              {!data.recent_orders?.length && (
                <tr><td colSpan={6} className="muted">No orders yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card mt-3">
        <div className="card-header"><h2>Quick actions</h2></div>
        <div className="card-body">
          <div className="row">
            <Link to="/staff/walk-in" className="btn btn-secondary">Record walk-in sale</Link>
            <Link to="/staff/inventory" className="btn btn-secondary">Receive stock</Link>
            <Link to="/staff/purchase-orders" className="btn btn-secondary">Raise purchase order</Link>
            <Link to="/staff/reports" className="btn btn-secondary">Download report</Link>
            <Link to="/staff/deliveries" className="btn btn-secondary">Plan deliveries</Link>
            <Link to="/staff/alerts" className="btn btn-secondary">Review alerts</Link>
          </div>
        </div>
      </section>
    </>
  );
}
