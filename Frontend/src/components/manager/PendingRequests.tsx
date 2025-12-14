import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
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
        const requests = response.data || [];
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
      
      const successful = results.filter((result, index) => 
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
      
      const successful = results.filter((result, index) => 
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

  const selectAllRequests = () => {
    if (bulkActions.length === filteredRequests.length) {
      setBulkActions([]);
    } else {
      setBulkActions(filteredRequests.map(req => req.id));
    }
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
      return '✅ Manager Approved → ⏳ HR Review';
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
            {user?.role === 'manager' ? 'Pending Manager Approvals' : 'Pending HR Approvals'}
          </h1>
          <p>Loading leave requests...</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading pending requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pending-requests">
        <div className="page-header">
          <h1>Pending Leave Requests</h1>
          <p>Review and approve leave applications</p>
        </div>
        <div className="error-state">
          <div className="error-icon">⚠️</div>
          <h3>Unable to Load Requests</h3>
          <p>{error}</p>
          <button onClick={loadPendingRequests} className="retry-btn">
            🔄 Try Again
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
              {user?.role === 'manager' ? 'Pending Manager Approvals' : 'Pending HR Approvals'}
            </h1>
            <p>
              {user?.role === 'manager' 
                ? 'First-level approval for your team members' 
                : 'Final approval for manager-reviewed requests'
              }
            </p>
          </div>
          <div className="header-stats">
            <div className="stat-badges">
              <span className="stat-badge total">
                <span className="stat-number">{stats.total}</span>
                <span className="stat-label">Total</span>
              </span>
              <span className="stat-badge urgent">
                <span className="stat-number">{stats.urgent}</span>
                <span className="stat-label">Urgent</span>
              </span>
              <span className="stat-badge hr-pending">
                <span className="stat-number">{stats.requiresHR}</span>
                <span className="stat-label">Requires HR</span>
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
            {loading ? '🔄 Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* Enhanced Controls Section */}
      <div className="controls-section">
        <div className="search-filters">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search by employee, department, or reason..."
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
              <option value="all">All Requests ({stats.total})</option>
              <option value="urgent">Urgent ({stats.urgent})</option>
              <option value="requires-hr">Requires HR ({stats.requiresHR})</option>
              {user?.role === 'manager' && (
                <option value="requires-manager">First Approval ({stats.total - stats.requiresHR})</option>
              )}
            </select>
          </div>
          
          <div className="filter-group">
            <select 
              value={sortBy} 
              onChange={(e) => setSortBy(e.target.value as any)}
              className="filter-select"
            >
              <option value="urgency">Sort by Urgency</option>
              <option value="date">Sort by Date</option>
              <option value="employee">Sort by Employee</option>
              <option value="department">Sort by Department</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {bulkActions.length > 0 && (
          <div className="bulk-actions-bar">
            <div className="bulk-info">
              <strong>{bulkActions.length}</strong> requests selected
            </div>
            <div className="bulk-buttons">
              <button
                className="bulk-approve-btn"
                onClick={handleBulkApprove}
                disabled={actionLoading === -1}
              >
                {actionLoading === -1 ? 'Processing...' : `✅ Approve ${bulkActions.length}`}
              </button>
              <button
                className="bulk-reject-btn"
                onClick={handleBulkReject}
                disabled={actionLoading === -1}
              >
                {actionLoading === -1 ? 'Processing...' : `❌ Reject ${bulkActions.length}`}
              </button>
              <button
                className="bulk-clear-btn"
                onClick={() => setBulkActions([])}
              >
                Clear Selection
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
            {searchTerm ? "No matching requests found" :
             user?.role === 'manager' 
              ? "No Pending Manager Approvals"
              : "No Pending HR Approvals"
            }
          </h3>
          <p>
            {searchTerm 
              ? "Try adjusting your search criteria"
              : user?.role === 'manager'
                ? "All leave requests have been processed."
                : "No manager-approved requests pending HR review."
            }
          </p>
          {(searchTerm || filter !== 'all') && (
            <button 
              onClick={() => { setSearchTerm(''); setFilter('all'); }}
              className="clear-filters-btn"
            >
              Clear Filters
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
                      {urgency === 'overdue' && '⏰ Overdue'}
                      {urgency === 'critical' && '🚨 Starts Today'}
                      {urgency === 'high' && '🚨 Urgent'}
                      {urgency === 'medium' && '⚠️ Soon'}
                      {urgency === 'low' && '📅 Upcoming'}
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
                      <span>({request.days} day{request.days !== 1 ? 's' : ''})</span>
                    </div>
                    
                    <div className="time-info">
                      {daysUntilStart < 0 ? (
                        <span className="overdue-text">{Math.abs(daysUntilStart)} days overdue</span>
                      ) : daysUntilStart === 0 ? (
                        <span className="starts-today">Starts today</span>
                      ) : (
                        <span>{daysUntilStart} days until start</span>
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
                            ? "Add approval notes..."
                            : "Add final approval notes..."
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
                             request.leaveType.requiresHRApproval ? '✅ Forward to HR' : '✅ Final Approve'
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
                            {actionLoading === request.id ? '...' : '❌ Reject'}
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
                            {actionLoading === request.id ? '...' : '✅ Final Approve'}
                          </button>
                          <button
                            className="btn-reject"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(request.id);
                            }}
                            disabled={actionLoading === request.id}
                          >
                            {actionLoading === request.id ? '...' : '❌ Reject'}
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
                        📋 Details
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Leave Request Details</h3>
              <button className="close-btn" onClick={() => setShowDetailsModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {/* Enhanced details content */}
              <div className="detail-sections">
                <div className="detail-section">
                  <h4>Employee Information</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Name:</label>
                      <span>{selectedRequest.employee.name}</span>
                    </div>
                    <div className="detail-item">
                      <label>Department:</label>
                      <span>{selectedRequest.employee.department}</span>
                    </div>
                    <div className="detail-item">
                      <label>Position:</label>
                      <span>{selectedRequest.employee.position}</span>
                    </div>
                    <div className="detail-item">
                      <label>Email:</label>
                      <span>{selectedRequest.employee.email}</span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Leave Details</h4>
                  <div className="detail-grid">
                    <div className="detail-item">
                      <label>Type:</label>
                      <span>{selectedRequest.leaveType.name}</span>
                    </div>
                    <div className="detail-item">
                      <label>Duration:</label>
                      <span>{selectedRequest.days} days</span>
                    </div>
                    <div className="detail-item">
                      <label>Dates:</label>
                      <span>{formatDate(selectedRequest.startDate)} - {formatDate(selectedRequest.endDate)}</span>
                    </div>
                    <div className="detail-item">
                      <label>Status:</label>
                      <span className={`status-${selectedRequest.status.toLowerCase()}`}>
                        {selectedRequest.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <h4>Reason</h4>
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