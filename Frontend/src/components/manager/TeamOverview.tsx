// components/TeamOverview.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import type{ User, Leave, LeaveBalance } from '../../types';
import { useTranslation } from 'react-i18next';
import './TeamOverview.css';

interface TeamMember extends User {
  leaveBalance?: LeaveBalance[];
  currentLeave?: Leave | null;
  upcomingLeaves?: Leave[];
  totalLeavesTaken?: number;
}

interface TeamStats {
  totalMembers: number;
  onLeaveToday: number;
  upcomingLeaves: number;
  averageLeaveDays: number;
  departmentBreakdown: { [key: string]: number };
}

const TeamOverview: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [stats, setStats] = useState<TeamStats | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showMemberDetails, setShowMemberDetails] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'calendar'>('grid');
  // Load team members
  useEffect(() => {
    if (user && (user.role === 'manager' || user.role === 'hr-admin' || user.role === 'super-admin')) {
      loadTeamMembers();
    }
  }, [user]);

  const loadTeamMembers = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Use manager endpoint if user is manager, otherwise get all users for HR
      const endpoint = user?.role === 'manager' 
        ? '/manager/team-overview'
        : '/users';
      
      const response = await apiService.get<TeamMember[]>(endpoint);
      
      if (response.success && response.data) {
        const members = await enhanceTeamMembers(response.data);
        setTeamMembers(members);
        calculateStats(members);
      } else {
        setError(response.message || t('team_overview.errors.load_failed'));
      }
    } catch (error: any) {
      console.error('Error loading team members:', error);
      setError(error.message || t('team_overview.errors.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const enhanceTeamMembers = async (members: User[]): Promise<TeamMember[]> => {
    const enhancedMembers = await Promise.all(
      members.map(async (member) => {
        try {
          // Get leave balances for each member
          const balanceResponse = await apiService.getLeaveBalances();
          const memberBalances = balanceResponse.success 
            ? balanceResponse.data?.filter(b => b.userId === member.id) || []
            : [];

          // Get current and upcoming leaves
          const today = new Date();
          const leaveResponse = await apiService.getLeaveHistory();
          const memberLeaves = leaveResponse.success 
            ? leaveResponse.data?.filter(l => 
                l.employeeId === member.id && 
                (l.status === 'APPROVED' || l.status === 'HR_APPROVED')
              ) || []
            : [];

          const currentLeave = memberLeaves.find(leave => 
            new Date(leave.startDate) <= today && 
            new Date(leave.endDate) >= today
          );

          const upcomingLeaves = memberLeaves.filter(leave => 
            new Date(leave.startDate) > today
          );

          const totalLeavesTaken = memberLeaves.reduce((total, leave) => total + leave.days, 0);

          return {
            ...member,
            leaveBalance: memberBalances,
            currentLeave,
            upcomingLeaves,
            totalLeavesTaken
          };
        } catch (error) {
          console.error(`Error enhancing member ${member.name}:`, error);
          return { ...member } as TeamMember;
        }
      })
    );

    return enhancedMembers;
  };

  const calculateStats = (members: TeamMember[]) => {
    const stats: TeamStats = {
      totalMembers: members.length,
      onLeaveToday: members.filter(m => m.currentLeave).length,
      upcomingLeaves: members.reduce((total, m) => total + (m.upcomingLeaves?.length || 0), 0),
      averageLeaveDays: members.length > 0 
        ? members.reduce((sum, m) => sum + (m.totalLeavesTaken || 0), 0) / members.length
        : 0,
      departmentBreakdown: members.reduce((acc, m) => {
        const department = m.department || t('team_overview.unassigned');
        acc[department] = (acc[department] || 0) + 1;
        return acc;
      }, {} as { [key: string]: number })
    };

    setStats(stats);
  };

  // Filter team members
  const filteredMembers = useMemo(() => {
    return teamMembers.filter(member => {
      const matchesSearch = 
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.position?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus = 
        filterStatus === 'all' || 
        (filterStatus === 'onLeave' && member.currentLeave) ||
        (filterStatus === 'available' && !member.currentLeave);

      const matchesDepartment = 
        filterDepartment === 'all' || 
        member.department === filterDepartment;

      return matchesSearch && matchesStatus && matchesDepartment;
    });
  }, [teamMembers, searchTerm, filterStatus, filterDepartment]);

  // Get unique departments for filter
  const departments = useMemo(() => {
    return Array.from(new Set(teamMembers.map(m => m.department || 'Unassigned'))).sort();
  }, [teamMembers]);

  // Handle member selection
  const handleMemberClick = (member: TeamMember) => {
    setSelectedMember(member);
    setShowMemberDetails(true);
  };

  // Get leave status badge
  const getLeaveStatusBadge = (member: TeamMember) => {
    if (member.currentLeave) {
      return (
        <span className="status-badge on-leave">
          ⏸️ {t('dashboard.on_leave')}
        </span>
      );
    }

    if (member.upcomingLeaves && member.upcomingLeaves.length > 0) {
      return (
        <span className="status-badge upcoming-leave">
          📅 {t('team_overview.upcoming_leave')}
        </span>
      );
    }

    return (
      <span className="status-badge available">
        ✅ {t('team_overview.available')}
      </span>
    );
  };

  // Get days until next leave
  const getDaysUntilLeave = (member: TeamMember): string => {
    if (!member.upcomingLeaves || member.upcomingLeaves.length === 0) return t('team_overview.no_upcoming');
    
    const nextLeave = member.upcomingLeaves[0];
    const leaveDate = new Date(nextLeave.startDate);
    const today = new Date();
    const daysUntil = Math.ceil((leaveDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return t('team_overview.days_until_leave', { days: daysUntil });
  };

  const getLeaveTypeName = (leaveType?: string | { name?: string }) => {
    if (!leaveType) return t('leave_history.unknown');
    if (typeof leaveType === 'string') return leaveType;
    return leaveType.name || t('leave_history.unknown');
  };

  // Render loading state
  if (loading) {
    return (
      <div className="team-overview">
        <div className="page-header">
          <h1>{t('team_overview.title')}</h1>
          <p>{t('team_overview.loading_info')}</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{t('team_overview.loading_team')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="team-overview">
      <div className="page-header">
        <div className="header-content">
          <div className="header-title">
            <h1>Team Overview</h1>
            <span className="team-count-badge">
              {t('team_overview.team_count', { count: teamMembers.length })}
            </span>
          </div>
          <div className="header-actions">
            <button 
              className="refresh-btn"
              onClick={loadTeamMembers}
              title={t('dashboard.refresh')}
            >
              🔄 {t('dashboard.refresh')}
            </button>
            <div className="view-toggle">
              <button 
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                🟦 {t('team_overview.views.grid')}
              </button>
              <button 
                className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                📋 {t('team_overview.views.table')}
              </button>
              <button 
                className={`view-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                onClick={() => setViewMode('calendar')}
              >
                📅 {t('dashboard.calendar')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="error-message">
          <div className="error-content">
            <span className="error-icon">❌</span>
            {error}
          </div>
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="stats-container">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">👥</div>
              <div className="stat-info">
                <div className="stat-value">{stats.totalMembers}</div>
                <div className="stat-label">{t('team_overview.stats.total_members')}</div>
              </div>
            </div>
            
            <div className="stat-card warning">
              <div className="stat-icon">⏸️</div>
              <div className="stat-info">
                <div className="stat-value">{stats.onLeaveToday}</div>
                <div className="stat-label">{t('team_overview.stats.on_leave_today')}</div>
              </div>
            </div>
            
            <div className="stat-card info">
              <div className="stat-icon">📅</div>
              <div className="stat-info">
                <div className="stat-value">{stats.upcomingLeaves}</div>
                <div className="stat-label">{t('team_overview.stats.upcoming')}</div>
              </div>
            </div>
            
            <div className="stat-card success">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <div className="stat-value">{stats.averageLeaveDays.toFixed(1)}</div>
                <div className="stat-label">{t('team_overview.stats.avg_leave')}</div>
              </div>
            </div>
          </div>

          {/* Department Breakdown */}
          <div className="department-breakdown">
            <h3>{t('team_overview.department_distribution')}</h3>
            <div className="department-chips">
              {Object.entries(stats.departmentBreakdown).map(([dept, count]) => (
                <span key={dept} className="department-chip">
                  {dept}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder={t('team_overview.search_placeholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        
        <div className="filter-controls">
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Status</option>
            <option value="all">{t('team_overview.filters.all_status')}</option>
            <option value="available">{t('team_overview.available')}</option>
            <option value="onLeave">{t('dashboard.on_leave')}</option>
          </select>

          <select 
            value={filterDepartment} 
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="filter-select"
          >
            <option value="all">{t('team_overview.filters.all_departments')}</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="results-info">
        {t('team_overview.showing', { shown: filteredMembers.length, total: teamMembers.length })}
        {(searchTerm || filterStatus !== 'all' || filterDepartment !== 'all') && ` ${t('hr_approvals.filtered')}`}
      </div>

      {/* Team Members Display */}
      {filteredMembers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>{t('team_overview.empty_title')}</h3>
          <p>
            {searchTerm || filterStatus !== 'all' || filterDepartment !== 'all' 
              ? t('team_overview.empty_filtered')
              : t('team_overview.empty_default')}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="team-grid">
          {filteredMembers.map(member => (
            <div 
              key={member.id} 
              className="team-card"
              onClick={() => handleMemberClick(member)}
            >
              <div className="card-header">
                <div className="member-avatar">
                  {member.avatar ? (
                    <img src={member.avatar} alt={member.name} />
                  ) : (
                    member.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="member-status">
                  {getLeaveStatusBadge(member)}
                </div>
              </div>
              
              <div className="card-body">
                <h3 className="member-name">{member.name}</h3>
                <p className="member-position">{member.position}</p>
                <p className="member-department">{member.department}</p>
                
                <div className="member-contact">
                  <span className="contact-icon">📧</span>
                  <span className="contact-email">{member.email}</span>
                </div>
                
                {member.phone && (
                  <div className="member-contact">
                    <span className="contact-icon">📱</span>
                    <span className="contact-phone">{member.phone}</span>
                  </div>
                )}
              </div>
              
              <div className="card-footer">
                <div className="leave-info">
                  {member.currentLeave ? (
                    <div className="current-leave">
                      <span className="leave-label">On Leave:</span>
                      <span className="leave-dates">
                        {new Date(member.currentLeave.startDate).toLocaleDateString()} - {new Date(member.currentLeave.endDate).toLocaleDateString()}
                      </span>
                    </div>
                  ) : member.upcomingLeaves && member.upcomingLeaves.length > 0 ? (
                    <div className="upcoming-leave-info">
                      <span className="leave-label">Next Leave:</span>
                      <span className="leave-dates">
                        {new Date(member.upcomingLeaves[0].startDate).toLocaleDateString()}
                      </span>
                    </div>
                  ) : (
                    <div className="no-upcoming-leave">
                      <span className="leave-label">{t('team_overview.no_upcoming')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="team-table-container">
          <table className="team-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>{t('about_me.position')}</th>
                <th>{t('about_me.department')}</th>
                <th>{t('leave_history.columns.status')}</th>
                <th>{t('team_overview.next_leave')}</th>
                <th>{t('dashboard.leave_balance')}</th>
                <th>{t('leave_history.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMembers.map(member => (
                <tr key={member.id}>
                  <td>
                    <div className="table-member-info">
                      <div className="member-avatar small">
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name} />
                        ) : (
                          member.name.charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="member-details">
                        <div className="member-name">{member.name}</div>
                        <div className="member-email">{member.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{member.position}</td>
                  <td>{member.department}</td>
                  <td>
                    {getLeaveStatusBadge(member)}
                  </td>
                  <td>
                    {getDaysUntilLeave(member)}
                  </td>
                  <td>
                    {member.leaveBalance && member.leaveBalance.length > 0 ? (
                      <div className="leave-balance-summary">
                        {member.leaveBalance[0].remaining} {t('team_overview.days_left')}
                      </div>
                    ) : t('hr_approvals.na')}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button 
                        className="action-btn view-btn"
                        onClick={() => handleMemberClick(member)}
                      >
                        {t('leave_history.view_details')}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Member Details Modal */}
      {showMemberDetails && selectedMember && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{t('team_overview.member_details')}</h2>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowMemberDetails(false);
                  setSelectedMember(null);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="member-profile">
                <div className="profile-header">
                  <div className="profile-avatar large">
                    {selectedMember.avatar ? (
                      <img src={selectedMember.avatar} alt={selectedMember.name} />
                    ) : (
                      selectedMember.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="profile-info">
                    <h3>{selectedMember.name}</h3>
                    <p className="profile-position">{selectedMember.position}</p>
                    <p className="profile-department">{selectedMember.department}</p>
                    <div className="profile-status">
                      {getLeaveStatusBadge(selectedMember)}
                    </div>
                  </div>
                </div>
                
                <div className="profile-details">
                  <div className="detail-section">
                    <h4>Contact Information</h4>
                    <div className="contact-details">
                      <div className="contact-item">
                        <span className="contact-label">Email:</span>
                        <span className="contact-value">{selectedMember.email}</span>
                      </div>
                      {selectedMember.phone && (
                        <div className="contact-item">
                          <span className="contact-label">Phone:</span>
                          <span className="contact-value">{selectedMember.phone}</span>
                        </div>
                      )}
                      {selectedMember.joinDate && (
                        <div className="contact-item">
                          <span className="contact-label">Join Date:</span>
                          <span className="contact-value">
                            {new Date(selectedMember.joinDate).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="detail-section">
                    <h4>{t('team_overview.leave_info')}</h4>
                    {selectedMember.leaveBalance && selectedMember.leaveBalance.length > 0 ? (
                      <div className="leave-balances">
                        <h5>{t('team_overview.leave_balances')}</h5>
                        <div className="balance-grid">
                          {selectedMember.leaveBalance.map(balance => (
                            <div key={balance.leaveTypeId} className="balance-item">
                              <span className="balance-type">{balance.leaveType?.name}:</span>
                              <span className="balance-days">
                                {balance.remaining} / {balance.total} {t('dashboard.days')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p>{t('team_overview.no_balance_info')}</p>
                    )}
                  </div>
                  
                  {selectedMember.currentLeave && (
                    <div className="detail-section">
                      <h4>{t('team_overview.current_leave')}</h4>
                      <div className="current-leave-details">
                        <div className="leave-info-item">
                          <span className="leave-label">Type:</span>
                          <span className="leave-value">
                            {getLeaveTypeName(selectedMember.currentLeave.leaveType)}
                          </span>
                        </div>
                        <div className="leave-info-item">
                          <span className="leave-label">Dates:</span>
                          <span className="leave-value">
                            {new Date(selectedMember.currentLeave.startDate).toLocaleDateString()} - {new Date(selectedMember.currentLeave.endDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="leave-info-item">
                          <span className="leave-label">Duration:</span>
                          <span className="leave-value">
                            {selectedMember.currentLeave.days} days
                          </span>
                        </div>
                        {selectedMember.currentLeave.reason && (
                          <div className="leave-info-item">
                            <span className="leave-label">Reason:</span>
                            <span className="leave-value reason">
                              {selectedMember.currentLeave.reason}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {selectedMember.upcomingLeaves && selectedMember.upcomingLeaves.length > 0 && (
                    <div className="detail-section">
                      <h4>{t('team_overview.upcoming_leaves')}</h4>
                      <div className="upcoming-leaves-list">
                        {selectedMember.upcomingLeaves.map(leave => (
                          <div key={leave.id} className="upcoming-leave-item">
                            <div className="leave-header">
                              <span className="leave-type">{getLeaveTypeName(leave.leaveType)}</span>
                              <span className="leave-days">{leave.days} {t('dashboard.days')}</span>
                            </div>
                            <div className="leave-dates">
                              {new Date(leave.startDate).toLocaleDateString()} - {new Date(leave.endDate).toLocaleDateString()}
                            </div>
                            {leave.reason && (
                              <div className="leave-reason">
                                {leave.reason}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <button
                className="close-modal-btn"
                onClick={() => {
                  setShowMemberDetails(false);
                  setSelectedMember(null);
                }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamOverview;
