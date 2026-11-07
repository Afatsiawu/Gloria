import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { roleHome } from '../context/AuthContext.jsx';

const PRIMARY = {
  public: [
    { to: '/search', label: 'Find medicines' },
    { to: '/#how', label: 'How it works' },
  ],
  customer: [
    { to: '/search', label: 'Search' },
    { to: '/orders', label: 'My orders' },
    { to: '/refills', label: 'Refills' },
    { to: '/cart', label: 'Cart' },
  ],
  pharmacist: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/staff/orders', label: 'Orders' },
    { to: '/staff/prescriptions', label: 'Prescriptions' },
    { to: '/staff/inventory', label: 'Inventory' },
  ],
  admin: [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/staff/orders', label: 'Orders' },
    { to: '/staff/prescriptions', label: 'Prescriptions' },
    { to: '/staff/inventory', label: 'Inventory' },
  ],
  rider: [{ to: '/rider', label: 'My deliveries' }],
};

const SECONDARY = {
  pharmacist: [
    { to: '/staff/purchase-orders', label: 'Purchasing' },
    { to: '/staff/suppliers', label: 'Suppliers' },
    { to: '/staff/walk-in', label: 'Walk-in sale' },
    { to: '/staff/alerts', label: 'Stock alerts' },
    { to: '/staff/deliveries', label: 'Deliveries' },
    { to: '/staff/zones', label: 'Delivery zones' },
    { to: '/staff/reports', label: 'Reports' },
  ],
  admin: [
    { to: '/staff/purchase-orders', label: 'Purchasing' },
    { to: '/staff/suppliers', label: 'Suppliers' },
    { to: '/staff/walk-in', label: 'Walk-in sale' },
    { to: '/staff/alerts', label: 'Stock alerts' },
    { to: '/staff/deliveries', label: 'Deliveries' },
    { to: '/staff/zones', label: 'Delivery zones' },
    { to: '/staff/reports', label: 'Reports' },
    { to: '/admin/users', label: 'Users & roles' },
    { to: '/admin/medicines', label: 'Medicines' },
    { to: '/admin/analytics', label: 'Analytics & forecast' },
    { to: '/admin/audit', label: 'Audit log' },
    { to: '/admin/outbox', label: 'Mock outbox' },
    { to: '/admin/settings', label: 'Settings & privacy' },
  ],
  customer: [{ to: '/account', label: 'Profile & privacy' }, { to: '/notifications', label: 'Notifications' }],
};

function Brand() {
  return (
    <Link to="/" className="brand" aria-label="PharmaLink home">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="28" height="28" role="img">
          <rect width="32" height="32" rx="9" fill="currentColor" />
          <path d="M14 7h4v7h7v4h-7v7h-4v-7H7v-4h7z" fill="#fff" />
        </svg>
      </span>
      <span>
        <strong>PharmaLink</strong>
        <small>Doryumu · Kordibe</small>
      </span>
    </Link>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role || 'public';
  const primary = PRIMARY[role] || PRIMARY.public;
  const secondary = SECONDARY[role] || [];

  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    document.body.classList.toggle('nav-open', open);
    return () => document.body.classList.remove('nav-open');
  }, [open]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>
      <div className="top-strip">
        <div className="container top-strip-inner">
          <span>Serving 10 community pharmacies in Doryumu &amp; Kordibe, Shai-Osudoku District</span>
          <span className="top-strip-note">Prescriptions verified by licensed pharmacists</span>
        </div>
      </div>
      <header className="site-header">
        <div className="container header-inner">
          <Brand />
          <button
            type="button"
            className="menu-btn"
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((v) => !v)}
          >
            <span aria-hidden="true">{open ? 'x' : 'menu'}</span>
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
          </button>
          <nav className="desktop-nav" aria-label="Main navigation">
            {primary.map((link) => (
              <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? 'active' : '')}>
                {link.label}
              </NavLink>
            ))}
            {secondary.length > 0 && (
              <details className="nav-more">
                <summary>More</summary>
                <div className="nav-more-panel">
                  {secondary.map((link) => (
                    <NavLink key={link.to} to={link.to}>
                      {link.label}
                    </NavLink>
                  ))}
                </div>
              </details>
            )}
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <Link to="/notifications" className="icon-btn" aria-label="Notifications" title="Notifications">
                  <span aria-hidden="true">Bell</span>
                </Link>
                <Link to={role === 'customer' ? '/account' : roleHome(role)} className="user-chip">
                  <span className="avatar" aria-hidden="true">{user.full_name?.charAt(0) || 'U'}</span>
                  <span className="user-name">
                    {user.full_name}
                    <small>{role}</small>
                  </span>
                </Link>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleLogout}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
                <Link to="/register" className="btn btn-primary btn-sm">Create account</Link>
              </>
            )}
          </div>
        </div>
        {open && (
          <nav id="mobile-nav" className="mobile-nav container" aria-label="Mobile navigation">
            <div className="mobile-links">
              {primary.map((link) => (
                <NavLink key={link.to} to={link.to}>{link.label}</NavLink>
              ))}
              {secondary.map((link) => (
                <NavLink key={link.to} to={link.to}>{link.label}</NavLink>
              ))}
              {user && <NavLink to="/notifications">Notifications</NavLink>}
              {!user && (
                <>
                  <NavLink to="/login">Sign in</NavLink>
                  <NavLink to="/register">Create account</NavLink>
                </>
              )}
              {user && (
                <button type="button" className="btn btn-ghost" onClick={handleLogout}>
                  Sign out
                </button>
              )}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="container page">
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <Brand />
            <p>
              A data-driven pharmacy and customer order system for community pharmacies in Doryumu and
              Kordibe. Compare prices, check live stock and have prescriptions reviewed by a pharmacist.
            </p>
          </div>
          <div>
            <h3>Customers</h3>
            <Link to="/search">Search medicines</Link>
            <Link to="/orders">Track an order</Link>
            <Link to="/refills">Refill reminders</Link>
          </div>
          <div>
            <h3>Pharmacy staff</h3>
            <Link to="/login">Pharmacist sign in</Link>
            <Link to="/staff/reports">Reports &amp; exports</Link>
            <Link to="/staff/alerts">Expiry alerts</Link>
          </div>
          <div>
            <h3>Trust &amp; safety</h3>
            <p className="small">
              Licensed pharmacies only. Prescription-only medicines are released after pharmacist
              verification. Data handled under Ghana&apos;s Data Protection Act 2012 (Act 843).
            </p>
          </div>
        </div>
        <div className="container footer-bottom">
          <p>
            <strong>Important:</strong> PharmaLink supports, and does not replace, the professional
            judgement and advice of a pharmacist. Always follow the medicine label and your prescriber&apos;s
            instructions.
          </p>
          <p className="small">© {new Date().getFullYear()} PharmaLink · Shai-Osudoku District, Ghana</p>
        </div>
      </footer>
    </div>
  );
}
