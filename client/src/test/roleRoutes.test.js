import { describe, expect, it } from 'vitest';
import {
  getHomeRoute,
  getNavGroups,
  isRouteAllowed,
  sanitizeNext,
  toPathname,
  resolveRoute,
} from '../config/roleRoutes.js';

describe('role home routes', () => {
  it('sends every role to its own area', () => {
    expect(getHomeRoute('customer')).toBe('/medicines');
    expect(getHomeRoute('pharmacist')).toBe('/dashboard');
    expect(getHomeRoute('admin')).toBe('/dashboard');
    expect(getHomeRoute('rider')).toBe('/rider');
  });

  it('falls back to the public home for an unknown role', () => {
    expect(getHomeRoute(undefined)).toBe('/');
    expect(getHomeRoute('guest')).toBe('/');
  });
});

describe('isRouteAllowed', () => {
  it('allows public pages to everyone', () => {
    for (const role of ['customer', 'pharmacist', 'admin', 'rider']) {
      expect(isRouteAllowed(role, '/')).toBe(true);
      expect(isRouteAllowed(role, '/medicines')).toBe(true);
      expect(isRouteAllowed(role, '/medicines/12')).toBe(true);
      expect(isRouteAllowed(role, '/cart')).toBe(true);
      expect(isRouteAllowed(role, '/checkout')).toBe(true);
      expect(isRouteAllowed(role, '/track')).toBe(true);
    }
  });

  it('allows customers their account and order pages only', () => {
    expect(isRouteAllowed('customer', '/account')).toBe(true);
    expect(isRouteAllowed('customer', '/account/orders')).toBe(true);
    expect(isRouteAllowed('customer', '/orders')).toBe(true);
    expect(isRouteAllowed('customer', '/orders/12')).toBe(true);
    expect(isRouteAllowed('customer', '/refills')).toBe(true);
    expect(isRouteAllowed('customer', '/dashboard')).toBe(false);
    expect(isRouteAllowed('customer', '/staff/orders')).toBe(false);
    expect(isRouteAllowed('customer', '/admin/users')).toBe(false);
    expect(isRouteAllowed('customer', '/rider')).toBe(false);
  });

  it('allows pharmacists their dashboard and staff pages', () => {
    expect(isRouteAllowed('pharmacist', '/dashboard')).toBe(true);
    expect(isRouteAllowed('pharmacist', '/staff/orders')).toBe(true);
    expect(isRouteAllowed('pharmacist', '/staff/inventory')).toBe(true);
    expect(isRouteAllowed('pharmacist', '/pharmacist/orders/5')).toBe(true);
    expect(isRouteAllowed('pharmacist', '/admin/users')).toBe(false);
    expect(isRouteAllowed('pharmacist', '/account')).toBe(false);
    expect(isRouteAllowed('pharmacist', '/rider')).toBe(false);
  });

  it('allows admins both admin and pharmacist pages', () => {
    expect(isRouteAllowed('admin', '/dashboard')).toBe(true);
    expect(isRouteAllowed('admin', '/staff/orders')).toBe(true);
    expect(isRouteAllowed('admin', '/admin/dashboard')).toBe(true);
    expect(isRouteAllowed('admin', '/admin/users')).toBe(true);
    expect(isRouteAllowed('admin', '/admin/settings')).toBe(true);
    expect(isRouteAllowed('admin', '/rider')).toBe(false);
    expect(isRouteAllowed('admin', '/account')).toBe(false);
  });

  it('allows riders only their delivery area', () => {
    expect(isRouteAllowed('rider', '/rider')).toBe(true);
    expect(isRouteAllowed('rider', '/rider/deliveries')).toBe(true);
    expect(isRouteAllowed('rider', '/dashboard')).toBe(false);
    expect(isRouteAllowed('rider', '/staff/orders')).toBe(false);
    expect(isRouteAllowed('rider', '/admin/users')).toBe(false);
  });
});

