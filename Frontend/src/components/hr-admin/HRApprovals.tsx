import React, { useState, useEffect } from 'react';
import { LeaveService } from '../../utils/leaveService';
import './HRApprovals.css';

interface LeaveApplication {
  id: number;
  employeeName: string;
  employeeId: string;
  employeeEmail: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected' | 'hr_pending' | 'hr_approved' | 'hr_rejected';
  reason: string;
  appliedDate: string;
  currentApprover: 'manager' | 'hr';
  managerNotes?: string;
  managerApprovedDate?: string;
}

const HRApprovals: React.FC = () => {
  const [hrPendingRequests, setHrPendingRequests] = useState<LeaveApplication[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LeaveApplication | null>(null);
  const [hrNotes, setHrNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadHrPendingRequests();
  }, []);

  const loadHrPendingRequests = () => {
    try {
      const requests = LeaveService.getPendingHRApplications();
      setHrPendingRequests(requests);
    } catch (error) {
      console.error('Error loading HR pending requests:', error);
      setError('Failed to load pending requests');
    }
  };

  const handleFinalApprove = async () => {
    if (!selectedRequest) return;

    try {
      await LeaveService.updateApplicationStatus(selectedRequest.id, {
        status: 'hr_approved',
        hrNotes: hrNotes,
        hrApprovedDate: new Date().toISOString().split('T')[0],
        currentApprover: 'hr'
      });

      setHrPendingRequests(prev => prev.filter(req => req.id !== selectedRequest.id));
      setSelectedRequest(null);
      setHrNotes('');
      setError('');
      
      alert('✅ Leave request fully approved! Employee has been notified.');
    } catch (error) {
      console.error('Error final approving request:', error);
      setError('Failed to approve request');
    }
  };

  const handleFinalReject = async () => {
    if (!selectedRequest) return;

    try {
      await LeaveService.updateApplicationStatus(selectedRequest.id, {
        status: 'hr_rejected',
        hrNotes: hrNotes,
        hrApprovedDate: new Date().toISOString().split('T')[0],
        currentApprover: 'hr'
      });

      setHrPendingRequests(prev => prev.filter(req => req.id !== selectedRequest.id));
      setSelectedRequest(null);
      setHrNotes('');
      setError('');
      
      alert('✅ Leave request rejected! Employee has been notified.');
    } catch (error) {
      console.error('Error final rejecting request:', error);
      setError('Failed to reject request');
    }
  };

  return (
    <div className="hr-approvals">
      <div className="page-header">
        <h1>HR Final Approvals</h1>
        <p>Final approval of manager-approved leave requests</p>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <div className="approvals-container">
        {hrPendingRequests.length === 0 ? (
          <div className="no-requests">
            <div className="no-requests-icon">✅</div>
            <h3>No Pending HR Approvals</h3>
            <p>All manager-approved requests have been processed</p>
          </div>
        ) : (
          <div className="approvals-grid">
            {hrPendingRequests.map(request => (
              <div key={request.id} className="approval-card">
                <div className="approval-header">
                  <div className="employee-info">
                    <h3>{request.employeeName}</h3>
                    <p>{request.department} • ID: {request.employeeId}</p>
                  </div>
                  <div className="approval-badges">
                    <span className="leave-type-tag">{request.leaveType}</span>
                    <span className="manager-approved">✓ Manager Approved</span>
                  </div>
                </div>

                <div className="approval-details">
                  <div className="detail-row">
                    <div className="detail-item">
                      <span className="label">Leave Period:</span>
                      <span className="value">
                        {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Duration:</span>
                      <span className="value">{request.days} days</span>
                    </div>
                  </div>
                  
                  <div className="detail-item">
                    <span className="label">Reason:</span>
                    <span className="value">{request.reason}</span>
                  </div>

                  {request.managerNotes && (
                    <div className="manager-notes">
                      <span className="label">Manager's Notes:</span>
                      <span className="value">{request.managerNotes}</span>
                    </div>
                  )}
                </div>

                <div className="approval-actions">
                  <button 
                    className="btn-review"
                    onClick={() => setSelectedRequest(request)}
                  >
                    Final Decision
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Final Decision Modal */}
      {selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Final HR Approval</h2>
              <button className="close-btn" onClick={() => {
                setSelectedRequest(null);
                setHrNotes('');
                setError('');
              }}>×</button>
            </div>

            <div className="modal-body">
              <div className="request-summary">
                <h4>Request Summary</h4>
                <p><strong>Employee:</strong> {selectedRequest.employeeName}</p>
                <p><strong>Department:</strong> {selectedRequest.department}</p>
                <p><strong>Leave Type:</strong> {selectedRequest.leaveType}</p>
                <p><strong>Period:</strong> {new Date(selectedRequest.startDate).toLocaleDateString()} to {new Date(selectedRequest.endDate).toLocaleDateString()}</p>
                <p><strong>Duration:</strong> {selectedRequest.days} days</p>
                <p><strong>Reason:</strong> {selectedRequest.reason}</p>
                
                {selectedRequest.managerNotes && (
                  <p><strong>Manager's Notes:</strong> {selectedRequest.managerNotes}</p>
                )}
              </div>

              <div className="decision-notes">
                <label>HR Notes (Optional)</label>
                <textarea
                  value={hrNotes}
                  onChange={(e) => setHrNotes(e.target.value)}
                  placeholder="Additional comments or notes..."
                  rows={3}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-reject"
                onClick={handleFinalReject}
              >
                Reject Finally
              </button>
              <button 
                className="btn-approve-final"
                onClick={handleFinalApprove}
              >
                Approve Finally
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HRApprovals;