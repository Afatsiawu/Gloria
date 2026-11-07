import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { Badge, EmptyState, ErrorState, PageHeader, Skeleton, Tabs } from '../../components/UI.jsx';
import { formatDate } from '../../utils/format.js';

export default function AlertsPage() {
  usePageTitle('Stock alerts');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [tab, setTab] = useState('low');
  const [days, setDays] = useState(90);
  const [allPharmacies, setAllPharmacies] = useState(false);

  const scoped = isAdmin && !allPharmacies;
  const query = `${dayParam(days)}${scoped ? `&pharmacyId=${pharmacyId}` : ''}`;
  const { data, loading, error, reload } = useFetch(`/inventory/alerts?${query}`);

  const low = data?.low_stock || [];
  const expiring = data?.expiring || [];
  const expired = data?.expired || [];

  return (
    <>
      <PageHeader
        eyebrow="Inventory risk"
        title="Stock alerts"
        subtitle="Low stock compared with each pharmacy’s reorder level, batches approaching expiry, and expired stock still on hand."
        actions={<Link to="/staff/purchase-orders" className="btn btn-primary btn-sm">Raise purchase order</Link>}
      />

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {isAdmin && (
        <label className="checkbox mb-2">
          <input type="checkbox" checked={allPharmacies} onChange={(event) => setAllPharmacies(event.target.checked)} />
          Show all 10 pharmacies
        </label>
      )}

      <div className="row between mb-2">
        <div className="field">
          <label htmlFor="alert-days">Expiry window (days)</label>
          <input
            id="alert-days"
            type="number"
            min="1"
            max="730"
            value={days}
            className="qty-input"
            onChange={(event) => setDays(event.target.value)}
          />
        </div>
        <p className="small muted mb-0">Window in use: {data?.days ?? days} days</p>
      </div>

      <Tabs
        tabs={[
          { value: 'low', label: 'Low stock', count: low.length },
          { value: 'expiring', label: 'Expiring', count: expiring.length },
          { value: 'expired', label: 'Expired', count: expired.length },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error && <ErrorState error={error} retry={reload} />}
      {loading && <Skeleton lines={6} />}

      {!loading && !error && tab === 'low' && (
        low.length === 0 ? <EmptyState title="No low-stock items">Every active medicine is above its reorder level.</EmptyState> : (
          <div className="table-wrap card">
            <table>
              <thead><tr><th>Medicine</th><th>Pharmacy</th><th className="text-right">Stock</th><th className="text-right">Reorder level</th><th>Status</th></tr></thead>
              <tbody>
                {low.map((row) => (
                  <tr key={`${row.pharmacy_id || ''}-${row.medicine_id}`}>
                    <td><strong>{row.brand_name}{row.strength ? ` ${row.strength}` : ''}</strong><div className="tiny muted">{row.generic_name}</div></td>
                    <td>{row.pharmacy_name || 'Your pharmacy'}{row.community ? <div className="tiny muted">{row.community}</div> : null}</td>
                    <td className="text-right">{row.stock}</td>
                    <td className="text-right">{row.reorder_level}</td>
                    <td><Badge tone={row.stock === 0 ? 'danger' : 'warning'}>{row.stock === 0 ? 'Out of stock' : 'Reorder'}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {!loading && !error && tab === 'expiring' && (
        expiring.length === 0 ? <EmptyState title="No batches expiring in this window">Try widening the expiry window.</EmptyState> : (
          <div className="table-wrap card">
            <table>
              <thead><tr><th>Medicine</th><th>Batch</th><th>Pharmacy</th><th>Expiry</th><th className="text-right">Days left</th><th className="text-right">On hand</th></tr></thead>
              <tbody>
                {expiring.map((row) => (
                  <tr key={`${row.pharmacy_id}-${row.id}`}>
                    <td>{row.brand_name}{row.strength ? ` ${row.strength}` : ''}</td>
                    <td>{row.batch_no}</td>
                    <td>{row.pharmacy_name || 'Your pharmacy'}</td>
                    <td>{formatDate(row.expiry_date)}</td>
                    <td className="text-right"><Badge tone={row.days_left <= 30 ? 'danger' : 'warning'}>{row.days_left}</Badge></td>
                    <td className="text-right">{row.quantity_on_hand}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {!loading && !error && tab === 'expired' && (
        expired.length === 0 ? <EmptyState title="No expired stock on hand">Expired batches are excluded from sale automatically.</EmptyState> : (
          <div className="table-wrap card">
            <table>
              <thead><tr><th>Medicine</th><th>Batch</th><th>Pharmacy</th><th>Expired on</th><th className="text-right">On hand</th><th>Action</th></tr></thead>
              <tbody>
                {expired.map((row) => (
                  <tr key={`${row.pharmacy_id}-${row.id}`}>
                    <td>{row.brand_name}{row.strength ? ` ${row.strength}` : ''}</td>
                    <td>{row.batch_no}</td>
                    <td>{row.pharmacy_name || 'Your pharmacy'}</td>
                    <td>{formatDate(row.expiry_date)}</td>
                    <td className="text-right">{row.quantity_on_hand}</td>
                    <td><Link to="/staff/inventory" className="btn btn-secondary btn-sm">Write off</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </>
  );
}

function dayParam(days) {
  return `days=${Number(days) || 90}`;
}
