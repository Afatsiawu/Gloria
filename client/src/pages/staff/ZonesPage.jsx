import { useState } from 'react';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { Alert, Badge, EmptyState, ErrorState, Field, Modal, PageHeader, Skeleton } from '../../components/UI.jsx';
import { formatMoney } from '../../utils/format.js';

const EMPTY = { name: '', fee: 0, rules: '', isActive: true };

export default function ZonesPage() {
  usePageTitle('Delivery zones');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const query = isAdmin ? `?pharmacyId=${pharmacyId}&includeInactive=true` : '?includeInactive=true';
  const { data, loading, error, reload } = useFetch(`/delivery-zones${query}`);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);

  const openCreate = () => { setEditing({ id: null }); setForm(EMPTY); setActionError(null); };
  const openEdit = (zone) => {
    setEditing(zone);
    setForm({ name: zone.name, fee: zone.fee, rules: zone.rules || '', isActive: Boolean(zone.is_active) });
    setActionError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      const body = {
        pharmacyId: isAdmin ? pharmacyId : undefined,
        name: form.name,
        fee: Number(form.fee),
        rules: form.rules || undefined,
        isActive: form.isActive,
      };
      if (editing.id) await api(`/delivery-zones/${editing.id}`, { method: 'PATCH', body });
      else await api('/delivery-zones', { method: 'POST', body });
      setNotice(editing.id ? 'Delivery zone updated.' : 'Delivery zone created.');
      setEditing(null);
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (zone) => {
    setNotice(null);
    setActionError(null);
    try {
      await api(`/delivery-zones/${zone.id}`, {
        method: 'PATCH',
        body: { name: zone.name, fee: zone.fee, rules: zone.rules || undefined, isActive: !zone.is_active, pharmacyId: isAdmin ? pharmacyId : undefined },
      });
      setNotice(`Zone ${zone.name} ${zone.is_active ? 'deactivated' : 'reactivated'}.`);
      reload();
    } catch (err) {
      setActionError(err);
    }
  };

  const remove = async (zone) => {
    if (!window.confirm(`Delete ${zone.name}? Zones used by an order can only be deactivated.`)) return;
    setActionError(null);
    try {
      await api(`/delivery-zones/${zone.id}`, { method: 'DELETE' });
      setNotice('Delivery zone deleted.');
      reload();
    } catch (err) {
      setActionError(err);
    }
  };

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const items = data?.items || [];

  return (
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Delivery zones"
        subtitle="Community zones, fees and any landmark rules. Customers choose a zone at checkout."
        actions={<button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>Add zone</button>}
      />

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && !editing && <Alert tone="error">{actionError.message}</Alert>}

      {error && <ErrorState error={error} retry={reload} />}
      {loading && <Skeleton lines={5} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState title="No delivery zones yet" action={<button type="button" className="btn btn-primary" onClick={openCreate}>Add the first zone</button>}>
          Add zones such as “Doryumu central” or “Kordibe junction” with a delivery fee.
        </EmptyState>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-3">
          {items.map((zone) => (
            <article className="card" key={zone.id}>
              <div className="card-body">
                <div className="row between">
                  <h3 className="mb-0">{zone.name}</h3>
                  <Badge tone={zone.is_active ? 'success' : 'neutral'}>{zone.is_active ? 'Active' : 'Paused'}</Badge>
                </div>
                <div className="price mt-1">{formatMoney(zone.fee)}</div>
                <p className="small muted mb-0">{zone.rules || 'No special rules recorded.'}</p>
                <div className="row mt-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(zone)}>Edit</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggle(zone)}>{zone.is_active ? 'Pause' : 'Activate'}</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(zone)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit delivery zone' : 'Add delivery zone'}
        footer={
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" form="zone-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save zone'}</button>
          </div>
        }
      >
        <form id="zone-form" onSubmit={submit} className="stack">
          {actionError && <Alert tone="error">{actionError.message}</Alert>}
          <Field label="Zone name" htmlFor="zone-name" required hint="For example Doryumu central, Kordibe junction, Asebi.">
            <input id="zone-name" value={form.name} onChange={update('name')} required />
          </Field>
          <Field label="Delivery fee (GHS)" htmlFor="zone-fee" required>
            <input id="zone-fee" type="number" min="0" step="0.01" value={form.fee} onChange={update('fee')} required />
          </Field>
          <Field label="Rules or landmarks" htmlFor="zone-rules">
            <textarea id="zone-rules" rows={3} value={form.rules} onChange={update('rules')} maxLength={500} placeholder="Orders after 6pm, call the pharmacy on arrival." />
          </Field>
          {editing?.id && (
            <label className="checkbox">
              <input type="checkbox" checked={form.isActive} onChange={update('isActive')} />
              Active and selectable at checkout
            </label>
          )}
        </form>
      </Modal>
    </>
  );
}
