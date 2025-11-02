import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LeaveService } from '../../utils/leaveService';
import './ApplyLeave.css';

interface LeaveFormData {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  emergencyContact: string;
}

const ApplyLeave: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState<LeaveFormData>({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    emergencyContact: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const leaveTypes = [
    'Annual Leave',
    'Sick Leave',
    'Emergency Leave',
    'Maternity Leave',
    'Paternity Leave',
    'Personal Leave',
    'Court Leave'
  ];

  const calculateDays = () => {
    if (formData.startDate && formData.endDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      const timeDiff = end.getTime() - start.getTime();
      const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      return days > 0 ? days : 0;
    }
    return 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsSubmitting(true);

    try {
      const days = calculateDays();
      if (days <= 0) {
        throw new Error('End date must be after start date');
      }

      if (!user) {
        throw new Error('User not found. Please login again.');
      }

      const leaveApplication = {
        employeeName: user.name || 'Unknown User',
        employeeId: user.id?.toString() || '1',
        employeeEmail: user.email || '',
        department: user.department || 'General',
        leaveType: formData.leaveType,
        startDate: formData.startDate,
        endDate: formData.endDate,
        days: days,
        status: 'pending' as const,
        reason: formData.reason,
        appliedDate: new Date().toISOString().split('T')[0],
        currentApprover: 'manager' as const,
        emergencyContact: formData.emergencyContact
      };

      // Try different creation methods
      let success = false;
      if (typeof LeaveService.createLeaveApplication === 'function') {
        LeaveService.createLeaveApplication(leaveApplication);
        success = true;
      } else if (typeof LeaveService.createApplication === 'function') {
        success = await LeaveService.createApplication(leaveApplication);
      }

      if (success) {
        // Reset form
        setFormData({
          leaveType: '',
          startDate: '',
          endDate: '',
          reason: '',
          emergencyContact: ''
        });
        setSuccess('✅ Leave application submitted successfully! Your manager will review it.');
      } else {
        throw new Error('Failed to create leave application');
      }

    } catch (error) {
      console.error('Error submitting leave application:', error);
      setError(error instanceof Error ? error.message : 'Failed to submit leave application');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof LeaveFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setError('');
    setSuccess('');
  };

  const isFormValid = () => {
    return formData.leaveType && 
           formData.startDate && 
           formData.endDate && 
           formData.reason &&
           calculateDays() > 0;
  };

  const days = calculateDays();

  return (
    <div className="apply-leave">
      <div className="page-header">
        <h1>Apply for Leave</h1>
        <p>Submit your leave request for approval</p>
      </div>

      <div className="leave-form-container">
        {error && (
          <div className="error-message">
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="leave-form">
          <div className="form-section">
            <h3>Leave Details</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Leave Type *</label>
                <select
                  value={formData.leaveType}
                  onChange={(e) => handleInputChange('leaveType', e.target.value)}
                  required
                >
                  <option value="">Select Leave Type</option>
                  {leaveTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>

              <div className="form-group">
                <label>End Date *</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  min={formData.startDate || new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
            </div>

            {days > 0 && (
              <div className="duration-display">
                <strong>Total Days: {days} day{days !== 1 ? 's' : ''}</strong>
                {user && (
                  <span className="balance-info">
                    Your vacation balance: {LeaveService.getEmployee(user.id || '')?.leaveBalance?.vacation || 18} days
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="form-section">
            <h3>Additional Information</h3>
            
            <div className="form-group">
              <label>Reason for Leave *</label>
              <textarea
                value={formData.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                placeholder="Please provide a detailed reason for your leave..."
                rows={4}
                required
              />
            </div>

            <div className="form-group">
              <label>Emergency Contact</label>
              <input
                type="text"
                value={formData.emergencyContact}
                onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                placeholder="Phone number for emergency contact"
              />
            </div>
          </div>

          <div className="workflow-info">
            <h4>📋 Approval Workflow</h4>
            <div className="workflow-steps">
              <div className="workflow-step">
                <span className="step-number">1</span>
                <div className="step-info">
                  <strong>Manager Approval</strong>
                  <p>Your direct manager will review first</p>
                </div>
              </div>
              <div className="workflow-step">
                <span className="step-number">2</span>
                <div className="step-info">
                  <strong>HR Final Approval</strong>
                  <p>HR department gives final approval</p>
                </div>
              </div>
              <div className="workflow-step">
                <span className="step-number">3</span>
                <div className="step-info">
                  <strong>Get Notified</strong>
                  <p>You'll be notified at each step</p>
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="submit-btn"
              disabled={!isFormValid() || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Leave Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApplyLeave;