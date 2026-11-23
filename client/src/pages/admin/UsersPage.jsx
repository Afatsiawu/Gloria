import { useState } from 'react';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
import {
  Alert,
  Badge,
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  Modal,
  PageTitle,
  Pagination,
} from '../../components/UI.jsx';
import { titleCase } from '../../utils/format.js';

const EMPTY = {
  fullName: '',
  phone: '',
  email: '',
  role: 'customer',
  pharmacyName: '',
  community: 'Doryumu',
  deliveryAddress: '',
  digitalAddressCode: '',
  password: '',
  isActive: true,
};

export default function UsersPage() {
  usePageTitle('Users & roles');
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const query = new URLSearchParams({ page, pageSize: '20' });
  if (q) query.set('q', q);
  if (role) query.set('role', role);
  const users = useFetch(`/users?${query.toString()}`);

  const openCreate = () => { setModal({ id: null }); setForm(EMPTY); setActionError(null); };
  const openEdit = (user) => {
    setModal(user);
    setForm({
      fullName: user.full_name,
      phone: user.phone,
      email: user.email || '',
      role: user.role,
      pharmacyName: user.pharmacy_name || '',
      community: user.community || 'Doryumu',
      deliveryAddress: user.delivery_address || '',
      digitalAddressCode: user.digital_address_code || '',
      password: '',
      isActive: Boolean(user.is_active),
    });
    setActionError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      const body = {
        fullName: form.fullName,
        phone: form.phone,
        email: form.email || undefined,
        role: form.role,
        pharmacyName: ['pharmacist', 'rider'].includes(form.role) ? form.pharmacyName : null,
        community: form.role === 'customer' ? form.community : null,
        deliveryAddress: form.deliveryAddress || null,
        digitalAddressCode: form.digitalAddressCode || null,
        isActive: form.isActive,
      };
      if (modal.id) {
        if (form.password) body.password = form.password;
        await api(`/users/${modal.id}`, { method: 'PATCH', body });
        setNotice('User updated.');
      } else {
        body.password = form.password;
        await api('/users', { method: 'POST', body });
        setNotice('User created.');
      }
      setModal(null);
      users.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (user) => {
    if (user.is_active && !window.confirm(`Suspend ${user.full_name}? They will be signed out on their next request.`)) return;
    setActionError(null);
    try {
      await api(`/users/${user.id}/${user.is_active ? 'suspend' : 'activate'}`, { method: 'POST' });
      setNotice(`${user.full_name} ${user.is_active ? 'suspended' : 'reactivated'}.`);
      users.reload();
    } catch (err) {
      setActionError(err);
    }
  };

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const items = users.data?.items || [];
  const needsPharmacy = ['pharmacist', 'rider'].includes(form.role);

  return (
    <>
      <PageTitle
        title="Users"
        subtitle="Staff accounts, pharmacy assignment and access."
        actions={<button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>Add user</button>}
      />

      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && !modal && <Alert tone="error">{actionError.message}</Alert>}

      <div className="toolbar">
        <Field label="Search" htmlFor="user-q" className="inline-field">
          <input id="user-q" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Name, phone or email" />
        </Field>
        <Field label="Role" htmlFor="user-role" className="inline-field">
          <select id="user-role" value={role} onChange={(event) => { setRole(event.target.value); setPage(1); }}>
            <option value="">All roles</option>
            <option value="customer">Customers</option>
            <option value="pharmacist">Pharmacists</option>
            <option value="admin">Administrators</option>
            <option value="rider">Riders</option>
          </select>
        </Field>
      </div>

      {users.error && <ErrorState error={users.error} retry={users.reload} />}
      {users.loading && <p className="loading">Loading…</p>}

      {!users.loading && !users.error && items.length === 0 && (
        <EmptyState title="No users match">Try a different search or role.</EmptyState>
      )}

      {!users.loading && items.length > 0 && (
        <>
          <DataTable
            columns={[
              {
                key: 'full_name',
                label: 'Name',
                render: (user) => (
                  <>
                    <strong>{user.full_name}</strong>
                    <div className="tiny muted">{user.phone}{user.email ? ` · ${user.email}` : ''}</div>
                  </>
                ),
              },
              { key: 'role', label: 'Role', render: (user) => titleCase(user.role) },
              { key: 'pharmacy_name', label: 'Pharmacy', render: (user) => user.pharmacy_name || '—' },
              {
                key: 'is_active',
                label: 'Status',
                render: (user) => <Badge tone={user.is_active ? 'success' : 'danger'}>{user.is_active ? 'Active' : 'Suspended'}</Badge>,
              },
              {
                key: 'actions',
                label: 'Actions',
                render: (user) => (
                  <div className="table-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(user)}>Edit</button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => toggleActive(user)}>{user.is_active ? 'Suspend' : 'Activate'}</button>
                  </div>
                ),
              },
            ]}
            rows={items}
          />
          <Pagination pagination={users.data?.pagination} onPage={setPage} />
        </>
      )}

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Edit user' : 'Add user'}
        wide
        footer={
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" form="user-form" className="btn btn-primary" disabled={busy}>{busy ? 'Please wait…' : 'Save user'}</button>
          </div>
        }
      >
        <form id="user-form" onSubmit={submit} className="stack">
          {actionError && <Alert tone="error">{actionError.message}</Alert>}
          <div className="form-grid">
            <Field label="Full name" htmlFor="user-fullname" required>
              <input id="user-fullname" value={form.fullName} onChange={update('fullName')} required />
            </Field>
            <Field label="Phone" htmlFor="user-phone" required>
              <input id="user-phone" value={form.phone} onChange={update('phone')} required />
            </Field>
            <Field label="Email" htmlFor="user-email">
              <input id="user-email" type="email" value={form.email} onChange={update('email')} />
            </Field>
            <Field label="Role" htmlFor="user-role-field" required>
              <select id="user-role-field" value={form.role} onChange={update('role')}>
                <option value="customer">Customer</option>
                <option value="pharmacist">Pharmacist</option>
                <option value="admin">Administrator</option>
                <option value="rider">Rider</option>
              </select>
            </Field>
            {needsPharmacy && (
              <Field label="Pharmacy name" htmlFor="user-pharmacy" required hint="Enter the pharmacy name exactly as it appears in the system.">
                <input
                  id="user-pharmacy"
                  value={form.pharmacyName}
                  onChange={update('pharmacyName')}
                  required
                  placeholder="e.g. Doryumu Community Pharmacy"
                />
              </Field>
            )}
            {form.role === 'customer' && (
              <Field label="Community" htmlFor="user-community">
                <select id="user-community" value={form.community} onChange={update('community')}>
                  <option value="Doryumu">Doryumu</option>
                  <option value="Kordibe">Kordibe</option>
                </select>
              </Field>
            )}
            <Field label={modal?.id ? 'New password (optional)' : 'Password'} htmlFor="user-password" required={!modal?.id}>
              <input id="user-password" type="password" value={form.password} onChange={update('password')} required={!modal?.id} minLength={8} autoComplete="new-password" />
            </Field>
          </div>
          {form.role === 'customer' && (
            <>
              <Field label="Delivery address" htmlFor="user-address">
                <textarea id="user-address" rows={2} value={form.deliveryAddress} onChange={update('deliveryAddress')} />
              </Field>
              <Field label="Digital address" htmlFor="user-digital">
                <input id="user-digital" value={form.digitalAddressCode} onChange={update('digitalAddressCode')} />
              </Field>
            </>
          )}
          {modal?.id && (
            <label className="checkbox">
              <input type="checkbox" checked={form.isActive} onChange={update('isActive')} />
              Account is active
            </label>
          )}
        </form>
      </Modal>
    </>
  );
}
