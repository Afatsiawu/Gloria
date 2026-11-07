import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import {
  Alert,
  Badge,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageHeader,
  Pagination,
  Skeleton,
  Tabs,
} from '../../components/UI.jsx';
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
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);

  const overview = useFetch(
    `/inventory?page=${page}&pageSize=20${isAdmin ? `&pharmacyId=${pharmacyId}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}${lowOnly ? '&lowOnly=true' : ''}`
  );
  const batches = useFetch(
    `/inventory/batches?page=${page}&pageSize=20${isAdmin ? `&pharmacyId=${pharmacyId}` : ''}${q ? `&q=${encodeURIComponent(q)}` : ''}&includeEmpty=true`
  );
  const medicines = useFetch('/medicines?pageSize=100');
  const suppliers = useFetch(`/suppliers${isAdmin ? `?pharmacyId=${pharmacyId}` : ''}`);

  const active = tab === 'overview' ? overview : batches;

  const reloadAll = () => {
    overview.reload();
    batches.reload();
  };

  const run = async (fn, message) => {
    setBusy(true);
    setNotice(null);
    setActionError(null);
    try {
      await fn();
      setNotice(message);
      setModal(null);
      reloadAll();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const receive = (event) => {
    event.preventDefault();
    const form = event.target;
    const data = Object.fromEntries(new FormData(form).entries());
    run(
      () => api('/inventory/batches', {
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
      `Received ${data.quantity} unit(s) into batch ${data.batchNo}.`
    );
  };

  const adjust = (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.target).entries());
    run(
      () => api(`/inventory/batches/${modal.batch.id}/adjust`, {
        method: 'PATCH',
        body: { delta: Number(data.delta), reason: data.reason },
      }),
      'Batch adjusted and written to the stock movement log.'
    );
  };

  return (
    <>
      <PageHeader
        eyebrow="Stock control"
        title="Inventory"
        subtitle="Live stock by medicine and batch. FEFO allocation means the earliest expiry is dispensed first and expired batches are excluded."
        actions={
          <div className="row">
            <Link to="/staff/alerts" className="btn btn-secondary btn-sm">Alerts</Link>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => { setActionError(null); setModal({ type: 'receive' }); }}>
              Receive stock
            </button>
          </div>
        }
      />

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <Alert tone="success">{notice}</Alert>}

      <Tabs
        tabs={[
          { value: 'overview', label: 'By medicine' },
          { value: 'batches', label: 'By batch' },
        ]}
        active={tab}
        onChange={(value) => { setTab(value); setPage(1); }}
      />

      <div className="card mb-2">
        <div className="card-body">
          <form className="row" onSubmit={(event) => event.preventDefault()}>
            <div className="field full">
              <label htmlFor="inventory-q">Search inventory</label>
              <input id="inventory-q" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Medicine, generic name or batch number" />
            </div>
            {tab === 'overview' && (
              <label className="checkbox">
                <input type="checkbox" checked={lowOnly} onChange={(event) => { setLowOnly(event.target.checked); setPage(1); }} />
                Low stock only
              </label>
            )}
          </form>
        </div>
      </div>

      {active.error && <ErrorState error={active.error} retry={active.reload} />}
      {active.loading && <Skeleton lines={8} />}

      {!active.loading && !active.error && tab === 'overview' && (
        <>
          {(active.data?.items || []).length === 0 ? (
            <EmptyState title="No stock lines match">Try clearing the search or the low-stock filter.</EmptyState>
          ) : (
            <div className="table-wrap card">
              <table>
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Stock</th>
                    <th className="text-right">Reorder at</th>
                    <th className="text-right">Batches</th>
                    <th>Nearest expiry</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {active.data.items.map((row) => (
                    <tr key={row.medicine_id}>
                      <td>
                        <strong>{row.brand_name}{row.strength ? ` ${row.strength}` : ''}</strong>
                        <div className="tiny muted">{row.generic_name}{row.requires_prescription ? ' · Rx' : ''}</div>
                      </td>
                      <td className="text-right">{formatMoney(row.price)}</td>
                      <td className="text-right"><strong>{row.stock}</strong></td>
                      <td className="text-right">{row.reorder_level}</td>
                      <td className="text-right">{row.active_batches}</td>
                      <td className="small">{row.nearest_expiry ? formatDate(row.nearest_expiry) : '—'}</td>
                      <td>
                        {row.stock === 0 ? <Badge tone="danger">Out of stock</Badge>
                          : row.stock <= row.reorder_level ? <Badge tone="warning">Low</Badge>
                            : <Badge tone="success">Healthy</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination pagination={active.data?.pagination} onPage={setPage} />
        </>
      )}

      {!active.loading && !active.error && tab === 'batches' && (
        <>
          {(active.data?.items || []).length === 0 ? (
            <EmptyState title="No batches match">Receive stock to create a batch, or clear the search.</EmptyState>
          ) : (
            <div className="table-wrap card">
              <table>
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Batch</th>
                    <th>Supplier</th>
                    <th>Expiry</th>
                    <th className="text-right">On hand</th>
                    <th>State</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {active.data.items.map((batch) => (
                    <tr key={batch.id}>
                      <td>
                        <strong>{batch.brand_name}{batch.strength ? ` ${batch.strength}` : ''}</strong>
                        <div className="tiny muted">{batch.generic_name}</div>
                      </td>
                      <td>{batch.batch_no}</td>
                      <td className="small">{batch.supplier_name || '—'}</td>
                      <td className="small">
                        {formatDate(batch.expiry_date)}
                        <div className="tiny muted">{batch.days_left >= 0 ? `${batch.days_left} days left` : `${Math.abs(batch.days_left)} days ago`}</div>
                      </td>
                      <td className="text-right"><strong>{batch.quantity_on_hand}</strong></td>
                      <td>
                        <Badge tone={batch.expiry_state === 'expired' ? 'danger' : batch.expiry_state === 'expiring' ? 'warning' : 'success'}>
                          {batch.expiry_state}
                        </Badge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => { setActionError(null); setModal({ type: 'adjust', batch }); }}
                        >
                          Adjust
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pagination pagination={active.data?.pagination} onPage={setPage} />
        </>
      )}

      <Modal
        open={modal?.type === 'receive'}
        onClose={() => setModal(null)}
        title="Receive stock"
        footer={
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" form="receive-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Receive batch'}
            </button>
          </div>
        }
      >
        <form id="receive-form" onSubmit={receive} className="stack">
          {actionError && <Alert tone="error">{actionError.message}</Alert>}
          <Field label="Medicine" htmlFor="receive-medicine" required>
            <select id="receive-medicine" name="medicineId" required>
              <option value="">Choose a medicine</option>
              {(medicines.data?.items || []).map((medicine) => (
                <option key={medicine.id} value={medicine.id}>
                  {medicine.brand_name}{medicine.strength ? ` ${medicine.strength}` : ''} · {medicine.generic_name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Supplier (optional)" htmlFor="receive-supplier">
            <select id="receive-supplier" name="supplierId">
              <option value="">No supplier</option>
              {(suppliers.data?.items || []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Batch number" htmlFor="receive-batch" required>
              <input id="receive-batch" name="batchNo" required />
            </Field>
            <Field label="Expiry date" htmlFor="receive-expiry" required>
              <input id="receive-expiry" name="expiryDate" type="date" defaultValue={defaultExpiry()} required />
            </Field>
          </div>
          <Field label="Quantity received" htmlFor="receive-quantity" required>
            <input id="receive-quantity" name="quantity" type="number" min="1" required />
          </Field>
          <p className="hint mb-0">Expired stock cannot be received. Stock is available for sale immediately and allocated FEFO.</p>
        </form>
      </Modal>

      <Modal
        open={modal?.type === 'adjust'}
        onClose={() => setModal(null)}
        title={modal?.batch ? `Adjust batch ${modal.batch.batch_no}` : 'Adjust batch'}
        footer={
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" form="adjust-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save adjustment'}
            </button>
          </div>
        }
      >
        <form id="adjust-form" onSubmit={adjust} className="stack">
          {actionError && <Alert tone="error">{actionError.message}</Alert>}
          <p className="small muted">
            Current quantity: <strong>{modal?.batch?.quantity_on_hand}</strong>. Use a negative number to write off
            damages, returns or expired stock.
          </p>
          <Field label="Adjustment" htmlFor="adjust-delta" required hint="For example -5 for a write-off, 10 for a count correction.">
            <input id="adjust-delta" name="delta" type="number" required />
          </Field>
          <Field label="Reason" htmlFor="adjust-reason" required>
            <textarea id="adjust-reason" name="reason" rows={3} maxLength={300} required />
          </Field>
          <p className="hint mb-0">Adjustments cannot make stock negative and are recorded in the stock movement log.</p>
        </form>
      </Modal>
    </>
  );
}
