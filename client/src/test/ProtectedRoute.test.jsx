import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
  roleHome: (role) => (role === 'rider' ? '/rider' : '/dashboard'),
}));

const mockUseAuth = vi.mocked(useAuth);

const authValue = (user, loading = false) => ({
  user,
  loading,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  setUser: vi.fn(),
});

const renderProtected = (user, roles, entry = '/dashboard') =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/login" element={<div>Login page</div>} />
        <Route element={<ProtectedRoute roles={roles} />}>
          <Route path="/dashboard" element={<div>Dashboard page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

describe('ProtectedRoute', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(authValue(null));
  });

  it('shows a loading state while the session is being restored', () => {
    mockUseAuth.mockReturnValue(authValue(null, true));
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Dashboard page</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );
    expect(screen.getByText('Checking your session')).toBeInTheDocument();
  });

  it('redirects unauthenticated visitors to the login page', () => {
    renderProtected(null, ['customer']);
    expect(screen.getByText('Login page')).toBeInTheDocument();
  });

  it('renders the protected page for an authorised user', () => {
    mockUseAuth.mockReturnValue(authValue({ id: 1, role: 'pharmacist' }));
    renderProtected({ id: 1, role: 'pharmacist' }, ['pharmacist']);
    expect(screen.getByText('Dashboard page')).toBeInTheDocument();
  });

  it('redirects users whose role is not allowed', () => {
    mockUseAuth.mockReturnValue(authValue({ id: 2, role: 'customer' }));
    renderProtected({ id: 2, role: 'customer' }, ['pharmacist']);
    expect(screen.queryByText('Dashboard page')).not.toBeInTheDocument();
  });
});
