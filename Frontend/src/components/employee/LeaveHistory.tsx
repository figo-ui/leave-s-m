import React, { useState, useEffect } from 'react';
import { apiService } from '../../utils/api';
import type{ LeaveApplication, LeaveBalance } from '../../types';
import { useTranslation } from 'react-i18next';
import './LeaveHistory.css';


const LeaveHistory: React.FC = () => {
  const { t, i18n } = useTranslation();

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
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(leave => {
        const leaveTypeName = typeof leave.leaveType === 'string'
          ? leave.leaveType
          : leave.leaveType?.name || '';
        const reason = leave.reason || '';
        return (
          leaveTypeName.toLowerCase().includes(term) ||
          reason.toLowerCase().includes(term) ||
          leave.status.toLowerCase().includes(term)
        );
      });
    }

    setFilteredHistory(filtered);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: { [key: string]: { class: string; label: string } } = {
      PENDING_MANAGER: { class: 'status-pending', label: t('status.pending_manager') },
      PENDING_HR: { class: 'status-hr-pending', label: t('status.pending_hr') },
      APPROVED: { class: 'status-approved', label: t('status.approved') },
      REJECTED: { class: 'status-rejected', label: t('status.rejected') },
      HR_APPROVED: { class: 'status-approved', label: t('status.hr_approved') },
      HR_REJECTED: { class: 'status-rejected', label: t('leave_history.hr_rejected') },
      CANCELLED: { class: 'status-rejected', label: t('status.cancelled') }
    };
    
    const config = statusConfig[status] || { class: 'status-pending', label: status };
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
  };

  const formatDate = (dateString: string) => {
    const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'om-ET' };
    const locale = localeMap[i18n.language] || 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
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

  const getLeaveTypeName = (leaveType?: string | { name?: string }) => {
    if (!leaveType) return t('leave_history.unknown');
    if (typeof leaveType === 'string') return leaveType;
    return leaveType.name || t('leave_history.unknown');
  };

  const getLeaveTypeColor = (leaveType?: string | { color?: string }) => {
    if (!leaveType || typeof leaveType === 'string') return '#667eea';
    return leaveType.color || '#667eea';
  };

  const statusCounts = getStatusCounts();
  const upcomingLeaves = getUpcomingLeaves();

  // Default leave types with fallback values
  const defaultLeaveTypes = [
    { type: t('leave_history.type_annual'), icon: '🏖️', used: 0, total: 18, remaining: 18 },
    { type: t('leave_history.type_sick'), icon: '🏥', used: 0, total: 10, remaining: 10 },
    { type: t('leave_history.type_personal'), icon: '👤', used: 0, total: 5, remaining: 5 }
  ];

  return (
    <div className="leave-history">
      <div className="page-header">
        <div className="header-content">
          <h2>{t('leave_history.title')}</h2>
          <p className="page-subtitle">{t('leave_history.subtitle')}</p>
        </div>
        <button onClick={fetchLeaveHistory} className="refresh-button" disabled={loading}>
          {loading ? `🔄 ${t('common.loading')}` : `🔄 ${t('dashboard.refresh')}`}
        </button>
      </div>

      {/* Leave Balance */}
      <div className="leave-balance-section">
        <h3>{t('dashboard.leave_balance')}</h3>
        <div className="balance-cards">
          {defaultLeaveTypes.map((leaveType, index) => {
            const balance = getLeaveBalanceByType(leaveType.type);
            return (
              <div key={index} className={`balance-card ${leaveType.type.toLowerCase()}`}>
                <div className="balance-icon">{leaveType.icon}</div>
                <div className="balance-info">
                  <span className="balance-type">{leaveType.type} {t('leave_history.leave')}</span>
                  <span className="balance-days">
                    {balance.remaining || leaveType.remaining} {t('dashboard.days')} {t('leave_history.remaining')}
                  </span>
                  <span className="balance-used">
                    {balance.used || leaveType.used}/{balance.total || leaveType.total} {t('dashboard.days')} {t('leave_history.used')}
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
            <div className="stat-label">{t('leave_history.total_applications')}</div>
          </div>
        </div>
        <div className="stat-card approved">
          <div className="stat-icon">✅</div>
          <div className="stat-info">
            <div className="stat-number">{statusCounts.approved}</div>
            <div className="stat-label">{t('status.approved')}</div>
          </div>
        </div>
        <div className="stat-card pending">
          <div className="stat-icon">⏳</div>
          <div className="stat-info">
            <div className="stat-number">{statusCounts.pending}</div>
            <div className="stat-label">{t('dashboard.stats.pending')}</div>
          </div>
        </div>
        <div className="stat-card rejected">
          <div className="stat-icon">❌</div>
          <div className="stat-info">
            <div className="stat-number">{statusCounts.rejected}</div>
            <div className="stat-label">{t('status.rejected')}</div>
          </div>
        </div>
      </div>

      {/* Upcoming Leaves */}
      {upcomingLeaves.length > 0 && (
        <div className="upcoming-leaves-section">
          <h3>{t('leave_history.upcoming')}</h3>
          <div className="upcoming-cards">
            {upcomingLeaves.map((leave, index) => (
              <div key={leave.id || index} className="upcoming-card">
                <div className="upcoming-type" style={{ color: getLeaveTypeColor(leave.leaveType) }}>
                  {getLeaveTypeName(leave.leaveType)}
                </div>
                <div className="upcoming-dates">
                  {formatDate(leave.startDate)} - {formatDate(leave.endDate)}
                </div>
                <div className="upcoming-days">{leave.days} {t('dashboard.days')}</div>
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
            placeholder={t('leave_history.search_placeholder')}
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
            <option value="all">{t('leave_history.all_status')}</option>
            <option value="pending">{t('dashboard.filters.pending')}</option>
            <option value="approved">{t('dashboard.filters.approved')}</option>
            <option value="rejected">{t('dashboard.filters.rejected')}</option>
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
          {t('dashboard.filters.all')} ({statusCounts.all})
        </button>
        <button 
          className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
          onClick={() => setFilterStatus('pending')}
          disabled={loading}
        >
          {t('dashboard.filters.pending')} ({statusCounts.pending})
        </button>
        <button 
          className={`filter-btn ${filterStatus === 'approved' ? 'active' : ''}`}
          onClick={() => setFilterStatus('approved')}
          disabled={loading}
        >
          {t('dashboard.filters.approved')} ({statusCounts.approved})
        </button>
        <button 
          className={`filter-btn ${filterStatus === 'rejected' ? 'active' : ''}`}
          onClick={() => setFilterStatus('rejected')}
          disabled={loading}
        >
          {t('dashboard.filters.rejected')} ({statusCounts.rejected})
        </button>
      </div>

      {/* Leave History Table */}
      <div className="history-table-container">
        {loading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>{t('leave_history.loading')}</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>{t('leave_history.empty_title')}</h3>
            <p>
              {filterStatus === 'all' 
                ? t('leave_history.empty_all')
                : t('leave_history.empty_filtered', { status: filterStatus })
              }
            </p>
          </div>
        ) : (
          <table className="history-table">
            <thead>
              <tr>
                <th>{t('leave_history.columns.leave_type')}</th>
                <th>{t('leave_history.columns.start_date')}</th>
                <th>{t('leave_history.columns.end_date')}</th>
                <th>{t('leave_history.columns.duration')}</th>
                <th>{t('leave_history.columns.applied_date')}</th>
                <th>{t('leave_history.columns.status')}</th>
                <th>{t('leave_history.columns.reason')}</th>
                <th>{t('leave_history.columns.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.map(leave => (
                <tr key={leave.id} className="history-row">
                  <td className="leave-type">
                    <span 
                      className="leave-type-badge"
                      style={{ color: getLeaveTypeColor(leave.leaveType) }}
                    >
                      {getLeaveTypeName(leave.leaveType)}
                    </span>
                  </td>
                  <td>{formatDate(leave.startDate)}</td>
                  <td>{formatDate(leave.endDate)}</td>
                  <td className="days-count">{leave.days} {t('dashboard.days')}</td>
                  <td>{formatDate(leave.appliedDate)}</td>
                  <td>{getStatusBadge(leave.status)}</td>
                  <td className="reason-cell" title={leave.reason || ''}>
                    {(leave.reason || '').length > 50
                      ? `${(leave.reason || '').substring(0, 50)}...`
                      : (leave.reason || '')}
                  </td>
                  <td>
                    <button 
                      className="btn-view-details"
                      onClick={() => setSelectedLeave(leave)}
                      disabled={loading}
                    >
                      {t('leave_history.view_details')}
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
              <h2>{t('leave_history.details_title')}</h2>
              <button className="close-btn" onClick={() => setSelectedLeave(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <strong>{t('leave_history.columns.leave_type')}:</strong> 
                  <span style={{ color: getLeaveTypeColor(selectedLeave.leaveType) }}>
                    {getLeaveTypeName(selectedLeave.leaveType)}
                  </span>
                </div>
                <div className="detail-item">
                  <strong>{t('leave_history.columns.start_date')}:</strong> {formatDate(selectedLeave.startDate)}
                </div>
                <div className="detail-item">
                  <strong>{t('leave_history.columns.end_date')}:</strong> {formatDate(selectedLeave.endDate)}
                </div>
                <div className="detail-item">
                  <strong>{t('leave_history.columns.duration')}:</strong> {selectedLeave.days} {t('dashboard.days')}
                </div>
                <div className="detail-item">
                  <strong>{t('leave_history.columns.applied_date')}:</strong> {formatDate(selectedLeave.appliedDate)}
                </div>
                <div className="detail-item">
                  <strong>{t('leave_history.columns.status')}:</strong> {getStatusBadge(selectedLeave.status)}
                </div>
                {selectedLeave.managerApprovedDate && (
                  <div className="detail-item">
                    <strong>{t('leave_history.manager_approved')}:</strong> {formatDate(selectedLeave.managerApprovedDate)}
                  </div>
                )}
                {selectedLeave.hrApprovedDate && (
                  <div className="detail-item">
                    <strong>{t('leave_history.hr_approved')}:</strong> {formatDate(selectedLeave.hrApprovedDate)}
                  </div>
                )}
                <div className="detail-item full-width">
                  <strong>{t('leave_history.columns.reason')}:</strong> 
                  <div className="reason-text">{selectedLeave.reason || ''}</div>
                </div>
                {selectedLeave.managerNotes && (
                  <div className="detail-item full-width">
                    <strong>{t('leave_history.manager_notes')}:</strong> 
                    <div className="notes-text">{selectedLeave.managerNotes}</div>
                  </div>
                )}
                {selectedLeave.hrNotes && (
                  <div className="detail-item full-width">
                    <strong>{t('leave_history.hr_notes')}:</strong> 
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
