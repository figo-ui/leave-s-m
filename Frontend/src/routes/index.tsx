import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Layout
import Layout from '../components/common/Layout';

// Auth
import Login from '../components/auth/Login';

// Common
import Dashboard from '../components/Dashboard';
import ProfileSettings from '../components/employee/AboutMe';

// Employee
import ApplyLeave from '../components/employee/ApplyLeave';
import LeaveHistory from '../components/employee/LeaveHistory';

// Manager
import PendingRequests from '../components/manager/PendingRequests';
import ApprovalsHistory from '../components/manager/ApprovalsHistory';
import TeamOverview from '../components/manager/TeamOverview';
import ManagerReports from '../components/manager/ManagerReports';

// HR Admin
import HRApprovals from '../components/hr-admin/HRApprovals';
import LeaveOverview from '../components/hr-admin/LeaveOverview';
import UserManagement from '../components/hr-admin/UserManagement';
import LeaveTypes from '../components/hr-admin/LeaveTypes';
import SystemConfig from '../components/hr-admin/SystemConfig';
import HrReports from '../components/hr-admin/HrReports';

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

// Role-based Route - only allow access for specific roles
const RoleRoute: React.FC<{ 
  children: React.ReactNode; 
  allowedRoles: string[];
}> = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  if (!user || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { user } = useAuth();

  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        } 
      />

      {/* Protected Routes with Layout */}
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
                <Route 
                  path="/apply-leave" 
                  element={
                    <RoleRoute allowedRoles={['employee']}>
                      <ApplyLeave />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/leave-history" 
                  element={
                    <RoleRoute allowedRoles={['employee']}>
                      <LeaveHistory />
                    </RoleRoute>
                  } 
                />

                {/* Manager specific routes */}
                <Route 
                  path="/pending-requests" 
                  element={
                    <RoleRoute allowedRoles={['manager']}>
                      <PendingRequests />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/approvals-history" 
                  element={
                    <RoleRoute allowedRoles={['manager']}>
                      <ApprovalsHistory />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/team-overview" 
                  element={
                    <RoleRoute allowedRoles={['manager']}>
                      <TeamOverview />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/reports" 
                  element={
                    <RoleRoute allowedRoles={['manager']}>
                      <ManagerReports />
                    </RoleRoute>
                  } 
                />

                {/* HR Admin specific routes */}
                <Route 
                  path="/hr-approvals" 
                  element={
                    <RoleRoute allowedRoles={['hr-admin']}>
                      <HRApprovals />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/leave-overview" 
                  element={
                    <RoleRoute allowedRoles={['hr-admin']}>
                      <LeaveOverview />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/user-management" 
                  element={
                    <RoleRoute allowedRoles={['hr-admin']}>
                      <UserManagement />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/leave-types" 
                  element={
                    <RoleRoute allowedRoles={['hr-admin']}>
                      <LeaveTypes />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/system-config" 
                  element={
                    <RoleRoute allowedRoles={['hr-admin']}>
                      <SystemConfig />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/reports" 
                  element={
                    <RoleRoute allowedRoles={['hr-admin']}>
                      <HrReports />
                    </RoleRoute>
                  } 
                />

                {/* Catch all - redirect to dashboard */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </Layout>
          </ProtectedRoute>
        } 
      />
    </Routes>
  );
};

export default AppRoutes;