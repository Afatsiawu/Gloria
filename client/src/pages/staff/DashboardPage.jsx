import { Link } from 'react-router-dom';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import { DataTable, ErrorState, Loading, StatusBadge } from '../../components/UI.jsx';
import { formatDate, formatMoney } from '../../utils/format.js';

export default function DashboardPage() {
  usePageTitle('Dashboard');
  const { user } = useStaffPharmacy();
  const { data, loading, error, reload } = useFetch('/dashboard');

  if (loading) return <Loading />;
  if (error) return <ErrorState error={error} retry={reload} />;
  if (!data) return null;

  const alerts = data.alerts;
  const alertParts = [];
  if (alerts?.low_stock?.length) alertParts.push(`${alerts.low_stock.length} low stock`);
  if (alerts?.expiring?.length) alertParts.push(`${alerts.expiring.length} expiring soon`);
  if (alerts?.expired?.length) alertParts.push(`${alerts.expired.length} expired`);
  const tiles = [
    { label: 'Orders today', value: data.sales?.orders_today ?? 0, to: '/staff/orders' },
    { label: 'Prescriptions waiting', value: data.orders?.pending_prescriptions ?? 0, to: '/staff/prescriptions' },
    { label: 'Low stock', value: data.stock?.low_stock ?? 0, to: '/staff/alerts' },
    { label: 'Expiring soon', value: data.stock?.expiring_batches ?? 0, to: '/staff/alerts' },
  ];

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Dashboard</h1>
          <p>{user?.pharmacy_name || 'All pharmacies'}</p>
        </div>
        <div className="page-actions">
          <Link to="/staff/orders" className="btn btn-primary">
            Order queue
          </Link>
        </div>
      </div>

      <div className="summary-tiles">
        {tiles.map((tile) => (
          <Link key={tile.label} to={tile.to} className="summary-tile">
            <span className="summary-value">{tile.value}</span>
            <span className="summary-label">{tile.label}</span>
          </Link>
        ))}
      </div>

      {alertParts.length > 0 && (
        <div className={`info-bar ${alerts?.expired?.length ? 'danger' : ''}`.trim()}>
          <span>{alertParts.join(', ')}.</span>
          <Link to="/staff/alerts">View stock alerts</Link>
        </div>
      )}

      {data.orders?.pending_prescriptions > 0 && (
        <div className="info-bar">
          <span>
            {data.orders.pending_prescriptions} prescription
            {data.orders.pending_prescriptions === 1 ? '' : 's'} waiting for review.
          </span>
          <Link to="/staff/prescriptions">Review</Link>
        </div>
      )}

      <h2 className="section-heading">Recent orders</h2>
      <DataTable
        rows={data.recent_orders || []}
        empty="No orders yet."
        columns={[
          {
            key: 'reference',
            label: 'Reference',
            render: (order) => <Link to={`/orders/${order.id}`}>{order.reference}</Link>,
          },
          { key: 'customer', label: 'Customer', render: (order) => order.customer_name || 'Walk-in' },
          { key: 'status', label: 'Status', render: (order) => <StatusBadge status={order.status} /> },
          {
            key: 'total',
            label: 'Total',
            align: 'right',
            render: (order) => formatMoney(order.total),
          },
          {
            key: 'created_at',
            label: 'Placed',
            render: (order) => <span className="nowrap">{formatDate(order.created_at)}</span>,
          },
        ]}
      />
    </>
  );
}
