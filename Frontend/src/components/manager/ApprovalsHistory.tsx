import React, { useState, useEffect } from 'react';
import { apiService } from '../../utils/api';
import type { Leave } from '../../types';
import { useTranslation } from 'react-i18next';
import './ApprovalsHistory.css';

const ApprovalsHistory: React.FC = () => {
  const { t, i18n } = useTranslation();
  const [approvals, setApprovals] = useState<Leave[]>([]);
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
        setError(response.message || t('approvals_history.errors.load_failed'));
      }
    } catch (error: any) {
      console.error('Error loading approvals history:', error);
      setError(error.message || t('approvals_history.errors.load_failed'));
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

  const getFilteredByDate = (approvalsList: Leave[]) => {
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

    return approvalsList.filter(approval => {
      const decisionDate = approval.managerApprovedDate || approval.hrApprovedDate || approval.appliedDate;
      return decisionDate ? new Date(decisionDate) >= startDate : false;
    });
  };

  const finalApprovals = getFilteredByDate(filteredApprovals);

  const getStats = () => {
    const total = approvals.length;
    const approved = approvals.filter(a => a.status === 'APPROVED').length;
    const rejected = approvals.filter(a => a.status === 'REJECTED').length;
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

    return { total, approved, rejected, approvalRate };
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('hr_approvals.na');
    const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'om-ET' };
    const locale = localeMap[i18n.language] || 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return t('hr_approvals.na');
    const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'om-ET' };
    const locale = localeMap[i18n.language] || 'en-US';
    return new Date(dateString).toLocaleString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getLeaveTypeName = (leaveType?: string | { name?: string }) => {
    if (!leaveType) return t('leave_history.unknown');
    if (typeof leaveType === 'string') return leaveType;
    return leaveType.name || t('leave_history.unknown');
  };

  const getStatusBadge = (status: string) => {
    if (status === 'APPROVED') {
      return <span className="status-badge approved">✅ {t('status.approved')}</span>;
    } else if (status === 'REJECTED') {
      return <span className="status-badge rejected">❌ {t('status.rejected')}</span>;
    }
    return <span className="status-badge pending">⏳ {status}</span>;
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="approvals-history">
        <div className="page-header">
          <h1>Approvals History</h1>
          <p>{t('approvals_history.subtitle')}</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{t('approvals_history.loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="approvals-history">
        <div className="page-header">
          <h1>Approvals History</h1>
          <p>{t('approvals_history.subtitle')}</p>
        </div>
        <div className="error-state">
          <h3>{t('approvals_history.errors.unable')}</h3>
          <p>{error}</p>
          <button onClick={loadApprovalsHistory} className="retry-btn">
            {t('common.try_again')}
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
            <h1>{t('approvals_history.title')}</h1>
            <p>{t('approvals_history.subtitle')}</p>
          </div>
          <div className="header-actions">
            <button 
              className="refresh-btn" 
              onClick={loadApprovalsHistory} 
              disabled={loading}
            >
              🔄 {t('dashboard.refresh')}
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
            <div className="stat-label">{t('approvals_history.stats.total')}</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon approved">✅</div>
          <div className="stat-content">
            <div className="stat-number">{stats.approved}</div>
            <div className="stat-label">{t('status.approved')}</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon rejected">❌</div>
          <div className="stat-content">
            <div className="stat-number">{stats.rejected}</div>
            <div className="stat-label">{t('status.rejected')}</div>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon rate">📈</div>
          <div className="stat-content">
            <div className="stat-number">{stats.approvalRate}%</div>
            <div className="stat-label">{t('approvals_history.stats.rate')}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <div className="filter-group">
          <label>{t('approvals_history.filters.status')}</label>
          <select 
            value={filter} 
            onChange={(e) => setFilter(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">{t('approvals_history.filters.all')}</option>
            <option value="approved">{t('approvals_history.filters.approved')}</option>
            <option value="rejected">{t('approvals_history.filters.rejected')}</option>
          </select>
        </div>
        
        <div className="filter-group">
          <label>{t('approvals_history.filters.period')}</label>
          <select 
            value={dateRange} 
            onChange={(e) => setDateRange(e.target.value as any)}
            className="filter-select"
          >
            <option value="all">{t('approvals_history.filters.all_time')}</option>
            <option value="month">{t('approvals_history.filters.month')}</option>
            <option value="quarter">{t('approvals_history.filters.quarter')}</option>
            <option value="year">{t('approvals_history.filters.year')}</option>
          </select>
        </div>

        <div className="results-count">
          {t('approvals_history.showing', { shown: finalApprovals.length, total: approvals.length })}
        </div>
      </div>

      {/* Approvals List */}
      <div className="approvals-list">
        {finalApprovals.length === 0 ? (
          <div className="no-data">
            <div className="no-data-icon">📝</div>
            <h3>{t('approvals_history.empty_title')}</h3>
            <p>{t('approvals_history.empty_subtitle')}</p>
          </div>
        ) : (
          finalApprovals.map((approval) => (
            <div key={approval.id} className="approval-card">
              <div className="approval-header">
                <div className="employee-info">
                  <div className="employee-avatar">
                    {(approval.employee?.name || 'U')
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .toUpperCase()}
                  </div>
                  <div className="employee-details">
                    <h4>{approval.employee?.name || t('leave_history.unknown')}</h4>
                    <p>{approval.employee?.department || t('approvals_history.unassigned')}</p>
                    <span className="employee-email">{approval.employee?.email || '—'}</span>
                  </div>
                </div>
                <div className="approval-meta">
                  {getStatusBadge(approval.status)}
                  <span className="decision-date">
                    {t('approvals_history.decided')}: {formatDateTime(approval.managerApprovedDate || approval.hrApprovedDate || approval.appliedDate)}
                  </span>
                </div>
              </div>

              <div className="approval-details">
                <div className="leave-info">
                  <div className="info-grid">
                    <div className="info-item">
                      <span className="label">{t('leave_history.columns.leave_type')}:</span>
                      <span className="value">{getLeaveTypeName(approval.leaveType)}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">{t('leave_history.columns.start_date')} - {t('leave_history.columns.end_date')}:</span>
                      <span className="value">
                        {formatDate(approval.startDate)} - {formatDate(approval.endDate)}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="label">{t('leave_history.columns.duration')}:</span>
                      <span className="value">{approval.days} {t('dashboard.days')}</span>
                    </div>
                    <div className="info-item">
                      <span className="label">{t('leave_history.columns.applied_date')}:</span>
                      <span className="value">{formatDate(approval.appliedDate)}</span>
                    </div>
                  </div>
                </div>

                <div className="reason-section">
                  <span className="label">{t('leave_history.columns.reason')}:</span>
                  <p className="reason-text">{approval.reason || '—'}</p>
                </div>

                {approval.managerNotes && (
                  <div className="notes-section">
                    <span className="label">{t('approvals_history.your_notes')}:</span>
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
