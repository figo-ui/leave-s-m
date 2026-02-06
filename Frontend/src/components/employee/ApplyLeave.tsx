import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import type { LeaveType, LeaveBalance } from '../../types';
import { useTranslation } from 'react-i18next';
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
  emergencyContact?: string;
  handoverNotes?: string;
  general?: string;
}

const ApplyLeave: React.FC = () => {
  const { user } = useAuth();
  const { t } = useTranslation();
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
        setError(t('apply_leave.errors.load_leave_types'));
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
      setError(t('apply_leave.errors.load_required_data'));
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

  const validateField = (field: keyof LeaveFormData, value: string | undefined): string => {
    const fieldValue = value ?? '';

    switch (field) {
      case 'leaveTypeId':
        if (!fieldValue) return t('apply_leave.validation.select_leave_type');
        return '';

      case 'startDate':
        if (!fieldValue) return t('apply_leave.validation.select_start_date');
        const startDate = new Date(fieldValue);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (startDate < today) {
          return t('apply_leave.validation.start_date_past');
        }
        return '';

      case 'endDate':
        if (!fieldValue) return t('apply_leave.validation.select_end_date');
        if (formData.startDate) {
          const startDate = new Date(formData.startDate);
          const endDate = new Date(fieldValue);
          if (endDate < startDate) {
            return t('apply_leave.validation.end_date_after');
          }
        }
        return '';

      case 'reason':
        if (!fieldValue.trim()) return t('apply_leave.validation.reason_required');
        if (fieldValue.trim().length < 10) return t('apply_leave.validation.reason_min');
        if (fieldValue.trim().length > 500) return t('apply_leave.validation.reason_max');
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
          errors.general = t('apply_leave.validation.insufficient_balance', { remaining: balance.remaining, requested: days });
        }
      } else {
        // No balance record found - use leave type max days as fallback
        if (days > selectedType.maxDays) {
          errors.general = t('apply_leave.validation.max_days', { max: selectedType.maxDays, requested: days });
        }
      }

      // Always check against max days
      if (days > selectedType.maxDays) {
        errors.general = t('apply_leave.validation.max_days', { max: selectedType.maxDays, requested: days });
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
      setError(t('apply_leave.errors.fix_validation'));
      return;
    }

    try {
      setIsSubmitting(true);

      if (!user) {
        throw new Error(t('apply_leave.errors.auth_failed'));
      }

      const days = calculateDays();
      const selectedType = getSelectedLeaveType();

      // Prepare data for backend API
      const leaveApplication = {
        leaveTypeId: parseInt(formData.leaveTypeId || '0', 10),
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
        
        const startDateLabel = new Date(leaveApplication.startDate).toLocaleDateString();
        const endDateLabel = new Date(leaveApplication.endDate).toLocaleDateString();
        const successMessage = [
          t('apply_leave.success.submitted'),
          '',
          t('apply_leave.success.details'),
          t('apply_leave.success.type', { type: selectedType?.name }),
          t('apply_leave.success.duration', { days }),
          t('apply_leave.success.dates', { start: startDateLabel, end: endDateLabel }),
          t('apply_leave.success.status'),
          selectedType?.requiresHRApproval ? t('apply_leave.success.requires_hr') : '',
          '',
          t('apply_leave.success.next_steps')
        ].filter(Boolean).join('\n');
        
        setSuccess(successMessage);
        
        // Refresh balances after successful submission
        setTimeout(() => {
          loadInitialData();
        }, 1000);
        
      } else {
        throw new Error(response.message || t('apply_leave.errors.submit_failed'));
      }

    } catch (error: any) {
      console.error('❌ Error submitting leave application:', error);
      
      // Enhanced error handling with specific messages
      let errorMessage = error.message || t('apply_leave.errors.submit_failed');
      
      if (error.message.includes('Leave balance not found')) {
        errorMessage = t('apply_leave.errors.balance_missing');
      } else if (error.message.includes('Unexpected response type') || error.message.includes('Cannot POST')) {
        errorMessage = t('apply_leave.errors.service_unavailable');
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = t('apply_leave.errors.network');
      } else if (error.message.includes('500') || error.message.includes('Internal Server Error')) {
        errorMessage = t('apply_leave.errors.server');
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
          <h1>{t('apply_leave.title')}</h1>
          <p>{t('apply_leave.subtitle_loading')}</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{t('apply_leave.loading_info')}</p>
          <small>{t('apply_leave.loading_setup')}</small>
        </div>
      </div>
    );
  }

  return (
    <div className="apply-leave">
      <div className="page-header">
        <h1>{t('apply_leave.title')}</h1>
        <p>{t('apply_leave.subtitle')}</p>
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
              <strong>{t('apply_leave.errors.submission_failed')}</strong>
              <button 
                onClick={() => setError('')} 
                className="error-close"
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
            <p>{error}</p>
            {(error.includes('balance') || error.includes('500')) && (
              <div className="recovery-suggestion">
                <p><strong>{t('apply_leave.errors.suggested_solutions')}</strong></p>
                <ul>
                  <li>{t('apply_leave.errors.solution_wait')}</li>
                  <li>{t('apply_leave.errors.solution_contact_hr')}</li>
                  <li>{t('apply_leave.errors.solution_select_other')}</li>
                  <li>{t('apply_leave.errors.solution_check_dates')}</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {validationErrors.general && (
          <div className="error-message">
            <div className="error-header">
              <span className="error-icon">⚠️</span>
              <strong>{t('apply_leave.errors.validation_error')}</strong>
            </div>
            <p>{validationErrors.general}</p>
          </div>
        )}

        {success && (
          <div className="success-message">
            <div className="success-header">
              <span className="success-icon">✅</span>
              <strong>{t('apply_leave.success.header')}</strong>
              <button 
                onClick={() => setSuccess('')} 
                className="success-close"
                aria-label={t('common.close')}
              >
                ×
              </button>
            </div>
            <div className="success-content">
              <pre>{success}</pre>
              <div className="next-steps">
                <h4>{t('apply_leave.success.next_title')}</h4>
                <div className="steps-timeline">
                  <div className="step-item current">
                    <div className="step-marker">1</div>
                    <div className="step-content">
                      <strong>{t('apply_leave.success.step1_title')}</strong>
                      <p>{t('apply_leave.success.step1_desc')}</p>
                    </div>
                  </div>
                  <div className="step-item">
                    <div className="step-marker">2</div>
                    <div className="step-content">
                      <strong>{t('apply_leave.success.step2_title')}</strong>
                      <p>{t('apply_leave.success.step2_desc')}</p>
                      <small>{t('apply_leave.success.step2_time')}</small>
                    </div>
                  </div>
                  {selectedType?.requiresHRApproval && (
                    <div className="step-item">
                      <div className="step-marker">3</div>
                      <div className="step-content">
                        <strong>{t('apply_leave.success.step3_title')}</strong>
                        <p>{t('apply_leave.success.step3_desc')}</p>
                        <small>{t('apply_leave.success.step3_time')}</small>
                      </div>
                    </div>
                  )}
                  <div className="step-item">
                    <div className="step-marker">{selectedType?.requiresHRApproval ? '4' : '3'}</div>
                    <div className="step-content">
                      <strong>{t('apply_leave.success.step4_title')}</strong>
                      <p>{t('apply_leave.success.step4_desc')}</p>
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
              <h3>{t('apply_leave.sections.details')}</h3>
              
              <div className="form-row">
                <div className="form-group">
                  <label>{t('apply_leave.fields.leave_type')} *</label>
                  <select
                    value={formData.leaveTypeId}
                    onChange={(e) => handleInputChange('leaveTypeId', e.target.value)}
                    className={validationErrors.leaveTypeId ? 'error' : ''}
                    required
                    disabled={isSubmitting}
                  >
                    <option value="">{t('apply_leave.placeholders.select_leave_type')}</option>
                    {leaveTypes
                      .filter(type => type.isActive)
                      .map(type => {
                        const typeBalance = getLeaveBalance(type.id);
                        const remaining = typeBalance ? typeBalance.remaining : type.maxDays;
                        return (
                          <option 
                            key={type.id} 
                            value={type.id.toString()}
                            disabled={typeBalance ? typeBalance.remaining <= 0 : false}
                          >
                            {type.name} ({remaining}/{type.maxDays} {t('dashboard.days')})
                            {type.requiresHRApproval && ` - ${t('apply_leave.hr_approval')}`}
                            {typeBalance && typeBalance.remaining <= 0 && ` - ${t('apply_leave.no_balance')}`}
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
                          <strong>{t('apply_leave.balance.your_balance')}:</strong> {balance.remaining} {t('apply_leave.balance.of')} {balance.total} {t('dashboard.days')} {t('apply_leave.balance.remaining')}
                          {balance.remaining <= 3 && (
                            <span className="low-balance-warning"> ⚠️ {t('apply_leave.balance.low')}</span>
                          )}
                        </div>
                      ) : (
                        <div className="balance-warning">
                          <strong>⚠️ {t('apply_leave.balance.not_found')}:</strong> {t('apply_leave.balance.using_default', { days: selectedType.maxDays })}
                        </div>
                      )}
                      {selectedType.requiresHRApproval && (
                        <div className="hr-approval-notice">
                          ⚠️ {t('apply_leave.hr_approval_notice')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>{t('apply_leave.fields.start_date')} *</label>
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
                  <label>{t('apply_leave.fields.end_date')} *</label>
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
                    <strong>{t('apply_leave.total_days', { days })}</strong>
                    {selectedType && balance && (
                      <span className={`balance-status ${
                        days > balance.remaining ? 'warning' : 
                        balance.remaining - days <= 3 ? 'caution' : 'success'
                      }`}>
                        ({t('apply_leave.days_will_remain', { days: balance.remaining - days })})
                      </span>
                    )}
                    {selectedType && !balance && (
                      <span className="balance-status info">
                        ({t('apply_leave.using_default_allocation')})
                      </span>
                    )}
                  </div>
                  
                  {selectedType && days > selectedType.maxDays && (
                    <div className="validation-message error">
                      ⚠️ {t('apply_leave.exceeds_max', { max: selectedType.maxDays })}
                    </div>
                  )}
                  
                  {selectedType && balance && days <= balance.remaining && days <= selectedType.maxDays && (
                    <div className="validation-message success">
                      ✅ {t('apply_leave.within_limits', { type: selectedType.name })}
                    </div>
                  )}
                  
                  {selectedType && !balance && days <= selectedType.maxDays && (
                    <div className="validation-message info">
                      ℹ️ {t('apply_leave.balance_auto_create')}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="form-section">
              <h3>{t('apply_leave.sections.additional')}</h3>
              
              <div className="form-group full-width">
                <label>{t('apply_leave.fields.reason')} *</label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => handleInputChange('reason', e.target.value)}
                  placeholder={t('apply_leave.placeholders.reason')}
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
                    {t('apply_leave.characters_count', { count: formData.reason.length })}
                    {formData.reason.length < 10 && ` (${t('apply_leave.min_required')})`}
                    {formData.reason.length > 400 && ` (${t('apply_leave.approaching_limit')})`}
                  </div>
                  {validationErrors.reason && (
                    <span className="field-error">{validationErrors.reason}</span>
                  )}
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>{t('apply_leave.fields.emergency_contact')}</label>
                  <input
                    type="text"
                    value={formData.emergencyContact}
                    onChange={(e) => handleInputChange('emergencyContact', e.target.value)}
                    placeholder={t('apply_leave.placeholders.emergency_contact')}
                    disabled={isSubmitting}
                    maxLength={20}
                  />
                  <small>{t('apply_leave.help.emergency_contact')}</small>
                </div>

                <div className="form-group">
                  <label>{t('apply_leave.fields.handover_notes')}</label>
                  <textarea
                    value={formData.handoverNotes}
                    onChange={(e) => handleInputChange('handoverNotes', e.target.value)}
                    placeholder={t('apply_leave.placeholders.handover_notes')}
                    rows={2}
                    disabled={isSubmitting}
                    maxLength={200}
                  />
                  <small>{t('apply_leave.help.handover_notes')}</small>
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
                    {t('apply_leave.submitting')}
                  </>
                ) : (
                  <>
                    <span className="btn-icon">📨</span>
                    {t('apply_leave.submit')}
                  </>
                )}
              </button>
              
              {!isFormValid() && (
                <div className="validation-hint">
                  ⚠️ {t('apply_leave.validation_hint')}
                </div>
              )}
            </div>
          </form>
        )}

        {/* Quick Actions */}
        {!success && (
          <div className="quick-actions">
            <h4>{t('apply_leave.quick_actions')}</h4>
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
                🗑️ {t('apply_leave.actions.clear_form')}
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
                🧪 {t('apply_leave.actions.fill_example')}
              </button>
              <button 
                type="button" 
                className="action-btn secondary"
                onClick={loadInitialData}
                disabled={isSubmitting}
              >
                🔄 {t('apply_leave.actions.refresh_data')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ApplyLeave;
