import React, { useState, useEffect } from 'react';
import { LeaveService } from '../../utils/leaveService';
import { useAuth } from '../../contexts/AuthContext';
import './ApprovalsHistory.css';

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
  managerApprovedDate?: string;
}

const ApprovalsHistory: React.FC = () => {
  const { user } = useAuth();
  const [approvalHistory, setApprovalHistory] = useState<LeaveApplication[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<LeaveApplication[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchApprovalHistory();
  }, []);

  useEffect(() => {
    filterHistory();
  }, [approvalHistory, filterStatus, searchTerm]);

  const fetchApprovalHistory = () => {
    setLoading(true);
    const managerDepartment = user?.department || '';
    const applications = LeaveService.getManagerApprovalHistory(managerDepartment);
    setApprovalHistory(applications);
    setLoading(false);
  };

  const filterHistory = () => {
    let filtered = approvalHistory;

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(leave => leave.status === filterStatus);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(leave =>
        leave.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        leave.leaveType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredHistory(filtered);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { class: string; label: string } } = {
      pending: { class: 'status-pending', label: 'Pending' },
      approved: { class: 'status-approved', label: 'Approved' },
      rejected: { class: 'status-rejected', label: 'Rejected' },
      hr_pending: { class: 'status-pending', label: 'HR Review' },
      hr_approved: { class: 'status-approved', label: 'HR Approved' },
      hr_rejected: { class: 'status-rejected', label: 'HR Rejected' }
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
      all: approvalHistory.length,
      pending: approvalHistory.filter(leave => leave.status === 'pending').length,
      approved: approvalHistory.filter(leave => leave.status === 'approved').length,
      rejected: approvalHistory.filter(leave => leave.status === 'rejected').length,
      hr_pending: approvalHistory.filter(leave => leave.status === 'hr_pending').length,
    };
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="approvals-history">
      <div className="page-header">
        <h2>My Approval History</h2>
        <p>Leave applications you have reviewed from your department</p>
        <button onClick={fetchApprovalHistory} className="refresh-button">
          🔄 Refresh
        </button>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat-card">
          <div className="stat-number">{statusCounts.all}</div>
          <div className="stat-label">Total Reviewed</div>
        </div>
        <div className="stat-card approved">
          <div className="stat-number">{statusCounts.approved}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-number">{statusCounts.rejected}</div>
          <div className="stat-label">Rejected</div>
        </div>
        <div className="stat-card pending">
          <div className="stat-number">{statusCounts.hr_pending}</div>
          <div className="stat-label">With HR</div>
        </div>
      </div>

      {/* Filters Section */}
      <div className="filters-section">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Search by employee or leave type..."
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
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="hr_pending">With HR</option>
          </select>
        </div>
      </div>

      {/* Approval History Table */}
      <div className="history-table-container">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading approval history...</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No approval history found</h3>
            <p>You haven't reviewed any leave applications yet.</p>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Leave Type</th>
                <th>Leave Period</th>
                <th>Duration</th>
                <th>Applied Date</th>
                <th>Status</th>
                <th>Your Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map(leave => (
                <tr key={leave.id} className="history-row">
                  <td>
                    <div className="employee-info">
                      <div className="employee-name">{leave.employeeName}</div>
                      <div className="employee-id">ID: {leave.employeeId}</div>
                    </div>
                  </td>
                  <td className="leave-type">{leave.leaveType}</td>
                  <td>
                    <div className="date-range">
                      <div>{formatDate(leave.startDate)}</div>
                      <div>to {formatDate(leave.endDate)}</div>
                    </div>
                  </td>
                  <td className="days">{leave.days} days</td>
                  <td>{formatDate(leave.appliedDate)}</td>
                  <td>{getStatusBadge(leave.status)}</td>
                  <td className="notes-cell">
                    {leave.managerNotes || 'No notes provided'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ApprovalsHistory;