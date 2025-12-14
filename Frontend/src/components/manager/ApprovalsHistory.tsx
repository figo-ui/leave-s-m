import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import './ApprovalsHistory.css';

interface ApprovalHistory {
  id: number;
  employee: {
    name: string;
    email: string;
    department: string;
  };
  leaveType: {
    name: string;
  };
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  managerApprovedDate: string;
  managerNotes?: string;
  appliedDate: string;
}

const ApprovalsHistory: React.FC = () => {
  const { user } = useAuth();
  const [approvals, setApprovals] = useState<ApprovalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [dateRange, setDateRange] = useState<'all' | 'month' | 'quarter' | 'year'>('all');

  useEffect(() => {
    loadApprovalsHistory();
  }, []);

  const loadApprovalsHistory = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiService.getApprovalsHistory();
      if (response.success) {
        setApprovals(response.data || []);
      } else {
        setError(response.message || 'Failed to load approvals history');
      }
    } catch (error: any) {
      console.error('Error loading approvals history:', error);
      setError(error.message || 'Failed to load approvals history');
    } finally {
      setLoading(false);
    }
  };

  const filteredApprovals = approvals.filter(approval => {
    if (filter === 'approved') {
      return approval.status === 'APPROVED';
    } else if (filter === 'rejected') {
      return approval.status === 'REJECTED';
    }
    return true;
  });

  const getFilteredByDate = (approvalsList: ApprovalHistory[]) => {
    const now = new Date();
    let startDate: Date;

    switch (dateRange) {
      case 'month':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        return approvalsList;
    }

    return approvalsList.filter(approval => 
      new Date(approval.managerApprovedDate) >= startDate
    );
  };

  const finalApprovals = getFilteredByDate(filteredApprovals);

  const getStats = () => {
    const total = approvals.length;
    const approved = approvals.filter(a => a.status === 'APPROVED').length;
    const rejected = approvals.filter(a => a.status === 'REJECTED').length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return { total, approved, rejected, approvalRate };
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    if (status === 'APPROVED') {
      return <span className="status-badge approved">✅ Approved</span>;
    } else if (status === 'REJECTED') {
      return <span className="status-badge rejected">❌ Rejected</span>;
    }
    return <span className="status-badge pending">⏳ {status}</span>;
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="approvals-history">
        <div className="page-header">
          <h1>Approvals History</h1>
          <p>Track your leave request decisions and patterns</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading approvals history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="approvals-history">
        <div className="page-header">
          <h1>Approvals History</h1>
          <p>Track your leave request decisions and patterns</p>
        </div>
        <div className="error-state">
          <h3>Unable to Load History</h3>
          <p>{error}</p>
          <button onClick={loadApprovalsHistory} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="approvals-history">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>Approvals History</h1>
            <p>Track your leave request decisions and patterns</p>
          </div>
          <div className="header-actions">
            <button 
              className="refresh-btn" 
              onClick={loadApprovalsHistory} 
              disabled={loading}
            >
              🔄 Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon total">📋</div>
          <div className="stat-content">
            <div className="stat-number">{stats.total}</div>
            <div className="stat-label">Total Decisions</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon approved">✅</div>
          <div className="stat-content">
            <div className="stat-number">{stats.approved}</div>
            <div className="stat-label">Approved</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon rejected">❌</div>
          <div className="stat-content">
            <div className="stat-number">{stats.rejected}</div>
            <div className="stat-label">Rejected</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon rate">📈</div>
          <div className="stat-content">
            <div className="stat-number">{stats.approvalRate}%</div>
            <div className="stat-label">Approval Rate</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>Status Filter:</label>
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Decisions</option>
            <option value="approved">Approved Only</option>
            <option value="rejected">Rejected Only</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>Time Period:</label>
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>

        <div className="results-count">
          Showing {finalApprovals.length} of {approvals.length} decisions
        </div>
      </div>

      {/* Approvals List */}
      <div className="approvals-list">
        {finalApprovals.length === 0 ? (
          <div className="no-data">
            <div className="no-data-icon">📝</div>
            <h3>No Approval History</h3>
            <p>No leave request decisions found for the selected filters.</p>
          </div>
        ) : (
          finalApprovals.map((approval) => (
            <div key={approval.id} className="approval-card">
              <div className="approval-header">
                <div className="employee-info">
                  <div className="employee-avatar">
                    {approval.employee.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </div>
                  <div className="employee-details">
                    <h4>{approval.employee.name}</h4>
                    <p>{approval.employee.department}</p>
                    <span className="employee-email">{approval.employee.email}</span>
                  </div>
                </div>
                <div className="approval-meta">
                  {getStatusBadge(approval.status)}
                  <span className="decision-date">
                    Decided: {formatDateTime(approval.managerApprovedDate)}
                  </span>
                </div>
              </div>

              <div className="approval-details">
                <div className="leave-info">
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="label">Leave Type:</span>
                      <span className="value">{approval.leaveType.name}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Dates:</span>
                      <span className="value">
                        {formatDate(approval.startDate)} - {formatDate(approval.endDate)}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="label">Duration:</span>
                      <span className="value">{approval.days} days</span>
                    </div>
                    <div className="info-item">
                      <span className="label">Applied:</span>
                      <span className="value">{formatDate(approval.appliedDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="reason-section">
                  <span className="label">Reason:</span>
                  <p className="reason-text">{approval.reason}</p>
                </div>

                {approval.managerNotes && (
                  <div className="notes-section">
                    <span className="label">Your Notes:</span>
                    <p className="notes-text">{approval.managerNotes}</p>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ApprovalsHistory;