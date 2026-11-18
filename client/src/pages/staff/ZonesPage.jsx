import { useState } from 'react';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { DataTable, ErrorState, Field, Loading, Modal } from '../../components/UI.jsx';
import { formatMoney } from '../../utils/format.js';

const EMPTY = { name: '', fee: 0, rules: '', isActive: true };

export default function ZonesPage() {
  usePageTitle('Delivery zones');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const query = isAdmin ? `?pharmacyId=${pharmacyId}&includeInactive=true` : '?includeInactive=true';
  const { data, loading, error, reload } = useFetch(`/delivery-zones${query}`, [pharmacyId]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  const openCreate = () => {
    setEditing({ id: null });
    setForm(EMPTY);
    setActionError('');
  };

  const openEdit = (zone) => {
    setEditing(zone);
    setForm({ name: zone.name, fee: zone.fee, rules: zone.rules || '', isActive: Boolean(zone.is_active) });
    setActionError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setActionError('');
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
      setNotice(editing.id ? 'Zone updated.' : 'Zone added.');
      setEditing(null);
      await reload();
    } catch (err) {
      setActionError(err.message || 'Could not save the zone.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (zone) => {
    setNotice('');
    setActionError('');
    try {
      await api(`/delivery-zones/${zone.id}`, {
        method: 'PATCH',
        body: {
          name: zone.name,
          fee: zone.fee,
          rules: zone.rules || undefined,
          isActive: !zone.is_active,
          pharmacyId: isAdmin ? pharmacyId : undefined,
        },
      });
      setNotice(`${zone.name} ${zone.is_active ? 'paused' : 'activated'}.`);
      await reload();
    } catch (err) {
      setActionError(err.message || 'Could not update the zone.');
    }
  };

  const remove = async (zone) => {
    if (!window.confirm(`Delete ${zone.name}?`)) return;
    setActionError('');
    try {
      await api(`/delivery-zones/${zone.id}`, { method: 'DELETE' });
      setNotice('Zone deleted.');
      await reload();
    } catch (err) {
      setActionError(err.message || 'Could not delete the zone.');
    }
  };

  const update = (key) => (event) =>
    setForm((current) => ({
      ...current,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }));

  const items = data?.items || [];

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Delivery zones</h1>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add zone
          </button>
        </div>
      </div>

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <p className="success-text">{notice}</p>}
      {actionError && !editing && <p className="error-text">{actionError}</p>}

      {error && <ErrorState error={error} retry={reload} />}
      {loading && <Loading />}

      {!loading && !error && (
        <DataTable
          rows={items}
          empty="No delivery zones yet."
          columns={[
            { key: 'name', label: 'Zone', render: (zone) => <strong>{zone.name}</strong> },
            { key: 'fee', label: 'Fee', render: (zone) => formatMoney(zone.fee) },
            {
              key: 'rules',
              label: 'Rules',
              render: (zone) => <span className="small muted">{zone.rules || '—'}</span>,
            },
            { key: 'status', label: 'Status', render: (zone) => (zone.is_active ? 'Active' : 'Paused') },
            {
              key: 'actions',
              label: 'Actions',
              render: (zone) => (
                <div className="table-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(zone)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => toggle(zone)}>
                    {zone.is_active ? 'Pause' : 'Activate'}
                  </button>
                  <button type="button" className="link" onClick={() => remove(zone)}>
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit zone' : 'Add zone'}
        footer={
          <div className="detail-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="zone-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="zone-form" onSubmit={submit}>
          {actionError && <p className="error-text">{actionError}</p>}
          <Field label="Zone name" htmlFor="zone-name" required>
            <input id="zone-name" value={form.name} onChange={update('name')} required />
          </Field>
          <Field label="Delivery fee (GHS)" htmlFor="zone-fee" required>
            <input
              id="zone-fee"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={form.fee}
              onChange={update('fee')}
              required
            />
          </Field>
          <Field label="Rules or landmarks" htmlFor="zone-rules">
            <textarea
              id="zone-rules"
              rows={3}
              value={form.rules}
              onChange={update('rules')}
              maxLength={500}
            />
          </Field>
          {editing?.id && (
            <label className="checkbox">
              <input type="checkbox" checked={form.isActive} onChange={update('isActive')} />
              Active at checkout
            </label>
          )}
        </form>
      </Modal>
    </>
  );
}
