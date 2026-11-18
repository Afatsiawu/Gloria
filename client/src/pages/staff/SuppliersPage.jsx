import { useState } from 'react';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import { useStaffPharmacy } from '../../components/PharmacyPicker.jsx';
import PharmacyPicker from '../../components/PharmacyPicker.jsx';
import { DataTable, ErrorState, Field, Loading, Modal } from '../../components/UI.jsx';

const EMPTY = { name: '', contactPerson: '', phone: '', email: '', address: '', isActive: true };

export default function SuppliersPage() {
  usePageTitle('Suppliers');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const query = isAdmin ? `?pharmacyId=${pharmacyId}&includeInactive=true` : '?includeInactive=true';
  const { data, loading, error, reload } = useFetch(`/suppliers${query}`, [pharmacyId]);
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

  const openEdit = (supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      contactPerson: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      isActive: Boolean(supplier.is_active),
    });
    setActionError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setActionError('');
    try {
      const body = {
        ...form,
        pharmacyId: isAdmin ? pharmacyId : undefined,
        email: form.email || undefined,
      };
      if (editing.id) await api(`/suppliers/${editing.id}`, { method: 'PATCH', body });
      else await api('/suppliers', { method: 'POST', body });
      setNotice(editing.id ? 'Supplier updated.' : 'Supplier added.');
      setEditing(null);
      await reload();
    } catch (err) {
      setActionError(err.message || 'Could not save the supplier.');
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (supplier) => {
    if (!window.confirm(`Deactivate ${supplier.name}?`)) return;
    setNotice('');
    setActionError('');
    try {
      await api(`/suppliers/${supplier.id}`, { method: 'DELETE' });
      setNotice('Supplier deactivated.');
      await reload();
    } catch (err) {
      setActionError(err.message || 'Could not deactivate the supplier.');
    }
  };

  const items = data?.items || [];
  const update = (key) => (event) =>
    setForm((current) => ({
      ...current,
      [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    }));

  return (
    <>
      <div className="page-title">
        <div>
          <h1>Suppliers</h1>
        </div>
        <div className="page-actions">
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add supplier
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
          empty="No suppliers yet."
          columns={[
            { key: 'name', label: 'Supplier', render: (supplier) => <strong>{supplier.name}</strong> },
            {
              key: 'contact',
              label: 'Contact',
              render: (supplier) => (
                <>
                  {supplier.contact_person || '—'}
                  <div className="small muted">{supplier.phone || '—'}</div>
                </>
              ),
            },
            { key: 'address', label: 'Address', render: (supplier) => supplier.address || '—' },
            { key: 'status', label: 'Status', render: (supplier) => (supplier.is_active ? 'Active' : 'Inactive') },
            {
              key: 'actions',
              label: '',
              render: (supplier) => (
                <div className="table-actions">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(supplier)}>
                    Edit
                  </button>
                  {Boolean(supplier.is_active) && (
                    <button type="button" className="link" onClick={() => deactivate(supplier)}>
                      Deactivate
                    </button>
                  )}
                </div>
              ),
            },
          ]}
        />
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit supplier' : 'Add supplier'}
        footer={
          <div className="detail-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button type="submit" form="supplier-form" className="btn btn-primary" disabled={busy}>
              {busy ? 'Please wait…' : 'Save'}
            </button>
          </div>
        }
      >
        <form id="supplier-form" onSubmit={submit}>
          {actionError && <p className="error-text">{actionError}</p>}
          <Field label="Supplier name" htmlFor="supplier-name" required>
            <input id="supplier-name" value={form.name} onChange={update('name')} required />
          </Field>
          <Field label="Contact person" htmlFor="supplier-contact">
            <input id="supplier-contact" value={form.contactPerson} onChange={update('contactPerson')} />
          </Field>
          <Field label="Phone" htmlFor="supplier-phone">
            <input
              id="supplier-phone"
              value={form.phone}
              onChange={update('phone')}
              inputMode="tel"
              autoComplete="tel"
            />
          </Field>
          <Field label="Email" htmlFor="supplier-email">
            <input
              id="supplier-email"
              type="email"
              value={form.email}
              onChange={update('email')}
              inputMode="email"
            />
          </Field>
          <Field label="Address" htmlFor="supplier-address">
            <textarea id="supplier-address" rows={2} value={form.address} onChange={update('address')} />
          </Field>
          {editing?.id && (
            <label className="checkbox">
              <input type="checkbox" checked={form.isActive} onChange={update('isActive')} />
              Active
            </label>
          )}
        </form>
      </Modal>
    </>
  );
}
