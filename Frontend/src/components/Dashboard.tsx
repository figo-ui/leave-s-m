
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { DashboardStats, Leave,TeamMember } from '../types';
import { apiService } from '../utils/api';
import './Dashboard.css';

// Add these new interfaces
interface EnhancedDashboardStats extends DashboardStats {
  upcomingLeaves?: Leave[];
  teamOnLeave?: number;
  leaveUtilization?: number;
  notifications?: number;
  recentApprovals?:number;
}

interface QuickAction {
  label: string;
  icon: string;
  path: string;
  color: string;
  description: string;
  badge?: number;
}

interface ActivityItem {
  id: number;
  leaveType?: {
    name: string;
    color?: string;
  };
  startDate: string;
  endDate: string;
  days: number;
  status: string;
  appliedDate?: string;
  employee?: {
    name: string;
    department?: string;
    avatar?: string;
  };
  reason?: string;
}

interface LeaveBalanceCard {
  type: string;
  used: number;
  total: number;
  remaining: number;
  percentage: number;
  color?: string;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState<EnhancedDashboardStats>({});
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceCard[]>([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState<Leave[]>([]);
  const [teamOnLeave, setTeamOnLeave] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'team'>('overview');

  const userRole = user?.role || 'employee';

  // Memoized role-specific configurations
  const roleConfig = useMemo(() => {
    const baseConfig = {
      employee: {
        title: 'Employee Dashboard',
        subtitle: 'Your leave management portal',
        primaryAction: '/apply-leave',
        primaryActionText: 'Apply for Leave',
        colorTheme: '#3498db'
      },
      manager: {
        title: 'Manager Dashboard',
        subtitle: 'Team management and leave approvals',
        primaryAction: '/pending-requests',
        primaryActionText: 'Review Pending Requests',
        colorTheme: '#27ae60'
      },
      'hr-admin': {
        title: 'HR Admin Dashboard',
        subtitle: 'System administration and analytics',
        primaryAction: '/hr-approvals',
        primaryActionText: 'HR Approvals',
        colorTheme: '#9b59b6'
      },
      'super-admin': {
        title: 'Super Admin Dashboard',
        subtitle: 'System administration and analytics',
        primaryAction: '/hr-approvals',
        primaryActionText: 'HR Approvals',
        colorTheme: '#e74c3c'
      }
    };
    return baseConfig[userRole as keyof typeof baseConfig] || baseConfig.employee;
  }, [userRole]);

  console.log(roleConfig);
  // Enhanced data loading with caching
  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const loaders = [
        loadDashboardStats(),
        loadRecentActivities(),
        loadLeaveBalances(),
        loadUpcomingLeaves(),
      ];

      if (userRole === 'manager' || userRole === 'hr-admin') {
        loaders.push(loadTeamOnLeave());
      }

      await Promise.all(loaders);

    } catch (error: unknown) {
      console.error('Error loading dashboard data:', error);
       if (error instanceof Error) {
      setError(error.message || 'Failed to load dashboard data');
    } else {
      setError('Failed to load dashboard data');
    }
  } finally {
    setLoading(false);
  }
}, [userRole]);

  const loadDashboardStats = async () => {
    try {
      const response = await apiService.getDashboardStats();
      if (response.success) {
        setDashboardData(prev => ({ ...prev, ...response.data }));
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadRecentActivities = async () => {
    try {
      let response;
      let activities: ActivityItem[] = [];

      switch (userRole) {
        case 'employee':
          response = await apiService.getLeaveHistory(5);
          if (response.success && response.data) {
            activities = response.data;
          }
          break;

        case 'manager':
          response = await apiService.getPendingRequests();
          if (response.success && response.data) {
            activities = response.data.slice(0, 5);
          }
          break;

        case 'hr-admin':
        
          response = await apiService.getLeaveOverview();
          if (response.success && response.data) {
            activities = response.data.slice(0, 6);
          }
          break;
      }

      setRecentActivities(activities);
    } catch (error) {
      console.error('Error loading activities:', error);
    }
  };

const loadLeaveBalances = async () => {
  try {
    if (userRole === 'employee') {
      const response = await apiService.getLeaveBalances();
      if (response.success && response.data) {
        // Cast to unknown first to avoid direct any usage
        const apiData = response.data as unknown[];
        
        const balances: LeaveBalanceCard[] = apiData.map((balance) => {
          const balanceItem = balance as {
            leaveType?: { name?: string; color?: string };
            usedDays?: number;
            totalDays?: number;
            remainingDays?: number;
          };
          
          return {
            type: balanceItem.leaveType?.name || 'Leave',
            used: balanceItem.usedDays || 0,
            total: balanceItem.totalDays || 0,
            remaining: balanceItem.remainingDays || 0,
            percentage: balanceItem.totalDays ? Math.round((balanceItem.usedDays || 0) / balanceItem.totalDays * 100) : 0,
            color: balanceItem.leaveType?.color || '#3498db'
          };
        });
        setLeaveBalances(balances);
      }
    }
  } catch (error) {
    console.error('Error loading leave balances:', error);
  }
};
  const loadUpcomingLeaves = async () => {
    try {
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setMonth(today.getMonth() + 1);

      const response = await apiService.getLeaveHistory(10);
      if (response.success && response.data) {
        const upcoming = response.data.filter((leave: Leave) => {
          const startDate = new Date(leave.startDate);
          return startDate >= today && startDate <= nextMonth && 
                (leave.status|| leave.status === 'APPROVED');
        }).slice(0, 3);
        setUpcomingLeaves(upcoming);
      }
    } catch (error) {
      console.error('Error loading upcoming leaves:', error);
    }
  };

 const loadTeamOnLeave = async () => {
  try {
    if (userRole === 'manager') {
      const response = await apiService.getManagerTeamOverview();
      if (response.success && response.data) {
        // Cast the data properly and avoid 'any'
        const teamMembers = response.data as TeamMember[];
        
        const todayOnLeave = teamMembers.filter((member: TeamMember) => {
          return member.leaves?.some((leave: Leave) => {
            const start = new Date(leave.startDate);
            const end = new Date(leave.endDate);
            const today = new Date();
            return today >= start && today <= end;
          });
        }).slice(0, 5);
        
        // Make sure setTeamOnLeave expects TeamMember[], not number[]
        setTeamOnLeave(todayOnLeave);
      }
    }
  } catch (error) {
    console.error('Error loading team on leave:', error);
  }
};
  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setRefreshKey(prev => prev + 1);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Load data on mount and when refreshKey changes
  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData, refreshKey]);

  // Enhanced quick actions with dynamic badges
  const quickActions: QuickAction[] = useMemo(() => {
    const actions = {
      employee: [
        { label: 'Apply for Leave', icon: '📝', path: '/apply-leave', color: '#27ae60', description: 'Submit new leave request', badge: 0 },
        { label: 'Leave History', icon: '📋', path: '/leave-history', color: '#3498db', description: 'View all your leaves', badge: recentActivities.length },
        { label: 'My Profile', icon: '👤', path: '/profile', color: '#9b59b6', description: 'Update personal information', badge: 0 },
        { label: 'Leave Balance', icon: '💰', path: '/leave-balance', color: '#f39c12', description: 'Check available days', badge: leaveBalances.length },
      ],
      manager: [
        { label: 'Pending Requests', icon: '✅', path: '/pending-requests', color: '#27ae60', description: 'Review team requests', badge: dashboardData.pendingRequests || 0 },
        { label: 'Team Overview', icon: '👥', path: '/team-overview', color: '#3498db', description: 'View team members', badge: dashboardData.teamSize || 0 },
        { label: 'Reports', icon: '📊', path: '/reports', color: '#9b59b6', description: 'Generate analytics', badge: 0 },
        { label: 'Calendar', icon: '📅', path: '/calendar', color: '#f39c12', description: 'Team leave calendar', badge: teamOnLeave.length },
      ],
      'hr-admin': [
        { label: 'HR Approvals', icon: '✅', path: '/hr-approvals', color: '#e74c3c', description: 'Final approval requests', badge: dashboardData.pendingApprovals || 0 },
        { label: 'User Management', icon: '👥', path: '/user-management', color: '#3498db', description: 'Manage system users', badge: 0 },
        { label: 'Leave Overview', icon: '👁️', path: '/leave-overview', color: '#27ae60', description: 'System-wide leaves', badge: 0 },
        { label: 'System Settings', icon: '⚙️', path: '/system-settings', color: '#9b59b6', description: 'Configure system', badge: 0 },
        { label: 'Analytics', icon: '📊', path: '/hr-reports', color: '#f39c12', description: 'HR reports & insights', badge: 0 },
      ],
      'super-admin': [
        { label: 'System Admin', icon: '🛡️', path: '/admin', color: '#e74c3c', description: 'System administration', badge: 0 },
        { label: 'User Management', icon: '👥', path: '/user-management', color: '#3498db', description: 'Manage all users', badge: 0 },
        { label: 'Audit Logs', icon: '📋', path: '/audit-logs', color: '#2c3e50', description: 'System activity logs', badge: 0 },
        { label: 'System Settings', icon: '⚙️', path: '/system-settings', color: '#9b59b6', description: 'Configure system', badge: 0 },
        { label: 'Backup & Restore', icon: '💾', path: '/backup', color: '#f39c12', description: 'Data management', badge: 0 },
      ]
    };

    return actions[userRole as keyof typeof actions] || actions.employee;
  }, [userRole, dashboardData, recentActivities.length, leaveBalances.length, teamOnLeave.length]);

  // Enhanced greeting with time-based emoji
  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    let greeting = 'Hello';
    let emoji = '👋';

    if (hour < 12) {
      greeting = 'Good morning';
      emoji = '☀️';
    } else if (hour < 17) {
      greeting = 'Good afternoon';
      emoji = '🌤️';
    } else if (hour < 21) {
      greeting = 'Good evening';
      emoji = '🌙';
    } else {
      greeting = 'Good night';
      emoji = '🌠';
    }

    return { greeting, emoji };
  }, []);

  // Enhanced status badge with tooltips
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING_MANAGER: { class: 'status-pending', label: 'Pending Manager', icon: '⏳', color: '#f39c12' },
      PENDING_HR: { class: 'status-pending-hr', label: 'Pending HR', icon: '📋', color: '#3498db' },
      APPROVED: { class: 'status-approved', label: 'Approved', icon: '✅', color: '#27ae60' },
      HR_APPROVED: { class: 'status-approved', label: 'HR Approved', icon: '✅', color: '#27ae60' },
      REJECTED: { class: 'status-rejected', label: 'Rejected', icon: '❌', color: '#e74c3c' },
      CANCELLED: { class: 'status-cancelled', label: 'Cancelled', icon: '🚫', color: '#95a5a6' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { 
      class: 'status-pending', 
      label: status, 
      icon: '❓', 
      color: '#95a5a6' 
    };

    return (
      <span 
        className={`status-badge ${config.class}`}
        style={{ backgroundColor: config.color }}
        title={config.label}
      >
        <span className="status-icon">{config.icon}</span>
        <span className="status-label">{config.label}</span>
      </span>
    );
  };

  // Enhanced date formatting
  const formatDate = (dateString: string, options: any = {}) => {
    const defaultOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    };
    return new Date(dateString).toLocaleDateString('en-US', defaultOptions);
  };

  // Render statistics with progress bars
  const renderStatistics = () => {
    if (loading) {
      return (
        <div className="stats-grid">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="stat-card shimmer">
              <div className="stat-content">
                <div className="stat-number">--</div>
                <div className="stat-label">Loading...</div>
              </div>
            </div>
          ))}
        </div>
      );
    }

    const stats = {
      employee: [
        {
          title: 'Available Days',
          value: dashboardData.availableLeaves || 0,
          icon: '📅',
          color: '#27ae60',
          subtitle: 'Ready to use',
          progress: dashboardData.availableLeaves ? 
            Math.min((dashboardData.availableLeaves / 30) * 100, 100) : 0
        },
        {
          title: 'Leaves Taken',
          value: dashboardData.leavesTaken || 0,
          icon: '✅',
          color: '#3498db',
          subtitle: 'This year',
          progress: dashboardData.leavesTaken ? 
            Math.min((dashboardData.leavesTaken / 20) * 100, 100) : 0
        },
        {
          title: 'Pending',
          value: dashboardData.pendingRequests || 0,
          icon: '⏳',
          color: '#f39c12',
          subtitle: 'Awaiting approval',
          progress: 100
        },
        {
          title: 'Utilization',
          value: dashboardData.leaveUtilization ? `${dashboardData.leaveUtilization}%` : '0%',
          icon: '📊',
          color: '#9b59b6',
          subtitle: 'Leave usage rate',
          progress: dashboardData.leaveUtilization || 0
        }
      ],
      manager: [
        {
          title: 'Pending Requests',
          value: dashboardData.pendingRequests || 0,
          icon: '⏳',
          color: '#f39c12',
          subtitle: 'Require attention',
          badge: 'urgent'
        },
        {
          title: 'Team Size',
          value: dashboardData.teamSize || 0,
          icon: '👥',
          color: '#3498db',
          subtitle: 'Active members',
          trend: dashboardData.teamSize ? '+' : null
        },
        {
          title: 'Approval Rate',
          value: `${dashboardData.approvalRate || 0}%`,
          icon: '📈',
          color: '#27ae60',
          subtitle: 'Overall approval',
          progress: dashboardData.approvalRate || 0
        },
        {
          title: 'On Leave',
          value: dashboardData.teamOnLeave || 0,
          icon: '🏖️',
          color: '#e74c3c',
          subtitle: 'Currently out',
          badge: dashboardData.teamOnLeave ? 'active' : null
        }
      ],
      'hr-admin': [
        {
          title: 'Total Employees',
          value: dashboardData.totalEmployees || 0,
          icon: '👥',
          color: '#3498db',
          subtitle: 'Active users',
          trend: '+'
        },
        {
          title: 'On Leave Today',
          value: dashboardData.onLeaveToday || 0,
          icon: '📋',
          color: '#27ae60',
          subtitle: 'Currently out',
          badge: 'active'
        },
        {
          title: 'Pending HR',
          value: dashboardData.pendingApprovals || 0,
          icon: '⚠️',
          color: '#e74c3c',
          subtitle: 'Require approval',
          badge: 'urgent'
        },
        {
          title: 'System Alerts',
          value: dashboardData.systemAlerts || 0,
          icon: '🔔',
          color: '#f39c12',
          subtitle: 'Notifications',
          badge: dashboardData.systemAlerts ? 'alert' : null
        }
      ]
    };

    const roleStats = stats[userRole as keyof typeof stats] || stats.employee;

    return (
      <div className="stats-grid">
        {roleStats.map((stat, index) => (
          <div key={index} className="stat-card">
            <div className="stat-icon" style={{ color: stat.color }}>
              {stat.icon}
            </div>
            <div className="stat-content">
              <div className="stat-value">{stat.value}</div>
              <div className="stat-title">{stat.title}</div>
              <div className="stat-subtitle">{stat.subtitle}</div>
              {stat.progress !== undefined && (
                <div className="stat-progress">
                  <div 
                    className="progress-bar" 
                    style={{ 
                      width: `${stat.progress}%`,
                      backgroundColor: stat.color
                    }}
                  />
                </div>
              )}
              {stat.badge && (
                <span className={`stat-badge badge-${stat.badge}`}>
                  {stat.badge === 'urgent' ? '!' : stat.badge === 'alert' ? '⚠️' : '•'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Enhanced activities section with filtering
  const renderActivities = () => {
    const filters = ['All', 'Pending', 'Approved', 'Rejected'];
    const [activeFilter, setActiveFilter] = useState('All');

    const filteredActivities = recentActivities.filter(activity => {
      if (activeFilter === 'All') return true;
      if (activeFilter === 'Pending') return activity.status.includes('PENDING');
      if (activeFilter === 'Approved') return activity.status.includes('APPROVED');
      if (activeFilter === 'Rejected') return activity.status === 'REJECTED';
      return true;
    });

    return (
      <div className="activities-section">
        <div className="section-header">
          <h2>Recent Activities</h2>
          <div className="activity-filters">
            {filters.map(filter => (
              <button
                key={filter}
                className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
        
        <div className="activities-list">
          {filteredActivities.length > 0 ? (
            filteredActivities.map(activity => (
              <div key={activity.id} className="activity-item">
                <div className="activity-icon">
                  {activity.status.includes('APPROVED') ? '✅' : 
                   activity.status === 'REJECTED' ? '❌' : '⏳'}
                </div>
                <div className="activity-content">
                  <div className="activity-header">
                    <span className="activity-title">
                      {activity.leaveType?.name || 'Leave Request'}
                    </span>
                    <span className="activity-days">{activity.days} days</span>
                  </div>
                  <div className="activity-details">
                    <span className="activity-date">
                      {formatDate(activity.startDate)} - {formatDate(activity.endDate)}
                    </span>
                    {activity.employee && (
                      <span className="activity-employee">
                        {activity.employee.name}
                      </span>
                    )}
                  </div>
                  <div className="activity-footer">
                    {getStatusBadge(activity.status)}
                    {activity.reason && (
                      <span className="activity-reason" title={activity.reason}>
                        📝
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="no-activities">
              <p>No activities found</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Enhanced leave balance visualization
  const renderLeaveBalances = () => {
    if (leaveBalances.length === 0) return null;

    return (
      <div className="balances-section">
        <h2>Leave Balance</h2>
        <div className="balances-grid">
          {leaveBalances.map((balance, index) => (
            <div key={index} className="balance-card">
              <div className="balance-header">
                <span className="balance-type">{balance.type}</span>
                <span className="balance-percentage">{balance.percentage}%</span>
              </div>
              <div className="balance-progress">
                <div 
                  className="progress-bar"
                  style={{
                    width: `${balance.percentage}%`,
                    backgroundColor: balance.color
                  }}
                />
              </div>
              <div className="balance-details">
                <div className="balance-item">
                  <span className="balance-label">Used</span>
                  <span className="balance-value">{balance.used}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">Remaining</span>
                  <span className="balance-value remaining">{balance.remaining}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">Total</span>
                  <span className="balance-value total">{balance.total}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Enhanced team view for managers
  const renderTeamView = () => {
    if (userRole !== 'manager') return null;

    return (
      <div className="team-section">
        <h2>Team Overview</h2>
        <div className="team-grid">
          {teamOnLeave.map((member, index) => (
            <div key={index} className="team-member">
              <div className="member-avatar">
                {member.name?.charAt(0) || 'U'}
              </div>
              <div className="member-info">
                <div className="member-name">{member.name}</div>
                <div className="member-position">{member.position}</div>
                <div className="member-leaves">
                  <span className="leave-count">
                    {member.leaves?.length || 0} leaves
                  </span>
                </div>
              </div>
              <div className="member-status">
                <span className="status-indicator on-leave">On Leave</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Enhanced quick actions with hover effects
  const renderQuickActions = () => (
    <div className="quick-actions-section">
      <h2>Quick Actions</h2>
      <div className="actions-grid">
        {quickActions.map((action, index) => (
          <button
            key={index}
            className="action-card"
            onClick={() => navigate(action.path)}
            style={{ '--action-color': action.color } as React.CSSProperties}
          >
            <div className="action-icon">{action.icon}</div>
            <div className="action-content">
              <div className="action-title">{action.label}</div>
              <div className="action-description">{action.description}</div>
            </div>
            {action.badge > 0 && (
              <span className="action-badge">{action.badge}</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  // Enhanced calendar widget
  const renderCalendarWidget = () => {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();

    return (
      <div className="calendar-widget">
        <div className="calendar-header">
          <h3>Calendar</h3>
          <span className="current-month">
            {today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="calendar-grid">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="calendar-day empty" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const isToday = day === today.getDate();
            const hasLeave = upcomingLeaves.some(leave => {
              const leaveDate = new Date(leave.startDate);
              return leaveDate.getDate() === day && 
                     leaveDate.getMonth() === today.getMonth();
            });

            return (
              <div
                key={day}
                className={`calendar-day ${isToday ? 'today' : ''} ${hasLeave ? 'has-leave' : ''}`}
              >
                {day}
                {hasLeave && <span className="leave-dot" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (error && !loading) {
    return (
      <div className="dashboard-error">
        <div className="error-content">
          <div className="error-icon">⚠️</div>
          <h3>Unable to Load Dashboard</h3>
          <p>{error}</p>
          <button onClick={loadDashboardData} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const greeting = getGreeting();

  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div className="welcome-section">
          <div className="greeting">
            <span className="greeting-emoji">{greeting.emoji}</span>
            <h1>
              {greeting.greeting}, <span className="user-name">{user?.name}</span>!
            </h1>
          </div>
          <p className="user-info">
            {user?.department} • {user?.position} • {user?.email}
          </p>
        </div>
        <div className="header-controls">
          <button
            className="refresh-btn"
            onClick={loadDashboardData}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : '🔄 Refresh'}
          </button>
          <div className="current-time">
            {new Date().toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="dashboard-tabs">
        <button
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
          onClick={() => setActiveTab('activities')}
        >
          Activities
        </button>
        {userRole === 'manager' && (
          <button
            className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            Team
          </button>
        )}
      </div>

      {/* Main Content */}
      <div className="dashboard-content">
        {/* Left Column */}
        <div className="content-left">
          {activeTab === 'overview' && renderStatistics()}
          {activeTab === 'activities' && renderActivities()}
          {activeTab === 'team' && renderTeamView()}
        </div>

        {/* Right Column */}
        <div className="content-right">
          {renderQuickActions()}
          {userRole === 'employee' && renderLeaveBalances()}
          {renderCalendarWidget()}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;