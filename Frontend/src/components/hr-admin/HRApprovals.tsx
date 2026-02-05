// components/HRApprovals.tsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import { Leave, User } from '../../types';
import { jsPDF } from 'jspdf';

import './HRApprovals.css';

interface HRApprovalData {
  leave: Leave;
  employee: User;
  manager?: User;
  leaveType?: any;
}

interface ApprovalAction {
  type: 'approve' | 'reject';
  leaveId: number;
  notes?: string;
}

const HRApprovals: React.FC = () => {
  const { user } = useAuth();
  const [pendingApprovals, setPendingApprovals] = useState<HRApprovalData[]>([]);
  const [approvedLeaves, setApprovedLeaves] = useState<HRApprovalData[]>([]);
  const [rejectedLeaves, setRejectedLeaves] = useState<HRApprovalData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [selectedLeave, setSelectedLeave] = useState<HRApprovalData | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<number | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<string>('');
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [leaveToReject, setLeaveToReject] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterLeaveType, setFilterLeaveType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'employee' | 'days'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  const pdfRef = useRef<HTMLDivElement>(null);

  // Load pending approvals
  useEffect(() => {
    if (user && (user.role === 'hr-admin' || user.role === 'super-admin')) {
      loadHRApprovals();
    }
  }, [user]);

  const loadHRApprovals = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Load pending approvals
      const pendingResponse = await apiService.getHRPendingApprovals();
      
      if (pendingResponse.success && pendingResponse.data) {
        const formattedData = pendingResponse.data.map((leave: Leave) => ({
          leave,
          employee: leave.employee || {} as User,
          manager: leave.manager || {} as User,
          leaveType: leave.leaveType
        }));
        setPendingApprovals(formattedData);
      }

      // Load historical data (approved/rejected)
      await loadHistoricalData();
      
    } catch (error: any) {
      console.error('Error loading HR approvals:', error);
      setError('Failed to load leave approvals. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadHistoricalData = async () => {
    try {
      const response = await apiService.getLeaveOverview();
      if (response.success && response.data) {
        const allLeaves = response.data;
        
        const approved = allLeaves.filter((leave: Leave) => 
          Leave.status === 'HR_APPROVED' || leave.status === 'APPROVED'
        ).map((leave: Leave) => ({
          leave,
          employee: leave.employee || {} as User,
          manager: leave.manager || undefined,
          leaveType: leave.leaveType
        }));

        const rejected = allLeaves.filter((leave: Leave) => 
          leave.status === 'REJECTED'
        ).map((leave: Leave) => ({
          leave,
          employee: leave.employee || {} as User,
          manager: leave.manager || undefined,
          leaveType: leave.leaveType
        }));

        setApprovedLeaves(approved);
        setRejectedLeaves(rejected);
      }
    } catch (error) {
      console.error('Error loading historical data:', error);
    }
  };

  const handleApprove = async (leaveId: number, notes?: string) => {
    try {
      setIsProcessing(leaveId);
      setError('');
      setSuccess('');

      const response = await apiService.approveHRLeave(leaveId, notes);
      
      if (response.success) {
        setSuccess(`Leave request approved successfully!`);
        
        // Move from pending to approved
        const approvedLeave = pendingApprovals.find(item => item.leave.id === leaveId);
        if (approvedLeave) {
          setPendingApprovals(prev => prev.filter(item => item.leave.id !== leaveId));
          setApprovedLeaves(prev => [approvedLeave, ...prev]);
        }
        
        // Close details modal if open
        if (selectedLeave && selectedLeave.leave.id === leaveId) {
          setShowDetailsModal(false);
          setSelectedLeave(null);
        }
      } else {
        throw new Error(response.message || 'Failed to approve leave');
      }
    } catch (error: any) {
      console.error('Error approving leave:', error);
      setError(error.message || 'Failed to approve leave. Please try again.');
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReject = async (leaveId: number, notes: string) => {
    try {
      setIsProcessing(leaveId);
      setError('');
      setSuccess('');

      const response = await apiService.rejectHRLeave(leaveId, notes);
      
      if (response.success) {
        setSuccess(`Leave request rejected successfully!`);
        
        // Move from pending to rejected
        const rejectedLeave = pendingApprovals.find(item => item.leave.id === leaveId);
        if (rejectedLeave) {
          setPendingApprovals(prev => prev.filter(item => item.leave.id !== leaveId));
          setRejectedLeaves(prev => [rejectedLeave, ...prev]);
        }
        
        // Close modals
        setShowRejectModal(false);
        setLeaveToReject(null);
        setRejectionNotes('');
        
        if (selectedLeave && selectedLeave.leave.id === leaveId) {
          setShowDetailsModal(false);
          setSelectedLeave(null);
        }
      } else {
        throw new Error(response.message || 'Failed to reject leave');
      }
    } catch (error: any) {
      console.error('Error rejecting leave:', error);
      setError(error.message || 'Failed to reject leave. Please try again.');
    } finally {
      setIsProcessing(null);
    }
  };

  const openRejectModal = (leaveId: number) => {
    setLeaveToReject(leaveId);
    setRejectionNotes('');
    setShowRejectModal(true);
  };

  const generatePDF = async (approvalData: HRApprovalData) => {
    try {
      if (!pdfRef.current) return;

      setLoading(true);
      
      // Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      
      // Add OBU Logo/Header
      pdf.setFontSize(20);
      pdf.setTextColor(0, 0, 128); // Dark blue
      pdf.text('Oda Bultum University', pageWidth / 2, 20, { align: 'center' });
      
      pdf.setFontSize(16);
      pdf.setTextColor(0, 0, 0);
      pdf.text('Leave Approval Certificate', pageWidth / 2, 30, { align: 'center' });
      
      pdf.setFontSize(12);
      pdf.text('HR Department', pageWidth / 2, 40, { align: 'center' });
      
      // Add line separator
      pdf.setDrawColor(0, 0, 128);
      pdf.setLineWidth(0.5);
      pdf.line(20, 45, pageWidth - 20, 45);
      
      // Certificate details
      pdf.setFontSize(14);
      pdf.setTextColor(0, 0, 128);
      pdf.text('CERTIFICATE OF LEAVE APPROVAL', pageWidth / 2, 60, { align: 'center' });
      
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      
      let yPos = 80;
      
      // Employee Details
      pdf.text(`Employee Name: ${approvalData.employee.name}`, 20, yPos);
      yPos += 10;
      
      pdf.text(`Employee ID: ${approvalData.employee.id}`, 20, yPos);
      yPos += 10;
      
      pdf.text(`Department: ${approvalData.employee.department}`, 20, yPos);
      yPos += 10;
      
      pdf.text(`Position: ${approvalData.employee.position }`, 20, yPos);
      yPos += 15;
      
      // Leave Details
      pdf.text('Leave Details:', 20, yPos);
      yPos += 10;
      
      pdf.text(`Leave Type: ${approvalData.leaveType?.name }`, 25, yPos);
      yPos += 8;
      
      pdf.text(`Start Date: ${new Date(approvalData.leave.startDate).toLocaleDateString()}`, 25, yPos);
      yPos += 8;
      
      pdf.text(`End Date: ${new Date(approvalData.leave.endDate).toLocaleDateString()}`, 25, yPos);
      yPos += 8;
      
      pdf.text(`Duration: ${approvalData.leave.days} day(s)`, 25, yPos);
      yPos += 8;
      
      pdf.text(`Reason: ${approvalData.leave.reason}`, 25, yPos);
      yPos += 15;
      
      // Approval Details
      pdf.text('Approval Details:', 20, yPos);
      yPos += 10;
      
      pdf.text(`Manager: ${approvalData.manager?.name }`, 25, yPos);
      yPos += 8;
      
      pdf.text(`HR Approver: ${user?.name || 'HR Department'}`, 25, yPos);
      yPos += 8;
      
      pdf.text(`Approval Date: ${new Date().toLocaleDateString()}`, 25, yPos);
      yPos += 15;
      
      // Terms and Conditions
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      
      const terms = [
        '1. This certificate must be presented to the department head before commencing leave.',
        '2. Employee must ensure all responsibilities are handed over before leave.',
        '3. Emergency contact must be provided to the department.',
        '4. Unused leave days cannot be carried over without prior approval.',
        '5. Employee must report back to work on the specified return date.'
      ];
      
      pdf.text('Terms and Conditions:', 20, yPos);
      yPos += 8;
      
      terms.forEach(term => {
        if (yPos > 270) {
          pdf.addPage();
          yPos = 20;
        }
        pdf.text(term, 25, yPos);
        yPos += 6;
      });
      
      // Signatures
      yPos = Math.max(yPos, 200);
      
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      
      // HR Signature
      pdf.text('_________________________', 30, yPos);
      pdf.text('HR Department', 40, yPos + 8);
      pdf.text('Signature & Stamp', 38, yPos + 16);
      
      // Employee Signature
      pdf.text('_________________________', pageWidth - 70, yPos);
      pdf.text('Employee', pageWidth - 60, yPos + 8);
      pdf.text('Signature', pageWidth - 58, yPos + 16);
      
      // Footer
      pdf.setFontSize(9);
      pdf.setTextColor(150, 150, 150);
      pdf.text('This is a system generated certificate. For verification, contact HR Department.', 
        pageWidth / 2, 285, { align: 'center' });
      
      // Generate filename
      const fileName = `Leave_Approval_${approvalData.employee.name.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
      
      // Save PDF
      pdf.save(fileName);
      
      setSuccess('PDF certificate generated successfully!');
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openLeaveDetails = (approvalData: HRApprovalData) => {
    setSelectedLeave(approvalData);
    setShowDetailsModal(true);
  };

  // Get unique departments and leave types for filters
  const departments = Array.from(new Set([
    ...pendingApprovals.map(item => item.employee.department),
    ...approvedLeaves.map(item => item.employee.department),
    ...rejectedLeaves.map(item => item.employee.department)
  ])).filter(Boolean).sort();

  const leaveTypes = Array.from(new Set([
    ...pendingApprovals.map(item => item.leaveType?.name),
    ...approvedLeaves.map(item => item.leaveType?.name),
    ...rejectedLeaves.map(item => item.leaveType?.name)
  ])).filter(Boolean).sort();

  // Filter and sort current data
  const getCurrentData = () => {
    let data: HRApprovalData[] = [];
    
    switch (activeTab) {
      case 'pending':
        data = pendingApprovals;
        break;
      case 'approved':
        data = approvedLeaves;
        break;
      case 'rejected':
        data = rejectedLeaves;
        break;
    }

    // Apply filters
    let filtered = data.filter(item => {
      const matchesSearch = 
        item.employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.leave.reason.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesDepartment = 
        filterDepartment === 'all' || 
        item.employee.department === filterDepartment;

      const matchesLeaveType = 
        filterLeaveType === 'all' || 
        item.leaveType?.name === filterLeaveType;

      return matchesSearch && matchesDepartment && matchesLeaveType;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(b.leave.appliedDate).getTime() - new Date(a.leave.appliedDate).getTime();
          break;
        case 'employee':
          comparison = a.employee.name.localeCompare(b.employee.name);
          break;
        case 'days':
          comparison = b.leave.days - a.leave.days;
          break;
      }
      
      return sortOrder === 'asc' ? -comparison : comparison;
    });

    return filtered;
  };

  const currentData = getCurrentData();

  if (loading && !currentData.length) {
    return (
      <div className="hr-approvals">
        <div className="page-header">
          <h1>HR Approvals</h1>
          <p>Review and approve leave requests</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading leave requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hr-approvals">
      <div className="page-header">
        <div className="header-content">
          <div className="header-title">
            <h1>HR Approvals</h1>
            <div className="status-badges">
              <span className={`status-badge ${activeTab === 'pending' ? 'active' : ''}`}>
                ⏳ Pending: {pendingApprovals.length}
              </span>
              <span className={`status-badge ${activeTab === 'approved' ? 'active' : ''}`}>
                ✅ Approved: {approvedLeaves.length}
              </span>
              <span className={`status-badge ${activeTab === 'rejected' ? 'active' : ''}`}>
                ❌ Rejected: {rejectedLeaves.length}
              </span>
            </div>
          </div>
          <button 
            className="refresh-btn"
            onClick={loadHRApprovals}
            title="Refresh approvals"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="message-banner error">
          <div className="message-content">
            <span className="message-icon">❌</span>
            {error}
          </div>
          <button onClick={() => setError('')} className="message-close">×</button>
        </div>
      )}

      {success && (
        <div className="message-banner success">
          <div className="message-content">
            <span className="message-icon">✅</span>
            {success}
          </div>
          <button onClick={() => setSuccess('')} className="message-close">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="approval-tabs">
        <button 
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
        >
          ⏳ Pending Approvals
          <span className="tab-count">{pendingApprovals.length}</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'approved' ? 'active' : ''}`}
          onClick={() => setActiveTab('approved')}
        >
          ✅ Approved Leaves
          <span className="tab-count">{approvedLeaves.length}</span>
        </button>
        <button 
          className={`tab-btn ${activeTab === 'rejected' ? 'active' : ''}`}
          onClick={() => setActiveTab('rejected')}
        >
          ❌ Rejected Leaves
          <span className="tab-count">{rejectedLeaves.length}</span>
        </button>
      </div>

      {/* Filters and Search */}
      <div className="filters-section">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by employee name, email, or reason..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <span className="search-icon">🔍</span>
        </div>
        
        <div className="filter-controls">
          <select 
            value={filterDepartment} 
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>

          <select 
            value={filterLeaveType} 
            onChange={(e) => setFilterLeaveType(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Leave Types</option>
            {leaveTypes.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>

          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as any)}
            className="filter-select"
          >
            <option value="date">Sort by Date</option>
            <option value="employee">Sort by Employee</option>
            <option value="days">Sort by Days</option>
          </select>

          <button 
            className="sort-order-btn"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
          </button>
        </div>
      </div>

      {/* Results Info */}
      <div className="results-info">
        Showing {currentData.length} of {
          activeTab === 'pending' ? pendingApprovals.length :
          activeTab === 'approved' ? approvedLeaves.length :
          rejectedLeaves.length
        } leave requests
        {(searchTerm || filterDepartment !== 'all' || filterLeaveType !== 'all') && ' (filtered)'}
      </div>

      {/* Leave Requests List */}
      <div className="approvals-container">
        {currentData.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              {activeTab === 'pending' ? '📭' :
               activeTab === 'approved' ? '✅' : '❌'}
            </div>
            <h3>
              {activeTab === 'pending' ? 'No Pending Approvals' :
               activeTab === 'approved' ? 'No Approved Leaves' : 'No Rejected Leaves'}
            </h3>
            <p>
              {activeTab === 'pending' 
                ? 'All leave requests have been processed.'
                : 'No records found for this category.'}
            </p>
          </div>
        ) : (
          <div className="approvals-grid">
            {currentData.map((item) => (
              <div key={item.leave.id} className="approval-card">
                <div className="card-header">
                  <div className="employee-info">
                    <div className="employee-avatar">
                      {item.employee.avatar ? (
                        <img src={item.employee.avatar} alt={item.employee.name} />
                      ) : (
                        item.employee.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="employee-details">
                      <h3>{item.employee.name}</h3>
                      <p className="employee-department">{item.employee.department}</p>
                      <p className="employee-position">{item.employee.position || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="leave-status">
                    {activeTab === 'pending' ? (
                      <span className="status-badge pending">⏳ Pending HR Approval</span>
                    ) : activeTab === 'approved' ? (
                      <span className="status-badge approved">✅ HR Approved</span>
                    ) : (
                      <span className="status-badge rejected">❌ Rejected</span>
                    )}
                  </div>
                </div>

                <div className="card-body">
                  <div className="leave-details">
                    <div className="detail-row">
                      <span className="detail-label">Leave Type:</span>
                      <span className="detail-value">
                        {item.leaveType?.name || 'N/A'}
                        {item.leaveType?.requiresHRApproval && ' (HR Approval Required)'}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Dates:</span>
                      <span className="detail-value">
                        {new Date(item.leave.startDate).toLocaleDateString()} - {new Date(item.leave.endDate).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Duration:</span>
                      <span className="detail-value">
                        {item.leave.days} day{item.leave.days !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <div className="detail-row">
                      <span className="detail-label">Reason:</span>
                      <span className="detail-value reason">
                        {item.leave.reason}
                      </span>
                    </div>
                    
                    {item.manager && (
                      <div className="detail-row">
                        <span className="detail-label">Manager:</span>
                        <span className="detail-value">
                          {item.manager.name} ({item.manager.email})
                        </span>
                      </div>
                    )}
                    
                    <div className="detail-row">
                      <span className="detail-label">Applied On:</span>
                      <span className="detail-value">
                        {new Date(item.leave.appliedDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="card-footer">
                  <div className="action-buttons">
                    <button 
                      className="action-btn view-btn"
                      onClick={() => openLeaveDetails(item)}
                    >
                      👁️ View Details
                    </button>
                    
                    {activeTab === 'pending' && (
                      <>
                        <button 
                          className="action-btn approve-btn"
                          onClick={() => handleApprove(item.leave.id)}
                          disabled={isProcessing === item.leave.id}
                        >
                          {isProcessing === item.leave.id ? (
                            <div className="loading-spinner-small"></div>
                          ) : (
                            '✅ Approve'
                          )}
                        </button>
                        
                        <button 
                          className="action-btn reject-btn"
                          onClick={() => openRejectModal(item.leave.id)}
                          disabled={isProcessing === item.leave.id}
                        >
                          {isProcessing === item.leave.id ? (
                            <div className="loading-spinner-small"></div>
                          ) : (
                            '❌ Reject'
                          )}
                        </button>
                      </>
                    )}
                    
                    {activeTab === 'approved' && (
                      <button 
                        className="action-btn download-btn"
                        onClick={() => generatePDF(item)}
                      >
                        📄 Generate Certificate
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Leave Details Modal */}
      {showDetailsModal && selectedLeave && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>Leave Request Details</h2>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedLeave(null);
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="details-container">
                <div className="section">
                  <h3>Employee Information</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Name:</label>
                      <span>{selectedLeave.employee.name}</span>
                    </div>
                    <div className="info-item">
                      <label>Department:</label>
                      <span>{selectedLeave.employee.department}</span>
                    </div>
                    <div className="info-item">
                      <label>Position:</label>
                      <span>{selectedLeave.employee.position || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <label>Email:</label>
                      <span>{selectedLeave.employee.email}</span>
                    </div>
                    {selectedLeave.employee.phone && (
                      <div className="info-item">
                        <label>Phone:</label>
                        <span>{selectedLeave.employee.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="section">
                  <h3>Leave Details</h3>
                  <div className="info-grid">
                    <div className="info-item">
                      <label>Leave Type:</label>
                      <span>
                        {selectedLeave.leaveType?.name || 'N/A'}
                        {selectedLeave.leaveType?.requiresHRApproval && ' (Requires HR Approval)'}
                      </span>
                    </div>
                    <div className="info-item">
                      <label>Start Date:</label>
                      <span>{new Date(selectedLeave.leave.startDate).toLocaleDateString()}</span>
                    </div>
                    <div className="info-item">
                      <label>End Date:</label>
                      <span>{new Date(selectedLeave.leave.endDate).toLocaleDateString()}</span>
                    </div>
                    <div className="info-item">
                      <label>Duration:</label>
                      <span>{selectedLeave.leave.days} days</span>
                    </div>
                    <div className="info-item full-width">
                      <label>Reason:</label>
                      <p className="reason-text">{selectedLeave.leave.reason}</p>
                    </div>
                  </div>
                </div>

                {selectedLeave.manager && (
                  <div className="section">
                    <h3>Manager Approval</h3>
                    <div className="info-grid">
                      <div className="info-item">
                        <label>Manager:</label>
                        <span>{selectedLeave.manager.name}</span>
                      </div>
                      <div className="info-item">
                        <label>Email:</label>
                        <span>{selectedLeave.manager.email}</span>
                      </div>
                      {selectedLeave.leave.managerNotes && (
                        <div className="info-item full-width">
                          <label>Manager Notes:</label>
                          <p className="notes-text">{selectedLeave.leave.managerNotes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="section">
                  <h3>Application Timeline</h3>
                  <div className="timeline">
                    <div className="timeline-item">
                      <div className="timeline-marker applied"></div>
                      <div className="timeline-content">
                        <strong>Applied</strong>
                        <p>{new Date(selectedLeave.leave.appliedDate).toLocaleString()}</p>
                      </div>
                    </div>
                    
                    {selectedLeave.leave.managerApprovedDate && (
                      <div className="timeline-item">
                        <div className="timeline-marker manager-approved"></div>
                        <div className="timeline-content">
                          <strong>Manager Approved</strong>
                          <p>{new Date(selectedLeave.leave.managerApprovedDate).toLocaleString()}</p>
                          {selectedLeave.leave.managerNotes && (
                            <small>Notes: {selectedLeave.leave.managerNotes}</small>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {selectedLeave.leave.status === 'HR_APPROVED' && selectedLeave.leave.hrApprovedDate && (
                      <div className="timeline-item">
                        <div className="timeline-marker hr-approved"></div>
                        <div className="timeline-content">
                          <strong>HR Approved</strong>
                          <p>{new Date(selectedLeave.leave.hrApprovedDate).toLocaleString()}</p>
                          {selectedLeave.leave.hrNotes && (
                            <small>Notes: {selectedLeave.leave.hrNotes}</small>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {selectedLeave.leave.status === 'REJECTED' && (
                      <div className="timeline-item">
                        <div className="timeline-marker rejected"></div>
                        <div className="timeline-content">
                          <strong>Rejected</strong>
                          <p>{selectedLeave.leave.hrApprovedDate 
                            ? new Date(selectedLeave.leave.hrApprovedDate).toLocaleString()
                            : new Date(selectedLeave.leave.managerApprovedDate).toLocaleString()}
                          </p>
                          {selectedLeave.leave.hrNotes && (
                            <small>Notes: {selectedLeave.leave.hrNotes}</small>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="modal-footer">
              <div className="footer-actions">
                {activeTab === 'pending' && (
                  <>
                    <button 
                      className="action-btn approve-btn"
                      onClick={() => {
                        handleApprove(selectedLeave.leave.id);
                        setShowDetailsModal(false);
                      }}
                      disabled={isProcessing === selectedLeave.leave.id}
                    >
                      ✅ Approve Leave
                    </button>
                    
                    <button 
                      className="action-btn reject-btn"
                      onClick={() => {
                        setShowDetailsModal(false);
                        openRejectModal(selectedLeave.leave.id);
                      }}
                      disabled={isProcessing === selectedLeave.leave.id}
                    >
                      ❌ Reject Leave
                    </button>
                  </>
                )}
                
                {activeTab === 'approved' && (
                  <button 
                    className="action-btn download-btn"
                    onClick={() => {
                      generatePDF(selectedLeave);
                      setShowDetailsModal(false);
                    }}
                  >
                    📄 Generate Approval Certificate
                  </button>
                )}
                
                <button 
                  className="action-btn close-btn"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedLeave(null);
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal-content reject-modal">
            <div className="modal-header">
              <h2>Reject Leave Request</h2>
              <button 
                className="close-btn"
                onClick={() => {
                  setShowRejectModal(false);
                  setLeaveToReject(null);
                  setRejectionNotes('');
                }}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <p className="reject-warning">
                ⚠️ Are you sure you want to reject this leave request?
                This action cannot be undone. Please provide a reason for rejection.
              </p>
              
              <div className="form-group">
                <label htmlFor="rejectionNotes">Reason for Rejection *</label>
                <textarea
                  id="rejectionNotes"
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                  placeholder="Please provide a detailed reason for rejecting this leave request..."
                  rows={4}
                  required
                />
                <small className="help-text">
                  This feedback will be shared with the employee and their manager.
                </small>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="action-btn cancel-btn"
                onClick={() => {
                  setShowRejectModal(false);
                  setLeaveToReject(null);
                  setRejectionNotes('');
                }}
                disabled={isProcessing === leaveToReject}
              >
                Cancel
              </button>
              
              <button 
                className="action-btn reject-btn"
                onClick={() => leaveToReject && handleReject(leaveToReject, rejectionNotes)}
                disabled={!rejectionNotes.trim() || isProcessing === leaveToReject}
              >
                {isProcessing === leaveToReject ? (
                  <div className="loading-spinner-small"></div>
                ) : (
                  'Confirm Rejection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden PDF Template */}
      <div ref={pdfRef} style={{ display: 'none' }}>
        <div id="pdf-template">
          {/* PDF content will be generated here */}
        </div>
      </div>
    </div>
  );
};

export default HRApprovals;