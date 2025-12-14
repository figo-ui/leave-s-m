// components/TeamOverview.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import { User, Leave, LeaveBalance } from '../../types';
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
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date }>({
    start: new Date(),
    end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
  });

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
        setError(response.message || 'Failed to load team members');
      }
    } catch (error: any) {
      console.error('Error loading team members:', error);
      setError(error.message || 'Failed to load team members');
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
    const today = new Date();
    
    const stats: TeamStats = {
      totalMembers: members.length,
      onLeaveToday: members.filter(m => m.currentLeave).length,
      upcomingLeaves: members.reduce((total, m) => total + (m.upcomingLeaves?.length || 0), 0),
      averageLeaveDays: members.length > 0 
        ? members.reduce((sum, m) => sum + (m.totalLeavesTaken || 0), 0) / members.length
        : 0,
      departmentBreakdown: members.reduce((acc, m) => {
        acc[m.department] = (acc[m.department] || 0) + 1;
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
    return Array.from(new Set(teamMembers.map(m => m.department))).sort();
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
          ⏸️ On Leave
        </span>
      );
    }

    if (member.upcomingLeaves && member.upcomingLeaves.length > 0) {
      return (
        <span className="status-badge upcoming-leave">
          📅 Upcoming Leave
        </span>
      );
    }

    return (
      <span className="status-badge available">
        ✅ Available
      </span>
    );
  };

  // Get days until next leave
  const getDaysUntilLeave = (member: TeamMember): string => {
    if (!member.upcomingLeaves || member.upcomingLeaves.length === 0) return 'No upcoming leave';
    
    const nextLeave = member.upcomingLeaves[0];
    const leaveDate = new Date(nextLeave.startDate);
    const today = new Date();
    const daysUntil = Math.ceil((leaveDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    return `${daysUntil} day${daysUntil !== 1 ? 's' : ''} until leave`;
  };

  // Handle approve/reject leave
  const handleLeaveAction = async (leaveId: number, action: 'approve' | 'reject', notes?: string) => {
    try {
      setError('');
      
      const response = action === 'approve' 
        ? await apiService.approveLeave(leaveId, notes)
        : await apiService.rejectLeave(leaveId, notes);
      
      if (response.success) {
        // Refresh team data
        await loadTeamMembers();
        if (selectedMember) {
          // Update selected member if they're the one we acted on
          const updatedMember = teamMembers.find(m => 
            m.upcomingLeaves?.some(l => l.id === leaveId) || 
            m.currentLeave?.id === leaveId
          );
          if (updatedMember) setSelectedMember(updatedMember);
        }
      } else {
        setError(response.message || `Failed to ${action} leave`);
      }
    } catch (error: any) {
      console.error(`Error ${action}ing leave:`, error);
      setError(error.message || `Failed to ${action} leave`);
    }
  };

  // Render loading state
  if (loading) {
    return (
      <div className="team-overview">
        <div className="page-header">
          <h1>Team Overview</h1>
          <p>Loading team information...</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading your team...</p>
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
              {teamMembers.length} team member{teamMembers.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="header-actions">
            <button 
              className="refresh-btn"
              onClick={loadTeamMembers}
              title="Refresh team data"
            >
              🔄 Refresh
            </button>
            <div className="view-toggle">
              <button 
                className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
              >
                🟦 Grid
              </button>
              <button 
                className={`view-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
              >
                📋 Table
              </button>
              <button 
                className={`view-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                onClick={() => setViewMode('calendar')}
              >
                📅 Calendar
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
                <div className="stat-label">Total Members</div>
              </div>
            </div>
            
            <div className="stat-card warning">
              <div className="stat-icon">⏸️</div>
              <div className="stat-info">
                <div className="stat-value">{stats.onLeaveToday}</div>
                <div className="stat-label">On Leave Today</div>
              </div>
            </div>
            
            <div className="stat-card info">
              <div className="stat-icon">📅</div>
              <div className="stat-info">
                <div className="stat-value">{stats.upcomingLeaves}</div>
                <div className="stat-label">Upcoming Leaves</div>
              </div>
            </div>
            
            <div className="stat-card success">
              <div className="stat-icon">📊</div>
              <div className="stat-info">
                <div className="stat-value">{stats.averageLeaveDays.toFixed(1)}</div>
                <div className="stat-label">Avg Leave Days</div>
              </div>
            </div>
          </div>

          {/* Department Breakdown */}
          <div className="department-breakdown">
            <h3>Department Distribution</h3>
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
            placeholder="Search team members by name, email, or position..."
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
            <option value="available">Available</option>
            <option value="onLeave">On Leave</option>
          </select>

          <select 
            value={filterDepartment} 
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="results-info">
        Showing {filteredMembers.length} of {teamMembers.length} team members
        {(searchTerm || filterStatus !== 'all' || filterDepartment !== 'all') && ' (filtered)'}
      </div>

      {/* Team Members Display */}
      {filteredMembers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>No Team Members Found</h3>
          <p>
            {searchTerm || filterStatus !== 'all' || filterDepartment !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'No team members are assigned to you yet.'}
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
                      <span className="leave-label">No upcoming leave</span>
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
                <th>Position</th>
                <th>Department</th>
                <th>Status</th>
                <th>Next Leave</th>
                <th>Leave Balance</th>
                <th>Actions</th>
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
                        {member.leaveBalance[0].remainingDays} days left
                      </div>
                    ) : 'N/A'}
                  </td>
                  <td>
                    <div className="table-actions">
                      <button 
                        className="action-btn view-btn"
                        onClick={() => handleMemberClick(member)}
                      >
                        View Details
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
              <h2>Team Member Details</h2>
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
                    <h4>Leave Information</h4>
                    {selectedMember.leaveBalance && selectedMember.leaveBalance.length > 0 ? (
                      <div className="leave-balances">
                        <h5>Leave Balances</h5>
                        <div className="balance-grid">
                          {selectedMember.leaveBalance.map(balance => (
                            <div key={balance.leaveTypeId} className="balance-item">
                              <span className="balance-type">{balance.leaveType?.name}:</span>
                              <span className="balance-days">
                                {balance.remainingDays} / {balance.totalDays} days
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p>No leave balance information available.</p>
                    )}
                  </div>
                  
                  {selectedMember.currentLeave && (
                    <div className="detail-section">
                      <h4>Current Leave</h4>
                      <div className="current-leave-details">
                        <div className="leave-info-item">
                          <span className="leave-label">Type:</span>
                          <span className="leave-value">
                            {selectedMember.currentLeave.leaveType?.name}
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
                      <h4>Upcoming Leaves</h4>
                      <div className="upcoming-leaves-list">
                        {selectedMember.upcomingLeaves.map(leave => (
                          <div key={leave.id} className="upcoming-leave-item">
                            <div className="leave-header">
                              <span className="leave-type">{leave.leaveType?.name}</span>
                              <span className="leave-days">{leave.days} days</span>
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
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamOverview;