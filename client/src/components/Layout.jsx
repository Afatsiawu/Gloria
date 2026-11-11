import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { getHomeRoute, getNavGroups } from '../config/roleRoutes.js';
import { useCart } from '../context/CartContext.jsx';
import NavMenu from './NavMenu.jsx';
import { Icon, Modal } from './UI.jsx';

function Logo({ to = '/' }) {
  return (
    <Link to={to} className="logo">
      <span className="logo-mark" aria-hidden="true">
        <Icon name="Cross" size={18} />
      </span>
      PharmaLink
    </Link>
  );
}

function MedicineSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');

  const submit = (event) => {
    event.preventDefault();
    const query = term.trim();
    navigate(query ? `/medicines?q=${encodeURIComponent(query)}` : '/medicines');
  };

  return (
    <form className="header-search" role="search" onSubmit={submit}>
      <div className="search-field">
        <span className="search-icon" aria-hidden="true">
          <Icon name="Search" size={18} />
        </span>
        <label className="sr-only" htmlFor="header-search">
          Search medicines
        </label>
        <input
          id="header-search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search medicines"
          autoComplete="off"
        />
      </div>
    </form>
  );
}

function StaffLayout({ user, groups, logout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div className="staff-shell">
      <aside className="staff-sidebar">
        <Logo />
        <nav className="sidebar-nav" aria-label="Staff navigation">
          {groups.map((group) => (
            <div className="sidebar-group" key={group.title}>
              <p className="sidebar-heading">{group.title}</p>
              {group.links.map((link) => (
                <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
          <button type="button" className="sidebar-signout" onClick={logout}>
            Sign out
          </button>
        </nav>
      </aside>
      <div className="staff-main">
        <div className="staff-topbar">
          <Logo />
          <span className="staff-user">
            {user?.role === 'pharmacist' && (user.pharmacy_name || user.pharmacyName)
              ? `${user.pharmacy_name || user.pharmacyName} · `
              : ''}
            {user?.full_name}
          </span>
          <button
            type="button"
            className="staff-menu-button"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-haspopup="dialog"
            onClick={() => setMenuOpen((open) => !open)}
            ref={menuButtonRef}
          >
            <Icon name={menuOpen ? 'Close' : 'Menu'} size={22} />
          </button>
        </div>
        <main id="main" className="staff-content">
          <Outlet />
        </main>
      </div>
      <NavMenu
        open={menuOpen}
        onClose={closeMenu}
        label="Staff menu"
        sections={groups}
        onLogout={logout}
        triggerRef={menuButtonRef}
      />
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const { count, conflict, resolveConflict } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [conflictError, setConflictError] = useState('');
  const menuButtonRef = useRef(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const isCustomer = user?.role === 'customer';
  const isStaff = ['pharmacist', 'admin', 'rider'].includes(user?.role);
  const inStaffArea = /^\/(?:dashboard|staff|admin|rider)(?:\/|$)/.test(location.pathname);

  useEffect(() => {
    if (!location.hash) {
      window.scrollTo(0, 0);
      return undefined;
    }
    const id = location.hash.slice(1);
    let frame = 0;
    let attempts = 0;
    const scrollToTarget = () => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView();
        return;
      }
      if (attempts < 120) {
        attempts += 1;
        frame = window.requestAnimationFrame(scrollToTarget);
      }
    };
    frame = window.requestAnimationFrame(scrollToTarget);
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname, location.hash]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleConflict = async (action) => {
    setConflictError('');
    try {
      await resolveConflict(action);
    } catch (err) {
      setConflictError(err.message || 'Could not update the cart.');
    }
  };

  if (isStaff && inStaffArea) {
    return <StaffLayout user={user} groups={getNavGroups(user.role)} logout={handleLogout} />;
  }

  const accountTo = user ? (isCustomer ? '/account' : getHomeRoute(user.role)) : '/login';
  const accountLabel = user ? (isCustomer ? 'Account' : 'Dashboard') : 'Login';
  const headerAccountLabel =
    user && !isCustomer && location.pathname !== '/' ? 'Back to dashboard' : accountLabel;
  const menuSections = getNavGroups('customer').map((section) => ({
    ...section,
    links: section.links
      .filter((link) => !isStaff || link.to !== '/cart')
      .map((link) =>
        isStaff && link.to === '/account' ? { label: 'Dashboard', to: accountTo } : link
      ),
  }));

  return (
    <div
      className={`app-shell${isStaff ? '' : ' has-bottom-nav'}${location.pathname === '/' ? ' is-home' : ''}${location.pathname === '/cart' ? ' has-sticky-cart' : ''}${['/', '/medicines'].includes(location.pathname) ? ' hide-header-search' : ''}`}
    >
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <header className="site-header">
        <div className="wrap header-inner">
          <Logo />
          <nav className="header-nav" aria-label="Main">
            <NavLink to="/medicines" className={({ isActive }) => (isActive ? 'active' : '')}>
              Medicines
            </NavLink>
            <Link to="/#pharmacies">Pharmacies</Link>
            <Link to="/#how-it-works">How it works</Link>
            <NavLink to="/track" className={({ isActive }) => (isActive ? 'active' : '')}>
              Track order
            </NavLink>
          </nav>
          <div className="header-actions">
            <Link to={accountTo} className="header-account">
              {headerAccountLabel}
            </Link>
            {!isStaff && (
              <Link to="/cart" className="icon-link" aria-label={`Cart, ${count} item${count === 1 ? '' : 's'}`}>
                <Icon name="Cart" size={22} />
                {count > 0 ? <span className="cart-badge">{count}</span> : <span className="cart-dot" aria-hidden="true" />}
              </Link>
            )}
            <button
              type="button"
              className="header-menu-button"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={menuOpen}
              aria-haspopup="dialog"
              onClick={() => setMenuOpen((open) => !open)}
              ref={menuButtonRef}
            >
              <Icon name={menuOpen ? 'Close' : 'Menu'} size={22} />
            </button>
          </div>
        </div>
        <div className="wrap header-search-row">
          <MedicineSearch />
        </div>
      </header>
      <main id="main" className="site-main">
        <div className="wrap">
          <Outlet />
        </div>
      </main>
      <footer className="site-footer on-dark">
        <div className="wrap footer-main">
          <div className="footer-brand-block">
            <Logo />
            <p className="footer-tagline">This does not replace your pharmacist.</p>
            <a className="footer-phone" href="tel:0243000000">
              024 300 0000
            </a>
          </div>
          <nav className="footer-columns" aria-label="Footer">
            <div className="footer-column">
              <p className="footer-heading">Shop</p>
              <Link to="/medicines">Medicines</Link>
              <Link to="/#categories">Categories</Link>
              <Link to="/#pharmacies">Pharmacies</Link>
            </div>
            <div className="footer-column">
              <p className="footer-heading">Help</p>
              <Link to="/track">Track order</Link>
              <Link to="/#how-it-works">How it works</Link>
              <Link to="/#prescriptions">Prescriptions</Link>
            </div>
            <div className="footer-column">
              <p className="footer-heading">Account</p>
              {user ? (
                <Link to={accountTo}>{isCustomer ? 'Your account' : 'Dashboard'}</Link>
              ) : (
                <>
                  <Link to="/login">Login</Link>
                  <Link to="/register">Register</Link>
                </>
              )}
              <button type="button" onClick={() => setPrivacyOpen(true)}>
                Privacy notice
              </button>
            </div>
          </nav>
        </div>
        <div className="wrap footer-bottom">
          <p>© {new Date().getFullYear()} PharmaLink. All rights reserved.</p>
        </div>
      </footer>
      {!isStaff && (
        <nav className="bottom-nav" aria-label="Quick links">
          <NavLink to="/" end>
            <Icon name="Home" size={22} />
            Home
          </NavLink>
          <NavLink to="/medicines">
            <Icon name="Search" size={22} />
            Medicines
          </NavLink>
          <NavLink to="/cart">
            <Icon name="Cart" size={22} />
            Cart
          </NavLink>
          <NavLink to={accountTo}>
            <Icon name="User" size={22} />
            Account
          </NavLink>
        </nav>
      )}
      <NavMenu
        open={menuOpen}
        onClose={closeMenu}
        label="Site menu"
        sections={menuSections}
        onLogout={user ? handleLogout : undefined}
        triggerRef={menuButtonRef}
      />
      <Modal
        open={Boolean(conflict)}
        onClose={() => handleConflict('keep')}
        title="Start a new cart?"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => handleConflict('keep')}>
              Keep current cart
            </button>
            <button type="button" className="btn btn-primary" onClick={() => handleConflict('new')}>
              Start new cart
            </button>
          </>
        }
      >
        <p>
          Your cart has medicines from {conflict?.currentPharmacy?.name}. A cart can only hold medicines from one
          pharmacy.
        </p>
        <p>Start a new cart for this medicine, or keep your current cart?</p>
        {conflict?.nextPharmacy && (
          <p className="small muted">
            The new medicine is from {conflict.nextPharmacy.name}, {conflict.nextPharmacy.community}.
          </p>
        )}
        {conflictError && <p className="error-text">{conflictError}</p>}
      </Modal>
      <Modal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title="Privacy notice"
        footer={
          <button type="button" className="btn btn-primary" onClick={() => setPrivacyOpen(false)}>
            Close
          </button>
        }
      >
        <p>
          We use your name, phone number and delivery details only to process and deliver your order under
          Ghana&apos;s Data Protection Act.
        </p>
        <p>Your details are shared only with the pharmacy you order from and, for delivery orders, the rider.</p>
        <p>We do not sell your details. Contact the pharmacy on 024 300 0000 to ask for a copy or removal.</p>
      </Modal>
    </div>
  );
}
