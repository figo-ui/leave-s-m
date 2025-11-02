import React, { useState, useEffect } from 'react';
import { LeaveService } from '../../utils/leaveService';
import { useAuth } from '../../contexts/AuthContext';
import './LeaveHistory.css';

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
  managerNotes?: string;
  hrNotes?: string;
}

const LeaveHistory: React.FC = () => {
  const { user } = useAuth();
  const [leaveHistory, setLeaveHistory] = useState<LeaveApplication[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeave, setSelectedLeave] = useState<LeaveApplication | null>(null);

  useEffect(() => {
    fetchLeaveHistory();
  }, []);

  useEffect(() => {
    filterHistory();
  }, [leaveHistory, filterStatus, searchTerm]);

  const fetchLeaveHistory = () => {
    setLoading(true);
    try {
      const employeeId = user?.id || '';
      
      // Get applications using available methods
      let applications: LeaveApplication[] = [];
      
      if (typeof LeaveService.getApplicationsByEmployee === 'function') {
        applications = LeaveService.getApplicationsByEmployee(employeeId);
      } else if (typeof LeaveService.getEmployeeApplications === 'function') {
        applications = LeaveService.getEmployeeApplications(employeeId);
      } else if (typeof LeaveService.getAllApplications === 'function') {
        const allApps = LeaveService.getAllApplications();
        applications = allApps.filter((app: LeaveApplication) => app.employeeId === employeeId);
      }
      
      // Sort by applied date (newest first)
      applications.sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());
      
      setLeaveHistory(applications);
      
    } catch (error) {
      console.error('Error fetching leave history:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterHistory = () => {
    let filtered = leaveHistory;

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(leave => leave.status === filterStatus);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(leave =>
        leave.leaveType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leave.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leave.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredHistory(filtered);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { class: string; label: string } } = {
      pending: { class: 'status-pending', label: 'Pending' },
      approved: { class: 'status-approved', label: 'Approved' },
      rejected: { class: 'status-rejected', label: 'Rejected' },
      hr_pending: { class: 'status-hr-pending', label: 'HR Review' },
      hr_approved: { class: 'status-approved', label: 'Approved' },
      hr_rejected: { class: 'status-rejected', label: 'Rejected' }
    };
    
    const config = statusConfig[status];
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusCounts = () => {
    return {
      all: leaveHistory.length,
      pending: leaveHistory.filter(leave => leave.status.includes('pending')).length,
      approved: leaveHistory.filter(leave => leave.status.includes('approved')).length,
      rejected: leaveHistory.filter(leave => leave.status.includes('rejected')).length,
    };
  };

  const getUpcomingLeaves = () => {
    const today = new Date().toISOString().split('T')[0];
    return leaveHistory
      .filter(leave => leave.status.includes('approved') && leave.startDate >= today)
      .slice(0, 3);
  };

  const statusCounts = getStatusCounts();
  const upcomingLeaves = getUpcomingLeaves();
  const employee = LeaveService.getEmployee(user?.id || '');

  return (
    <div className="leave-history">
      <div className="page-header">
        <div className="header-content">
          <h2>My Leave History</h2>
          <p className="page-subtitle">Track and manage your leave applications</p>
        </div>
        <button onClick={fetchLeaveHistory} className="refresh-button">
          🔄 Refresh
        </button>
      </div>

      {/* Leave Balance */}
      <div className="leave-balance-section">
        <h3>Leave Balance</h3>
        <div className="balance-cards">
          <div className="balance-card sick">
            <div className="balance-icon">🏥</div>
            <div className="balance-info">
              <span className="balance-type">Sick Leave</span>
              <span className="balance-days">{employee?.leaveBalance?.sick || 10} days</span>
            </div>
          </div>
          <div className="balance-card vacation">
            <div className="balance-icon">🏖️</div>
            <div className="balance-info">
              <span className="balance-type">Vacation</span>
              <span className="balance-days">{employee?.leaveBalance?.vacation || 18} days</span>
            </div>
          </div>
          <div className="balance-card personal">
            <div className="balance-icon">👤</div>
            <div className="balance-info">
              <span className="balance-type">Personal Leave</span>
              <span className="balance-days">{employee?.leaveBalance?.personal || 5} days</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-info">
            <div className="stat-number">{statusCounts.all}</div>
            <div className="stat-label">Total Applications</div>
          </div>
        </div>
        <div className="stat-card approved">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-number">{statusCounts.approved}</div>
            <div className="stat-label">Approved</div>
          </div>
        </div>
        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <div className="stat-number">{statusCounts.pending}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-icon">❌</div>
          <div className="stat-info">
            <div className="stat-number">{statusCounts.rejected}</div>
            <div className="stat-label">Rejected</div>
          </div>
        </div>
      </div>

      {/* Upcoming Leaves */}
      {upcomingLeaves.length > 0 && (
        <div className="upcoming-leaves-section">
          <h3>📅 Upcoming Approved Leaves</h3>
          <div className="upcoming-cards">
            {upcomingLeaves.map((leave, index) => (
              <div key={leave.id || index} className="upcoming-card">
                <div className="upcoming-type">{leave.leaveType}</div>
                <div className="upcoming-dates">
                  {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                </div>
                <div className="upcoming-days">{leave.days} days</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search by leave type, reason, or status..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="filter-group">
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="status-filter"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="hr_pending">HR Review</option>
          </select>
        </div>
      </div>

      {/* Status Filter Buttons */}
      <div className="filter-buttons">
        <button 
          className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
        >
          All ({statusCounts.all})
        </button>
        <button 
          className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
          onClick={() => setFilterStatus('pending')}
        >
          Pending ({statusCounts.pending})
        </button>
        <button 
          className={`filter-btn ${filterStatus === 'approved' ? 'active' : ''}`}
          onClick={() => setFilterStatus('approved')}
        >
          Approved ({statusCounts.approved})
        </button>
        <button 
          className={`filter-btn ${filterStatus === 'rejected' ? 'active' : ''}`}
          onClick={() => setFilterStatus('rejected')}
        >
          Rejected ({statusCounts.rejected})
        </button>
      </div>

      {/* Leave History Table */}
      <div className="history-table-container">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading your leave history...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No leave applications found</h3>
            <p>
              {filterStatus === 'all' 
                ? "You haven't applied for any leave yet. Start by applying for a new leave."
                : `No ${filterStatus} leave applications found.`
              }
            </p>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Leave Type</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Duration</th>
                <th>Applied Date</th>
                <th>Status</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map(leave => (
                <tr key={leave.id} className="history-row">
                  <td className="leave-type">
                    <span className="leave-type-badge">{leave.leaveType}</span>
                  </td>
                  <td>{formatDate(leave.startDate)}</td>
                  <td>{formatDate(leave.endDate)}</td>
                  <td className="days-count">{leave.days} day{leave.days !== 1 ? 's' : ''}</td>
                  <td>{formatDate(leave.appliedDate)}</td>
                  <td>{getStatusBadge(leave.status)}</td>
                  <td className="reason-cell" title={leave.reason}>
                    {leave.reason.length > 50 ? `${leave.reason.substring(0, 50)}...` : leave.reason}
                  </td>
                  <td>
                    <button 
                      className="btn-view-details"
                      onClick={() => setSelectedLeave(leave)}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Leave Details Modal */}
      {selectedLeave && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Leave Application Details</h2>
              <button className="close-btn" onClick={() => setSelectedLeave(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>Leave Type:</strong> {selectedLeave.leaveType}
                </div>
                <div className="detail-item">
                  <strong>Start Date:</strong> {formatDate(selectedLeave.startDate)}
                </div>
                <div className="detail-item">
                  <strong>End Date:</strong> {formatDate(selectedLeave.endDate)}
                </div>
                <div className="detail-item">
                  <strong>Duration:</strong> {selectedLeave.days} days
                </div>
                <div className="detail-item">
                  <strong>Applied Date:</strong> {formatDate(selectedLeave.appliedDate)}
                </div>
                <div className="detail-item">
                  <strong>Status:</strong> {getStatusBadge(selectedLeave.status)}
                </div>
                <div className="detail-item full-width">
                  <strong>Reason:</strong> 
                  <div className="reason-text">{selectedLeave.reason}</div>
                </div>
                {selectedLeave.managerNotes && (
                  <div className="detail-item full-width">
                    <strong>Manager's Notes:</strong> 
                    <div className="notes-text">{selectedLeave.managerNotes}</div>
                  </div>
                )}
                {selectedLeave.hrNotes && (
                  <div className="detail-item full-width">
                    <strong>HR Notes:</strong> 
                    <div className="notes-text">{selectedLeave.hrNotes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveHistory;