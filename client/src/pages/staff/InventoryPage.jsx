import { useState } from 'react';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { DataTable, ErrorState, Field, Loading, Modal, Pagination, Tabs } from '../../components/UI.jsx';
import { formatDate, formatMoney } from '../../utils/format.js';

const DAY = 86400000;
const defaultExpiry = () => new Date(Date.now() + 365 * DAY).toISOString().slice(0, 10);

export default function InventoryPage() {
  usePageTitle('Inventory');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [tab, setTab] = useState('overview');
  const [q, setQ] = useState('');
  const [lowOnly, setLowOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const common = `page=${page}&pageSize=20${isAdmin ? `&pharmacyId=${pharmacyId}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const overview = useFetch(`/inventory?${common}${lowOnly ? '&lowOnly=true' : ''}`, [pharmacyId, q, lowOnly, page]);
  const batches = useFetch(`/inventory/batches?${common}&includeEmpty=true`, [pharmacyId, q, page]);
  const medicines = useFetch('/medicines?pageSize=100');
  const suppliers = useFetch(`/suppliers${isAdmin ? `?pharmacyId=${pharmacyId}` : ''}`);

  const active = tab === 'overview' ? overview : batches;

  const reloadAll = () => {
    overview.reload();
    batches.reload();
  };

  const run = async (fn, message) => {
    setBusy(true);
    setNotice('');
    setActionError('');
    try {
      await fn();
      setNotice(message);
      setModal(null);
      reloadAll();
    } catch (err) {
      setActionError(err.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const receive = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    run(
      () =>
        api('/inventory/batches', {
          method: 'POST',
          body: {
            pharmacyId: isAdmin ? pharmacyId : undefined,
            medicineId: Number(data.medicineId),
            supplierId: data.supplierId ? Number(data.supplierId) : undefined,
            batchNo: data.batchNo,
            expiryDate: data.expiryDate,
            quantity: Number(data.quantity),
          },
        }),
      `Received ${data.quantity} units into batch ${data.batchNo}.`
    );
  };

  const adjust = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    run(
      () =>
        api(`/inventory/batches/${modal.batch.id}/adjust`, {
          method: 'PATCH',
          body: { delta: Number(data.delta), reason: data.reason },
        }),
      'Batch adjusted.'
    );
  };

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Inventory</h1>
          <p>{tab === 'overview' ? 'By medicine' : 'By batch'}</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setActionError('');
              setModal({ type: 'receive' });
            }}
          >
            Receive stock
          </button>
        </div>
      </div>

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <p className="success-text">{notice}</p>}

      <Tabs
        tabs={[
          { value: 'overview', label: 'By medicine' },
          { value: 'batches', label: 'By batch' },
        ]}
        active={tab}
        onChange={(value) => {
          setTab(value);
          setPage(1);
        }}
      />

      <div className="toolbar">
        <div className="toolbar-search">
          <label className="sr-only" htmlFor="inventory-q">
            Search inventory
          </label>
          <input
            id="inventory-q"
            value={q}
            onChange={(event) => {
              setQ(event.target.value);
              setPage(1);
            }}
            placeholder="Medicine or batch number"
          />
        </div>
        {tab === 'overview' && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={lowOnly}
              onChange={(event) => {
                setLowOnly(event.target.checked);
                setPage(1);
              }}
            />
            Low stock only
          </label>
        )}
      </div>

      {active.error && <ErrorState error={active.error} retry={active.reload} />}
      {active.loading && <Loading />}

      {!active.loading && !active.error && tab === 'overview' && (
        <>
          <DataTable
            rows={active.data?.items || []}
            rowKey="medicine_id"
            empty="No stock lines match."
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
                    <div className="small muted">{row.requires_prescription ? 'Rx' : 'OTC'}</div>
                  </>
                ),
              },
              { key: 'price', label: 'Price', align: 'right', render: (row) => formatMoney(row.price) },
              { key: 'stock', label: 'Stock', align: 'right', render: (row) => <strong>{row.stock}</strong> },
              { key: 'reorder_level', label: 'Reorder at', align: 'right' },
              {
                key: 'status',
                label: 'Status',
                render: (row) =>
                  row.stock === 0 ? 'Out of stock' : row.stock <= row.reorder_level ? 'Low' : 'In stock',
              },
            ]}
          />
          <Pagination pagination={active.data?.pagination} onPage={setPage} />
        </>
      )}

      {!active.loading && !active.error && tab === 'batches' && (
        <>
          <DataTable
            rows={active.data?.items || []}
            empty="No batches match."
            columns={[
              {
                key: 'brand_name',
                label: 'Medicine',
                render: (batch) => (
                  <>
                    <strong>
                      {batch.brand_name}
                      {batch.strength ? ` ${batch.strength}` : ''}
                    </strong>
                    <div className="small muted">{batch.batch_no}</div>
                  </>
                ),
              },
              {
                key: 'expiry_date',
                label: 'Expiry',
                render: (batch) => (
                  <>
                    {formatDate(batch.expiry_date)}
                    <div className="small muted">
                      {batch.days_left >= 0 ? `${batch.days_left} days left` : 'Expired'}
                    </div>
                  </>
                ),
              },
              {
                key: 'quantity_on_hand',
                label: 'On hand',
                align: 'right',
                render: (batch) => <strong>{batch.quantity_on_hand}</strong>,
              },
              {
                key: 'actions',
                label: '',
                render: (batch) => (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setActionError('');
                      setModal({ type: 'adjust', batch });
                    }}
                  >
                    Adjust
                  </button>
                ),
              },
            ]}
          />
          <Pagination pagination={active.data?.pagination} onPage={setPage} />
        </>
      )}

      <Modal
        open={modal?.type === 'receive'}
        onClose={() => setModal(null)}
        title="Receive stock"
        footer={
          <div className="detail-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="submit" form="receive-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : 'Receive'}
            </button>
          </div>
        }
      >
        <form id="receive-form" onSubmit={receive}>
          {actionError && <p className="error-text">{actionError}</p>}
          <Field label="Medicine" htmlFor="receive-medicine" required>
            <select id="receive-medicine" name="medicineId" required>
              <option value="">Choose a medicine</option>
              {(medicines.data?.items || []).map((medicine) => (
                <option key={medicine.id} value={medicine.id}>
                  {medicine.brand_name}
                  {medicine.strength ? ` ${medicine.strength}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supplier (optional)" htmlFor="receive-supplier">
            <select id="receive-supplier" name="supplierId">
              <option value="">No supplier</option>
              {(suppliers.data?.items || []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Batch number" htmlFor="receive-batch" required>
            <input id="receive-batch" name="batchNo" required />
          </Field>
          <Field label="Expiry date" htmlFor="receive-expiry" required>
            <input id="receive-expiry" name="expiryDate" type="date" defaultValue={defaultExpiry()} required />
          </Field>
          <Field label="Quantity received" htmlFor="receive-quantity" required>
            <input id="receive-quantity" name="quantity" type="number" min="1" inputMode="numeric" required />
          </Field>
        </form>
      </Modal>

      <Modal
        open={modal?.type === 'adjust'}
        onClose={() => setModal(null)}
        title={modal?.batch ? `Batch ${modal.batch.batch_no}` : 'Adjust batch'}
        footer={
          <div className="detail-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button type="submit" form="adjust-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="adjust-form" onSubmit={adjust}>
          {actionError && <p className="error-text">{actionError}</p>}
          <p className="muted">Current quantity: {modal?.batch?.quantity_on_hand}</p>
          <Field label="Adjustment" htmlFor="adjust-delta" required hint="Use a negative number to write off stock.">
            <input id="adjust-delta" name="delta" type="number" inputMode="numeric" required />
          </Field>
          <Field label="Reason" htmlFor="adjust-reason" required>
            <textarea id="adjust-reason" name="reason" rows={3} maxLength={300} required />
          </Field>
        </form>
      </Modal>
    </>
  );
}
