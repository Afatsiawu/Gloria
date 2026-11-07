import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import { useAuth, roleHome } from './context/AuthContext.jsx';
import { Skeleton } from './components/UI.jsx';

const LandingPage = lazy(() => import('./pages/LandingPage.jsx'));
const SearchPage = lazy(() => import('./pages/SearchPage.jsx'));
const MedicineDetailPage = lazy(() => import('./pages/MedicineDetailPage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));
const CartPage = lazy(() => import('./pages/CartPage.jsx'));
const CheckoutPage = lazy(() => import('./pages/CheckoutPage.jsx'));
const OrdersPage = lazy(() => import('./pages/OrdersPage.jsx'));
const OrderTrackingPage = lazy(() => import('./pages/OrderTrackingPage.jsx'));
const ProfilePage = lazy(() => import('./pages/ProfilePage.jsx'));
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
const MedicinesPage = lazy(() => import('./pages/admin/MedicinesPage.jsx'));
const AnalyticsPage = lazy(() => import('./pages/admin/AnalyticsPage.jsx'));
const AuditPage = lazy(() => import('./pages/admin/AuditPage.jsx'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage.jsx'));
const OutboxPage = lazy(() => import('./pages/admin/OutboxPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to={roleHome(user.role)} replace /> : <LandingPage />;
}

function Fallback() {
  return (
    <div className="card">
      <div className="card-body">
        <Skeleton lines={5} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div className="container page"><Fallback /></div>}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomeRedirect />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="medicines/:id" element={<MedicineDetailPage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="register" element={<RegisterPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
          <Route path="reset-password" element={<ResetPasswordPage />} />

          <Route element={<ProtectedRoute roles={['customer']} />}>
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<CheckoutPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="account" element={<ProfilePage />} />
            <Route path="refills" element={<RefillsPage />} />
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="orders/:id" element={<OrderTrackingPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['pharmacist', 'admin']} />}>
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

          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="admin/users" element={<UsersPage />} />
            <Route path="admin/medicines" element={<MedicinesPage />} />
            <Route path="admin/analytics" element={<AnalyticsPage />} />
            <Route path="admin/audit" element={<AuditPage />} />
            <Route path="admin/settings" element={<SettingsPage />} />
            <Route path="admin/outbox" element={<OutboxPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['rider']} />}>
            <Route path="rider" element={<RiderPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
