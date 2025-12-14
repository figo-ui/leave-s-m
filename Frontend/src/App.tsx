import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/common/Layout';
import Login from './components/auth/Login';
import Dashboard from './components/Dashboard';
import ApplyLeave from './components/employee/ApplyLeave';
import LeaveHistory from './components/employee/LeaveHistory';
import AboutMe from './components/employee/AboutMe';
import PendingRequests from './components/manager/PendingRequests';
import UserManagement from './components/hr-admin/UserManagement';
import LeaveOverview from './components/hr-admin/LeaveOverview';
import LeaveTypes from './components/hr-admin/LeaveTypes';
import SystemConfig from './components/hr-admin/SystemConfig';
import HrReports from './components/hr-admin/HrReports';
import HRApprovals from './components/hr-admin/HRApprovals';
import './App.css';

// Loading Component
const LoadingScreen: React.FC = () => (
  <div className="loading-screen">
    <div className="loading-content">
      <div className="loading-logo">OBU LMS</div>
      <div className="loading-spinner"></div>
      <p>Loading system...</p>
    </div>
  </div>
);

// Public Route
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

// Protected Route
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Role-based Route
const RoleRoute: React.FC<{ 
  children: React.ReactNode; 
  allowedRoles: string[];
}> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};

// Main App Content
const AppContent: React.FC = () => {
  const { user } = useAuth();

  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/login" element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          } />
          
          <Route path="/*" element={
            <ProtectedRoute>
              <Layout userRole={user?.role || 'employee'}>
                <Routes>
                  {/* Common routes */}
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/profile" element={<AboutMe />} />
                  
                  {/* Employee routes */}
                  <Route path="/apply-leave" element={
                    <RoleRoute allowedRoles={['employee']}>
                      <ApplyLeave />
                    </RoleRoute>
                  } />
                  <Route path="/leave-history" element={
                    <RoleRoute allowedRoles={['employee']}>
                      <LeaveHistory />
                    </RoleRoute>
                  } />
                  
                  {/* Manager routes */}
                  <Route path="/pending-requests" element={
                    <RoleRoute allowedRoles={['manager']}>
                      <PendingRequests />
                    </RoleRoute>
                  } />
                  
                  {/* HR Admin routes */}
                  <Route path="/hr-approvals" element={
                    <RoleRoute allowedRoles={['hr-admin']}>
                      <HRApprovals />
                    </RoleRoute>
                  } />
                  <Route path="/user-management" element={
                    <RoleRoute allowedRoles={['hr-admin']}>
                      <UserManagement />
                    </RoleRoute>
                  } />
                  <Route path="/leave-overview" element={
                    <RoleRoute allowedRoles={['hr-admin']}>
                      <LeaveOverview />
                    </RoleRoute>
                  } />
                  <Route path="/leave-types" element={
                    <RoleRoute allowedRoles={['hr-admin']}>
                      <LeaveTypes />
                    </RoleRoute>
                  } />
                  <Route path="/system-config" element={
                    <RoleRoute allowedRoles={['hr-admin']}>
                      <SystemConfig />
                    </RoleRoute>
                  } />
                  <Route path="/hr-reports" element={
                    <RoleRoute allowedRoles={['hr-admin']}>
                      <HrReports />
                    </RoleRoute>
                  } />
                  
                  {/* Catch all */}
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          } />
        </Routes>
      </div>
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;