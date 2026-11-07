import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, openProtectedFile } from '../../api/client.js';
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
  StatusBadge,
  Tabs,
} from '../../components/UI.jsx';
import { formatDateTime } from '../../utils/format.js';

const TABS = [
  { value: 'pending', label: 'Pending' },
  { value: 'queried', label: 'Queried' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function PrescriptionQueuePage() {
  usePageTitle('Prescription queue');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const [status, setStatus] = useState('pending');
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState('approved');
  const [remarks, setRemarks] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const path = `/prescriptions?status=${status}${isAdmin ? `&pharmacyId=${pharmacyId}` : ''}`;
  const { data, loading, error: loadError, reload } = useFetch(path);

  const open = (item) => {
    setSelected(item);
    setDecision('approved');
    setRemarks('');
    setError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api(`/prescriptions/${selected.id}/review`, {
        method: 'PATCH',
        body: { status: decision, remarks: remarks || undefined },
      });
      setNotice(`Prescription #${selected.id} marked ${decision}.`);
      setSelected(null);
      reload();
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  };

  const items = data?.items || [];

  return (
    <>
      <PageHeader
        eyebrow="Clinical safety"
        title="Prescription queue"
        subtitle="Review uploaded prescriptions before prescription-only medicines are released. Decisions notify the customer immediately."
        actions={<button type="button" className="btn btn-ghost btn-sm" onClick={reload}>Refresh</button>}
      />

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <Alert tone="success">{notice}</Alert>}
      {loadError && <ErrorState error={loadError} retry={reload} />}

      <Tabs tabs={TABS} active={status} onChange={setStatus} label="Prescription status" />

      {loading && <Skeleton lines={6} />}

      {!loading && !loadError && items.length === 0 && (
        <EmptyState title={`No ${status} prescriptions`}>
          {status === 'pending'
            ? 'New customer uploads will appear here and in the customer’s order timeline.'
            : 'There is nothing in this state right now.'}
        </EmptyState>
      )}

      {!loading && items.length > 0 && (
        <div className="stack">
          {items.map((item) => (
            <article className="card" key={item.id}>
              <div className="card-body">
                <div className="row between">
                  <div>
                    <div className="row">
                      <strong>Order {item.reference}</strong>
                      <StatusBadge status={item.status} />
                      <Badge tone="neutral">{item.pharmacy_name}</Badge>
                    </div>
                    <p className="small muted mb-0 mt-1">
                      {item.customer_name} · {item.customer_phone} · uploaded {formatDateTime(item.created_at)}
                    </p>
                    <p className="small mb-0"><strong>Rx items:</strong> {item.pom_items || '—'}</p>
                    {item.remarks && <p className="small mb-0"><strong>Last remarks:</strong> {item.remarks}</p>}
                  </div>
                  <div className="row">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openProtectedFile(`/prescriptions/${item.id}/file`)}>
                      View file
                    </button>
                    <Link to={`/orders/${item.order_id}`} className="btn btn-ghost btn-sm">Order</Link>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => open(item)}>
                      Review
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Review prescription #${selected.id}` : 'Review prescription'}
        footer={
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>Cancel</button>
            <button type="submit" form="review-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save decision'}
            </button>
          </div>
        }
      >
        {selected && (
          <form id="review-form" onSubmit={submit} className="stack">
            {error && <Alert tone="error">{error.message}</Alert>}
            <p className="small muted">
              Order {selected.reference} · {selected.customer_name} · {selected.pharmacy_name}
            </p>
            <p className="small"><strong>Prescription-only items:</strong> {selected.pom_items || '—'}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => openProtectedFile(`/prescriptions/${selected.id}/file`)}>
              Open prescription file
            </button>
            <Field label="Decision" htmlFor="decision" required>
              <select id="decision" value={decision} onChange={(event) => setDecision(event.target.value)}>
                <option value="approved">Approve — release the medicine</option>
                <option value="queried">Query — ask the customer for clarification</option>
                <option value="rejected">Reject — do not release</option>
              </select>
            </Field>
            <Field
              label="Pharmacist remarks"
              htmlFor="remarks"
              hint="Required when querying or rejecting. These remarks are shown to the customer."
              error={decision !== 'approved' && !remarks.trim() ? 'Add remarks for a query or rejection.' : undefined}
            >
              <textarea id="remarks" rows={4} maxLength={500} value={remarks} onChange={(event) => setRemarks(event.target.value)} />
            </Field>
            <Alert tone="info">
              Approval is recorded in the audit log. It only verifies the prescription; payment must also be
              confirmed before the order can move to verified.
            </Alert>
          </form>
        )}
      </Modal>
    </>
  );
}
