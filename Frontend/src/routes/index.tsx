import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';


// Layout
import Layout from '../components/common/Layout';

// Auth
import Login from '../components/auth/Login';

// Common
import Dashboard from '../components/Dashboard';
import AboutMe from '../components/employee/AboutMe';
import ProfileSettings from '../components/common/ProfileSettings';
import Notifications from '../components/common/Notifications';
import InfoPage from '../components/common/InfoPage';
import HelpSupport from '../components/common/HelpSupport';
import AboutSystem from '../components/common/AboutSystem';

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

// Info pages / placeholders
const ReportsRedirect: React.FC = () => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/dashboard" replace />;
  }

  if (user.role === 'manager') {
    return <Navigate to="/manager-reports" replace />;
  }

  if (user.role === 'hr-admin' || user.role === 'super-admin') {
    return <Navigate to="/hr-reports" replace />;
  }

  return <Navigate to="/dashboard" replace />;
};

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
                <Route path="/dashboard" element={<Dashboard  />} />
                <Route path="/about-me" element={<AboutMe />} />
                <Route path="/profile" element={<Navigate to="/about-me" replace />} />
                <Route path="/profile-settings" element={<ProfileSettings />} />
                <Route path="/notifications" element={<Notifications />} />
                <Route 
                  path="/help-support" 
                  element={
                    <HelpSupport />
                  }
                />
                <Route 
                  path="/about-system" 
                  element={
                    <AboutSystem />
                  }
                />
                <Route 
                  path="/calendar" 
                  element={
                    <InfoPage
                      titleKey="pages.calendar.title"
                      descriptionKey="pages.calendar.description"
                      hintKey="pages.calendar.hint"
                    />
                  }
                />
                <Route path="/reports" element={<ReportsRedirect />} />

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
                  path="/manager-reports" 
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
                    <RoleRoute allowedRoles={['hr-admin', 'super-admin']}>
                      <HRApprovals />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/leave-overview" 
                  element={
                    <RoleRoute allowedRoles={['hr-admin', 'super-admin']}>
                      <LeaveOverview />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/user-management" 
                  element={
                    <RoleRoute allowedRoles={['hr-admin', 'super-admin']}>
                      <UserManagement />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/leave-types" 
                  element={
                    <RoleRoute allowedRoles={['hr-admin', 'super-admin']}>
                      <LeaveTypes />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/system-config" 
                  element={
                    <RoleRoute allowedRoles={['hr-admin', 'super-admin']}>
                      <SystemConfig />
                    </RoleRoute>
                  } 
                />
                <Route 
                  path="/hr-reports" 
                  element={
                    <RoleRoute allowedRoles={['hr-admin', 'super-admin']}>
                      <HrReports />
                    </RoleRoute>
                  } 
                />

                {/* Super Admin specific routes */}
                <Route 
                  path="/admin" 
                  element={
                    <RoleRoute allowedRoles={['super-admin']}>
                      <InfoPage
                        titleKey="pages.admin.title"
                        descriptionKey="pages.admin.description"
                        hintKey="pages.admin.hint"
                      />
                    </RoleRoute>
                  }
                />
                <Route 
                  path="/audit-logs" 
                  element={
                    <RoleRoute allowedRoles={['super-admin']}>
                      <InfoPage
                        titleKey="pages.audit_logs.title"
                        descriptionKey="pages.audit_logs.description"
                        hintKey="pages.audit_logs.hint"
                      />
                    </RoleRoute>
                  }
                />
                <Route 
                  path="/backup" 
                  element={
                    <RoleRoute allowedRoles={['super-admin']}>
                      <InfoPage
                        titleKey="pages.backup_restore.title"
                        descriptionKey="pages.backup_restore.description"
                        hintKey="pages.backup_restore.hint"
                      />
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
