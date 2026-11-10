import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import AccessWatcher from './components/AccessWatcher.jsx';
import { RequireAuth, RequireRole } from './components/guards.jsx';
import { Loading } from './components/UI.jsx';
import { useAuth, roleHome } from './context/AuthContext.jsx';

const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const MedicinesPage = lazy(() => import('./pages/MedicinesPage.jsx'));
const MedicineDetailPage = lazy(() => import('./pages/MedicineDetailPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));
const CartPage = lazy(() => import('./pages/CartPage.jsx'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage.jsx'));
const OrdersPage = lazy(() => import('./pages/OrdersPage.jsx'));
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage.jsx'));
const TrackPage = lazy(() => import('./pages/TrackPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage.jsx'));
const RefillsPage = lazy(() => import('./pages/RefillsPage.jsx'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage.jsx'));
const DashboardPage = lazy(() => import('./pages/staff/DashboardPage.jsx'));
const PrescriptionQueuePage = lazy(() => import('./pages/staff/PrescriptionQueuePage.jsx'));
const OrderQueuePage = lazy(() => import('./pages/staff/OrderQueuePage.jsx'));
const InventoryPage = lazy(() => import('./pages/staff/InventoryPage.jsx'));
const PurchaseOrdersPage = lazy(() => import('./pages/staff/PurchaseOrdersPage.jsx'));
const SuppliersPage = lazy(() => import('./pages/staff/SuppliersPage.jsx'));
const WalkInPage = lazy(() => import('./pages/staff/WalkInPage.jsx'));
const AlertsPage = lazy(() => import('./pages/staff/AlertsPage.jsx'));
const DeliveriesPage = lazy(() => import('./pages/staff/DeliveriesPage.jsx'));
const ZonesPage = lazy(() => import('./pages/staff/ZonesPage.jsx'));
const StaffReportsPage = lazy(() => import('./pages/staff/ReportsPage.jsx'));
const RiderPage = lazy(() => import('./pages/RiderPage.jsx'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage.jsx'));
const AdminMedicinesPage = lazy(() => import('./pages/admin/MedicinesPage.jsx'));
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage.jsx'));
const AuditPage = lazy(() => import('./pages/admin/AuditPage.jsx'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage.jsx'));
const OutboxPage = lazy(() => import('./pages/admin/OutboxPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));
const StyleGuidePage = import.meta.env.DEV ? lazy(() => import('./pages/StyleGuidePage.jsx')) : null;

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user && user.role !== 'customer') return <Navigate to={roleHome(user.role)} replace />;
  return <HomePage />;
}

function SearchRedirect() {
  const location = useLocation();
  return <Navigate to={`/medicines${location.search}`} replace />;
}

function OrderRoute() {
  const { reference } = useParams();
  const { user, loading } = useAuth();
  const isAccountOrder = /^\d+$/.test(reference || '');
  if (!isAccountOrder) return <TrackPage />;
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: `/orders/${reference}` }} />;
  return <OrderTrackingPage />;
}

function Fallback() {
  return <Loading text="Loading this page" />;
}

export default function App() {
  return (
    <Suspense fallback={<div className="wrap"><Fallback /></div>}>
      <AccessWatcher>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomeRedirect />} />
            <Route path="search" element={<SearchRedirect />} />
            <Route path="medicines" element={<MedicinesPage />} />
            <Route path="medicines/:id" element={<MedicineDetailPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route path="forgot-password" element={<ForgotPasswordPage />} />
            <Route path="reset-password" element={<ResetPasswordPage />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="track" element={<TrackPage />} />
            <Route path="orders/:reference" element={<OrderRoute />} />

            <Route element={<RequireRole roles={['customer']} />}>
              <Route path="orders" element={<OrdersPage />} />
              <Route path="account" element={<ProfilePage />} />
              <Route path="refills" element={<RefillsPage />} />
            </Route>

            <Route element={<RequireAuth />}>
              <Route path="account/change-password" element={<ChangePasswordPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
            </Route>

            <Route element={<RequireRole roles={['pharmacist', 'admin']} />}>
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="staff/orders" element={<OrderQueuePage />} />
              <Route path="staff/prescriptions" element={<PrescriptionQueuePage />} />
              <Route path="staff/inventory" element={<InventoryPage />} />
              <Route path="staff/purchase-orders" element={<PurchaseOrdersPage />} />
              <Route path="staff/suppliers" element={<SuppliersPage />} />
              <Route path="staff/walk-in" element={<WalkInPage />} />
              <Route path="staff/alerts" element={<AlertsPage />} />
              <Route path="staff/deliveries" element={<DeliveriesPage />} />
              <Route path="staff/zones" element={<ZonesPage />} />
              <Route path="staff/reports" element={<StaffReportsPage />} />
            </Route>

            <Route element={<RequireRole roles={['admin']} />}>
              <Route path="admin/users" element={<UsersPage />} />
              <Route path="admin/medicines" element={<AdminMedicinesPage />} />
              <Route path="admin/analytics" element={<AnalyticsPage />} />
              <Route path="admin/audit" element={<AuditPage />} />
              <Route path="admin/settings" element={<SettingsPage />} />
              <Route path="admin/outbox" element={<OutboxPage />} />
            </Route>

            <Route element={<RequireRole roles={['rider']} />}>
              <Route path="rider" element={<RiderPage />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
            {StyleGuidePage && <Route path="styleguide" element={<StyleGuidePage />} />}
          </Route>
        </Routes>
      </AccessWatcher>
    </Suspense>
  );
}
