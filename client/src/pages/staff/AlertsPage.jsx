import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { DataTable, ErrorState, Loading, Tabs } from '../../components/UI.jsx';
import { formatDate } from '../../utils/format.js';

export default function AlertsPage() {
  usePageTitle('Stock alerts');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [tab, setTab] = useState('low');
  const [days, setDays] = useState(90);
  const [allPharmacies, setAllPharmacies] = useState(false);

  const scoped = isAdmin && !allPharmacies;
  const query = `days=${Number(days) || 90}${scoped ? `&pharmacyId=${pharmacyId}` : ''}`;
  const { data, loading, error, reload } = useFetch(`/inventory/alerts?${query}`, [days, pharmacyId, allPharmacies]);

  const low = data?.low_stock || [];
  const expiring = data?.expiring || [];
  const expired = data?.expired || [];

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Stock alerts</h1>
          <p>{data?.days ?? days}-day expiry window</p>
        </div>
        <div className="page-actions">
          <Link to="/staff/purchase-orders" className="btn btn-primary">
            Raise purchase order
          </Link>
        </div>
      </div>

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {isAdmin && (
        <label className="checkbox">
          <input
            type="checkbox"
            checked={allPharmacies}
            onChange={(event) => setAllPharmacies(event.target.checked)}
          />
          All pharmacies
        </label>
      )}

      <div className="toolbar">
        <label className="inline-field" htmlFor="alert-days">
          <span>Expiry window (days)</span>
          <input
            id="alert-days"
            type="number"
            min="1"
            max="730"
            inputMode="numeric"
            value={days}
            onChange={(event) => setDays(event.target.value)}
          />
        </label>
      </div>

      <Tabs
        tabs={[
          { value: 'low', label: `Low stock (${low.length})` },
          { value: 'expiring', label: `Expiring (${expiring.length})` },
          { value: 'expired', label: `Expired (${expired.length})` },
        ]}
        active={tab}
        onChange={setTab}
      />

      {error && <ErrorState error={error} retry={reload} />}
      {loading && <Loading />}

      {!loading && !error && tab === 'low' && (
        <DataTable
          rows={low}
          rowKey={(row) => `${row.pharmacy_id || ''}-${row.medicine_id}`}
          empty="No low-stock items."
          columns={[
            {
              key: 'brand_name',
              label: 'Medicine',
              render: (row) => (
                <>
                  <strong>
                    {row.brand_name}
                    {row.strength ? ` ${row.strength}` : ''}
                  </strong>
                  <div className="small muted">{row.generic_name}</div>
                </>
              ),
            },
            { key: 'stock', label: 'Stock', align: 'right' },
            { key: 'reorder_level', label: 'Reorder at', align: 'right' },
            {
              key: 'status',
              label: 'Status',
              render: (row) => (row.stock === 0 ? 'Out of stock' : 'Reorder'),
            },
          ]}
        />
      )}

      {!loading && !error && tab === 'expiring' && (
        <DataTable
          rows={expiring}
          rowKey={(row) => `${row.pharmacy_id}-${row.id}`}
          empty="No batches expiring in this window."
          columns={[
            {
              key: 'brand_name',
              label: 'Medicine',
              render: (row) => (
                <>
                  {row.brand_name}
                  {row.strength ? ` ${row.strength}` : ''}
                  <div className="small muted">{row.batch_no}</div>
                </>
              ),
            },
            { key: 'expiry_date', label: 'Expiry', render: (row) => formatDate(row.expiry_date) },
            { key: 'days_left', label: 'Days left', align: 'right' },
            { key: 'quantity_on_hand', label: 'On hand', align: 'right' },
          ]}
        />
      )}

      {!loading && !error && tab === 'expired' && (
        <DataTable
          rows={expired}
          rowKey={(row) => `${row.pharmacy_id}-${row.id}`}
          empty="No expired stock on hand."
          columns={[
            {
              key: 'brand_name',
              label: 'Medicine',
              render: (row) => (
                <>
                  {row.brand_name}
                  {row.strength ? ` ${row.strength}` : ''}
                  <div className="small muted">{row.batch_no}</div>
                </>
              ),
            },
            { key: 'expiry_date', label: 'Expired on', render: (row) => formatDate(row.expiry_date) },
            { key: 'quantity_on_hand', label: 'On hand', align: 'right' },
            {
              key: 'action',
              label: '',
              render: () => (
                <Link to="/staff/inventory" className="btn btn-secondary btn-sm">
                  Write off
                </Link>
              ),
            },
          ]}
        />
      )}
    </>
  );
}
