import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/AuthContext';
import Navbar from './components/Navbar';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import History from './pages/History';
import Profile from './pages/Profile';
import AdminUsers from './pages/Admin/AdminUsers';
import AdminFiles from './pages/Admin/AdminFiles';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminLogs from './pages/Admin/AdminLogs';
import AdminSettings from './pages/Admin/AdminSettings';
import AdminLayout from './components/Admin/AdminLayout';
import SubjectDetail from './pages/SubjectDetail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import LoadingOverlay from './components/Common/LoadingOverlay';
import JobProgress from './components/Common/JobProgress';
import { useUIStore } from './store/useUIStore';
import { useMaterialStore } from './store/useMaterialStore';

const RouteLoadingState = () => (
  <div className="flex-1 flex items-center justify-center bg-white">
    <div className="text-sm font-semibold text-gray-500">Loading your workspace...</div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <RouteLoadingState />;
  if (!user) return <Navigate to="/login" />;

  return children;
};

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) return <RouteLoadingState />;
  if (!user) return <Navigate to="/login" />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" />;

  return children;
};

const AppContent = () => {
  const { loginWithToken } = useAuth();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      loginWithToken(token).then(() => {
        const url = new URL(window.location);
        url.searchParams.delete('token');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }).catch(err => {
        console.error('Landing token handling failed', err);
      });
    }
  }, [loginWithToken]);

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {!isAdminRoute && <Navbar />}
      <main className={`flex-1 min-h-0 flex flex-col ${isAdminRoute ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/subjects/:id" element={<ProtectedRoute><SubjectDetail /></ProtectedRoute>} />
          <Route path="/upload" element={<ProtectedRoute><Upload /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          
          <Route path="/admin" element={<AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><AdminLayout><AdminUsers /></AdminLayout></AdminRoute>} />
          <Route path="/admin/files" element={<AdminRoute><AdminLayout><AdminFiles /></AdminLayout></AdminRoute>} />
          <Route path="/admin/logs" element={<AdminRoute><AdminLayout><AdminLogs /></AdminLayout></AdminRoute>} />
          <Route path="/admin/settings" element={<AdminRoute><AdminLayout><AdminSettings /></AdminLayout></AdminRoute>} />
          
          <Route path="/" element={<Navigate to="/dashboard" />} />
        </Routes>
      </main>
    </div>
  );
};

const App = () => {
  const loadingStates = useUIStore(state => state.loadingStates);
  const jobProgress = useMaterialStore(state => state.jobProgress);
  
  // Only block UI for critical auth operations
  const isBlocking = loadingStates['login'] || loadingStates['register'];

  return (
    <AuthProvider>
      <Toaster position="top-right" />
      <LoadingOverlay visible={isBlocking} message="Please wait..." />
      <JobProgress job={jobProgress} />
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
};

export default App;
