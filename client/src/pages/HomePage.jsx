import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { ErrorState, Icon, Loading, SectionBand } from '../components/UI.jsx';

const COMMUNITIES = ['Doryumu', 'Kordibe'];

function HeroPattern() {
  return (
    <svg className="hero-pattern" viewBox="0 0 220 220" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round">
        <path d="M78 18h26v34h34v26h-34v34H78V78H44V52h34z" />
        <rect x="120" y="120" width="82" height="40" rx="20" transform="rotate(-28 161 140)" />
        <path d="M139 132l44 24" />
      </g>
    </svg>
  );
}

export default function HomePage() {
  usePageTitle('PharmaLink');
  const navigate = useNavigate();
  const categories = useFetch('/categories');
  const pharmacies = useFetch('/pharmacies');
  const [term, setTerm] = useState('');
  const [reference, setReference] = useState('');
  const [phone, setPhone] = useState('');

  const search = (event) => {
    event.preventDefault();
    const query = term.trim();
    navigate(query ? `/medicines?q=${encodeURIComponent(query)}` : '/medicines');
  };

  const track = (event) => {
    event.preventDefault();
    const query = new URLSearchParams({
      reference: reference.trim().toUpperCase(),
      phone: phone.trim(),
    });
    navigate(`/track?${query.toString()}`);
  };

  const pharmacyRows = pharmacies.data?.items || [];
  const categoryRows = (categories.data?.items || []).slice(0, 6);
  const communityCount = (community) =>
    pharmacyRows.filter((pharmacy) => pharmacy.community === community).length;

  return (
    <div className="home-page">
      <SectionBand tone="hero" className="home-hero">
        <HeroPattern />
        <div className="home-hero-inner">
          <h1>Order medicines from pharmacies in Doryumu and Kordibe</h1>
          <p className="home-lede">Search for a medicine, compare pharmacies and place your order. No account needed.</p>
          <form className="home-search" role="search" onSubmit={search}>
            <label className="sr-only" htmlFor="home-search">
              Search medicines
            </label>
            <input
              id="home-search"
              value={term}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search medicines"
              autoComplete="off"
            />
            <button type="submit" className="btn btn-primary">
              Search
            </button>
          </form>
          <div className="community-cards">
            {COMMUNITIES.map((community) => {
              const count = communityCount(community);
              return (
                <Link key={community} to={`/medicines?community=${community}`} className="community-card">
                  <span className="community-name">{community}</span>
                  <span className="community-count">
                    {count > 0 ? `${count} pharmac${count === 1 ? 'y' : 'ies'}` : 'View medicines'}
                  </span>
                  <span className="community-arrow" aria-hidden="true">
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </SectionBand>

      <SectionBand tone="white" className="home-section" id="how-it-works">
        <h2>How it works</h2>
        <ol className="steps">
          <li className="step-card">
            <span className="step-number" aria-hidden="true">
              1
            </span>
            <span>Find your medicine.</span>
          </li>
          <li className="step-card">
            <span className="step-number" aria-hidden="true">
              2
            </span>
            <span>Place your order, no account needed.</span>
          </li>
          <li className="step-card">
            <span className="step-number" aria-hidden="true">
              3
            </span>
            <span>Pick it up or get it delivered.</span>
          </li>
        </ol>
      </SectionBand>

      <SectionBand tone="plain" className="home-section" id="categories">
        <h2>Browse by category</h2>
        {categories.loading && <Loading />}
        {categories.error && <ErrorState error={categories.error} retry={categories.reload} />}
        {!categories.loading && !categories.error && (
          <div className="category-tiles">
            {categoryRows.map((category) => (
              <Link key={category.id} to={`/medicines?categoryId=${category.id}`} className="category-tile">
                <span className="category-mark" aria-hidden="true">
                  <Icon name="Package" size={20} />
                </span>
                <span className="category-name">{category.name}</span>
                <span className="category-count">
                  {category.medicine_count
                    ? `${category.medicine_count} medicine${category.medicine_count === 1 ? '' : 's'}`
                    : 'Browse'}
                </span>
              </Link>
            ))}
          </div>
        )}
      </SectionBand>

      <SectionBand tone="white" className="home-section" id="pharmacies">
        <h2>Our pharmacies</h2>
        {pharmacies.loading && <Loading />}
        {pharmacies.error && <ErrorState error={pharmacies.error} retry={pharmacies.reload} />}
        {!pharmacies.loading && !pharmacies.error && (
          <div className="pharmacy-groups">
            {COMMUNITIES.map((community) => {
              const rows = pharmacyRows.filter((pharmacy) => pharmacy.community === community);
              return (
                <div key={community} className="pharmacy-group">
                  <h3>{community}</h3>
                  {rows.length === 0 && <p className="muted">No pharmacies listed.</p>}
                  <div className="pharmacy-cards">
                    {rows.map((pharmacy) => (
                      <article key={pharmacy.id} className="pharmacy-card">
                        <h4 className="pharmacy-name">{pharmacy.name}</h4>
                        <a href={`tel:${pharmacy.phone}`} className="pharmacy-phone">
                          <Icon name="Phone" size={16} />
                          {pharmacy.phone}
                        </a>
                        <Link to={`/medicines?community=${community}`} className="pharmacy-link">
                          See medicines
                        </Link>
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionBand>

      <SectionBand tone="plain" className="home-section">
        <div className="track-card">
          <h2>Track your order</h2>
          <form className="track-form" onSubmit={track}>
            <div className="field">
              <label htmlFor="track-reference">Order reference</label>
              <input
                id="track-reference"
                value={reference}
                onChange={(event) => setReference(event.target.value)}
                placeholder="PH-123456"
                autoComplete="off"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="track-phone">Phone number</label>
              <input
                id="track-phone"
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              Track order
            </button>
          </form>
        </div>
        <p className="home-note" id="prescriptions">
          Prescription medicines need a prescription. A pharmacist checks it before your order is released.
        </p>
      </SectionBand>
    </div>
  );
}
