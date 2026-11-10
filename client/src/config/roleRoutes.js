/**
 * Single source of truth for role-based routing.
 *
 * The app historically uses `/dashboard` and `/staff/*` for pharmacist pages,
 * so those URLs stay as they are. The role table's canonical paths
 * (`/pharmacist/*`, `/admin/dashboard`, `/rider/deliveries`) are mapped onto
 * them here instead of renaming routes.
 */

export const ROLES = ['customer', 'pharmacist', 'admin', 'rider'];

export const HOME_ROUTES = {
  customer: '/account',
  pharmacist: '/dashboard',
  admin: '/dashboard',
  rider: '/rider',
};

export const CHANGE_PASSWORD_PATH = '/account/change-password';

export const PUBLIC_PATHS = [
  '/',
  '/search',
  '/medicines',
  '/medicines/:id',
  '/cart',
  '/checkout',
  '/track',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
];

const SIGNED_IN_PATHS = ['/notifications'];

const ROLE_PATHS = {
  customer: ['/orders/*', '/account/*', '/refills', ...SIGNED_IN_PATHS],
  pharmacist: ['/dashboard', '/staff/*', CHANGE_PASSWORD_PATH, ...SIGNED_IN_PATHS],
  admin: ['/dashboard', '/staff/*', '/admin/*', CHANGE_PASSWORD_PATH, ...SIGNED_IN_PATHS],
  rider: ['/rider/*', CHANGE_PASSWORD_PATH, ...SIGNED_IN_PATHS],
};

/** Canonical role URLs mapped onto the routes that already exist. */
const ROUTE_ALIASES = [
  [/^\/pharmacist\/dashboard(?:\/.*)?$/, '/dashboard'],
  [/^\/pharmacist\/orders(?:\/.*)?$/, '/staff/orders'],
  [/^\/pharmacist\/prescriptions(?:\/.*)?$/, '/staff/prescriptions'],
  [/^\/pharmacist\/inventory(?:\/.*)?$/, '/staff/inventory'],
  [/^\/pharmacist\/suppliers(?:\/.*)?$/, '/staff/suppliers'],
  [/^\/pharmacist\/purchase-orders(?:\/.*)?$/, '/staff/purchase-orders'],
  [/^\/pharmacist\/walk-in(?:\/.*)?$/, '/staff/walk-in'],
  [/^\/pharmacist\/reports(?:\/.*)?$/, '/staff/reports'],
  [/^\/admin\/dashboard(?:\/.*)?$/, '/dashboard'],
  [/^\/rider\/deliveries(?:\/.*)?$/, '/rider'],
];

export const ROLE_NAV = {
  customer: [
    { label: 'Home', to: '/' },
    { label: 'Medicines', to: '/medicines' },
    { label: 'Pharmacies', to: '/#pharmacies' },
    { label: 'Track order', to: '/track' },
    { label: 'Cart', to: '/cart' },
    { label: 'Account', to: '/account' },
  ],
  pharmacist: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Orders', to: '/staff/orders' },
    { label: 'Prescriptions', to: '/staff/prescriptions' },
    { label: 'Inventory and batches', to: '/staff/inventory' },
    { label: 'Suppliers and purchasing', to: '/staff/suppliers' },
    { label: 'Walk-in sales', to: '/staff/walk-in' },
    { label: 'Reports', to: '/staff/reports' },
    { label: 'Log out', action: 'logout' },
  ],
  admin: [
    { label: 'Dashboard', to: '/dashboard' },
    { label: 'Orders', to: '/staff/orders' },
    { label: 'Prescriptions', to: '/staff/prescriptions' },
    { label: 'Inventory', to: '/staff/inventory' },
    { label: 'Medicines and categories', to: '/admin/medicines' },
    { label: 'Delivery zones', to: '/staff/zones' },
    { label: 'Users and roles', to: '/admin/users' },
    { label: 'Analytics', to: '/admin/analytics' },
    { label: 'Reports', to: '/staff/reports' },
    { label: 'Audit log', to: '/admin/audit' },
    { label: 'Settings', to: '/admin/settings' },
    { label: 'Log out', action: 'logout' },
  ],
  rider: [
    { label: 'Deliveries', to: '/rider' },
    { label: 'Log out', action: 'logout' },
  ],
};

function escapeSegment(segment) {
  return segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patternToRegex(pattern) {
  if (pattern === '/') return /^\/$/;
  if (pattern.endsWith('/*')) {
    const base = escapeSegment(pattern.slice(0, -2));
    return new RegExp(`^${base}(?:/.*)?/?$`);
  }
  const source = pattern
    .split('/')
    .map((segment) => (segment.startsWith(':') ? '[^/]+' : escapeSegment(segment)))
    .join('/');
  return new RegExp(`^${source}/?$`);
}

const PUBLIC_MATCHERS = PUBLIC_PATHS.map(patternToRegex);
const ROLE_MATCHERS = Object.fromEntries(
  ROLES.map((role) => [role, ROLE_PATHS[role].map(patternToRegex)])
);

/** Returns a safe local pathname, or null for anything absolute, protocol-like or malformed. */
export function toPathname(value) {
  if (typeof value !== 'string') return null;
  const raw = value.trim();
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  if (raw.includes('\\') || /[\u0000-\u001f\u007f]/.test(raw)) return null;
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return null;
  const pathname = raw.split(/[?#]/)[0] || '/';
  if (pathname.length > 1) return pathname.replace(/\/+$/, '');
  return pathname;
}

/** Maps the canonical role URLs onto the routes the app actually renders. */
export function resolveRoute(value) {
  const pathname = toPathname(value);
  if (!pathname) return null;
  const alias = ROUTE_ALIASES.find(([pattern]) => pattern.test(pathname));
  return alias ? alias[1] : pathname;
}

export function getHomeRoute(role) {
  return HOME_ROUTES[role] || '/';
}

export function isKnownRoute(value) {
  const pathname = resolveRoute(value);
  if (!pathname) return false;
  return (
    PUBLIC_MATCHERS.some((matcher) => matcher.test(pathname)) ||
    ROLES.some((role) => ROLE_MATCHERS[role].some((matcher) => matcher.test(pathname)))
  );
}

export function isRouteAllowed(role, value) {
  const pathname = resolveRoute(value);
  if (!pathname) return false;
  if (PUBLIC_MATCHERS.some((matcher) => matcher.test(pathname))) return true;
  const matchers = ROLE_MATCHERS[role];
  if (!matchers) return false;
  return matchers.some((matcher) => matcher.test(pathname));
}

/**
 * Validates a `next` value for a signed-in role.
 * Returns a safe local path, or null when the caller should use the role home.
 */
export function sanitizeNext(next, role) {
  const pathname = resolveRoute(next);
  if (!pathname || !isKnownRoute(pathname) || !isRouteAllowed(role, pathname)) return null;
  const suffix = typeof next === 'string' ? (next.trim().match(/[?#].*$/)?.[0] ?? '') : '';
  return `${pathname}${suffix}`;
}
