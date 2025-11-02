import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../utils/api';
import './Dashboard.css';

interface DashboardProps {
  userRole: string;
}

interface LeaveApplication {
  id: number;
  employeeName: string;
  employeeId: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected' | 'hr_pending' | 'hr_approved' | 'hr_rejected';
  reason: string;
  appliedDate: string;
}

interface DashboardStats {
  pendingRequests?: number;
  leavesTaken?: number;
  leaveBalance?: any[];
  teamOnLeave?: number;
  teamSize?: number;
  totalEmployees?: number;
  onLeaveToday?: number;
  availableLeaves?: number;
  approvalRate?: number;
  recentActivity?: any[];
  systemAlerts?: number;
  pendingApprovals?: number;
}

const Dashboard: React.FC<DashboardProps> = ({ userRole }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<DashboardStats>({});
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboardData();
  }, [userRole, user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load dashboard stats from backend
      const statsResponse = await apiService.get<{ success: boolean; data: DashboardStats }>('/dashboard/stats');
      if (statsResponse.success) {
        setDashboardData(statsResponse.data);
      }

      // Load recent activities based on role
      await loadRecentActivities();

    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivities = async () => {
    try {
      switch (userRole) {
        case 'employee':
          const leaveHistory = await apiService.get<{ success: boolean; data: any[] }>('/leaves/history?limit=4');
          if (leaveHistory.success) {
            setRecentActivities(leaveHistory.data);
          }
          break;

        case 'manager':
          const pendingLeaves = await apiService.get<{ success: boolean; data: any[] }>('/leaves/pending');
          if (pendingLeaves.success) {
            setRecentActivities(pendingLeaves.data.slice(0, 4));
          }
          break;

        case 'hr-admin':
          // For HR, get all recent leaves
          const allLeaves = await apiService.get<{ success: boolean; data: any[] }>('/leaves/history?limit=6');
          if (allLeaves.success) {
            setRecentActivities(allLeaves.data);
          }
          break;
      }
    } catch (error) {
      console.error('Error loading recent activities:', error);
    }
  };

  // Role-based quick actions
  const getQuickActions = () => {
    switch (userRole) {
      case 'manager':
        return [
          { label: 'Approve Requests', icon: '✅', path: '/pending-requests', color: '#27ae60' },
          { label: 'View Team', icon: '👥', path: '/team-overview', color: '#3498db' },
          { label: 'Generate Reports', icon: '📊', path: '/reports', color: '#9b59b6' },
          { label: 'Approvals History', icon: '📝', path: '/approvals-history', color: '#f39c12' }
        ];
      case 'hr-admin':
        return [
          { label: 'Leave Overview', icon: '👁️', path: '/leave-overview', color: '#27ae60' },
          { label: 'HR Approvals', icon: '✅', path: '/hr-approvals', color: '#e74c3c' },
          { label: 'User Management', icon: '👥', path: '/user-management', color: '#3498db' },
          { label: 'Analytics', icon: '📊', path: '/reports', color: '#9b59b6' }
        ];
      default: // employee
        return [
          { label: 'Apply for Leave', icon: '📝', path: '/apply-leave', color: '#27ae60' },
          { label: 'Leave History', icon: '📋', path: '/leave-history', color: '#3498db' },
          { label: 'Leave Balance', icon: '💰', path: '/leave-history', color: '#f39c12' },
          { label: 'Profile Settings', icon: '👤', path: '/profile', color: '#9b59b6' }
        ];
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const getRoleSpecificContent = () => {
    switch (userRole) {
      case 'manager':
        return {
          title: 'Manager Dashboard',
          subtitle: 'Team management and leave approvals',
          primaryAction: '/pending-requests',
          primaryActionText: 'Review Pending Requests'
        };
      case 'hr-admin':
        return {
          title: 'HR Admin Dashboard',
          subtitle: 'System administration and analytics',
          primaryAction: '/leave-overview',
          primaryActionText: 'View Leave Overview'
        };
      default:
        return {
          title: 'Employee Dashboard',
          subtitle: 'Your leave management portal',
          primaryAction: '/apply-leave',
          primaryActionText: 'Apply for Leave'
        };
    }
  };

  const handleQuickAction = (path: string) => {
    navigate(path);
  };

  const handlePrimaryAction = () => {
    navigate(roleContent.primaryAction);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { class: string; label: string } } = {
      PENDING_MANAGER: { class: 'pending', label: 'Manager Review' },
      PENDING_HR: { class: 'pending', label: 'HR Review' },
      APPROVED: { class: 'approved', label: 'Approved' },
      REJECTED: { class: 'rejected', label: 'Rejected' },
      CANCELLED: { class: 'rejected', label: 'Cancelled' }
    };
    
    const config = statusConfig[status] || { class: 'pending', label: status };
    return <span className={`activity-status ${config.class}`}>{config.label}</span>;
  };

  // Render statistics based on user role
  const renderEmployeeStats = () => (
    <>
      <div className="stat-card">
        <div className="stat-icon balance">📅</div>
        <div className="stat-content">
          <div className="stat-number">{dashboardData.availableLeaves || 0}</div>
          <div className="stat-label">Available Leaves</div>
          <div className="stat-trend">Ready to use</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon approved">✅</div>
        <div className="stat-content">
          <div className="stat-number">{dashboardData.leavesTaken || 0}</div>
          <div className="stat-label">Leaves Taken</div>
          <div className="stat-trend">This year</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon pending">⏳</div>
        <div className="stat-content">
          <div className="stat-number">{dashboardData.pendingRequests || 0}</div>
          <div className="stat-label">Pending Requests</div>
          <div className="stat-trend">Awaiting approval</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon history">📊</div>
        <div className="stat-content">
          <div className="stat-number">{dashboardData.leavesTaken || 0}</div>
          <div className="stat-label">Total This Year</div>
          <div className="stat-trend">All leave types</div>
        </div>
      </div>
    </>
  );

  const renderManagerStats = () => (
    <>
      <div className="stat-card">
        <div className="stat-icon pending">⏳</div>
        <div className="stat-content">
          <div className="stat-number">{dashboardData.pendingRequests || 0}</div>
          <div className="stat-label">Pending Requests</div>
          <div className="stat-trend">Require your attention</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon team">👥</div>
        <div className="stat-content">
          <div className="stat-number">{dashboardData.teamSize || 0}</div>
          <div className="stat-label">Team Members</div>
          <div className="stat-trend">{dashboardData.teamOnLeave || 0} on leave</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon approved">✅</div>
        <div className="stat-content">
          <div className="stat-number">{dashboardData.approvalRate || 0}%</div>
          <div className="stat-label">Approval Rate</div>
          <div className="stat-trend positive">Team performance</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon productivity">📈</div>
        <div className="stat-content">
          <div className="stat-number">
            {dashboardData.teamSize ? 
              Math.round(((dashboardData.teamSize - (dashboardData.teamOnLeave || 0)) / dashboardData.teamSize) * 100) : 100}%
          </div>
          <div className="stat-label">Team Availability</div>
          <div className="stat-trend">Present today</div>
        </div>
      </div>
    </>
  );

  const renderHRAdminStats = () => (
    <>
      <div className="stat-card">
        <div className="stat-icon users">👥</div>
        <div className="stat-content">
          <div className="stat-number">{dashboardData.totalEmployees || 0}</div>
          <div className="stat-label">Total Employees</div>
          <div className="stat-trend">Across organization</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon active">📋</div>
        <div className="stat-content">
          <div className="stat-number">{dashboardData.onLeaveToday || 0}</div>
          <div className="stat-label">On Leave Today</div>
          <div className="stat-trend">Currently out</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon alerts">⚠️</div>
        <div className="stat-content">
          <div className="stat-number">{dashboardData.pendingApprovals || 0}</div>
          <div className="stat-label">Pending Approvals</div>
          <div className="stat-trend">Require attention</div>
        </div>
      </div>
      <div className="stat-card">
        <div className="stat-icon analytics">📊</div>
        <div className="stat-content">
          <div className="stat-number">{dashboardData.systemAlerts || 0}</div>
          <div className="stat-label">System Alerts</div>
          <div className="stat-trend">Active notifications</div>
        </div>
      </div>
    </>
  );

  const renderStats = () => {
    if (loading) {
      return (
        <>
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="stat-card loading">
              <div className="stat-icon">⏳</div>
              <div className="stat-content">
                <div className="stat-number">--</div>
                <div className="stat-label">Loading...</div>
                <div className="stat-trend">Please wait</div>
              </div>
            </div>
          ))}
        </>
      );
    }

    switch (userRole) {
      case 'manager':
        return renderManagerStats();
      case 'hr-admin':
        return renderHRAdminStats();
      default:
        return renderEmployeeStats();
    }
  };

  // Render recent activities based on role
  const renderEmployeeActivities = () => (
    <div className="content-section activities-section">
      <div className="section-header">
        <h2 className="section-title">My Recent Leaves</h2>
        <button className="view-all-btn" onClick={() => navigate('/leave-history')}>
          View All
        </button>
      </div>
      <div className="activities-list">
        {loading ? (
          <div className="loading-text">Loading activities...</div>
        ) : recentActivities.length > 0 ? (
          recentActivities.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-icon">
                {activity.status === 'APPROVED' ? '✅' : 
                 activity.status === 'REJECTED' ? '❌' : '⏳'}
              </div>
              <div className="activity-details">
                <div className="activity-main">
                  <span className="activity-type">{activity.leaveType?.name || 'Leave'}</span>
                  <span className="activity-days">{activity.days} days</span>
                </div>
                <div className="activity-meta">
                  <span className="activity-date">
                    {formatDate(activity.appliedDate)}
                  </span>
                  {getStatusBadge(activity.status)}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-data">No leave applications yet</div>
        )}
      </div>
    </div>
  );

  const renderManagerActivities = () => (
    <div className="content-section activities-section">
      <div className="section-header">
        <h2 className="section-title">Pending Team Requests</h2>
        <button className="view-all-btn" onClick={() => navigate('/pending-requests')}>
          View All
        </button>
      </div>
      <div className="activities-list">
        {loading ? (
          <div className="loading-text">Loading team requests...</div>
        ) : recentActivities.length > 0 ? (
          recentActivities.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-avatar">
                {activity.employee?.name?.charAt(0) || 'U'}
              </div>
              <div className="activity-details">
                <div className="activity-main">
                  <span className="employee-name">{activity.employee?.name}</span>
                  <span className="activity-type">{activity.leaveType?.name}</span>
                </div>
                <div className="activity-meta">
                  <span className="activity-date">
                    {formatDate(activity.appliedDate)}
                  </span>
                  {getStatusBadge(activity.status)}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-data">No pending requests</div>
        )}
      </div>
    </div>
  );

  const renderHRAdminActivities = () => (
    <div className="content-section activities-section">
      <div className="section-header">
        <h2 className="section-title">Recent Leave Applications</h2>
        <button className="view-all-btn" onClick={() => navigate('/leave-overview')}>
          View All
        </button>
      </div>
      <div className="activities-list">
        {loading ? (
          <div className="loading-text">Loading applications...</div>
        ) : recentActivities.length > 0 ? (
          recentActivities.map((activity) => (
            <div key={activity.id} className="activity-item">
              <div className="activity-icon leave">
                📋
              </div>
              <div className="activity-details">
                <div className="activity-main">
                  <span className="employee-name">{activity.employee?.name}</span>
                  <span className="activity-type">{activity.leaveType?.name}</span>
                </div>
                <div className="activity-meta">
                  <span className="activity-date">
                    {formatDate(activity.appliedDate)}
                  </span>
                  {getStatusBadge(activity.status)}
                  <span className="activity-department">{activity.employee?.department}</span>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-data">No recent applications</div>
        )}
      </div>
    </div>
  );

  const renderActivities = () => {
    switch (userRole) {
      case 'manager':
        return renderManagerActivities();
      case 'hr-admin':
        return renderHRAdminActivities();
      default:
        return renderEmployeeActivities();
    }
  };

  // Render sidebar content based on role
  const renderEmployeeSidebar = () => (
    <div className="content-section upcoming-section">
      <h2 className="section-title">Quick Links</h2>
      <div className="upcoming-list">
        <div className="quick-link" onClick={() => navigate('/apply-leave')}>
          <span className="link-icon">📝</span>
          <span className="link-text">Apply for Leave</span>
        </div>
        <div className="quick-link" onClick={() => navigate('/leave-history')}>
          <span className="link-icon">📋</span>
          <span className="link-text">View Leave History</span>
        </div>
        <div className="quick-link" onClick={() => navigate('/profile')}>
          <span className="link-icon">👤</span>
          <span className="link-text">Update Profile</span>
        </div>
      </div>
    </div>
  );

  const renderManagerSidebar = () => (
    <div className="content-section team-section">
      <h2 className="section-title">Team Overview</h2>
      <div className="team-stats">
        <div className="team-stat">
          <span className="stat-value">{dashboardData.teamSize || 0}</span>
          <span className="stat-label">Team Size</span>
        </div>
        <div className="team-stat">
          <span className="stat-value">{dashboardData.teamOnLeave || 0}</span>
          <span className="stat-label">On Leave</span>
        </div>
        <div className="team-stat">
          <span className="stat-value">{dashboardData.pendingRequests || 0}</span>
          <span className="stat-label">Pending</span>
        </div>
      </div>
      <button className="view-team-btn" onClick={() => navigate('/team-overview')}>
        View Full Team
      </button>
    </div>
  );

  const renderHRAdminSidebar = () => (
    <div className="content-section alerts-section">
      <h2 className="section-title">System Overview</h2>
      <div className="system-stats">
        <div className="system-stat">
          <span className="stat-value">{dashboardData.totalEmployees || 0}</span>
          <span className="stat-label">Total Users</span>
        </div>
        <div className="system-stat">
          <span className="stat-value">{dashboardData.onLeaveToday || 0}</span>
          <span className="stat-label">On Leave</span>
        </div>
        <div className="system-stat">
          <span className="stat-value">{dashboardData.pendingApprovals || 0}</span>
          <span className="stat-label">Pending</span>
        </div>
      </div>
      <button className="system-overview-btn" onClick={() => navigate('/leave-overview')}>
        System Overview
      </button>
    </div>
  );

  const renderSidebar = () => {
    switch (userRole) {
      case 'manager':
        return renderManagerSidebar();
      case 'hr-admin':
        return renderHRAdminSidebar();
      default:
        return renderEmployeeSidebar();
    }
  };

  const roleContent = getRoleSpecificContent();
  const quickActions = getQuickActions();

  if (error) {
    return (
      <div className="dashboard">
        <div className="error-state">
          <h2>Unable to Load Dashboard</h2>
          <p>{error}</p>
          <button onClick={loadDashboardData} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Welcome Header */}
      <div className="dashboard-header">
        <div className="welcome-section">
          <h1 className="greeting">
            {getGreeting()}, {user?.name || 'User'}!
          </h1>
          <p className="dashboard-subtitle">{roleContent.subtitle}</p>
          <p className="user-department">{user?.department} • {user?.position}</p>
        </div>
        <div className="header-actions">
          <button className="primary-action-btn" onClick={handlePrimaryAction}>
            {roleContent.primaryActionText}
          </button>
          <div className="current-date">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="stats-grid">
        {renderStats()}
      </div>

      {/* Main Content Grid */}
      <div className="dashboard-content">
        {/* Quick Actions */}
        <div className="content-section quick-actions-section">
          <h2 className="section-title">Quick Actions</h2>
          <div className="actions-grid">
            {quickActions.map((action, index) => (
              <button 
                key={index} 
                className="action-card" 
                style={{ '--action-color': action.color } as React.CSSProperties}
                onClick={() => handleQuickAction(action.path)}
              >
                <span className="action-icon">{action.icon}</span>
                <span className="action-label">{action.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Activities Section */}
        {renderActivities()}

        {/* Sidebar Sections */}
        {renderSidebar()}

        {/* Calendar Widget */}
        <div className="content-section calendar-section">
          <h2 className="section-title">Today</h2>
          <div className="calendar-widget">
            <div className="calendar-date">
              {new Date().getDate()}
            </div>
            <div className="calendar-info">
              <div className="calendar-day">
                {new Date().toLocaleDateString('en-US', { weekday: 'long' })}
              </div>
              <div className="calendar-full-date">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;