import { useState } from 'react';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { DataTable, ErrorState, Field, Loading, Modal, statusText } from '../../components/UI.jsx';
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
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const query = `${isAdmin ? `?pharmacyId=${pharmacyId}${status ? `&status=${status}` : ''}` : status ? `?status=${status}` : ''}`;
  const list = useFetch(`/purchase-orders${query}`, [pharmacyId, status]);
  const suppliers = useFetch(`/suppliers${isAdmin ? `?pharmacyId=${pharmacyId}` : ''}`);
  const medicines = useFetch('/medicines?pageSize=100');
  const detail = useFetch(selectedId ? `/purchase-orders/${selectedId}` : null);

  const reload = () => {
    list.reload();
    if (selectedId) detail.reload();
  };

  const run = async (fn, message) => {
    setBusy(true);
    setNotice('');
    setError('');
    try {
      await fn();
      setNotice(message);
      reload();
      return true;
    } catch (err) {
      setError(err.message || 'Could not save.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const create = async (event) => {
    event.preventDefault();
    const valid = lines.filter((line) => line.medicineId && Number(line.quantityOrdered) > 0);
    if (!valid.length) {
      setError('Add at least one medicine line.');
      return;
    }
    const ok = await run(
      () =>
        api('/purchase-orders', {
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
      setError('Enter a quantity for at least one line.');
      return;
    }
    run(
      () => api(`/purchase-orders/${po.id}/receive`, { method: 'POST', body: { items } }),
      'Goods received.'
    );
  };

  const items = list.data?.items || [];
  const po = detail.data?.purchaseOrder;

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Purchase orders</h1>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setError('');
              setCreating(true);
            }}
          >
            New purchase order
          </button>
        </div>
      </div>

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && !selectedId && !creating && <p className="success-text">{notice}</p>}
      {error && !selectedId && !creating && <p className="error-text">{error}</p>}

      <div className="toolbar">
        <select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">All</option>
          <option value="draft">Draft</option>
          <option value="ordered">Ordered</option>
          <option value="received">Received</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {list.error && <ErrorState error={list.error} retry={list.reload} />}
      {list.loading && <Loading />}

      {!list.loading && !list.error && (
        <DataTable
          rows={items}
          empty="No purchase orders yet."
          columns={[
            {
              key: 'id',
              label: 'PO',
              render: (order) => <strong>PO-{String(order.id).padStart(4, '0')}</strong>,
            },
            { key: 'supplier_name', label: 'Supplier' },
            { key: 'status', label: 'Status', render: (order) => statusText(order.status) },
            { key: 'order_value', label: 'Value', align: 'right', render: (order) => formatMoney(order.order_value) },
            { key: 'created_at', label: 'Created', render: (order) => formatDate(order.created_at) },
            {
              key: 'actions',
              label: '',
              render: (order) => (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setError('');
                    setSelectedId(order.id);
                  }}
                >
                  Open
                </button>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New purchase order"
        wide
        footer={
          <div className="detail-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setCreating(false)}>
              Cancel
            </button>
            <button type="submit" form="po-create-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : 'Create draft'}
            </button>
          </div>
        }
      >
        <form id="po-create-form" onSubmit={create}>
          {error && <p className="error-text">{error}</p>}
          <Field label="Supplier" htmlFor="po-supplier" required>
            <select id="po-supplier" name="supplierId" required>
              <option value="">Choose a supplier</option>
              {(suppliers.data?.items || []).map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </Field>
          {lines.map((line, index) => (
            <div className="walkin-line" key={index}>
              <Field label="Medicine" htmlFor={`po-medicine-${index}`}>
                <select
                  id={`po-medicine-${index}`}
                  value={line.medicineId}
                  onChange={(event) => updateLine(index, 'medicineId', event.target.value)}
                >
                  <option value="">Choose a medicine</option>
                  {(medicines.data?.items || []).map((medicine) => (
                    <option key={medicine.id} value={medicine.id}>
                      {medicine.brand_name}
                      {medicine.strength ? ` ${medicine.strength}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quantity" htmlFor={`po-qty-${index}`}>
                <input
                  id={`po-qty-${index}`}
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={line.quantityOrdered}
                  onChange={(event) => updateLine(index, 'quantityOrdered', event.target.value)}
                />
              </Field>
              <Field label="Unit cost (GHS)" htmlFor={`po-cost-${index}`}>
                <input
                  id={`po-cost-${index}`}
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={line.unitCost}
                  onChange={(event) => updateLine(index, 'unitCost', event.target.value)}
                />
              </Field>
              <button
                type="button"
                className="link"
                onClick={() => setLines((current) => current.filter((_, i) => i !== index))}
                disabled={lines.length === 1}
              >
                Remove line
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setLines((current) => [...current, emptyLine()])}
          >
            Add line
          </button>
        </form>
      </Modal>

      <Modal
        open={Boolean(selectedId)}
        onClose={() => setSelectedId(null)}
        title={po ? `PO-${String(po.id).padStart(4, '0')}` : 'Purchase order'}
        wide
        footer={
          <button type="button" className="btn btn-secondary" onClick={() => setSelectedId(null)}>
            Close
          </button>
        }
      >
        {detail.loading && <Loading />}
        {detail.error && <ErrorState error={detail.error} retry={detail.reload} />}
        {po && (
          <>
            {error && <p className="error-text">{error}</p>}
            <p className="muted">
              {po.supplier_name} · {statusText(po.status)}
            </p>

            <DataTable
              rows={po.items || []}
              empty="No lines."
              columns={[
                {
                  key: 'brand_name',
                  label: 'Medicine',
                  render: (item) => (
                    <>
                      {item.brand_name}
                      {item.strength ? ` ${item.strength}` : ''}
                    </>
                  ),
                },
                { key: 'quantity_ordered', label: 'Ordered', align: 'right' },
                { key: 'quantity_received', label: 'Received', align: 'right' },
                { key: 'outstanding', label: 'Open', align: 'right' },
                { key: 'unit_cost', label: 'Unit cost', align: 'right', render: (item) => formatMoney(item.unit_cost) },
              ]}
            />

            {po.status === 'draft' && (
              <div className="detail-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        api(`/purchase-orders/${po.id}/status`, {
                          method: 'PATCH',
                          body: { status: 'ordered' },
                        }),
                      'Marked as ordered.'
                    )
                  }
                >
                  Mark ordered
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        api(`/purchase-orders/${po.id}/status`, {
                          method: 'PATCH',
                          body: { status: 'cancelled' },
                        }),
                      'Purchase order cancelled.'
                    )
                  }
                >
                  Cancel
                </button>
              </div>
            )}

            {po.status === 'ordered' && (
              <form onSubmit={receive}>
                <h3 className="section-heading">Receive goods</h3>
                {po.items
                  .filter((item) => item.outstanding > 0)
                  .map((item) => (
                    <div className="walkin-line" key={item.id} data-receive-line data-id={item.id}>
                      <p className="small">
                        {item.brand_name} ({item.outstanding} outstanding)
                      </p>
                      <Field label="Batch number" htmlFor={`batch-${item.id}`}>
                        <input id={`batch-${item.id}`} name="batchNo" required />
                      </Field>
                      <Field label="Quantity" htmlFor={`qty-${item.id}`}>
                        <input
                          id={`qty-${item.id}`}
                          name="quantity"
                          type="number"
                          min="0"
                          max={item.outstanding}
                          inputMode="numeric"
                          defaultValue={item.outstanding}
                        />
                      </Field>
                      <Field label="Expiry" htmlFor={`expiry-${item.id}`}>
                        <input
                          id={`expiry-${item.id}`}
                          name="expiryDate"
                          type="date"
                          defaultValue={defaultExpiry()}
                          required
                        />
                      </Field>
                    </div>
                  ))}
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? 'Please wait…' : 'Receive goods'}
                </button>
              </form>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
