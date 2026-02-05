
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { DashboardStats, Leave,TeamMember,LeaveType, UserRole } from '../types';
import { apiService } from '../utils/api';
import { useTranslation } from 'react-i18next';
import './Dashboard.css';

// Add these new interfaces
interface EnhancedDashboardStats extends DashboardStats {
  upcomingLeaves?: Leave[];
  teamOnLeave?: number;
  leaveUtilization?: number;
  notifications?: number;
  recentApprovals?:number;
  teamSize?:number;
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
  leaveType?: LeaveType | string;
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
  const { t, i18n } = useTranslation();
  const [dashboardData, setDashboardData] = useState<EnhancedDashboardStats>({
    title: '',
    color: '',
    subtitle: ''
  });
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalanceCard[]>([]);
  const [upcomingLeaves, setUpcomingLeaves] = useState<Leave[]>([]);
  const [teamOnLeave, setTeamOnLeave] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'overview' | 'activities' | 'team'>('overview');
  const [activityFilter, setActivityFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  const userRole = user?.role || 'employee';

  // Memoized role-specific configurations
  const roleConfig = useMemo(() => {
    const baseConfig = {
      employee: {
        title: t('dashboard.titles.employee'),
        subtitle: t('dashboard.subtitles.employee'),
        primaryAction: '/apply-leave',
        primaryActionText: t('dashboard.actions.apply_leave'),
        colorTheme: '#3498db'
      },
      manager: {
        title: t('dashboard.titles.manager'),
        subtitle: t('dashboard.subtitles.manager'),
        primaryAction: '/pending-requests',
        primaryActionText: t('dashboard.actions.review_pending'),
        colorTheme: '#27ae60'
      },
      'hr-admin': {
        title: t('dashboard.titles.hr_admin'),
        subtitle: t('dashboard.subtitles.hr_admin'),
        primaryAction: '/hr-approvals',
        primaryActionText: t('dashboard.actions.hr_approvals'),
        colorTheme: '#9b59b6'
      },
      'super-admin': {
        title: t('dashboard.titles.super_admin'),
        subtitle: t('dashboard.subtitles.super_admin'),
        primaryAction: '/hr-approvals',
        primaryActionText: t('dashboard.actions.hr_approvals'),
        colorTheme: '#e74c3c'
      }
    };
    return baseConfig[userRole as keyof typeof baseConfig] || baseConfig.employee;
  }, [userRole, t]);

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
        { label: t('menu.apply_leave'), icon: '📝', path: '/apply-leave', color: '#27ae60', description: t('dashboard.quick_actions.apply_desc'), badge: 0 },
        { label: t('menu.leave_history'), icon: '📋', path: '/leave-history', color: '#3498db', description: t('dashboard.quick_actions.history_desc'), badge: recentActivities.length },
        { label: t('dashboard.quick_actions.my_profile'), icon: '👤', path: '/profile', color: '#9b59b6', description: t('dashboard.quick_actions.profile_desc'), badge: 0 },
        { label: t('dashboard.quick_actions.leave_balance'), icon: '💰', path: '/leave-balance', color: '#f39c12', description: t('dashboard.quick_actions.balance_desc'), badge: leaveBalances.length },
      ],
      manager: [
        { label: t('menu.pending_requests'), icon: '✅', path: '/pending-requests', color: '#27ae60', description: t('dashboard.quick_actions.pending_desc'), badge: dashboardData.pendingRequests || 0 },
        { label: t('menu.team_overview'), icon: '👥', path: '/team-overview', color: '#3498db', description: t('dashboard.quick_actions.team_desc'), badge: dashboardData.teamSize || 0 },
        { label: t('menu.reports'), icon: '📊', path: '/reports', color: '#9b59b6', description: t('dashboard.quick_actions.reports_desc'), badge: 0 },
        { label: t('dashboard.quick_actions.calendar'), icon: '📅', path: '/calendar', color: '#f39c12', description: t('dashboard.quick_actions.calendar_desc'), badge: teamOnLeave.length },
      ],
      'hr-admin': [
        { label: t('menu.approvals'), icon: '✅', path: '/hr-approvals', color: '#e74c3c', description: t('dashboard.quick_actions.hr_approvals_desc'), badge: dashboardData.pendingApprovals || 0 },
        { label: t('menu.user_management'), icon: '👥', path: '/user-management', color: '#3498db', description: t('dashboard.quick_actions.users_desc'), badge: 0 },
        { label: t('menu.leave_overview'), icon: '👁️', path: '/leave-overview', color: '#27ae60', description: t('dashboard.quick_actions.overview_desc'), badge: 0 },
        { label: t('dashboard.quick_actions.system_settings'), icon: '⚙️', path: '/system-settings', color: '#9b59b6', description: t('dashboard.quick_actions.settings_desc'), badge: 0 },
        { label: t('dashboard.quick_actions.analytics'), icon: '📊', path: '/hr-reports', color: '#f39c12', description: t('dashboard.quick_actions.analytics_desc'), badge: 0 },
      ],
      'super-admin': [
        { label: t('dashboard.quick_actions.system_admin'), icon: '🛡️', path: '/admin', color: '#e74c3c', description: t('dashboard.quick_actions.system_admin_desc'), badge: 0 },
        { label: t('menu.user_management'), icon: '👥', path: '/user-management', color: '#3498db', description: t('dashboard.quick_actions.users_desc_all'), badge: 0 },
        { label: t('dashboard.quick_actions.audit_logs'), icon: '📋', path: '/audit-logs', color: '#2c3e50', description: t('dashboard.quick_actions.audit_desc'), badge: 0 },
        { label: t('dashboard.quick_actions.system_settings'), icon: '⚙️', path: '/system-settings', color: '#9b59b6', description: t('dashboard.quick_actions.settings_desc'), badge: 0 },
        { label: t('dashboard.quick_actions.backup_restore'), icon: '💾', path: '/backup', color: '#f39c12', description: t('dashboard.quick_actions.backup_desc'), badge: 0 },
      ]
    };

    return actions[userRole as keyof typeof actions] || actions.employee;
  }, [userRole, dashboardData, recentActivities.length, leaveBalances.length, teamOnLeave.length, t]);

  // Enhanced greeting with time-based emoji
  const getGreeting = useCallback(() => {
    const hour = new Date().getHours();
    let greeting = t('dashboard.greetings.hello');
    let emoji = '👋';

    if (hour < 12) {
      greeting = t('dashboard.greetings.morning');
      emoji = '☀️';
    } else if (hour < 17) {
      greeting = t('dashboard.greetings.afternoon');
      emoji = '🌤️';
    } else if (hour < 21) {
      greeting = t('dashboard.greetings.evening');
      emoji = '🌙';
    } else {
      greeting = t('dashboard.greetings.night');
      emoji = '🌠';
    }

    return { greeting, emoji };
  }, [t]);

  // Enhanced status badge with tooltips
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      PENDING_MANAGER: { class: 'status-pending', label: t('status.pending_manager'), icon: '⏳', color: '#f39c12' },
      PENDING_HR: { class: 'status-pending-hr', label: t('status.pending_hr'), icon: '📋', color: '#3498db' },
      APPROVED: { class: 'status-approved', label: t('status.approved'), icon: '✅', color: '#27ae60' },
      HR_APPROVED: { class: 'status-approved', label: t('status.hr_approved'), icon: '✅', color: '#27ae60' },
      REJECTED: { class: 'status-rejected', label: t('status.rejected'), icon: '❌', color: '#e74c3c' },
      CANCELLED: { class: 'status-cancelled', label: t('status.cancelled'), icon: '🚫', color: '#95a5a6' }
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
  const formatDate = (dateString: string, options: Intl.DateTimeFormatOptions = {}) => {
    const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'om-ET' };
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    };
    const locale = localeMap[i18n.language] || 'en-US';
    return new Date(dateString).toLocaleDateString(locale, defaultOptions);
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
                <div className="stat-label">{t('common.loading')}</div>
              </div>
            </div>
          ))}
        </div>
      );
    }

  const stats: Record<UserRole, DashboardStats[]> = {
      employee: [
        {
          title: t('dashboard.stats.available_days'),
          value: dashboardData.availableLeaves || 0,
          icon: '📅',
          color: '#27ae60',
          subtitle: t('dashboard.stats.ready_to_use'),
          progress: dashboardData.availableLeaves ? 
            Math.min((dashboardData.availableLeaves / 30) * 100, 100) : 0
        },
        {
          title: t('dashboard.stats.leaves_taken'),
          value: dashboardData.leavesTaken || 0,
          icon: '✅',
          color: '#3498db',
          subtitle: t('dashboard.stats.this_year'),
          progress: dashboardData.leavesTaken ? 
            Math.min((dashboardData.leavesTaken / 20) * 100, 100) : 0
        },
        {
          title: t('dashboard.stats.pending'),
          value: dashboardData.pendingRequests || 0,
          icon: '⏳',
          color: '#f39c12',
          subtitle: t('dashboard.stats.awaiting_approval'),
          progress: 100
        },
        {
          title: t('dashboard.stats.utilization'),
          value: dashboardData.leaveUtilization || 0,
          icon: '📊',
          color: '#9b59b6',
          subtitle: t('dashboard.stats.usage_rate'),
          progress: dashboardData.leaveUtilization || 0
        }
      ],
      manager: [
        {
          title: t('dashboard.stats.pending_requests'),
          value: dashboardData.pendingRequests || 0,
          icon: '⏳',
          color: '#f39c12',
          subtitle: t('dashboard.stats.require_attention'),
          badge: 'urgent'
        },
        {
          title: t('dashboard.stats.team_size'),
          value: dashboardData.teamSize || 0,
          icon: '👥',
          color: '#3498db',
          subtitle: t('dashboard.stats.active_members'),
          trend:  '+' 
        },
        {
          title: t('dashboard.stats.approval_rate'),
          value: dashboardData.approvalRate || 0,
          icon: '📈',
          color: '#27ae60',
          subtitle: t('dashboard.stats.overall_approval'),
          progress: dashboardData.approvalRate || 0
        },
        {
          title: t('dashboard.stats.on_leave'),
          value: dashboardData.teamOnLeave || 0,
          icon: '🏖️',
          color: '#e74c3c',
          subtitle: t('dashboard.stats.currently_out'),
          badge:  'active'
        }
      ],
      'hr-admin': [
        {
          title: t('dashboard.stats.total_employees'),
          value: dashboardData.totalEmployees || 0,
          icon: '👥',
          color: '#3498db',
          subtitle: t('dashboard.stats.active_users'),
          trend: '+'
        },
        {
          title: t('dashboard.stats.on_leave_today'),
          value: dashboardData.onLeaveToday || 0,
          icon: '📋',
          color: '#27ae60',
          subtitle: t('dashboard.stats.currently_out'),
          badge: 'active'
        },
        {
          title: t('dashboard.stats.pending_hr'),
          value: dashboardData.pendingApprovals || 0,
          icon: '⚠️',
          color: '#e74c3c',
          subtitle: t('dashboard.stats.require_approval'),
          badge: 'urgent'
        },
        {
          title: t('dashboard.stats.system_alerts'),
          value: dashboardData.systemAlerts || 0,
          icon: '🔔',
          color: '#f39c12',
          subtitle: t('dashboard.stats.notifications'),
          badge: 'alert'
        }
      ],
      'super-admin': [
        {
          title: t('dashboard.stats.total_employees'),
          value: dashboardData.totalEmployees || 0,
          icon: '👥',
          color: '#3498db',
          subtitle: t('dashboard.stats.active_users'),
          trend: '+'
        },
        {
          title: t('dashboard.stats.on_leave_today'),
          value: dashboardData.onLeaveToday || 0,
          icon: '📋',
          color: '#27ae60',
          subtitle: t('dashboard.stats.currently_out'),
          badge: 'active'
        },
        {
          title: t('dashboard.stats.pending_hr'),
          value: dashboardData.pendingApprovals || 0,
          icon: '⚠️',
          color: '#e74c3c',
          subtitle: t('dashboard.stats.require_approval'),
          badge: 'urgent'
        },
        {
          title: t('dashboard.stats.system_alerts'),
          value: dashboardData.systemAlerts || 0,
          icon: '🔔',
          color: '#f39c12',
          subtitle: t('dashboard.stats.notifications'),
          badge: 'alert'
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
    const filters = [
      { key: 'all' as const, label: t('dashboard.filters.all') },
      { key: 'pending' as const, label: t('dashboard.filters.pending') },
      { key: 'approved' as const, label: t('dashboard.filters.approved') },
      { key: 'rejected' as const, label: t('dashboard.filters.rejected') }
    ];

    const filteredActivities = recentActivities.filter(activity => {
      if (activityFilter === 'all') return true;
      if (activityFilter === 'pending') return activity.status.includes('PENDING');
      if (activityFilter === 'approved') return activity.status.includes('APPROVED');
      if (activityFilter === 'rejected') return activity.status === 'REJECTED';
      return true;
    });

    return (
      <div className="activities-section">
        <div className="section-header">
          <h2>{t('dashboard.recent_activities')}</h2>
          <div className="activity-filters">
            {filters.map(filter => (
              <button
                key={filter.key}
                className={`filter-btn ${activityFilter === filter.key ? 'active' : ''}`}
                onClick={() => setActivityFilter(filter.key)}
              >
                {filter.label}
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
                      {typeof activity.leaveType === 'string'
                        ? activity.leaveType
                        : activity.leaveType?.name || t('dashboard.leave_request')}
                    </span>
                    <span className="activity-days">{activity.days} {t('dashboard.days')}</span>
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
              <p>{t('dashboard.no_activities')}</p>
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
        <h2>{t('dashboard.leave_balance')}</h2>
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
                  <span className="balance-label">{t('dashboard.used')}</span>
                  <span className="balance-value">{balance.used}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">{t('dashboard.remaining')}</span>
                  <span className="balance-value remaining">{balance.remaining}</span>
                </div>
                <div className="balance-item">
                  <span className="balance-label">{t('dashboard.total')}</span>
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
        <h2>{t('menu.team_overview')}</h2>
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
                    {member.leaves?.length || 0} {t('dashboard.leaves')}
                  </span>
                </div>
              </div>
              <div className="member-status">
                <span className="status-indicator on-leave">{t('dashboard.on_leave')}</span>
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
      <h2>{t('dashboard.quick_actions.title')}</h2>
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
            {action.badge=0 && (
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
    const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'om-ET' };
    const locale = localeMap[i18n.language] || 'en-US';

    return (
      <div className="calendar-widget">
        <div className="calendar-header">
          <h3>{t('dashboard.calendar')}</h3>
          <span className="current-month">
            {today.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}
          </span>
        </div>
        <div className="calendar-grid">
          {[
            t('dashboard.days_short.sun'),
            t('dashboard.days_short.mon'),
            t('dashboard.days_short.tue'),
            t('dashboard.days_short.wed'),
            t('dashboard.days_short.thu'),
            t('dashboard.days_short.fri'),
            t('dashboard.days_short.sat')
          ].map(day => (
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
          <h3>{t('dashboard.unable_to_load')}</h3>
          <p>{error}</p>
          <button onClick={loadDashboardData} className="retry-btn">
            {t('common.try_again')}
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
            {loading ? t('dashboard.refreshing') : `🔄 ${t('dashboard.refresh')}`}
          </button>
          <div className="current-time">
            {new Date().toLocaleTimeString(i18n.language === 'am' ? 'am-ET' : i18n.language === 'om' ? 'om-ET' : 'en-US', { 
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
          {t('dashboard.tabs.overview')}
        </button>
        <button
          className={`tab-btn ${activeTab === 'activities' ? 'active' : ''}`}
          onClick={() => setActiveTab('activities')}
        >
          {t('dashboard.tabs.activities')}
        </button>
        {userRole === 'manager' && (
          <button
            className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            {t('dashboard.tabs.team')}
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
