import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/common/Layout';
import { Spinner } from './components/common/UI';

// Auth pages
import LoginPage from './pages/auth/Login';
import SignupPage from './pages/auth/Signup';

// Admin pages
import AdminDashboard from './pages/admin/Dashboard';
import AdminIndustries from './pages/admin/Industries';
import AdminReports from './pages/admin/Reports';
import AdminAlerts from './pages/admin/Alerts';
import AdminRegions from './pages/admin/Regions';
import AdminUsers from './pages/admin/Users';

// Officer pages
import OfficerDashboard from './pages/officer/Dashboard';
import OfficerMap from './pages/officer/MapPage';
import OfficerIndustries from './pages/officer/Industries';
import OfficerReports from './pages/officer/Reports';
import OfficerAlerts from './pages/officer/Alerts';
import OfficerComplaints from './pages/officer/Complaints';
import OfficerIndustryApprovals from './pages/officer/IndustryApprovals';

// Industry pages
import IndustryDashboard from './pages/industry/Dashboard';
import IndustryReports from './pages/industry/Reports';
import IndustryCompliance from './pages/industry/Compliance';
import IndustryAlerts from './pages/industry/Alerts';
import IndustryWarnings from './pages/industry/Warnings';

// Citizen pages
import CitizenDashboard from './pages/citizen/Dashboard';
import CitizenMap from './pages/citizen/MapPage';
import CitizenIndustries from './pages/citizen/Industries';
import CitizenForecast from './pages/citizen/Forecast';
import CitizenComplaint from './pages/citizen/Complaint';

// ── Protected Route ────────────────────────────────────
const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Loading PrithviNet...</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;

  return <AppShell>{children}</AppShell>;
};

// ── Public Route (redirect if logged in) ──────────────
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    const dest = {
      super_admin: '/admin', regional_officer: '/officer',
      industry: '/industry', citizen: '/citizen',
    }[user.role] || '/';
    return <Navigate to={dest} replace />;
  }
  return children;
};

// ── Unauthorized page ──────────────────────────────────
const Unauthorized = () => (
  <div className="h-screen flex flex-col items-center justify-center gap-4"
    style={{ background: 'var(--bg-primary)' }}>
    <div className="text-5xl">🚫</div>
    <h2 style={{ fontFamily: 'Syne', fontWeight: 700, color: 'var(--text-primary)' }}>Access Denied</h2>
    <p style={{ color: 'var(--text-secondary)' }}>You don't have permission to view this page.</p>
    <a href="/login" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 8 }}>
      Return to Login
    </a>
  </div>
);

// ── App ────────────────────────────────────────────────
function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><SignupPage /></PublicRoute>} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Super Admin */}
      <Route path="/admin" element={<ProtectedRoute roles={['super_admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/regions" element={<ProtectedRoute roles={['super_admin']}><AdminRegions /></ProtectedRoute>} />
      <Route path="/admin/industries" element={<ProtectedRoute roles={['super_admin']}><AdminIndustries /></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute roles={['super_admin']}><AdminReports /></ProtectedRoute>} />
      <Route path="/admin/alerts" element={<ProtectedRoute roles={['super_admin']}><AdminAlerts /></ProtectedRoute>} />
      <Route path="/admin/simulation" element={<Navigate to="/admin" replace />} />
      <Route path="/admin/users" element={<ProtectedRoute roles={['super_admin']}><AdminUsers /></ProtectedRoute>} />

      {/* Regional Officer */}
      <Route path="/officer" element={<ProtectedRoute roles={['regional_officer']}><OfficerDashboard /></ProtectedRoute>} />
      <Route path="/officer/map" element={<ProtectedRoute roles={['regional_officer']}><OfficerMap /></ProtectedRoute>} />
      <Route path="/officer/industries" element={<ProtectedRoute roles={['regional_officer']}><OfficerIndustries /></ProtectedRoute>} />
      <Route path="/officer/industry-approvals" element={<ProtectedRoute roles={['regional_officer']}><OfficerIndustryApprovals /></ProtectedRoute>} />
      <Route path="/officer/reports" element={<ProtectedRoute roles={['regional_officer']}><OfficerReports /></ProtectedRoute>} />
      <Route path="/officer/alerts" element={<ProtectedRoute roles={['regional_officer']}><OfficerAlerts /></ProtectedRoute>} />
      <Route path="/officer/simulation" element={<Navigate to="/officer" replace />} />
      <Route path="/officer/complaints" element={<ProtectedRoute roles={['regional_officer']}><OfficerComplaints /></ProtectedRoute>} />

      {/* Industry */}
      <Route path="/industry" element={<ProtectedRoute roles={['industry']}><IndustryDashboard /></ProtectedRoute>} />
      <Route path="/industry/submit-report" element={<ProtectedRoute roles={['industry']}><IndustryDashboard /></ProtectedRoute>} />
      <Route path="/industry/reports" element={<ProtectedRoute roles={['industry']}><IndustryReports /></ProtectedRoute>} />
      <Route path="/industry/warnings" element={<ProtectedRoute roles={['industry']}><IndustryWarnings /></ProtectedRoute>} />
      <Route path="/industry/compliance" element={<ProtectedRoute roles={['industry']}><IndustryCompliance /></ProtectedRoute>} />
      <Route path="/industry/alerts" element={<ProtectedRoute roles={['industry']}><IndustryAlerts /></ProtectedRoute>} />

      {/* Citizen */}
      <Route path="/citizen" element={<ProtectedRoute roles={['citizen']}><CitizenDashboard /></ProtectedRoute>} />
      <Route path="/citizen/map" element={<ProtectedRoute roles={['citizen']}><CitizenMap /></ProtectedRoute>} />
      <Route path="/citizen/industries" element={<ProtectedRoute roles={['citizen']}><CitizenIndustries /></ProtectedRoute>} />
      <Route path="/citizen/forecast" element={<ProtectedRoute roles={['citizen']}><CitizenForecast /></ProtectedRoute>} />
      <Route path="/citizen/complaint" element={<ProtectedRoute roles={['citizen']}><CitizenComplaint /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
