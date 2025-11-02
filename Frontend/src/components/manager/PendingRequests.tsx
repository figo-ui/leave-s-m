import React, { useState, useEffect } from 'react';
import { LeaveService } from '../../utils/leaveService';

import { LeaveApplication }from '../../types';
import './PendingRequests.css';


const PendingRequests: React.FC = () => {
  const [pendingRequests, setPendingRequests] = useState<LeaveApplication[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<LeaveApplication | null>(null);
  const [managerNotes, setManagerNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadPendingRequests();
  }, []);

  const loadPendingRequests = () => {
    try {
      const requests = LeaveService.getPendingManagerApplications();
      setPendingRequests(requests);
    } catch (error) {
      console.error('Error loading pending requests:', error);
      setError('Failed to load pending requests');
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;
    
    if (!managerNotes.trim()) {
      setError('Please provide approval notes');
      return;
    }

    try {
      await LeaveService.updateApplicationStatus(selectedRequest.id, {
        status: 'hr_pending',
        managerNotes: managerNotes,
        managerApprovedDate: new Date().toISOString().split('T')[0],
        currentApprover: 'hr'
      });

      setPendingRequests(prev => prev.filter(req => req.id !== selectedRequest.id));
      setSelectedRequest(null);
      setManagerNotes('');
      setError('');
      
      alert('✅ Request approved and sent to HR!');
    } catch (error) {
      console.error('Error approving request:', error);
      setError('Failed to approve request');
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;
    
    if (!managerNotes.trim()) {
      setError('Please provide rejection reason');
      return;
    }

    try {
      await LeaveService.updateApplicationStatus(selectedRequest.id, {
        status: 'rejected',
        managerNotes: managerNotes,
        managerApprovedDate: new Date().toISOString().split('T')[0],
        currentApprover: 'manager'
      });

      setPendingRequests(prev => prev.filter(req => req.id !== selectedRequest.id));
      setSelectedRequest(null);
      setManagerNotes('');
      setError('');
      
      alert('✅ Request rejected! Employee has been notified.');
    } catch (error) {
      console.error('Error rejecting request:', error);
      setError('Failed to reject request');
    }
  };

  return (
    <div className="pending-requests">
      <div className="page-header">
        <h1>Pending Leave Requests</h1>
        <p>Review and approve/reject leave requests from your team</p>
      </div>

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <div className="requests-container">
        {pendingRequests.length === 0 ? (
          <div className="no-requests">
            <div className="no-requests-icon">✅</div>
            <h3>No Pending Requests</h3>
            <p>All leave requests have been processed</p>
          </div>
        ) : (
          <div className="requests-grid">
            {pendingRequests.map(request => (
              <div key={request.id} className="request-card">
                <div className="request-header">
                  <div className="employee-info">
                    <h3>{request.employeeName}</h3>
                    <p>{request.department} • ID: {request.employeeId}</p>
                  </div>
                  <span className="leave-type-tag">{request.leaveType}</span>
                </div>

                <div className="request-details">
                  <div className="detail-item">
                    <span className="label">Period:</span>
                    <span className="value">
                      {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Duration:</span>
                    <span className="value">{request.days} days</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Reason:</span>
                    <span className="value">{request.reason}</span>
                  </div>
                </div>

                <div className="request-actions">
                  <button 
                    className="btn-review"
                    onClick={() => setSelectedRequest(request)}
                  >
                    Review & Decide
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decision Modal */}
      {selectedRequest && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Review Leave Request</h2>
              <button className="close-btn" onClick={() => {
                setSelectedRequest(null);
                setManagerNotes('');
                setError('');
              }}>×</button>
            </div>

            <div className="modal-body">
              <div className="request-summary">
                <h4>Request Details</h4>
                <p><strong>Employee:</strong> {selectedRequest.employeeName}</p>
                <p><strong>Leave Type:</strong> {selectedRequest.leaveType}</p>
                <p><strong>Period:</strong> {new Date(selectedRequest.startDate).toLocaleDateString()} to {new Date(selectedRequest.endDate).toLocaleDateString()}</p>
                <p><strong>Duration:</strong> {selectedRequest.days} days</p>
                <p><strong>Reason:</strong> {selectedRequest.reason}</p>
              </div>

              <div className="decision-notes">
                <label>Your Notes *</label>
                <textarea
                  value={managerNotes}
                  onChange={(e) => {
                    setManagerNotes(e.target.value);
                    setError('');
                  }}
                  placeholder="Provide approval comments or rejection reason..."
                  rows={4}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-reject"
                onClick={handleReject}
                disabled={!managerNotes.trim()}
              >
                Reject
              </button>
              <button 
                className="btn-approve"
                onClick={handleApprove}
                disabled={!managerNotes.trim()}
              >
                Approve & Send to HR
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PendingRequests;