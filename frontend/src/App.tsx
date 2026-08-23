import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RequestForm from './pages/RequestForm';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import DriverDashboard from './pages/DriverDashboard';
import LoginSuccess from './pages/LoginSuccess';
import CustomerDashboard from './pages/CustomerDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import ReceiptPage from './pages/ReceiptPage';
import BoardPage from './pages/BoardPage';
import Landing from './pages/Landing';

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import GlobalNoticeBanner from './components/GlobalNoticeBanner';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans selection:bg-primary-100">
        <GlobalNoticeBanner />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/staff-login" element={<Login />} />
          <Route path="/login" element={<Navigate to="/staff-login" replace />} />
          <Route path="/request" element={<RequestForm />} />
          <Route path="/receipt/:id" element={<ReceiptPage />} />
          <Route path="/board/:partnerId" element={<BoardPage />} />
          <Route path="/login-success" element={<LoginSuccess />} />
          <Route path="/status" element={<ProtectedRoute allowedRoles={['CUSTOMER']}><CustomerDashboard /></ProtectedRoute>} />
          <Route path="/super-admin" element={<ProtectedRoute allowedRoles={['SUPER_ADMIN']} redirectTo="/staff-login"><SuperAdminDashboard /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute allowedRoles={['PARTNER']} redirectTo="/staff-login"><AdminDashboard /></ProtectedRoute>} />
          <Route path="/driver" element={<ProtectedRoute allowedRoles={['DRIVER', 'PARTNER']} redirectTo="/staff-login"><DriverDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
