import { useState } from 'react';
import { api } from '../../api/client.js';
import { useFetch, usePageTitle } from '../../hooks/useApi.js';
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
} from '../../components/UI.jsx';
import { formatMoney } from '../../utils/format.js';

const EMPTY = {
  brandName: '',
  genericName: '',
  strength: '',
  dosageForm: '',
  categoryId: '',
  requiresPrescription: false,
  description: '',
  price: 0,
  reorderLevel: 10,
  isActive: true,
};

export default function MedicinesPage() {
  usePageTitle('Medicines');
  const [q, setQ] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [priceModal, setPriceModal] = useState(null);
  const [priceForm, setPriceForm] = useState({ pharmacyId: '', price: 0, reorderLevel: 10, isActive: true });
  const [categoryModal, setCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });

  const query = new URLSearchParams({ includeInactive: 'true', page, pageSize: '20' });
  if (q) query.set('q', q);
  if (categoryId) query.set('categoryId', categoryId);
  const medicines = useFetch(`/medicines?${query.toString()}`);
  const categories = useFetch('/categories');
  const pharmacies = useFetch('/pharmacies');

  const openCreate = () => { setModal({ id: null }); setForm(EMPTY); setActionError(null); };
  const openEdit = (medicine) => {
    setModal(medicine);
    setForm({
      brandName: medicine.brand_name,
      genericName: medicine.generic_name,
      strength: medicine.strength || '',
      dosageForm: medicine.dosage_form || '',
      categoryId: medicine.category_id || '',
      requiresPrescription: Boolean(medicine.requires_prescription),
      description: medicine.description || '',
      price: medicine.min_price || 0,
      reorderLevel: 10,
      isActive: Boolean(medicine.is_active),
    });
    setActionError(null);
  };

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      const body = {
        brandName: form.brandName,
        genericName: form.genericName,
        strength: form.strength || undefined,
        dosageForm: form.dosageForm || undefined,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        requiresPrescription: form.requiresPrescription,
        description: form.description || undefined,
        isActive: form.isActive,
      };
      // Changing the base price rewrites every pharmacy's reorder level, so only
      // send it when it actually changed (or when creating a new medicine).
      if (!modal.id || Number(form.price) !== Number(modal.min_price)) {
        body.price = Number(form.price);
        body.reorderLevel = Number(form.reorderLevel);
      }
      if (modal.id) await api(`/medicines/${modal.id}`, { method: 'PATCH', body });
      else await api('/medicines', { method: 'POST', body });
      setNotice(modal.id ? 'Medicine updated.' : 'Medicine created.');
      setModal(null);
      medicines.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const openPrice = async (medicine) => {
    setActionError(null);
    try {
      const detail = await api(`/medicines/${medicine.id}`);
      const first = detail.availability[0];
      setPriceModal(medicine);
      setPriceForm({
        pharmacyId: first?.pharmacy_id || pharmacies.data?.items?.[0]?.id || '',
        price: first?.price ?? medicine.min_price ?? 0,
        reorderLevel: 10,
        isActive: true,
      });
    } catch (err) {
      setActionError(err);
    }
  };

  const savePrice = async (event) => {
    event.preventDefault();
    setBusy(true);
    setActionError(null);
    try {
      await api(`/pharmacies/${priceForm.pharmacyId}/medicines/${priceModal.id}`, {
        method: 'PATCH',
        body: { price: Number(priceForm.price), reorderLevel: Number(priceForm.reorderLevel), isActive: priceForm.isActive },
      });
      setNotice('Pharmacy price updated.');
      setPriceModal(null);
      medicines.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setBusy(false);
    }
  };

  const addCategory = async (event) => {
    event.preventDefault();
    setActionError(null);
    try {
      await api('/categories', { method: 'POST', body: newCategory });
      setNewCategory({ name: '', description: '' });
      categories.reload();
      setNotice('Category created.');
    } catch (err) {
      setActionError(err);
    }
  };

  const deleteCategory = async (category) => {
    if (!window.confirm(`Delete category ${category.name}? Medicines will become uncategorised.`)) return;
    setActionError(null);
    try {
      await api(`/categories/${category.id}`, { method: 'DELETE' });
      categories.reload();
      setNotice('Category deleted.');
    } catch (err) {
      setActionError(err);
    }
  };

  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === 'checkbox' ? event.target.checked : event.target.value }));
  const items = medicines.data?.items || [];

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Medicines & prices"
        subtitle="Manage the master catalogue. Base prices are applied to all pharmacies; pharmacists can then adjust their own outlet price."
        actions={
          <div className="row">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setCategoryModal(true); setActionError(null); }}>Categories</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>Add medicine</button>
          </div>
        }
      />

      {notice && <Alert tone="success">{notice}</Alert>}
      {actionError && !modal && !priceModal && !categoryModal && <Alert tone="error">{actionError.message}</Alert>}

      <div className="card mb-2">
        <div className="card-body">
          <form className="form-grid" onSubmit={(event) => event.preventDefault()}>
            <Field label="Search" htmlFor="medicine-q">
              <input id="medicine-q" value={q} onChange={(event) => { setQ(event.target.value); setPage(1); }} placeholder="Brand or generic name" />
            </Field>
            <Field label="Category" htmlFor="medicine-category">
              <select id="medicine-category" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(1); }}>
                <option value="">All categories</option>
                {(categories.data?.items || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
          </form>
        </div>
      </div>

      {medicines.error && <ErrorState error={medicines.error} retry={medicines.reload} />}
      {medicines.loading && <Skeleton lines={8} />}

      {!medicines.loading && !medicines.error && items.length === 0 && (
        <EmptyState title="No medicines match" action={<button type="button" className="btn btn-primary" onClick={openCreate}>Add a medicine</button>}>
          Try a different search or category.
        </EmptyState>
      )}

      {!medicines.loading && items.length > 0 && (
        <>
          <div className="table-wrap card">
            <table>
              <thead>
                <tr>
                  <th>Medicine</th>
                  <th>Category</th>
                  <th>Rx</th>
                  <th className="text-right">From</th>
                  <th className="text-right">Pharmacies</th>
                  <th className="text-right">Stock</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((medicine) => (
                  <tr key={medicine.id}>
                    <td>
                      <strong>{medicine.brand_name}{medicine.strength ? ` ${medicine.strength}` : ''}</strong>
                      <div className="tiny muted">{medicine.generic_name}{medicine.dosage_form ? ` · ${medicine.dosage_form}` : ''}</div>
                    </td>
                    <td className="small">{medicine.category_name || '—'}</td>
                    <td>{medicine.requires_prescription ? <Badge tone="warning">Rx</Badge> : <Badge tone="success">OTC</Badge>}</td>
                    <td className="text-right">{formatMoney(medicine.min_price)}</td>
                    <td className="text-right">{medicine.pharmacy_count}</td>
                    <td className="text-right">{medicine.stock}</td>
                    <td><Badge tone={medicine.is_active ? 'success' : 'neutral'}>{medicine.is_active ? 'Active' : 'Inactive'}</Badge></td>
                    <td>
                      <div className="table-actions">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openEdit(medicine)}>Edit</button>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => openPrice(medicine)}>Price</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination pagination={medicines.data?.pagination} onPage={setPage} />
        </>
      )}

      <Modal
        open={Boolean(modal)}
        onClose={() => setModal(null)}
        title={modal?.id ? 'Edit medicine' : 'Add medicine'}
        wide
        footer={
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" form="medicine-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save medicine'}</button>
          </div>
        }
      >
        <form id="medicine-form" onSubmit={submit} className="stack">
          {actionError && <Alert tone="error">{actionError.message}</Alert>}
          <div className="form-grid">
            <Field label="Brand name" htmlFor="med-brand" required>
              <input id="med-brand" value={form.brandName} onChange={update('brandName')} required />
            </Field>
            <Field label="Generic name" htmlFor="med-generic" required>
              <input id="med-generic" value={form.genericName} onChange={update('genericName')} required />
            </Field>
            <Field label="Strength" htmlFor="med-strength">
              <input id="med-strength" value={form.strength} onChange={update('strength')} placeholder="500 mg" />
            </Field>
            <Field label="Dosage form" htmlFor="med-form">
              <input id="med-form" value={form.dosageForm} onChange={update('dosageForm')} placeholder="Tablet" />
            </Field>
            <Field label="Category" htmlFor="med-category">
              <select id="med-category" value={form.categoryId} onChange={update('categoryId')}>
                <option value="">Uncategorised</option>
                {(categories.data?.items || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </Field>
            <Field label="Base price (GHS)" htmlFor="med-price" required hint="Applied to every pharmacy when a medicine is created or its base price changes.">
              <input id="med-price" type="number" min="0" step="0.01" value={form.price} onChange={update('price')} required />
            </Field>
            <Field label="Default reorder level" htmlFor="med-reorder">
              <input id="med-reorder" type="number" min="0" value={form.reorderLevel} onChange={update('reorderLevel')} />
            </Field>
          </div>
          <Field label="Description" htmlFor="med-description">
            <textarea id="med-description" rows={3} value={form.description} onChange={update('description')} maxLength={1000} />
          </Field>
          <div className="row">
            <label className="checkbox">
              <input type="checkbox" checked={form.requiresPrescription} onChange={update('requiresPrescription')} />
              Prescription-only medicine
            </label>
            <label className="checkbox">
              <input type="checkbox" checked={form.isActive} onChange={update('isActive')} />
              Active in the catalogue
            </label>
          </div>
          <Alert tone="warning">
            Marking a medicine prescription-only means new orders cannot be verified without an approved
            prescription.
          </Alert>
        </form>
      </Modal>

      <Modal
        open={Boolean(priceModal)}
        onClose={() => setPriceModal(null)}
        title={priceModal ? `Set pharmacy price — ${priceModal.brand_name}` : 'Set pharmacy price'}
        footer={
          <div className="row">
            <button type="button" className="btn btn-ghost" onClick={() => setPriceModal(null)}>Cancel</button>
            <button type="submit" form="price-form" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save price'}</button>
          </div>
        }
      >
        <form id="price-form" onSubmit={savePrice} className="stack">
          {actionError && <Alert tone="error">{actionError.message}</Alert>}
          <Field label="Pharmacy" htmlFor="price-pharmacy" required>
            <select id="price-pharmacy" value={priceForm.pharmacyId} onChange={(event) => setPriceForm((current) => ({ ...current, pharmacyId: event.target.value }))} required>
              <option value="">Choose a pharmacy</option>
              {(pharmacies.data?.items || []).map((pharmacy) => (
                <option key={pharmacy.id} value={pharmacy.id}>{pharmacy.name} ({pharmacy.community})</option>
              ))}
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Price (GHS)" htmlFor="price-value" required>
              <input id="price-value" type="number" min="0" step="0.01" value={priceForm.price} onChange={(event) => setPriceForm((current) => ({ ...current, price: event.target.value }))} required />
            </Field>
            <Field label="Reorder level" htmlFor="price-reorder">
              <input id="price-reorder" type="number" min="0" value={priceForm.reorderLevel} onChange={(event) => setPriceForm((current) => ({ ...current, reorderLevel: event.target.value }))} />
            </Field>
          </div>
          <label className="checkbox">
            <input type="checkbox" checked={priceForm.isActive} onChange={(event) => setPriceForm((current) => ({ ...current, isActive: event.target.checked }))} />
            This pharmacy sells the medicine
          </label>
        </form>
      </Modal>

      <Modal open={categoryModal} onClose={() => setCategoryModal(false)} title="Medicine categories">
        {actionError && <Alert tone="error">{actionError.message}</Alert>}
        <form onSubmit={addCategory} className="row mb-2">
          <div className="field full">
            <label htmlFor="new-category">New category name</label>
            <input id="new-category" value={newCategory.name} onChange={(event) => setNewCategory((current) => ({ ...current, name: event.target.value }))} required minLength={2} />
          </div>
          <button type="submit" className="btn btn-primary">Add</button>
        </form>
        <div className="alert-list">
          {(categories.data?.items || []).map((category) => (
            <div className="alert-item" key={category.id}>
              <div className="row between full">
                <div>
                  <strong>{category.name}</strong>
                  <div className="tiny muted">{category.medicine_count} medicines</div>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteCategory(category)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
