import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { Badge, EmptyState, ErrorState, PageHeader, Pagination, SkeletonCards } from '../components/UI.jsx';
import { formatMoney } from '../utils/format.js';

export default function SearchPage() {
  usePageTitle('Find medicines');
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') || '');

  const q = params.get('q') || '';
  const categoryId = params.get('categoryId') || '';
  const community = params.get('community') || '';
  const available = params.get('available') === 'true';
  const rx = params.get('rx') || '';
  const page = params.get('page') || '1';

  const categories = useFetch('/categories');

  const path = useMemo(() => {
    const query = new URLSearchParams({ page, pageSize: '12' });
    if (q) query.set('q', q);
    if (categoryId) query.set('categoryId', categoryId);
    if (community) query.set('community', community);
    if (available) query.set('available', 'true');
    if (rx) query.set('rx', rx);
    return `/medicines?${query.toString()}`;
  }, [q, categoryId, community, available, rx, page]);

  const { data, loading, error, reload } = useFetch(path);

  const update = (key, value) => {
    const next = new URLSearchParams(params);
    if (value === '' || value === false) next.delete(key);
    else next.set(key, String(value));
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const submit = (event) => {
    event.preventDefault();
    update('q', term.trim());
  };

  const items = data?.items || [];

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Find medicines in Doryumu and Kordibe"
        subtitle="Live availability from 10 community pharmacies. Prescription-only medicines are clearly marked."
      />

      <div className="search-panel card mb-2">
        <div className="card-body">
          <form onSubmit={submit} role="search">
            <div className="search-input-wrap">
              <span className="search-icon" aria-hidden="true">Search</span>
              <label className="sr-only" htmlFor="search-input">Search medicines</label>
              <input
                id="search-input"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Search by brand name, generic name or description"
                autoComplete="off"
              />
            </div>
            <div className="filters mt-2">
              <div className="chips" aria-label="Filter by community">
                {['', 'Doryumu', 'Kordibe'].map((value) => (
                  <button
                    key={value || 'all'}
                    type="button"
                    className={`chip ${community === value ? 'active' : ''}`}
                    onClick={() => update('community', value)}
                  >
                    {value || 'All communities'}
                  </button>
                ))}
              </div>
              <label className="checkbox">
                <input type="checkbox" checked={available} onChange={(event) => update('available', event.target.checked)} />
                In stock only
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={rx === 'false'} onChange={(event) => update('rx', event.target.checked ? 'false' : '')} />
                Over the counter only
              </label>
            </div>
            <div className="row mt-2">
              <button type="submit" className="btn btn-primary">Search</button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => { setTerm(''); setParams({}, { replace: true }); }}
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="chips mb-2" aria-label="Filter by category">
        <button type="button" className={`chip ${!categoryId ? 'active' : ''}`} onClick={() => update('categoryId', '')}>
          All categories
        </button>
        {categories.data?.items?.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`chip ${String(category.id) === categoryId ? 'active' : ''}`}
            onClick={() => update('categoryId', String(category.id))}
          >
            {category.name}
          </button>
        ))}
      </div>

      {error && <ErrorState error={error} retry={reload} />}
      {loading && <SkeletonCards count={6} />}

      {!loading && !error && (
        <>
          <div className="search-results-head row between mb-1">
            <p className="muted mb-0">
              {data?.pagination?.total ?? 0} medicine{(data?.pagination?.total ?? 0) === 1 ? '' : 's'} found
              {q ? ` for “${q}”` : ''}
            </p>
            {data?.pagination?.total > 0 && (
              <span className="small muted">
                Page {data.pagination.page} of {data.pagination.totalPages}
              </span>
            )}
          </div>

          {items.length === 0 ? (
            <EmptyState
              title="No medicines matched"
              action={<Link to="/search" className="btn btn-secondary">Clear filters</Link>}
            >
              Try a generic name, a shorter search term or clear the community and stock filters. Your search
              was recorded as unmet demand so pharmacies can stock it.
            </EmptyState>
          ) : (
            <div className="grid grid-3">
              {items.map((medicine) => (
                <article className="card product-card hoverable" key={medicine.id}>
                  <div className="card-body">
                    <div className="row between">
                      <span className="tiny muted">{medicine.category_name || 'General'}</span>
                      {medicine.requires_prescription ? (
                        <Badge tone="warning">Rx required</Badge>
                      ) : (
                        <Badge tone="success">OTC</Badge>
                      )}
                    </div>
                    <h3 className="product-title">
                      <Link to={`/medicines/${medicine.id}`}>{medicine.brand_name}</Link>
                    </h3>
                    <p className="product-meta">
                      {medicine.generic_name}
                      {medicine.strength ? ` · ${medicine.strength}` : ''}
                      {medicine.dosage_form ? ` · ${medicine.dosage_form}` : ''}
                    </p>
                    <div className="product-foot">
                      <div>
                        <div className="price">{formatMoney(medicine.min_price)}<small> from</small></div>
                        <div className="stock-line">
                          {medicine.stock > 0 ? (
                            <span className="tone-success">
                              {medicine.stock} unit{medicine.stock === 1 ? '' : 's'} · {medicine.pharmacy_count} pharmac
                              {medicine.pharmacy_count === 1 ? 'y' : 'ies'}
                            </span>
                          ) : (
                            <span className="tone-danger">Out of stock</span>
                          )}
                        </div>
                      </div>
                      <Link to={`/medicines/${medicine.id}`} className="btn btn-secondary btn-sm">View</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <Pagination pagination={data?.pagination} onPage={(next) => update('page', String(next))} />
        </>
      )}
    </>
  );
}
