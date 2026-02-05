import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import type { LeaveType, LeaveBalance } from '../../types';
import './ApplyLeave.css';

interface LeaveFormData {
  leaveTypeId?: string;
  startDate: string;
  endDate: string;
  reason: string;
  emergencyContact: string;
  handoverNotes: string;
}

interface ValidationErrors {
  leaveTypeId?: string;
  startDate?: string;
  endDate?: string;
  reason?: string;
  general?: string;
}

const ApplyLeave: React.FC = () => {
  const { user } = useAuth();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [debugInfo, setDebugInfo] = useState('');

  const [formData, setFormData] = useState<LeaveFormData>({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
    emergencyContact: '',
    handoverNotes: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Loading initial data for leave application...');
      
      const [leaveTypesResponse, balancesResponse] = await Promise.all([
        apiService.getLeaveTypes(),
        apiService.getLeaveBalances()
      ]);

      if (leaveTypesResponse.success) {
        setLeaveTypes(leaveTypesResponse.data || []);
        console.log(`✅ Loaded ${leaveTypesResponse.data?.length || 0} leave types`);
      } else {
        console.error('❌ Failed to load leave types:', leaveTypesResponse.message);
        setError('Failed to load leave types. Please refresh the page.');
      }

      if (balancesResponse.success) {
        setLeaveBalances(balancesResponse.data || []);
        console.log(`✅ Loaded ${balancesResponse.data?.length || 0} leave balances`);
      } else {
        console.warn('⚠️ Failed to load leave balances:', balancesResponse.message);
        // Don't set error for balances - we can proceed without them
      }

      setDebugInfo(`
        User: ${user?.name} (${user?.id})
        Leave Types: ${leaveTypesResponse.data?.length || 0}
        Leave Balances: ${balancesResponse.data?.length || 0}
        Last Updated: ${new Date().toLocaleTimeString()}
      `);

    } catch (error: unknown) {
      console.error('💥 Error loading initial data:', error);
      setError('Failed to load required data. Please refresh the page or contact support.');
    } finally {
      setLoading(false);
    }
  };

  const calculateDays = (start?: string, end?: string): number => {
    const startDate = start || formData.startDate;
    const endDate = end || formData.endDate;
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Handle same day leave
      if (start.toDateString() === end.toDateString()) {
        return 1;
      }
      
      const timeDiff = end.getTime() - start.getTime();
      const days = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
      return days > 0 ? days : 0;
    }
    return 0;
  };

  const getSelectedLeaveType = (): LeaveType | undefined => {
    return leaveTypes.find(type => type.id.toString() === formData.leaveTypeId);
  };

  const getLeaveBalance = (leaveTypeId: number): LeaveBalance | undefined => {
    return leaveBalances.find(balance => balance.leaveTypeId === leaveTypeId);
  };

  const validateField = (field: keyof LeaveFormData, value: string): string => {
    const days = calculateDays();
    const selectedType = getSelectedLeaveType();

    switch (field) {
      case 'leaveTypeId':
        if (!value) return 'Please select a leave type';
        return '';

      case 'startDate':
        if (!value) return 'Please select start date';
        const startDate = new Date(value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (startDate < today) {
          return 'Start date cannot be in the past';
        }
        return '';

      case 'endDate':
        if (!value) return 'Please select end date';
        if (formData.startDate) {
          const startDate = new Date(formData.startDate);
          const endDate = new Date(value);
          if (endDate < startDate) {
            return 'End date must be after start date';
          }
        }
        return '';

      case 'reason':
        if (!value.trim()) return 'Please provide a reason for leave';
        if (value.trim().length < 10) return 'Reason must be at least 10 characters long';
        if (value.trim().length > 500) return 'Reason must be less than 500 characters';
        return '';

      default:
        return '';
    }
  };

  const validateForm = (): ValidationErrors => {
    const errors: ValidationErrors = {};
    const days = calculateDays();
    const selectedType = getSelectedLeaveType();

    // Validate individual fields
    (Object.keys(formData) as Array<keyof LeaveFormData>).forEach(field => {
      if (field !== 'emergencyContact' && field !== 'handoverNotes') {
        const error = validateField(field, formData[field]);
        if (error) errors[field] = error;
      }
    });

    // Validate business rules
    if (selectedType && days > 0) {
      const balance = getLeaveBalance(selectedType.id);
      
      // Check if we have sufficient balance
      if (balance) {
        if (days > balance.remaining) {
          errors.general = `Insufficient leave balance. You have ${balance.remaining} days remaining but requested ${days} days.`;
        }
      } else {
        // No balance record found - use leave type max days as fallback
        if (days > selectedType.maxDays) {
          errors.general = `This leave type allows maximum ${selectedType.maxDays} days. You selected ${days} days.`;
        }
      }

      // Always check against max days
      if (days > selectedType.maxDays) {
        errors.general = `This leave type allows maximum ${selectedType.maxDays} days. You selected ${days} days.`;
      }
    }

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setValidationErrors({});

    const errors = validateForm();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setError('Please fix the validation errors below before submitting.');
      return;
    }

    try {
      setIsSubmitting(true);

      if (!user) {
        throw new Error('User authentication failed. Please log in again.');
      }

      const days = calculateDays();
      const selectedType = getSelectedLeaveType();

      // Prepare data for backend API
      const leaveApplication = {
        leaveTypeId: parseInt(formData.leaveTypeId),
        startDate: formData.startDate,
        endDate: formData.endDate,
        reason: formData.reason.trim(),
        // Include optional fields if they have values
        ...(formData.emergencyContact && { emergencyContact: formData.emergencyContact }),
        ...(formData.handoverNotes && { handoverNotes: formData.handoverNotes })
      };

      console.log('📤 Submitting leave application:', {
        ...leaveApplication,
        calculatedDays: days,
        employeeId: user.id,
        employeeName: user.name
      });

      const response = await apiService.applyLeave(leaveApplication);

      if (response.success) {
        console.log('✅ Leave application submitted successfully:', response.data);
        
        // Reset form
        setFormData({
          leaveTypeId: '',
          startDate: '',
          endDate: '',
          reason: '',
          emergencyContact: '',
          handoverNotes: ''
        });
        
        const successMessage = `
          ✅ Leave application submitted successfully!

          📋 Application Details:
          • Type: ${selectedType?.name}
          • Duration: ${days} days
          • Dates: ${new Date(leaveApplication.startDate).toLocaleDateString()} - ${new Date(leaveApplication.endDate).toLocaleDateString()}
          • Status: Pending Manager Approval
          ${selectedType?.requiresHRApproval ? '• ⚠️ Requires additional HR approval' : ''}

          Your manager will review it shortly. You'll receive notifications at each step.
        `;
        
        setSuccess(successMessage);
        
        // Refresh balances after successful submission
        setTimeout(() => {
          loadInitialData();
        }, 1000);
        
      } else {
        throw new Error(response.message || 'Failed to submit leave application. Please try again.');
      }

    } catch (error: any) {
      console.error('❌ Error submitting leave application:', error);
      
      // Enhanced error handling with specific messages
      let errorMessage = error.message || 'Failed to submit leave application. Please try again.';
      
      if (error.message.includes('Leave balance not found')) {
        errorMessage = 'Your leave balance record is missing. The system will attempt to create it automatically. Please try again in a moment.';
      } else if (error.message.includes('Unexpected response type') || error.message.includes('Cannot POST')) {
        errorMessage = 'Leave application service is currently unavailable. Please try again later or contact IT support.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network connection error. Please check your internet connection and try again.';
      } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
        errorMessage = 'Server error occurred. This might be due to missing leave balances. The system administrator has been notified.';
      }
      
      setError(errorMessage);
      
      // Set debug info for troubleshooting
      setDebugInfo(prev => prev + `\nSubmit Error: ${error.message}\nTime: ${new Date().toLocaleTimeString()}`);
      
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof LeaveFormData, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }

    // Clear general error when user makes changes
    if (error && field !== 'emergencyContact' && field !== 'handoverNotes') {
      setError('');
    }
  };

  const handleDateChange = (field: 'startDate' | 'endDate', value: string) => {
    handleInputChange(field, value);
    
    // Auto-adjust end date if start date is changed to be after current end date
    if (field === 'startDate' && formData.endDate && new Date(value) > new Date(formData.endDate)) {
      handleInputChange('endDate', value);
    }
  };

  const isFormValid = (): boolean => {
    const errors = validateForm();
    return Object.keys(errors).length === 0;
  };

  const days = calculateDays();
  const selectedType = getSelectedLeaveType();
  const balance = selectedType ? getLeaveBalance(selectedType.id) : null;

  if (loading) {
    return (
      <div className="apply-leave">
        <div className="page-header">
          <h1>Apply for Leave</h1>
          <p>Submit your leave request for approval</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading leave information...</p>
          <small>Setting up your leave application form</small>
        </div>
      </div>
    );
  }

  return (
    <div className="apply-leave">
      <div className="page-header">
        <h1>Apply for Leave</h1>
        <p>Submit your leave request for manager approval</p>
      </div>

      {/* Debug Info - Remove in production */}
      {process.env.NODE_ENV === 'development' && debugInfo && (
        <div className="debug-panel">
          <details>
            <summary>🔧 Debug Information</summary>
            <pre>{debugInfo}</pre>
          </details>
        </div>
      )}

      <div className="leave-form-container">
        {error && (
          <div className="error-message">
            <div className="error-header">
              <span className="error-icon">❌</span>
              <strong>Submission Failed</strong>
              <button 
                onClick={() => setError('')} 
                className="error-close"
              >
                ×
              </button>
            </div>
            <p>{error}</p>
            {(error.includes('balance') || error.includes('500')) && (
              <div className="recovery-suggestion">
                <p><strong>Suggested Solutions:</strong></p>
                <ul>
                  <li>Wait a moment and try again</li>
                  <li>Contact HR to verify your leave balances</li>
                  <li>Try selecting a different leave type</li>
                  <li>Ensure your dates are valid and within allowed limits</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {validationErrors.general && (
          <div className="error-message">
            <div className="error-header">
              <span className="error-icon">⚠️</span>
              <strong>Validation Error</strong>
            </div>
            <p>{validationErrors.general}</p>
          </div>
        )}

        {success && (
          <div className="success-message">
            <div className="success-header">
              <span className="success-icon">✅</span>
              <strong>Application Submitted Successfully!</strong>
              <button 
                onClick={() => setSuccess('')} 
                className="success-close"
              >
                ×
              </button>
            </div>
            <div className="success-content">
              <pre>{success}</pre>
              <div className="next-steps">
                <h4>📋 What happens next?</h4>
                <div className="steps-timeline">
                  <div className="step-item current">
                    <div className="step-marker">1</div>
                    <div className="step-content">
                      <strong>Application Submitted</strong>
                      <p>Your leave request has been received</p>
                    </div>
                  </div>
                  <div className="step-item">
                    <div className="step-marker">2</div>
                    <div className="step-content">
                      <strong>Manager Review</strong>
                      <p>Your manager will review the request</p>
                      <small>Usually within 24-48 hours</small>
                    </div>
                  </div>
                  {selectedType?.requiresHRApproval && (
                    <div className="step-item">
                      <div className="step-marker">3</div>
                      <div className="step-content">
                        <strong>HR Approval</strong>
                        <p>HR department will give final approval</p>
                        <small>Additional review required</small>
                      </div>
                    </div>
                  )}
                  <div className="step-item">
                    <div className="step-marker">{selectedType?.requiresHRApproval ? '4' : '3'}</div>
                    <div className="step-content">
                      <strong>Final Confirmation</strong>
                      <p>You'll receive final decision notification</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {!success && (
          <form onSubmit={handleSubmit} className="leave-form">
            <div className="form-section">
              <h3>📅 Leave Details</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>Leave Type *</label>
                  <select
                    value={formData.leaveTypeId}
                    onChange={(e) => handleInputChange('leaveTypeId', e.target.value)}
                    className={validationErrors.leaveTypeId ? 'error' : ''}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">Select Leave Type</option>
                    {leaveTypes
                      .filter(type => type.isActive)
                      .map(type => {
                        const typeBalance = getLeaveBalance(type.id);
                        const remaining = typeBalance ? typeBalance.remaining : type.maxDays;
                        const isLowBalance = typeBalance && typeBalance.remaining <= 3;
                        
                        return (
                          <option 
                            key={type.id} 
                            value={type.id.toString()}
                            disabled={typeBalance ? typeBalance.remaining <= 0 : false}
                          >
                            {type.name} ({remaining}/{type.maxDays} days)
                            {type.requiresHRApproval && ' - HR Approval'}
                            {typeBalance && typeBalance.remaining <= 0 && ' - No Balance'}
                          </option>
                        );
                      })
                    }
                  </select>
                  {validationErrors.leaveTypeId && (
                    <span className="field-error">{validationErrors.leaveTypeId}</span>
                  )}
                  {selectedType && (
                    <div className="leave-type-info">
                      <p className="type-description">{selectedType.description}</p>
                      {balance ? (
                        <div className={`balance-info ${balance.remaining <= 3 ? 'low-balance' : ''}`}>
                          <strong>Your Balance:</strong> {balance.remaining} of {balance.total} days remaining
                          {balance.remaining <= 3 && (
                            <span className="low-balance-warning"> ⚠️ Low balance</span>
                          )}
                        </div>
                      ) : (
                        <div className="balance-warning">
                          <strong>⚠️ Balance Not Found:</strong> Using default {selectedType.maxDays} days
                        </div>
                      )}
                      {selectedType.requiresHRApproval && (
                        <div className="hr-approval-notice">
                          ⚠️ This leave type requires additional HR approval
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>Start Date *</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={(e) => handleDateChange('startDate', e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className={validationErrors.startDate ? 'error' : ''}
                    required
                    disabled={isSubmitting}
                  />
                  {validationErrors.startDate && (
                    <span className="field-error">{validationErrors.startDate}</span>
                  )}
                </div>

                <div className="form-group">
                  <label>End Date *</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={(e) => handleInputChange('endDate', e.target.value)}
                    min={formData.startDate || new Date().toISOString().split('T')[0]}
                    className={validationErrors.endDate ? 'error' : ''}
                    required
                    disabled={isSubmitting}
                  />
                  {validationErrors.endDate && (
                    <span className="field-error">{validationErrors.endDate}</span>
                  )}
                </div>
              </div>

              {(days > 0 || formData.startDate || formData.endDate) && (
                <div className="duration-info">
                  <div className="duration-display">
                    <strong>Total Days: {days} day{days !== 1 ? 's' : ''}</strong>
                    {selectedType && balance && (
                      <span className={`balance-status ${
                        days > balance.remaining ? 'warning' : 
                        balance.remaining - days <= 3 ? 'caution' : 'success'
                      }`}>
                        ({balance.remaining - days} days will remain)
                      </span>
                    )}
                    {selectedType && !balance && (
                      <span className="balance-status info">
                        (Using default allocation)
                      </span>
                    )}
                  </div>
                  
                  {selectedType && days > selectedType.maxDays && (
                    <div className="validation-message error">
                      ⚠️ Exceeds maximum allowed days for this leave type ({selectedType.maxDays} days)
                    </div>
                  )}
                  
                  {selectedType && balance && days <= balance.remaining && days <= selectedType.maxDays && (
                    <div className="validation-message success">
                      ✅ Within allowed limits for {selectedType.name}
                    </div>
                  )}
                  
                  {selectedType && !balance && days <= selectedType.maxDays && (
                    <div className="validation-message info">
                      ℹ️ Leave balance will be automatically created upon submission
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-section">
              <h3>📝 Additional Information</h3>
              
              <div className="form-group full-width">
                <label>Reason for Leave *</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => handleInputChange('reason', e.target.value)}
                  placeholder="Please provide a detailed reason for your leave. Include relevant details that will help your manager understand your request. Minimum 10 characters required."
                  rows={4}
                  className={validationErrors.reason ? 'error' : ''}
                  required
                  disabled={isSubmitting}
                  minLength={10}
                  maxLength={500}
                />
                <div className="input-footer">
                  <div className={`char-count ${
                    formData.reason.length === 0 ? 'default' :
                    formData.reason.length < 10 ? 'warning' : 
                    formData.reason.length > 400 ? 'caution' : 'success'
                  }`}>
                    {formData.reason.length}/500 characters
                    {formData.reason.length < 10 && ' (minimum 10 required)'}
                    {formData.reason.length > 400 && ' (approaching limit)'}
                  </div>
                  {validationErrors.reason && (
                    <span className="field-error">{validationErrors.reason}</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Emergency Contact (Optional)</label>
                  <input
                    type="text"
                    value={formData.emergencyContact}
                    onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                    placeholder="Phone number for emergency contact"
                    disabled={isSubmitting}
                    maxLength={20}
                  />
                  <small>For urgent contact during your absence</small>
                </div>

                <div className="form-group">
                  <label>Handover Notes (Optional)</label>
                  <textarea
                    value={formData.handoverNotes}
                    onChange={(e) => handleInputChange('handoverNotes', e.target.value)}
                    placeholder="Brief notes about work handover, pending tasks, or important contacts..."
                    rows={2}
                    disabled={isSubmitting}
                    maxLength={200}
                  />
                  <small>Important information for colleagues covering your work</small>
                </div>
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className={`submit-btn ${!isFormValid() || isSubmitting ? 'disabled' : 'primary'}`}
                disabled={!isFormValid() || isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Submitting Application...
                  </>
                ) : (
                  <>
                    <span className="btn-icon">📨</span>
                    Submit Leave Application
                  </>
                )}
              </button>
              
              {!isFormValid() && (
                <div className="validation-hint">
                  ⚠️ Please complete all required fields correctly to submit your application
                </div>
              )}
            </div>
          </form>
        )}

        {/* Quick Actions */}
        {!success && (
          <div className="quick-actions">
            <h4>💡 Quick Actions</h4>
            <div className="action-buttons">
              <button 
                type="button" 
                className="action-btn secondary"
                onClick={() => {
                  setFormData({
                    leaveTypeId: '',
                    startDate: '',
                    endDate: '',
                    reason: '',
                    emergencyContact: '',
                    handoverNotes: ''
                  });
                  setValidationErrors({});
                  setError('');
                }}
                disabled={isSubmitting}
              >
                🗑️ Clear Form
              </button>
              <button 
                type="button" 
                className="action-btn secondary"
                onClick={() => {
                  const exampleStart = new Date(Date.now() + 86400000 * 7);
                  const exampleEnd = new Date(Date.now() + 86400000 * 9);
                  
                  setFormData({
                    leaveTypeId: leaveTypes[0]?.id.toString() || '',
                    startDate: exampleStart.toISOString().split('T')[0],
                    endDate: exampleEnd.toISOString().split('T')[0],
                    reason: 'Annual vacation with family. All urgent tasks have been completed and handed over to colleagues. Emergency contact available if needed.',
                    emergencyContact: '+251911223344',
                    handoverNotes: 'Project files are in the shared drive. Contact team lead for urgent matters. Client meetings rescheduled.'
                  });
                }}
                disabled={isSubmitting || leaveTypes.length === 0}
              >
                🧪 Fill Example
              </button>
              <button 
                type="button" 
                className="action-btn secondary"
                onClick={loadInitialData}
                disabled={isSubmitting}
              >
                🔄 Refresh Data
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplyLeave;