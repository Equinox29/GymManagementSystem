import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Members from './components/Members';
import Payments from './components/Payments';
import Attendance from './components/Attendance';
import Inventory from './components/Inventory';
import InventorySales from './components/InventorySales';
import Equipment from './components/Equipment';
import MemberPortal from './components/MemberPortal';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen bg-[#050505]"><div className="animate-spin w-6 h-6 border-2 border-zinc-500 border-t-zinc-100 rounded-full" aria-label="Loading" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={user.role === 'member' ? '/portal' : '/'} replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/portal" element={<ProtectedRoute roles={['member']}><MemberPortal /></ProtectedRoute>} />
      <Route path="/" element={<ProtectedRoute roles={['admin', 'staff']}><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="members" element={<Members />} />
        <Route path="payments" element={<Payments />} />
        <Route path="attendance" element={<Attendance />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="inventory/sales" element={<InventorySales />} />
        <Route path="equipment" element={<Equipment />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
