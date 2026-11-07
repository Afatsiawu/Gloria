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
} from '../../components/UI.jsx';

const EMPTY = { name: '', contactPerson: '', phone: '', email: '', address: '', isActive: true };

export default function SuppliersPage() {
  usePageTitle('Suppliers');
  const { pharmacyId, setPharmacyId, isAdmin } = useStaffPharmacy();
  const query = isAdmin ? `?pharmacyId=${pharmacyId}&includeInactive=true` : '?includeInactive=true';
  const { data, loading, error, reload } = useFetch(`/suppliers${query}`);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);

  const openCreate = () => { setEditing({ id: null }); setForm(EMPTY); setActionError(null); };
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
    setActionError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      const body = {
        ...form,
        pharmacyId: isAdmin ? pharmacyId : undefined,
        email: form.email || undefined,
      };
      if (editing.id) {
        await api(`/suppliers/${editing.id}`, { method: 'PATCH', body });
        setNotice('Supplier updated.');
      } else {
        await api('/suppliers', { method: 'POST', body });
        setNotice('Supplier created.');
      }
      setEditing(null);
      reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (supplier) => {
    if (!window.confirm(`Deactivate ${supplier.name}? Existing batches keep their supplier record.`)) return;
    setNotice(null);
    setActionError(null);
    try {
      await api(`/suppliers/${supplier.id}`, { method: 'DELETE' });
      setNotice('Supplier deactivated.');
      reload();
    } catch (err) {
      setActionError(err);
    }
  };

  const items = data?.items || [];
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));

  return (
    <>
      <PageHeader
        eyebrow="Procurement"
        title="Suppliers"
        subtitle="Keep contact details for the wholesalers and distributors your pharmacy buys from."
        actions={<button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>Add supplier</button>}
      />

      {isAdmin && <PharmacyPicker pharmacyId={pharmacyId} onChange={setPharmacyId} />}
      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && !editing && <Alert tone="error">{actionError.message}</Alert>}

      {error && <ErrorState error={error} retry={reload} />}
      {loading && <Skeleton lines={6} />}

      {!loading && !error && items.length === 0 && (
        <EmptyState title="No suppliers yet" action={<button type="button" className="btn btn-primary" onClick={openCreate}>Add your first supplier</button>}>
          Suppliers are attached to a pharmacy and used when receiving stock or raising purchase orders.
        </EmptyState>
      )}

      {!loading && items.length > 0 && (
        <div className="grid grid-2">
          {items.map((supplier) => (
            <article className="card" key={supplier.id}>
              <div className="card-body">
                <div className="row between">
                  <h3 className="mb-0">{supplier.name}</h3>
                  <Badge tone={supplier.is_active ? 'success' : 'neutral'}>{supplier.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
                <p className="small muted mt-1 mb-1">
                  {supplier.contact_person || 'No contact person'} · {supplier.phone || 'No phone'}
                </p>
                <p className="small muted mb-1">{supplier.email || 'No email'}</p>
                <p className="small mb-0">{supplier.address || 'No address'}</p>
                <div className="row mt-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(supplier)}>Edit</button>
                  {supplier.is_active && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => deactivate(supplier)}>Deactivate</button>
                  )}
                  <span className="tiny muted">{supplier.batch_count} batches received</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Edit supplier' : 'Add supplier'}
        footer={
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            <button type="submit" form="supplier-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save supplier'}</button>
          </div>
        }
      >
        <form id="supplier-form" onSubmit={submit} className="stack">
          {actionError && <Alert tone="error">{actionError.message}</Alert>}
          <Field label="Supplier name" htmlFor="supplier-name" required>
            <input id="supplier-name" value={form.name} onChange={update('name')} required />
          </Field>
          <div className="form-grid">
            <Field label="Contact person" htmlFor="supplier-contact">
              <input id="supplier-contact" value={form.contactPerson} onChange={update('contactPerson')} />
            </Field>
            <Field label="Phone" htmlFor="supplier-phone">
              <input id="supplier-phone" value={form.phone} onChange={update('phone')} />
            </Field>
          </div>
          <Field label="Email" htmlFor="supplier-email">
            <input id="supplier-email" type="email" value={form.email} onChange={update('email')} />
          </Field>
          <Field label="Address" htmlFor="supplier-address">
            <textarea id="supplier-address" rows={2} value={form.address} onChange={update('address')} />
          </Field>
          {editing?.id && (
            <label className="checkbox">
              <input type="checkbox" checked={form.isActive} onChange={update('isActive')} />
              Active (inactive suppliers cannot be selected for new stock)
            </label>
          )}
        </form>
      </Modal>
    </>
  );
}
