import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import type { Leave } from '../../types';
import { useTranslation } from 'react-i18next';
import './PendingRequests.css';

interface PendingRequest {
  id: number;
  employee: {
    id: number;
    name: string;
    email: string;
    department: string;
    position: string;
    avatar?: string;
    manager?: {
      name: string;
      email: string;
    };
  };
  leaveType: {
    id: number;
    name: string;
    color?: string;
    requiresHRApproval: boolean;
  };
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: string;
  appliedDate: string;
  currentApprover: string;
  managerNotes?: string;
  hrNotes?: string;
  managerApprovedBy?: number;
  managerApprovedDate?: string;
  hrApprovedBy?: number;
  hrApprovedDate?: string;
}

const PendingRequests: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [approvalNotes, setApprovalNotes] = useState<{ [key: number]: string }>({});
  const [filter, setFilter] = useState<'all' | 'urgent' | 'requires-hr' | 'requires-manager'>('all');
  const [sortBy, setSortBy] = useState<'urgency' | 'date' | 'employee' | 'department'>('urgency');
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [bulkActions, setBulkActions] = useState<number[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadPendingRequests();
  }, []);

  const loadPendingRequests = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('🔄 Loading pending requests for:', {
        userId: user?.id,
        userRole: user?.role,
        userName: user?.name
      });

      let response;
      
      if (user?.role === 'manager') {
        response = await apiService.getPendingRequests();
      } else if (user?.role === 'hr-admin') {
        response = await apiService.getHRPendingApprovals();
      } else {
        setError('You do not have permission to view pending requests');
        return;
      }
      
      if (response.success) {
        const requests = (response.data || []).map((leave: Leave) => ({
          id: leave.id,
          employee: {
            id: leave.employee?.id ?? leave.employeeId ?? 0,
            name: leave.employee?.name ?? 'Unknown',
            email: leave.employee?.email ?? '',
            department: leave.employee?.department ?? leave.department ?? 'Unassigned',
            position: leave.employee?.position ?? '',
            avatar: leave.employee?.avatar,
            manager: leave.employee?.manager
              ? { name: leave.employee.manager.name, email: leave.employee.manager.email }
              : undefined
          },
          leaveType: typeof leave.leaveType === 'string'
            ? {
                id: leave.leaveTypeId ?? 0,
                name: leave.leaveType,
                color: '#667eea',
                requiresHRApproval: false
              }
            : {
                id: leave.leaveType?.id ?? leave.leaveTypeId ?? 0,
                name: leave.leaveType?.name || 'Unknown',
                color: leave.leaveType?.color,
                requiresHRApproval: leave.leaveType?.requiresHRApproval ?? false
              },
          startDate: leave.startDate,
          endDate: leave.endDate,
          days: leave.days,
          reason: leave.reason || '',
          status: leave.status,
          appliedDate: leave.appliedDate,
          currentApprover: String(leave.currentApprover),
          managerNotes: leave.managerNotes,
          hrNotes: leave.hrNotes,
          managerApprovedBy: leave.managerApprovedBy,
          managerApprovedDate: leave.managerApprovedDate,
          hrApprovedBy: leave.hrApprovedBy,
          hrApprovedDate: leave.hrApprovedDate
        }));
        console.log('✅ Requests loaded:', requests.length);
        
        setPendingRequests(requests);
      } else {
        setError(response.message || 'Failed to load pending requests');
      }
    } catch (error: any) {
      console.error('💥 Error loading requests:', error);
      setError(error.message || 'Failed to load pending requests');
    } finally {
      setLoading(false);
    }
  };

  // Enhanced approval workflow
  const handleManagerApprove = async (requestId: number) => {
    try {
      setActionLoading(requestId);
      const notes = approvalNotes[requestId] || '';
      
      const response = await apiService.approveLeave(requestId, notes);
      
      if (response.success) {
        showNotification('Leave approved and forwarded to HR', 'success');
        
        // Update local state
        setPendingRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { 
                  ...req, 
                  status: 'PENDING_HR',
                  currentApprover: 'HR',
                  managerNotes: notes,
                  managerApprovedBy: user?.id,
                  managerApprovedDate: new Date().toISOString()
                }
              : req
          )
        );
        
        // Clear notes and bulk selection
        setApprovalNotes(prev => {
          const newNotes = { ...prev };
          delete newNotes[requestId];
          return newNotes;
        });
        setBulkActions(prev => prev.filter(id => id !== requestId));

      } else {
        showNotification(response.message || 'Failed to approve leave', 'error');
      }
    } catch (error: any) {
      console.error('Error approving leave:', error);
      showNotification(error.message || 'Failed to approve leave', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleHRApprove = async (requestId: number) => {
    try {
      setActionLoading(requestId);
      const notes = approvalNotes[requestId] || '';
      
      const response = await apiService.approveHRLeave(requestId, notes);
      
      if (response.success) {
        showNotification('Leave request finally approved!', 'success');
        
        // Remove from list
        setPendingRequests(prev => prev.filter(req => req.id !== requestId));
        setBulkActions(prev => prev.filter(id => id !== requestId));
        
        // Clear notes
        setApprovalNotes(prev => {
          const newNotes = { ...prev };
          delete newNotes[requestId];
          return newNotes;
        });

      } else {
        showNotification(response.message || 'Failed to approve leave', 'error');
      }
    } catch (error: any) {
      console.error('Error approving leave:', error);
      showNotification(error.message || 'Failed to approve leave', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      setActionLoading(requestId);
      const notes = approvalNotes[requestId] || '';
      
      const response = user?.role === 'hr-admin' 
        ? await apiService.rejectHRLeave(requestId, notes)
        : await apiService.rejectLeave(requestId, notes);
      
      if (response.success) {
        const rejecter = user?.role === 'hr-admin' ? 'HR' : 'Manager';
        showNotification(`Leave request rejected by ${rejecter}`, 'success');
        
        // Remove from list
        setPendingRequests(prev => prev.filter(req => req.id !== requestId));
        setBulkActions(prev => prev.filter(id => id !== requestId));
        
        // Clear notes
        setApprovalNotes(prev => {
          const newNotes = { ...prev };
          delete newNotes[requestId];
          return newNotes;
        });

      } else {
        showNotification(response.message || 'Failed to reject leave', 'error');
      }
    } catch (error: any) {
      console.error('Error rejecting leave:', error);
      showNotification(error.message || 'Failed to reject leave', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Bulk actions
  const handleBulkApprove = async () => {
    if (bulkActions.length === 0) return;
    
    try {
      setActionLoading(-1); // Use -1 for bulk actions
      const notes = "Bulk approval";
      
      const results = await Promise.allSettled(
        bulkActions.map(requestId => 
          user?.role === 'manager' 
            ? apiService.approveLeave(requestId, notes)
            : apiService.approveHRLeave(requestId, notes)
        )
      );
      
      const successful = results.filter(result => 
        result.status === 'fulfilled' && result.value.success
      ).length;
      
      const failed = results.length - successful;
      
      if (successful > 0) {
        showNotification(`Successfully approved ${successful} requests${failed > 0 ? `, ${failed} failed` : ''}`, 'success');
        
        // Remove successful requests
        const successfulIds = results
          .map((result, index) => result.status === 'fulfilled' && result.value.success ? bulkActions[index] : null)
          .filter(Boolean) as number[];
        
        setPendingRequests(prev => prev.filter(req => !successfulIds.includes(req.id)));
        setBulkActions([]);
      }
      
      if (failed > 0) {
        showNotification(`${failed} requests failed to approve`, 'error');
      }
      
    } catch (error: any) {
      showNotification('Bulk approval failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkReject = async () => {
    if (bulkActions.length === 0) return;
    
    try {
      setActionLoading(-1);
      const notes = "Bulk rejection";
      
      const results = await Promise.allSettled(
        bulkActions.map(requestId => 
          user?.role === 'hr-admin' 
            ? apiService.rejectHRLeave(requestId, notes)
            : apiService.rejectLeave(requestId, notes)
        )
      );
      
      const successful = results.filter(result => 
        result.status === 'fulfilled' && result.value.success
      ).length;
      
      if (successful > 0) {
        showNotification(`Successfully rejected ${successful} requests`, 'success');
        setPendingRequests(prev => prev.filter(req => !bulkActions.includes(req.id)));
        setBulkActions([]);
      }
      
    } catch (error: any) {
      showNotification('Bulk rejection failed', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const toggleBulkSelection = (requestId: number) => {
    setBulkActions(prev => 
      prev.includes(requestId) 
        ? prev.filter(id => id !== requestId)
        : [...prev, requestId]
    );
  };

  // Enhanced utility functions
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDaysUntilStart = (startDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const diffTime = start.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const getUrgencyLevel = (startDate: string) => {
    const daysUntilStart = getDaysUntilStart(startDate);
    if (daysUntilStart < 0) return 'overdue';
    if (daysUntilStart === 0) return 'critical';
    if (daysUntilStart <= 2) return 'high';
    if (daysUntilStart <= 7) return 'medium';
    return 'low';
  };

  const getUrgencyScore = (request: PendingRequest) => {
    const daysUntilStart = getDaysUntilStart(request.startDate);
    let score = 0;
    
    if (daysUntilStart < 0) score = 100;
    else if (daysUntilStart === 0) score = 90;
    else if (daysUntilStart <= 2) score = 80;
    else if (daysUntilStart <= 7) score = 60;
    else score = 40;
    
    // Prioritize HR-pending requests
    if (request.status === 'PENDING_HR') score += 20;
    
    return score;
  };

  const getWorkflowStatus = (request: PendingRequest) => {
    const isManagerPending = request.status === 'PENDING_MANAGER';
    const isHRPending = request.status === 'PENDING_HR';
    const requiresHR = request.leaveType.requiresHRApproval;

    if (isManagerPending) {
      return requiresHR ? '⏳ Manager Review → HR Review' : '⏳ Manager Review → Final';
    }
    
    if (isHRPending) {
      return t('pending_requests.status.manager_to_hr');
    }
    
    return 'Pending Review';
  };

  // Enhanced filtering and sorting
  const filteredRequests = pendingRequests
    .filter(request => {
      // Status filter
      if (user?.role === 'manager' && request.status !== 'PENDING_MANAGER') return false;
      if (user?.role === 'hr-admin' && request.status !== 'PENDING_HR') return false;
      
      // Additional filters
      if (filter === 'urgent') {
        const urgency = getUrgencyLevel(request.startDate);
        return urgency === 'critical' || urgency === 'high' || urgency === 'overdue';
      }
      
      if (filter === 'requires-hr') {
        return request.leaveType.requiresHRApproval;
      }
      
      if (filter === 'requires-manager') {
        return !request.leaveType.requiresHRApproval;
      }
      
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          request.employee.name.toLowerCase().includes(term) ||
          request.employee.department.toLowerCase().includes(term) ||
          request.leaveType.name.toLowerCase().includes(term) ||
          request.reason.toLowerCase().includes(term)
        );
      }
      
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'urgency':
          return getUrgencyScore(b) - getUrgencyScore(a);
        case 'date':
          return new Date(a.appliedDate).getTime() - new Date(b.appliedDate).getTime();
        case 'employee':
          return a.employee.name.localeCompare(b.employee.name);
        case 'department':
          return a.employee.department.localeCompare(b.employee.department);
        default:
          return 0;
      }
    });

  // Enhanced stats calculation
  const stats = {
    total: pendingRequests.length,
    urgent: pendingRequests.filter(req => {
      const urgency = getUrgencyLevel(req.startDate);
      return urgency === 'critical' || urgency === 'high' || urgency === 'overdue';
    }).length,
    requiresHR: pendingRequests.filter(req => req.leaveType.requiresHRApproval).length,
    managerPending: pendingRequests.filter(req => req.status === 'PENDING_MANAGER').length,
    hrPending: pendingRequests.filter(req => req.status === 'PENDING_HR').length,
  };

  // Enhanced notification system
  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    // Implementation for showing notifications
    console.log(`${type.toUpperCase()}: ${message}`);
  };

  // Auto-refresh
  useEffect(() => {
    const interval = setInterval(() => {
      if (!loading && pendingRequests.length > 0) {
        loadPendingRequests();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [loading, pendingRequests.length]);

  if (loading) {
    return (
      <div className="pending-requests">
        <div className="page-header">
          <h1>
            {user?.role === 'manager' ? t('pending_requests.titles.manager') : t('pending_requests.titles.hr')}
          </h1>
          <p>{t('pending_requests.loading')}</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{t('pending_requests.loading_pending')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pending-requests">
        <div className="page-header">
          <h1>{t('pending_requests.title')}</h1>
          <p>{t('pending_requests.subtitle')}</p>
        </div>
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>{t('pending_requests.errors.unable')}</h3>
          <p>{error}</p>
          <button onClick={loadPendingRequests} className="retry-btn">
            🔄 {t('common.try_again')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pending-requests">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>
              {user?.role === 'manager' ? t('pending_requests.titles.manager') : t('pending_requests.titles.hr')}
            </h1>
            <p>
              {user?.role === 'manager' 
                ? t('pending_requests.subtitles.manager')
                : t('pending_requests.subtitles.hr')
              }
            </p>
          </div>
          <div className="header-stats">
            <div className="stat-badges">
              <span className="stat-badge total">
                <span className="stat-number">{stats.total}</span>
                <span className="stat-label">{t('pending_requests.stats.total')}</span>
              </span>
              <span className="stat-badge urgent">
                <span className="stat-number">{stats.urgent}</span>
                <span className="stat-label">{t('pending_requests.stats.urgent')}</span>
              </span>
              <span className="stat-badge hr-pending">
                <span className="stat-number">{stats.requiresHR}</span>
                <span className="stat-label">{t('pending_requests.stats.requires_hr')}</span>
              </span>
            </div>
          </div>
        </div>
        <div className="header-actions">
          <button 
            className="refresh-btn" 
            onClick={loadPendingRequests} 
            disabled={loading}
          >
            {loading ? `🔄 ${t('common.loading')}` : `🔄 ${t('dashboard.refresh')}`}
          </button>
        </div>
      </div>

      {/* Enhanced Controls Section */}
      <div className="controls-section">
        <div className="search-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder={t('pending_requests.search_placeholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
          </div>
          
          <div className="filter-group">
            <select 
              value={filter} 
              onChange={(e) => setFilter(e.target.value as any)}
              className="filter-select"
            >
              <option value="all">{t('pending_requests.filters.all', { count: stats.total })}</option>
              <option value="urgent">{t('pending_requests.filters.urgent', { count: stats.urgent })}</option>
              <option value="requires-hr">{t('pending_requests.filters.requires_hr', { count: stats.requiresHR })}</option>
              {user?.role === 'manager' && (
                <option value="requires-manager">{t('pending_requests.filters.first_approval', { count: stats.total - stats.requiresHR })}</option>
              )}
            </select>
          </div>
          
          <div className="filter-group">
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="filter-select"
            >
              <option value="urgency">{t('pending_requests.sort.urgency')}</option>
              <option value="date">{t('pending_requests.sort.date')}</option>
              <option value="employee">{t('pending_requests.sort.employee')}</option>
              <option value="department">{t('pending_requests.sort.department')}</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {bulkActions.length > 0 && (
          <div className="bulk-actions-bar">
            <div className="bulk-info">
              {t('pending_requests.bulk.selected', { count: bulkActions.length })}
            </div>
            <div className="bulk-buttons">
              <button
                className="bulk-approve-btn"
                onClick={handleBulkApprove}
                disabled={actionLoading === -1}
              >
                {actionLoading === -1 ? t('pending_requests.bulk.processing') : `✅ ${t('pending_requests.bulk.approve', { count: bulkActions.length })}`}
              </button>
              <button
                className="bulk-reject-btn"
                onClick={handleBulkReject}
                disabled={actionLoading === -1}
              >
                {actionLoading === -1 ? t('pending_requests.bulk.processing') : `❌ ${t('pending_requests.bulk.reject', { count: bulkActions.length })}`}
              </button>
              <button
                className="bulk-clear-btn"
                onClick={() => setBulkActions([])}
              >
                {t('pending_requests.bulk.clear')}
              </button>
            </div>
          </div>
        )}
      </div>

      {filteredRequests.length === 0 ? (
        <div className="no-requests">
          <div className="no-requests-icon">
            {user?.role === 'manager' ? '✅' : '👥'}
          </div>
          <h3>
            {searchTerm ? t('pending_requests.empty.matching') :
             user?.role === 'manager' 
              ? t('pending_requests.empty.manager')
              : t('pending_requests.empty.hr')
            }
          </h3>
          <p>
            {searchTerm 
              ? t('pending_requests.empty.try_adjust')
              : user?.role === 'manager'
                ? t('pending_requests.empty.processed')
                : t('pending_requests.empty.hr_review')
            }
          </p>
          {(searchTerm || filter !== 'all') && (
            <button 
              onClick={() => { setSearchTerm(''); setFilter('all'); }}
              className="clear-filters-btn"
            >
              {t('pending_requests.clear_filters')}
            </button>
          )}
        </div>
      ) : (
        <div className="requests-grid">
          {filteredRequests.map((request) => {
            const urgency = getUrgencyLevel(request.startDate);
            const daysUntilStart = getDaysUntilStart(request.startDate);
            const isSelected = bulkActions.includes(request.id);
            const isManagerPending = request.status === 'PENDING_MANAGER';
            const isHRPending = request.status === 'PENDING_HR';
            
            return (
              <div 
                key={request.id} 
                className={`request-card ${isSelected ? 'selected' : ''} urgency-${urgency}`}
                onClick={() => toggleBulkSelection(request.id)}
              >
                {/* Selection Checkbox */}
                <div className="selection-checkbox">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleBulkSelection(request.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>

                <div className="request-header">
                  <div className="employee-info">
                    <div className="employee-avatar">
                      {request.employee.avatar ? (
                        <img src={request.employee.avatar} alt={request.employee.name} />
                      ) : (
                        <div className="avatar-placeholder">
                          {request.employee.name.split(' ').map(n => n[0]).join('')}
                        </div>
                      )}
                    </div>
                    <div className="employee-details">
                      <h4>{request.employee.name}</h4>
                      <p>{request.employee.position} • {request.employee.department}</p>
                      <span className="employee-email">{request.employee.email}</span>
                    </div>
                  </div>
                  
                  <div className="request-meta">
                    <div className={`urgency-badge ${urgency}`}>
                      {urgency === 'overdue' && t('pending_requests.urgency.overdue')}
                      {urgency === 'critical' && t('pending_requests.urgency.starts_today')}
                      {urgency === 'high' && t('pending_requests.urgency.urgent')}
                      {urgency === 'medium' && t('pending_requests.urgency.soon')}
                      {urgency === 'low' && t('pending_requests.urgency.upcoming')}
                    </div>
                    <div className="workflow-status">
                      {getWorkflowStatus(request)}
                    </div>
                  </div>
                </div>

                <div className="request-details">
                  <div className="leave-info">
                    <span 
                      className="leave-type-tag" 
                      style={{ backgroundColor: request.leaveType.color || '#667eea' }}
                    >
                      {request.leaveType.name}
                      {request.leaveType.requiresHRApproval && <span className="hr-indicator">HR</span>}
                    </span>
                    
                    <div className="date-info">
                      <strong>{formatDate(request.startDate)} - {formatDate(request.endDate)}</strong>
                      <span>({request.days} {t('dashboard.days')})</span>
                    </div>
                    
                    <div className="time-info">
                      {daysUntilStart < 0 ? (
                        <span className="overdue-text">{t('pending_requests.time.overdue', { days: Math.abs(daysUntilStart) })}</span>
                      ) : daysUntilStart === 0 ? (
                        <span className="starts-today">{t('pending_requests.time.starts_today')}</span>
                      ) : (
                        <span>{t('pending_requests.time.until_start', { days: daysUntilStart })}</span>
                      )}
                    </div>
                  </div>

                  <div className="reason-section">
                    <p className="reason-text">{request.reason}</p>
                  </div>

                  {/* Manager Approval History */}
                  {isHRPending && request.managerNotes && (
                    <div className="approval-history">
                      <div className="manager-approval">
                        <strong>✅ Manager Approved</strong>
                        <p>{request.managerNotes}</p>
                      </div>
                    </div>
                  )}

                  {/* Action Section */}
                  <div className="action-section">
                    <div className="approval-notes">
                      <textarea
                        placeholder={
                          user?.role === 'manager'
                            ? t('pending_requests.notes.manager')
                            : t('pending_requests.notes.hr')
                        }
                        value={approvalNotes[request.id] || ''}
                        onChange={(e) => setApprovalNotes(prev => ({
                          ...prev,
                          [request.id]: e.target.value
                        }))}
                        onClick={(e) => e.stopPropagation()}
                        rows={2}
                      />
                    </div>

                    <div className="action-buttons">
                      {isManagerPending && user?.role === 'manager' && (
                        <>
                          <button
                            className="btn-approve"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleManagerApprove(request.id);
                            }}
                            disabled={actionLoading === request.id}
                          >
                            {actionLoading === request.id ? '...' : 
                             request.leaveType.requiresHRApproval ? t('pending_requests.actions.forward_hr') : t('pending_requests.actions.final_approve')
                            }
                          </button>
                          <button
                            className="btn-reject"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(request.id);
                            }}
                            disabled={actionLoading === request.id}
                          >
                            {actionLoading === request.id ? '...' : t('pending_requests.actions.reject')}
                          </button>
                        </>
                      )}

                      {isHRPending && user?.role === 'hr-admin' && (
                        <>
                          <button
                            className="btn-approve final"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleHRApprove(request.id);
                            }}
                            disabled={actionLoading === request.id}
                          >
                            {actionLoading === request.id ? '...' : t('pending_requests.actions.final_approve')}
                          </button>
                          <button
                            className="btn-reject"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(request.id);
                            }}
                            disabled={actionLoading === request.id}
                          >
                            {actionLoading === request.id ? '...' : t('pending_requests.actions.reject')}
                          </button>
                        </>
                      )}

                      <button
                        className="btn-details"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRequest(request);
                          setShowDetailsModal(true);
                        }}
                      >
                        📋 {t('pending_requests.details')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Enhanced Details Modal */}
      {showDetailsModal && selectedRequest && (
        <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('pending_requests.details_title')}
          >
            <div className="modal-header">
              <h3>{t('pending_requests.details_title')}</h3>
              <button
                className="close-btn"
                onClick={() => setShowDetailsModal(false)}
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              {/* Enhanced details content */}
              <div className="detail-sections">
                <div className="detail-section">
                  <h4>{t('hr_approvals.employee_info')}</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>{t('about_me.full_name')}:</label>
                      <span>{selectedRequest.employee.name}</span>
                    </div>
                    <div className="detail-item">
                      <label>{t('about_me.department')}:</label>
                      <span>{selectedRequest.employee.department}</span>
                    </div>
                    <div className="detail-item">
                      <label>{t('about_me.position')}:</label>
                      <span>{selectedRequest.employee.position}</span>
                    </div>
                    <div className="detail-item">
                      <label>{t('about_me.email')}:</label>
                      <span>{selectedRequest.employee.email}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>{t('apply_leave.sections.details')}</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>{t('apply_leave.fields.leave_type')}:</label>
                      <span>{selectedRequest.leaveType.name}</span>
                    </div>
                    <div className="detail-item">
                      <label>{t('leave_history.columns.duration')}:</label>
                      <span>{selectedRequest.days} {t('dashboard.days')}</span>
                    </div>
                    <div className="detail-item">
                      <label>{t('leave_history.columns.applied_date')}:</label>
                      <span>{formatDate(selectedRequest.startDate)} - {formatDate(selectedRequest.endDate)}</span>
                    </div>
                    <div className="detail-item">
                      <label>{t('leave_history.columns.status')}:</label>
                      <span className={`status-${selectedRequest.status.toLowerCase()}`}>
                        {selectedRequest.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>{t('leave_history.columns.reason')}</h4>
                  <p className="reason-detail">{selectedRequest.reason}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingRequests;