describe('resolveRoute aliases', () => {
  it('maps the canonical role URLs onto existing routes', () => {
    expect(resolveRoute('/pharmacist/dashboard')).toBe('/dashboard');
    expect(resolveRoute('/pharmacist/orders')).toBe('/staff/orders');
    expect(resolveRoute('/pharmacist/orders/5')).toBe('/staff/orders');
    expect(resolveRoute('/admin/dashboard')).toBe('/dashboard');
    expect(resolveRoute('/rider/deliveries')).toBe('/rider');
    expect(resolveRoute('/account')).toBe('/account');
  });
});

describe('toPathname', () => {
  it('keeps only safe local pathnames', () => {
    expect(toPathname('/account/orders?page=2#top')).toBe('/account/orders');
    expect(toPathname('/account/')).toBe('/account');
    expect(toPathname('/')).toBe('/');
    expect(toPathname('//evil.com')).toBeNull();
    expect(toPathname('https://evil.com')).toBeNull();
    expect(toPathname('/\\evil')).toBeNull();
    expect(toPathname('javascript:alert(1)')).toBeNull();
    expect(toPathname(undefined)).toBeNull();
  });
});

describe('sanitizeNext', () => {
  it('accepts a safe, existing, role-allowed path', () => {
    expect(sanitizeNext('/account/orders', 'customer')).toBe('/account/orders');
    expect(sanitizeNext('/checkout?step=payment', 'customer')).toBe('/checkout?step=payment');
    expect(sanitizeNext('/staff/orders', 'pharmacist')).toBe('/staff/orders');
    expect(sanitizeNext('/pharmacist/orders/5', 'pharmacist')).toBe('/staff/orders');
    expect(sanitizeNext('/admin/users', 'admin')).toBe('/admin/users');
    expect(sanitizeNext('/rider/deliveries', 'rider')).toBe('/rider');
  });

  it('rejects open redirects and protocol payloads', () => {
    for (const next of [
      '//evil.com',
      'https://evil.com',
      'http://evil.com',
      'javascript:alert(1)',
      '/\\evil.com',
      '/javascript:alert(1)',
      'https://evil.com/account',
    ]) {
      expect(sanitizeNext(next, 'customer')).toBeNull();
    }
  });

  it('rejects paths that do not exist in the router', () => {
    expect(sanitizeNext('/not-a-page', 'customer')).toBeNull();
    expect(sanitizeNext('/medicines/12/edit', 'customer')).toBeNull();
  });

  it('rejects pages that belong to another role', () => {
    expect(sanitizeNext('/admin/dashboard', 'customer')).toBeNull();
    expect(sanitizeNext('/admin/users', 'pharmacist')).toBeNull();
    expect(sanitizeNext('/staff/orders', 'rider')).toBeNull();
    expect(sanitizeNext('/account', 'admin')).toBeNull();
    expect(sanitizeNext('/rider', 'customer')).toBeNull();
  });

  it('returns null so callers can fall back to the role home', () => {
    expect(sanitizeNext(null, 'customer')).toBeNull();
    expect(sanitizeNext('', 'pharmacist')).toBeNull();
    expect(sanitizeNext('/admin/settings', 'rider')).toBeNull();
    expect(getHomeRoute('rider')).toBe('/rider');
  });
});

describe('role navigation', () => {
  it('builds grouped staff menus without action entries', () => {
    const groups = getNavGroups('pharmacist');
    expect(groups.map((group) => group.title)).toEqual(['Orders', 'Stock', 'Reports']);
    const links = groups.flatMap((group) => group.links);
    expect(links.map((link) => link.to)).toContain('/staff/orders');
    expect(links.map((link) => link.to)).not.toContain('/admin/users');
    expect(links.some((link) => link.action)).toBe(false);
  });

  it('gives an admin both staff and administration pages', () => {
    const targets = getNavGroups('admin').flatMap((group) => group.links.map((link) => link.to));
    expect(targets).toContain('/staff/inventory');
    expect(targets).toContain('/admin/users');
    expect(targets).toContain('/admin/settings');
  });

  it('renders the customer links as one unlabelled section', () => {
    const groups = getNavGroups('customer');
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBeNull();
    expect(groups[0].links.map((link) => link.to)).toEqual([
      '/',
      '/medicines',
      '/',
      '/track',
      '/cart',
      '/account',
    ]);
  });

  it('returns no menu for an unknown role', () => {
    expect(getNavGroups('guest')).toEqual([]);
  });
});
