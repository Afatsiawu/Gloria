import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client.js';
import { useCart } from '../context/CartContext.jsx';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { EmptyState, ErrorState, Icon, ProductCard, Toast } from '../components/UI.jsx';

const COMMUNITIES = ['Doryumu', 'Kordibe'];
const PAGE_SIZE = 12;
const SORT_LABELS = {
  'price-asc': 'Price: low to high',
  'price-desc': 'Price: high to low',
};

export default function MedicinesPage() {
  usePageTitle('Medicines');
  const { addItem } = useCart();
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [busyId, setBusyId] = useState(null);
  const [addedId, setAddedId] = useState(null);
  const [toast, setToast] = useState(null);
  const loggedTerm = useRef('');
  const addedTimer = useRef(null);

  const q = params.get('q') || '';
  const categoryId = params.get('categoryId') || '';
  const community = params.get('community') || '';
  const available = params.get('available') === 'true';
  const needsPrescription = params.get('rx') === 'true';
  const sort = params.get('sort') || '';
  const [searchTerm, setSearchTerm] = useState(q);
  const [draft, setDraft] = useState({ categoryId, community, available, needsPrescription });

  useEffect(() => {
    setSearchTerm(q);
  }, [q]);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [q, categoryId, community, available, needsPrescription, sort]);

  useEffect(() => () => clearTimeout(addedTimer.current), []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const categories = useFetch('/categories');

  const path = useMemo(() => {
    const query = new URLSearchParams({ page: '1', pageSize: '100' });
    if (q) query.set('q', q);
    if (categoryId) query.set('categoryId', categoryId);
    if (community) query.set('community', community);
    if (available) query.set('available', 'true');
    if (needsPrescription) query.set('rx', 'true');
    return `/medicines?${query.toString()}`;
  }, [q, categoryId, community, available, needsPrescription]);

  const { data, loading, error, reload } = useFetch(path);

  const items = useMemo(() => {
    const rows = data?.items || [];
    if (sort === 'price-asc') return [...rows].sort((a, b) => Number(a.min_price) - Number(b.min_price));
    if (sort === 'price-desc') return [...rows].sort((a, b) => Number(b.min_price) - Number(a.min_price));
    return rows;
  }, [data, sort]);

  const total = data?.pagination?.total ?? items.length;

  useEffect(() => {
    if (loading || error || !q || items.length > 0) return;
    const key = `${q}|${community}|${categoryId}`;
    if (loggedTerm.current === key) return;
    loggedTerm.current = key;
    api('/unmet-requests', {
      method: 'POST',
      body: { searchedTerm: q, ...(community ? { community } : {}) },
    }).catch(() => {});
  }, [loading, error, q, community, categoryId, items.length]);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value === '' || value === false) next.delete(key);
    else next.set(key, String(value));
    setParams(next, { replace: true });
  };

  const submitSearch = (event) => {
    event.preventDefault();
    update('q', searchTerm.trim());
  };

  const openFilters = () => {
    setDraft({ categoryId, community, available, needsPrescription });
    setFiltersOpen(true);
  };

  const toggleFilters = () => {
    if (filtersOpen) setFiltersOpen(false);
    else openFilters();
  };

  const setDraftField = (key, value) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const applyFilters = () => {
    const next = new URLSearchParams(params);
    if (draft.categoryId) next.set('categoryId', draft.categoryId);
    else next.delete('categoryId');
    if (draft.community) next.set('community', draft.community);
    else next.delete('community');
    if (draft.available) next.set('available', 'true');
    else next.delete('available');
    if (draft.needsPrescription) next.set('rx', 'true');
    else next.delete('rx');
    setParams(next, { replace: true });
    if (window.matchMedia('(max-width: 1023px)').matches) setFiltersOpen(false);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDraft({ categoryId: '', community: '', available: false, needsPrescription: false });
    setParams({}, { replace: true });
  };

  const add = async (medicine) => {
    setBusyId(medicine.id);
    try {
      await addItem({ medicineId: medicine.id });
      setAddedId(medicine.id);
      setToast({ tone: 'success', message: `${medicine.brand_name} added to your cart.` });
      clearTimeout(addedTimer.current);
      addedTimer.current = setTimeout(() => setAddedId(null), 2000);
    } catch (err) {
      setToast({ tone: 'error', message: err.message || 'Could not add this item.' });
    } finally {
      setBusyId(null);
    }
  };

  const categoryName = (categories.data?.items || []).find((row) => String(row.id) === String(categoryId))?.name;

  const chips = [];
  if (q) chips.push({ key: 'q', label: `Search: ${q}`, remove: () => update('q', '') });
  if (categoryId) chips.push({ key: 'category', label: categoryName || 'Category', remove: () => update('categoryId', '') });
  if (community) chips.push({ key: 'community', label: community, remove: () => update('community', '') });
  if (available) chips.push({ key: 'available', label: 'In stock', remove: () => update('available', false) });
  if (needsPrescription) {
    chips.push({ key: 'rx', label: 'Prescription needed', remove: () => update('rx', '') });
  }
  if (sort) chips.push({ key: 'sort', label: SORT_LABELS[sort], remove: () => update('sort', '') });

  const filterCount = [categoryId, community, available, needsPrescription].filter(Boolean).length;

  return (
    <>
      <h1 className="page-heading">Medicines</h1>

      <div className="medicines-toolbar">
        <form className="medicines-search" role="search" onSubmit={submitSearch}>
          <label className="sr-only" htmlFor="medicine-search">
            Search medicines
          </label>
          <div className="search-field">
            <Icon name="Search" size={18} className="search-icon" />
            <input
              id="medicine-search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search medicines"
              autoComplete="off"
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Search
          </button>
        </form>
        <button
          type="button"
          className="btn btn-secondary"
          aria-expanded={filtersOpen}
          aria-controls="medicine-filters"
          onClick={toggleFilters}
        >
          Filter{filterCount ? ` (${filterCount})` : ''}
        </button>
      </div>

      {chips.length > 0 && (
        <div className="filter-chips" aria-label="Applied filters">
          {chips.map((chip) => (
            <button key={chip.key} type="button" className="filter-chip" onClick={chip.remove}>
              {chip.label}
              <span aria-hidden="true">×</span>
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          <button type="button" className="filter-clear" onClick={clearFilters}>
            Clear all
          </button>
        </div>
      )}

      <div className={`medicines-layout${filtersOpen ? ' with-filters' : ''}`}>
        {filtersOpen && (
          <aside className="filter-panel card" id="medicine-filters" aria-label="Filters">
            <div className="field">
              <label htmlFor="filter-category">Category</label>
              <select
                id="filter-category"
                value={draft.categoryId}
                onChange={(event) => setDraftField('categoryId', event.target.value)}
              >
                <option value="">All categories</option>
                {(categories.data?.items || []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="filter-community">Community</label>
              <select
                id="filter-community"
                value={draft.community}
                onChange={(event) => setDraftField('community', event.target.value)}
              >
                <option value="">Both</option>
                {COMMUNITIES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.available}
                onChange={(event) => setDraftField('available', event.target.checked)}
              />
              In stock only
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={draft.needsPrescription}
                onChange={(event) => setDraftField('needsPrescription', event.target.checked)}
              />
              Prescription needed
            </label>
            <div className="filter-actions">
              <button type="button" className="btn btn-primary" onClick={applyFilters}>
                Apply
              </button>
              <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                Clear
              </button>
            </div>
          </aside>
        )}

        <div className="medicines-results">
          <div className="result-header">
            <p className="result-count">
              {loading ? 'Loading…' : `${total} result${total === 1 ? '' : 's'}`}
            </p>
            <label className="result-sort" htmlFor="result-sort">
              <span>Sort by price</span>
              <select id="result-sort" value={sort} onChange={(event) => update('sort', event.target.value)}>
                <option value="">Default</option>
                <option value="price-asc">Low to high</option>
                <option value="price-desc">High to low</option>
              </select>
            </label>
          </div>

          {error && <ErrorState error={error} retry={reload} />}

          {!loading && !error && items.length === 0 && (
            <EmptyState
              title="No medicines matched"
              icon="Package"
              action={
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              }
            >
              {q
                ? `Check the spelling of “${q}” or try a shorter word.`
                : 'Try another category or clear the filters.'}
            </EmptyState>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <div className="product-grid">
                {items.slice(0, visible).map((medicine) => (
                  <ProductCard
                    key={medicine.id}
                    medicine={medicine}
                    onAdd={add}
                    busy={busyId === medicine.id}
                    added={addedId === medicine.id}
                  />
                ))}
              </div>
              {visible < items.length && (
                <div className="load-more">
                  <button type="button" className="btn btn-secondary" onClick={() => setVisible((n) => n + PAGE_SIZE)}>
                    Load more
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Toast tone={toast?.tone} onClose={() => setToast(null)}>
        {toast?.message}
      </Toast>
    </>
  );
}
