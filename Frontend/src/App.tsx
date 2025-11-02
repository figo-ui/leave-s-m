import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/common/Layout';
import Login from './components/auth/Login';
import Dashboard from './components/Dashboard';
import ApplyLeave from './components/employee/ApplyLeave';
import LeaveHistory from './components/employee/LeaveHistory';
import ProfileSettings from './components/employee/ProfileSettings';
import PendingRequests from './components/manager/PendingRequests';
import UserManagement from './components/hr-admin/UserManagement';
import LeaveOverview from './components/hr-admin/LeaveOverview';
import LeaveTypes from './components/hr-admin/LeaveTypes';
import ApprovalsHistory from './components/manager/ApprovalsHistory';
import TeamOverview from './components/manager/TeamOverview';
import ManagerReports from './components/manager/ManagerReports';
import SystemConfig from './components/hr-admin/SystemConfig';
import HrReports from './components/hr-admin/HrReports';
import HRApprovals from './components/hr-admin/HRApprovals';
import Notifications from './components/common/Notifications';
import './App.css';

// Loading component
const LoadingScreen: React.FC = () => (
  <div className="loading-screen">
    <div className="loading-spinner"></div>
    <p>Loading...</p>
  </div>
);

// Public Route - redirect to dashboard if already logged in
const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

// Protected Route - redirect to login if not authenticated
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Main App Content with Routing
const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Router>
      <div className="App">
        <Routes>
          {/* Public Route - Login Page */}
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <Login />
              </PublicRoute>
            } 
          />
          
          {/* Protected Routes - All authenticated pages */}
          <Route 
            path="/*" 
            element={
              <ProtectedRoute>
                <Layout userRole={user?.role || 'employee'}>
                  <Routes>
                    {/* Common routes for all roles */}
                    <Route path="/" element={<Navigate to="/dashboard" replace />} />
                    <Route path="/dashboard" element={<Dashboard userRole={user?.role || 'employee'} />} />
                    <Route path="/profile" element={<ProfileSettings />} />

                    {/* Employee specific routes */}
                    {user?.role === 'employee' && (
                      <>
                        <Route path="/apply-leave" element={<ApplyLeave />} />
                        <Route path="/leave-history" element={<LeaveHistory />} />
                      </>
                    )}

                    {/* Manager specific routes */}
                    {user?.role === 'manager' && (
                      <>
                        <Route path="/pending-requests" element={<PendingRequests />} />
                        <Route path="/approvals-history" element={<ApprovalsHistory />} />
                        <Route path="/team-overview" element={<TeamOverview />} />
                        <Route path="/reports" element={<ManagerReports />} />
                      </>
                    )}

                    {/* HR Admin specific routes */}
                    {user?.role === 'hr-admin' && (
                      <>
                        <Route path="/hr-approvals" element={<HRApprovals />} />
                        <Route path="/leave-overview" element={<LeaveOverview />} />
                        <Route path="/user-management" element={<UserManagement />} />
                        <Route path="/leave-types" element={<LeaveTypes />} />
                        <Route path="/system-config" element={<SystemConfig />} />
                        <Route path="/reports" element={<HrReports />} />
                      </>
                    )}
                  
                    {/* Catch all - redirect to dashboard */}
                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            } 
          />
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