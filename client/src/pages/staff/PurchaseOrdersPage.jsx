import { useState } from 'react';
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
  Skeleton,
  statusText,
} from '../../components/UI.jsx';
import { formatDate, formatMoney } from '../../utils/format.js';

const DAY = 86400000;
const defaultExpiry = () => new Date(Date.now() + 365 * DAY).toISOString().slice(0, 10);
const emptyLine = () => ({ medicineId: '', quantityOrdered: 10, unitCost: 0 });

export default function PurchaseOrdersPage() {
  usePageTitle('Purchase orders');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [lines, setLines] = useState([emptyLine()]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const query = `${isAdmin ? `?pharmacyId=${pharmacyId}${status ? `&status=${status}` : ''}` : status ? `?status=${status}` : ''}`;
  const list = useFetch(`/purchase-orders${query}`);
  const suppliers = useFetch(`/suppliers${isAdmin ? `?pharmacyId=${pharmacyId}` : ''}`);
  const medicines = useFetch('/medicines?pageSize=100');
  const detail = useFetch(selectedId ? `/purchase-orders/${selectedId}` : null);

  const reload = () => {
    list.reload();
    if (selectedId) detail.reload();
  };

  const run = async (fn, message) => {
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      await fn();
      setNotice(message);
      reload();
      return true;
    } catch (err) {
      setError(err);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async (event) => {
    event.preventDefault();
    const valid = lines.filter((line) => line.medicineId && Number(line.quantityOrdered) > 0);
    if (!valid.length) {
      setError(new Error('Add at least one medicine line.'));
      return;
    }
    const ok = await run(
      () => api('/purchase-orders', {
        method: 'POST',
        body: {
          pharmacyId: isAdmin ? pharmacyId : undefined,
          supplierId: Number(event.target.supplierId.value),
          items: valid.map((line) => ({
            medicineId: Number(line.medicineId),
            quantityOrdered: Number(line.quantityOrdered),
            unitCost: Number(line.unitCost) || 0,
          })),
        },
      }),
      'Draft purchase order created.'
    );
    if (ok) {
      setCreating(false);
      setLines([emptyLine()]);
    }
  };

  const updateLine = (index, key, value) =>
    setLines((current) => current.map((line, i) => (i === index ? { ...line, [key]: value } : line)));

  const receive = (event) => {
    event.preventDefault();
    const po = detail.data?.purchaseOrder;
    const rows = [...event.target.querySelectorAll('[data-receive-line]')];
    const items = rows
      .map((row) => {
        const quantity = Number(row.querySelector('[name="quantity"]').value);
        if (!quantity) return null;
        return {
          purchaseOrderItemId: Number(row.dataset.id),
          quantityReceived: quantity,
          batchNo: row.querySelector('[name="batchNo"]').value,
          expiryDate: row.querySelector('[name="expiryDate"]').value,
        };
      })
      .filter(Boolean);
    if (!items.length) {
      setError(new Error('Enter a quantity for at least one line.'));
      return;
    }
    run(
      () => api(`/purchase-orders/${po.id}/receive`, { method: 'POST', body: { items } }),
      'Goods received. New batches are now available for sale.'
    );
  };

  const items = list.data?.items || [];
  const po = detail.data?.purchaseOrder;

  return (
    <>
      <PageHeader
        eyebrow="Procurement"
        title="Purchase orders"
        subtitle="Raise orders with suppliers, mark them ordered and receive goods into tracked batches with expiry dates."
        actions={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => { setError(null); setCreating(true); }}>
            New purchase order
          </button>
        }
      />

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <Alert tone="success">{notice}</Alert>}
      {error && !selectedId && !creating && <Alert tone="error">{error.message}</Alert>}

      <div className="chips mb-2">
        {[['', 'All'], ['draft', 'Draft'], ['ordered', 'Ordered'], ['received', 'Received'], ['cancelled', 'Cancelled']].map(([value, label]) => (
          <button key={value || 'all'} type="button" className={`chip ${status === value ? 'active' : ''}`} onClick={() => setStatus(value)}>
            {label}
          </button>
        ))}
      </div>

      {list.error && <ErrorState error={list.error} retry={list.reload} />}
      {list.loading && <Skeleton lines={6} />}

      {!list.loading && !list.error && items.length === 0 && (
        <EmptyState title="No purchase orders yet" action={<button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>Raise your first order</button>}>
          Purchase orders help you restock low items and record supplier batches.
        </EmptyState>
      )}

      {!list.loading && items.length > 0 && (
        <div className="table-wrap card">
          <table>
            <thead>
              <tr>
                <th>PO</th>
                <th>Supplier</th>
                <th>Status</th>
                <th className="text-right">Lines</th>
                <th className="text-right">Value</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((order) => (
                <tr key={order.id}>
                  <td><strong>PO-{String(order.id).padStart(4, '0')}</strong></td>
                  <td>{order.supplier_name}</td>
                  <td><Badge tone={order.status === 'received' ? 'success' : order.status === 'cancelled' ? 'danger' : order.status === 'ordered' ? 'info' : 'neutral'}>{statusText(order.status)}</Badge></td>
                  <td className="text-right">{order.item_count}</td>
                  <td className="text-right">{formatMoney(order.order_value)}</td>
                  <td className="small muted">{formatDate(order.created_at)}</td>
                  <td>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setError(null); setSelectedId(order.id); }}>
                      Open
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="New purchase order" wide
        footer={
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
            <button type="submit" form="po-create-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Create draft'}</button>
          </div>
        }
      >
        <form id="po-create-form" onSubmit={create} className="stack">
          {error && <Alert tone="error">{error.message}</Alert>}
          <Field label="Supplier" htmlFor="po-supplier" required>
            <select id="po-supplier" name="supplierId" required>
              <option value="">Choose a supplier</option>
              {(suppliers.data?.items || []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
              ))}
            </select>
          </Field>
          <div className="walkin-lines">
            {lines.map((line, index) => (
              <div className="walkin-line" key={index}>
                <div className="field full">
                  <label htmlFor={`po-medicine-${index}`}>Medicine</label>
                  <select id={`po-medicine-${index}`} value={line.medicineId} onChange={(event) => updateLine(index, 'medicineId', event.target.value)}>
                    <option value="">Choose a medicine</option>
                    {(medicines.data?.items || []).map((medicine) => (
                      <option key={medicine.id} value={medicine.id}>{medicine.brand_name}{medicine.strength ? ` ${medicine.strength}` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`po-qty-${index}`}>Quantity</label>
                  <input id={`po-qty-${index}`} type="number" min="1" value={line.quantityOrdered} onChange={(event) => updateLine(index, 'quantityOrdered', event.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor={`po-cost-${index}`}>Unit cost (GHS)</label>
                  <input id={`po-cost-${index}`} type="number" min="0" step="0.01" value={line.unitCost} onChange={(event) => updateLine(index, 'unitCost', event.target.value)} />
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} disabled={lines.length === 1}>Remove</button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLines((current) => [...current, emptyLine()])}>Add another line</button>
        </form>
      </Modal>

      <Modal open={Boolean(selectedId)} onClose={() => setSelectedId(null)} title={po ? `PO-${String(po.id).padStart(4, '0')}` : 'Purchase order'} wide
        footer={<button type="button" className="btn btn-ghost" onClick={() => setSelectedId(null)}>Close</button>}
      >
        {detail.loading && <Skeleton lines={5} />}
        {detail.error && <ErrorState error={detail.error} retry={detail.reload} />}
        {po && (
          <div className="stack">
            {error && <Alert tone="error">{error.message}</Alert>}
            <div className="row between">
              <div>
                <strong>{po.supplier_name}</strong>
                <div className="small muted">{po.supplier_phone} {po.supplier_email ? `· ${po.supplier_email}` : ''}</div>
              </div>
              <Badge tone={po.status === 'received' ? 'success' : po.status === 'cancelled' ? 'danger' : 'info'}>{statusText(po.status)}</Badge>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Medicine</th><th className="text-right">Ordered</th><th className="text-right">Received</th><th className="text-right">Outstanding</th><th className="text-right">Unit cost</th></tr>
                </thead>
                <tbody>
                  {po.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.brand_name}{item.strength ? ` ${item.strength}` : ''}</td>
                      <td className="text-right">{item.quantity_ordered}</td>
                      <td className="text-right">{item.quantity_received}</td>
                      <td className="text-right">{item.outstanding}</td>
                      <td className="text-right">{formatMoney(item.unit_cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {po.status === 'draft' && (
              <div className="row">
                <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run(() => api(`/purchase-orders/${po.id}/status`, { method: 'PATCH', body: { status: 'ordered' } }), 'Purchase order marked ordered.')}>
                  Mark as ordered
                </button>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={() => run(() => api(`/purchase-orders/${po.id}/status`, { method: 'PATCH', body: { status: 'cancelled' } }), 'Purchase order cancelled.')}>
                  Cancel PO
                </button>
              </div>
            )}

            {po.status === 'ordered' && (
              <form onSubmit={receive} className="stack">
                <h3>Receive goods</h3>
                <p className="small muted">Enter the quantity delivered and a batch number/expiry for each line. Leave blank to receive later.</p>
                {po.items.filter((item) => item.outstanding > 0).map((item) => (
                  <div className="walkin-line" key={item.id} data-receive-line data-id={item.id}>
                    <div className="field full">
                      <label>{item.brand_name} <span className="small muted">({item.outstanding} outstanding)</span></label>
                      <input name="batchNo" placeholder="Batch number" required />
                    </div>
                    <div className="field">
                      <label>Quantity</label>
                      <input name="quantity" type="number" min="0" max={item.outstanding} defaultValue={item.outstanding} />
                    </div>
                    <div className="field">
                      <label>Expiry</label>
                      <input name="expiryDate" type="date" defaultValue={defaultExpiry()} required />
                    </div>
                  </div>
                ))}
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Receiving…' : 'Receive selected goods'}</button>
              </form>
            )}

            {po.status === 'received' && <Alert tone="success">This purchase order has been fully received.</Alert>}
            {po.status === 'cancelled' && <Alert tone="warning">This purchase order was cancelled and cannot receive goods.</Alert>}
          </div>
        )}
      </Modal>
    </>
  );
}
