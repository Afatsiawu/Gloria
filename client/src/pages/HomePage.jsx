import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFetch, usePageTitle } from '../hooks/useApi.js';
import { ErrorState, Icon, Loading, SectionBand } from '../components/UI.jsx';
import { MiniCard, PhoneMock, VisualFrame } from '../components/LandingVisuals.jsx';
import landingImages from '../config/landingImages.js';

const COMMUNITIES = ['Doryumu', 'Kordibe'];

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
        <div className="home-hero-grid">
          <div className="home-hero-copy">
            <h1>Order medicines from pharmacies in Doryumu and Kordibe</h1>
            <p className="home-lede">
              Search for a medicine, compare pharmacies and place your order. No account needed.
            </p>
            <form className="home-search" role="search" onSubmit={search}>
              <span className="home-search-icon" aria-hidden="true">
                <Icon name="Search" size={20} />
              </span>
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
                      <Icon name="ArrowRight" size={16} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="home-hero-visual" aria-hidden="true">
            <VisualFrame tone="peach" shape="circle" className="hero-frame" image={landingImages.hero}>
              <PhoneMock variant="medicines" className="hero-phone" />
            </VisualFrame>
            <MiniCard className="hero-mini hero-mini-stock">
              <span className="mini-dot" />
              <span>
                <strong>In stock</strong>
                <span className="mini-label">Panadol 500 mg · GHS 5.00</span>
              </span>
            </MiniCard>
            <MiniCard className="hero-mini hero-mini-ready">
              <Icon name="Package" size={18} />
              <span>
                <strong>Ready</strong>
                <span className="mini-label">Doryumu Community Pharmacy</span>
              </span>
            </MiniCard>
          </div>
        </div>
      </SectionBand>

      <SectionBand tone="white" className="home-section home-categories" id="categories">
        <div className="categories-grid">
          <div className="categories-visual" aria-hidden="true">
            <VisualFrame
              tone="blue"
              shape="circle"
              className="categories-frame"
              image={landingImages.categories}
            >
              <div className="category-orbit">
                {[0, 1, 2, 3].map((index) => (
                  <span className="category-orbit-mark" key={index}>
                    <Icon name="Package" size={24} />
                  </span>
                ))}
              </div>
            </VisualFrame>
          </div>
          <div className="categories-body">
            <h2>Browse by category</h2>
            {categories.loading && <Loading />}
            {categories.error && <ErrorState error={categories.error} retry={categories.reload} />}
            {!categories.loading && !categories.error && (
              <div className="category-list">
                {categoryRows.map((category) => (
                  <Link
                    key={category.id}
                    to={`/medicines?categoryId=${category.id}`}
                    className="category-row"
                  >
                    <span className="category-mark" aria-hidden="true">
                      <Icon name="Package" size={20} />
                    </span>
                    <span className="category-text">
                      <span className="category-name">{category.name}</span>
                      <span className="category-count">
                        {category.medicine_count
                          ? `${category.medicine_count} medicine${category.medicine_count === 1 ? '' : 's'}`
                          : 'Browse'}
                      </span>
                    </span>
                    <Icon name="ArrowRight" size={18} className="category-arrow" />
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionBand>

      <SectionBand tone="peach" className="home-section home-how" id="how-it-works">
        <h2 className="how-title">How it works</h2>
        <div className="how-wrap">
          <svg
            className="how-connectors"
            viewBox="0 0 1000 936"
            preserveAspectRatio="none"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M 18 120 C 250 120 300 448 490 448" />
            <path d="M 490 448 C 300 448 250 776 18 776" />
          </svg>
          <ol className="how-steps">
            <li className="how-step">
              <div className="how-step-copy">
                <span className="how-step-number" aria-hidden="true">
                  1
                </span>
                <h3>Find your medicine.</h3>
              </div>
              <div className="how-step-visual" aria-hidden="true">
                <VisualFrame tone="peach" shape="panel">
                  <div className="how-panel">
                    <MiniCard className="how-mini">
                      <Icon name="Search" size={18} />
                      <span className="mini-label">Search medicines</span>
                    </MiniCard>
                    <MiniCard className="how-mini">
                      <span className="how-thumb">P</span>
                      <span>
                        <strong>Panadol 500 mg</strong>
                        <span className="mini-label">GHS 5.00</span>
                      </span>
                      <span className="how-chip">In stock</span>
                    </MiniCard>
                    <MiniCard className="how-mini">
                      <span className="how-thumb">B</span>
                      <span>
                        <strong>Brufen 400 mg</strong>
                        <span className="mini-label">GHS 7.00</span>
                      </span>
                      <span className="how-chip">In stock</span>
                    </MiniCard>
                  </div>
                </VisualFrame>
              </div>
            </li>
            <li className="how-step">
              <div className="how-step-copy">
                <span className="how-step-number" aria-hidden="true">
                  2
                </span>
                <h3>Place your order, no account needed.</h3>
              </div>
              <div className="how-step-visual" aria-hidden="true">
                <VisualFrame tone="blue" shape="panel">
                  <div className="how-panel">
                    <MiniCard className="how-mini">
                      <span className="how-thumb">P</span>
                      <span>
                        <strong>Panadol 500 mg</strong>
                        <span className="mini-label">Doryumu Community Pharmacy</span>
                      </span>
                      <span className="how-price">GHS 5.00</span>
                    </MiniCard>
                    <MiniCard className="how-mini">
                      <Icon name="Cart" size={18} />
                      <span>
                        <strong>1 item</strong>
                        <span className="mini-label">GHS 5.00</span>
                      </span>
                    </MiniCard>
                    <span className="how-action">Place order</span>
                  </div>
                </VisualFrame>
              </div>
            </li>
            <li className="how-step">
              <div className="how-step-copy">
                <span className="how-step-number" aria-hidden="true">
                  3
                </span>
                <h3>Pick it up or get it delivered.</h3>
              </div>
              <div className="how-step-visual" aria-hidden="true">
                <VisualFrame tone="rose" shape="panel">
                  <div className="how-panel">
                    <MiniCard className="how-mini">
                      <Icon name="MapPin" size={18} />
                      <span>
                        <strong>Pickup</strong>
                        <span className="mini-label">Doryumu Community Pharmacy</span>
                      </span>
                    </MiniCard>
                    <MiniCard className="how-mini">
                      <Icon name="Truck" size={18} />
                      <span>
                        <strong>Delivery</strong>
                        <span className="mini-label">Choose an address</span>
                      </span>
                      <span className="how-chip">Ready</span>
                    </MiniCard>
                  </div>
                </VisualFrame>
              </div>
            </li>
          </ol>
        </div>
      </SectionBand>

      <SectionBand tone="white" className="home-section home-pharmacies" id="pharmacies">
        <h2>Our pharmacies</h2>
        {pharmacies.loading && <Loading />}
        {pharmacies.error && <ErrorState error={pharmacies.error} retry={pharmacies.reload} />}
        {!pharmacies.loading && !pharmacies.error && (
          <div className="pharmacy-grid">
            {pharmacyRows.map((pharmacy) => (
              <article key={pharmacy.id} className="pharmacy-card">
                <span className="pharmacy-community">{pharmacy.community}</span>
                <h3 className="pharmacy-name">{pharmacy.name}</h3>
                <a href={`tel:${pharmacy.phone}`} className="pharmacy-phone">
                  <Icon name="Phone" size={16} />
                  {pharmacy.phone}
                </a>
                <Link
                  to={`/medicines?community=${pharmacy.community}`}
                  className="pharmacy-link"
                >
                  See medicines
                  <Icon name="ArrowRight" size={16} />
                </Link>
              </article>
            ))}
          </div>
        )}
      </SectionBand>

      <SectionBand tone="plain" className="home-section home-prescription" id="prescriptions">
        <div className="prescription-panel">
          <div className="prescription-visual" aria-hidden="true">
            <VisualFrame
              tone="peach"
              shape="circle"
              className="prescription-frame"
              image={landingImages.prescription}
            >
              <span className="prescription-mark">
                <Icon name="Package" size={44} />
              </span>
            </VisualFrame>
          </div>
          <div className="prescription-copy">
            <h2>Prescription medicines</h2>
            <p>
              Prescription medicines need a prescription. A pharmacist checks it before your order is
              released.
            </p>
            <Link to="/medicines" className="btn btn-secondary">
              Browse medicines
            </Link>
          </div>
        </div>
      </SectionBand>

      <SectionBand tone="white" className="home-section home-tracking">
        <div className="track-panel">
          <div className="track-copy">
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
          <div className="track-visual" aria-hidden="true">
            <span className="track-halo" />
            <PhoneMock variant="tracking" className="track-phone" />
          </div>
        </div>
      </SectionBand>
    </div>
  );
}
