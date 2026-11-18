import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, openProtectedFile } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { DataTable, ErrorState, Field, Loading, Modal, StatusBadge, Tabs } from '../../components/UI.jsx';
import { formatDateTime } from '../../utils/format.js';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'queried', label: 'Queried' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function PrescriptionQueuePage() {
  usePageTitle('Prescriptions');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [status, setStatus] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState('approved');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const path = `/prescriptions?status=${status}${isAdmin ? `&pharmacyId=${pharmacyId}` : ''}`;
  const { data, loading, error: loadError, reload } = useFetch(path, [status, pharmacyId]);

  const open = (item) => {
    setSelected(item);
    setDecision('approved');
    setRemarks('');
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    if (decision !== 'approved' && !remarks.trim()) {
      setError('Add remarks for a query or rejection.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api(`/prescriptions/${selected.id}/review`, {
        method: 'PATCH',
        body: { status: decision, remarks: remarks || undefined },
      });
      setNotice(`Prescription ${selected.id} marked ${decision}.`);
      setSelected(null);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not save the decision.');
    } finally {
      setBusy(false);
    }
  };

  const items = data?.items || [];

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Prescriptions</h1>
          <p>{items.length} in this list</p>
        </div>
      </div>

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <p className="success-text">{notice}</p>}
      {loadError && <ErrorState error={loadError} retry={reload} />}

      <Tabs tabs={TABS} active={status} onChange={setStatus} label="Prescription status" />

      {loading && <Loading />}

      {!loading && !loadError && (
        <DataTable
          rows={items}
          empty={`No ${status} prescriptions.`}
          columns={[
            {
              key: 'reference',
              label: 'Order',
              render: (item) => (
                <Link to={`/orders/${item.order_id}`}>
                  <strong>{item.reference}</strong>
                </Link>
              ),
            },
            {
              key: 'customer',
              label: 'Customer',
              render: (item) => (
                <>
                  {item.customer_name}
                  <div className="small muted">{item.customer_phone}</div>
                </>
              ),
            },
            {
              key: 'created_at',
              label: 'Uploaded',
              render: (item) => <span className="nowrap">{formatDateTime(item.created_at)}</span>,
            },
            { key: 'status', label: 'Status', render: (item) => <StatusBadge status={item.status} /> },
            {
              key: 'actions',
              label: 'Actions',
              render: (item) => (
                <div className="table-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => openProtectedFile(`/prescriptions/${item.id}/file`)}
                  >
                    View file
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => open(item)}>
                    Review
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Prescription ${selected.id}` : 'Review prescription'}
        footer={
          <div className="detail-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setSelected(null)}>
              Cancel
            </button>
            <button type="submit" form="review-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : 'Save'}
            </button>
          </div>
        }
      >
        {selected && (
          <form id="review-form" onSubmit={submit}>
            {error && <p className="error-text">{error}</p>}
            <p className="muted">
              Order {selected.reference} · {selected.customer_name}
            </p>
            <p className="small">Prescription items: {selected.pom_items || '—'}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => openProtectedFile(`/prescriptions/${selected.id}/file`)}
            >
              Open file
            </button>
            <Field label="Decision" htmlFor="decision" required>
              <select id="decision" value={decision} onChange={(event) => setDecision(event.target.value)}>
                <option value="approved">Approve</option>
                <option value="queried">Query</option>
                <option value="rejected">Reject</option>
              </select>
            </Field>
            <Field
              label="Remarks"
              htmlFor="remarks"
              hint="Shown to the customer. Required for a query or rejection."
            >
              <textarea
                id="remarks"
                rows={4}
                maxLength={500}
                value={remarks}
                onChange={(event) => setRemarks(event.target.value)}
              />
            </Field>
          </form>
        )}
      </Modal>
    </>
  );
}
