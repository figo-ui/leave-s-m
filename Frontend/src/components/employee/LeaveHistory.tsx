import React, { useState, useEffect } from 'react';
import { apiService } from '../../utils/api';
import { LeaveApplication, LeaveBalance } from '../../types';
import './LeaveHistory.css';


const LeaveHistory: React.FC = () => {

  const [leaveHistory, setLeaveHistory] = useState<LeaveApplication[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<LeaveApplication[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLeave, setSelectedLeave] = useState<LeaveApplication | null>(null);

  useEffect(() => {
    fetchLeaveHistory();
    fetchLeaveBalances();
  }, []);

  useEffect(() => {
    filterHistory();
  }, [leaveHistory, filterStatus, searchTerm]);

  const fetchLeaveHistory = async () => {
    setLoading(true);
    try {
      const response = await apiService.get<LeaveApplication[]>('/leaves/history');
      if (response.success) {
        const applications = response.data || [];
        // Sort by applied date (newest first)
        applications.sort((a, b) => new Date(b.appliedDate).getTime() - new Date(a.appliedDate).getTime());
        setLeaveHistory(applications);
      } else {
        console.error('Failed to fetch leave history:', response.message);
      }
    } catch (error) {
      console.error('Error fetching leave history:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveBalances = async () => {
    try {
      // Get balances from dashboard stats
      const response = await apiService.get<any>('/dashboard/stats');
      if (response.success && response.data.leaveBalance) {
        setLeaveBalances(response.data.leaveBalance);
      }
    } catch (error) {
      console.error('Error fetching leave balances:', error);
    }
  };

  const filterHistory = () => {
    let filtered = leaveHistory;

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(leave => {
        switch (filterStatus) {
          case 'pending':
            return leave.status.includes('PENDING');
          case 'approved':
            return leave.status.includes('APPROVED');
          case 'rejected':
            return leave.status.includes('REJECTED');
          default:
            return true;
        }
      });
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(leave =>
        leave.leaveType.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leave.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leave.status.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredHistory(filtered);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { class: string; label: string } } = {
      PENDING_MANAGER: { class: 'status-pending', label: 'Pending Manager' },
      PENDING_HR: { class: 'status-hr-pending', label: 'Pending HR' },
      APPROVED: { class: 'status-approved', label: 'Approved' },
      REJECTED: { class: 'status-rejected', label: 'Rejected' },
      HR_APPROVED: { class: 'status-approved', label: 'HR Approved' },
      HR_REJECTED: { class: 'status-rejected', label: 'HR Rejected' },
      CANCELLED: { class: 'status-rejected', label: 'Cancelled' }
    };
    
    const config = statusConfig[status] || { class: 'status-pending', label: status };
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
      pending: leaveHistory.filter(leave => leave.status.includes('PENDING')).length,
      approved: leaveHistory.filter(leave => leave.status.includes('APPROVED')).length,
      rejected: leaveHistory.filter(leave => leave.status.includes('REJECTED')).length,
    };
  };

  const getUpcomingLeaves = () => {
    const today = new Date().toISOString().split('T')[0];
    return leaveHistory
      .filter(leave => leave.status.includes('APPROVED') && leave.startDate >= today)
      .slice(0, 3);
  };

  const getLeaveBalanceByType = (type: string) => {
    const balance = leaveBalances.find(b => b.type.toLowerCase().includes(type.toLowerCase()));
    return balance || { used: 0, total: 0, remaining: 0 };
  };

  const statusCounts = getStatusCounts();
  const upcomingLeaves = getUpcomingLeaves();

  // Default leave types with fallback values
  const defaultLeaveTypes = [
    { type: 'Annual', icon: '🏖️', used: 0, total: 18, remaining: 18 },
    { type: 'Sick', icon: '🏥', used: 0, total: 10, remaining: 10 },
    { type: 'Personal', icon: '👤', used: 0, total: 5, remaining: 5 }
  ];

  return (
    <div className="leave-history">
      <div className="page-header">
        <div className="header-content">
          <h2>My Leave History</h2>
          <p className="page-subtitle">Track and manage your leave applications</p>
        </div>
        <button onClick={fetchLeaveHistory} className="refresh-button" disabled={loading}>
          {loading ? '🔄 Loading...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Leave Balance */}
      <div className="leave-balance-section">
        <h3>Leave Balance</h3>
        <div className="balance-cards">
          {defaultLeaveTypes.map((leaveType, index) => {
            const balance = getLeaveBalanceByType(leaveType.type);
            return (
              <div key={index} className={`balance-card ${leaveType.type.toLowerCase()}`}>
                <div className="balance-icon">{leaveType.icon}</div>
                <div className="balance-info">
                  <span className="balance-type">{leaveType.type} Leave</span>
                  <span className="balance-days">
                    {balance.remaining || leaveType.remaining} days remaining
                  </span>
                  <span className="balance-used">
                    {balance.used || leaveType.used}/{balance.total || leaveType.total} days used
                  </span>
                </div>
              </div>
            );
          })}
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
                <div className="upcoming-type" style={{ color: leave.leaveType.color }}>
                  {leave.leaveType.name}
                </div>
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
            disabled={loading}
          />
        </div>

        <div className="filter-group">
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value)}
            className="status-filter"
            disabled={loading}
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {/* Status Filter Buttons */}
      <div className="filter-buttons">
        <button 
          className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
          onClick={() => setFilterStatus('all')}
          disabled={loading}
        >
          All ({statusCounts.all})
        </button>
        <button 
          className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
          onClick={() => setFilterStatus('pending')}
          disabled={loading}
        >
          Pending ({statusCounts.pending})
        </button>
        <button 
          className={`filter-btn ${filterStatus === 'approved' ? 'active' : ''}`}
          onClick={() => setFilterStatus('approved')}
          disabled={loading}
        >
          Approved ({statusCounts.approved})
        </button>
        <button 
          className={`filter-btn ${filterStatus === 'rejected' ? 'active' : ''}`}
          onClick={() => setFilterStatus('rejected')}
          disabled={loading}
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
                    <span 
                      className="leave-type-badge"
                      style={{ color: leave.leaveType.color }}
                    >
                      {leave.leaveType.name}
                    </span>
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
                      disabled={loading}
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
                  <strong>Leave Type:</strong> 
                  <span style={{ color: selectedLeave.leaveType.color }}>
                    {selectedLeave.leaveType.name}
                  </span>
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
                {selectedLeave.managerApprovedDate && (
                  <div className="detail-item">
                    <strong>Manager Approved:</strong> {formatDate(selectedLeave.managerApprovedDate)}
                  </div>
                )}
                {selectedLeave.hrApprovedDate && (
                  <div className="detail-item">
                    <strong>HR Approved:</strong> {formatDate(selectedLeave.hrApprovedDate)}
                  </div>
                )}
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