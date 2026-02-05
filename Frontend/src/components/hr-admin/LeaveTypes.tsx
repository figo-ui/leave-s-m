import React, { useState, useEffect } from 'react';
import { apiService } from '../../utils/api';
import type { LeaveType } from '../../types';
import { useTranslation } from 'react-i18next';
import './LeaveTypes.css';

const LeaveTypes: React.FC = () => {
  const { t, i18n } = useTranslation();

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    maxDays: 15,
    description: '',
    color: '#3B82F6',
    requiresHRApproval: false,
    carryOver: false,
    requiresApproval: true
  });

  useEffect(() => {
    loadLeaveTypes();
  }, []);

  const loadLeaveTypes = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.getLeaveTypes();
      
      if (response.success) {
        setLeaveTypes(response.data || []);
      } else {
        setError(response.message || t('leave_types.errors.load_failed'));
      }
    } catch (error: any) {
      console.error('Error loading leave types:', error);
      setError(error.message || t('leave_types.errors.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (leaveType: LeaveType) => {
    try {
      setActionLoading(leaveType.id);
      setError('');
      setSuccess('');

      console.log('🔄 Toggling leave type status:', {
        id: leaveType.id,
        currentStatus: leaveType.isActive,
        newStatus: !leaveType.isActive
      });

      // Use the specific status toggle endpoint
      const response = await apiService.patch(`/leave-types/${leaveType.id}/status`, {
        isActive: !leaveType.isActive
      });

      if (response.success) {
        setSuccess(
          !leaveType.isActive
            ? t('leave_types.messages.activated', { name: leaveType.name })
            : t('leave_types.messages.deactivated', { name: leaveType.name })
        );
        
        // Update local state
        setLeaveTypes(prev => 
          prev.map(lt => 
            lt.id === leaveType.id 
              ? { ...lt, isActive: !lt.isActive }
              : lt
          )
        );
      } else {
        throw new Error(response.message || t('leave_types.errors.update_status'));
      }
    } catch (error: any) {
      console.error('Error toggling leave type status:', error);
      setError(error.message || t('leave_types.errors.update_status'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setError('');
      setSuccess('');

      // Validate form
      if (!formData.name.trim()) {
        setError(t('leave_types.errors.name_required'));
        return;
      }

      if (formData.maxDays < 1) {
        setError(t('leave_types.errors.max_days_min'));
        return;
      }

      let response;
      
      if (editingType) {
        // Update existing leave type - only send changed fields
        const updateData = {
          name: formData.name,
          maxDays: formData.maxDays,
          description: formData.description,
          color: formData.color,
          requiresHRApproval: formData.requiresHRApproval,
          carryOver: formData.carryOver,
          requiresApproval: formData.requiresApproval
        };

        console.log('🔄 Updating leave type:', { id: editingType.id, updateData });
        
        response = await apiService.updateLeaveType(editingType.id, updateData);
      } else {
        // Create new leave type
        const createData = {
          name: formData.name,
          maxDays: formData.maxDays,
          description: formData.description,
          color: formData.color,
          requiresHRApproval: formData.requiresHRApproval,
          carryOver: formData.carryOver,
          requiresApproval: formData.requiresApproval
        };

        console.log('🆕 Creating leave type:', createData);
        
        response = await apiService.createLeaveType(createData);
      }

      if (response.success) {
        setSuccess(
          editingType
            ? t('leave_types.messages.updated', { name: formData.name })
            : t('leave_types.messages.created', { name: formData.name })
        );
        resetForm();
        await loadLeaveTypes();
      } else {
        throw new Error(response.message || t('leave_types.errors.save_failed'));
      }
    } catch (error: any) {
      console.error('Error saving leave type:', error);
      setError(error.message || t('leave_types.errors.save_failed'));
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      maxDays: 15,
      description: '',
      color: '#3B82F6',
      requiresHRApproval: false,
      carryOver: false,
      requiresApproval: true
    });
    setEditingType(null);
    setShowAddForm(false);
  };

  const handleEdit = (leaveType: LeaveType) => {
    setFormData({
      name: leaveType.name || '',
      maxDays: leaveType.maxDays,
      description: leaveType.description || '',
      color: leaveType.color || '#3B82F6',
      requiresHRApproval: leaveType.requiresHRApproval ?? false,
      carryOver: leaveType.carryOver,
      requiresApproval: leaveType.requiresApproval ?? true
    });
    setEditingType(leaveType);
    setShowAddForm(true);
    setError('');
    setSuccess('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked 
             : type === 'number' ? parseInt(value) || 0 
             : value
    }));
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return t('common.na');
    const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'om-ET' };
    const locale = localeMap[i18n.language] || 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  if (loading) {
    return (
      <div className="leave-types">
        <div className="page-header">
          <h1>{t('leave_types.title')}</h1>
          <p>{t('leave_types.subtitle')}</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{t('leave_types.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leave-types">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>{t('leave_types.title')}</h1>
            <p>{t('leave_types.subtitle')}</p>
          </div>
          <button 
            className="add-btn primary"
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            disabled={showAddForm}
          >
            + {t('leave_types.add')}
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
          <button onClick={clearMessages} className="message-close">×</button>
        </div>
      )}

      {success && (
        <div className="message-banner success">
          <div className="message-content">
            <span className="message-icon">✅</span>
            {success}
          </div>
          <button onClick={clearMessages} className="message-close">×</button>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="form-section">
          <div className="form-header">
            <h3>{editingType ? t('leave_types.edit_title') : t('leave_types.add_title')}</h3>
            <button className="close-btn" onClick={resetForm}>×</button>
          </div>
          
          <form onSubmit={handleSubmit} className="leave-type-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">{t('leave_types.form.name')} *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder={t('leave_types.form.name_placeholder')}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="maxDays">{t('leave_types.form.max_days')} *</label>
                <input
                  type="number"
                  id="maxDays"
                  name="maxDays"
                  value={formData.maxDays}
                  onChange={handleInputChange}
                  min="1"
                  max="365"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">{t('leave_types.form.description')}</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder={t('leave_types.form.description_placeholder')}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="color">{t('leave_types.form.color')}</label>
              <div className="color-input-group">
                <input
                  type="color"
                  id="color"
                  name="color"
                  value={formData.color}
                  onChange={handleInputChange}
                />
                <span className="color-value">{formData.color}</span>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="requiresHRApproval"
                    checked={formData.requiresHRApproval}
                    onChange={handleInputChange}
                  />
                  <span className="checkmark"></span>
                  {t('leave_types.form.requires_hr')}
                </label>
                <small>{t('leave_types.form.requires_hr_help')}</small>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="carryOver"
                    checked={formData.carryOver}
                    onChange={handleInputChange}
                  />
                  <span className="checkmark"></span>
                  {t('leave_types.form.carry_over')}
                </label>
                <small>{t('leave_types.form.carry_over_help')}</small>
              </div>

              <div className="form-group checkbox-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="requiresApproval"
                    checked={formData.requiresApproval}
                    onChange={handleInputChange}
                  />
                  <span className="checkmark"></span>
                  {t('leave_types.form.requires_approval')}
                </label>
                <small>{t('leave_types.form.requires_approval_help')}</small>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="save-btn primary">
                {editingType ? t('leave_types.form.update') : t('leave_types.form.create')}
              </button>
              <button type="button" className="cancel-btn" onClick={resetForm}>
                {t('common.cancel')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leave Types Table */}
      <div className="table-section">
        <div className="table-header">
          <h3>{t('leave_types.table.title')}</h3>
          <div className="table-stats">
            <span className="stat">
              {t('leave_types.table.total', { count: leaveTypes.length })}
            </span>
            <span className="stat">
              {t('leave_types.table.active', { count: leaveTypes.filter(lt => lt.isActive).length })}
            </span>
          </div>
        </div>

        {leaveTypes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>{t('leave_types.empty.title')}</h3>
            <p>{t('leave_types.empty.subtitle')}</p>
            <button 
              className="add-btn primary"
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
            >
              + {t('leave_types.empty.add_first')}
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="leave-types-table">
              <thead>
                <tr>
                  <th>{t('leave_types.table.name')}</th>
                  <th>{t('leave_types.table.max_days')}</th>
                  <th>{t('leave_types.table.hr_approval')}</th>
                  <th>{t('leave_types.table.carry_over')}</th>
                  <th>{t('leave_types.table.status')}</th>
                  <th>{t('leave_types.table.created')}</th>
                  <th>{t('leave_types.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {leaveTypes.map(leaveType => (
                  <tr key={leaveType.id} className={!leaveType.isActive ? 'inactive' : ''}>
                    <td>
                      <div className="leave-type-info">
                        <span 
                          className="color-indicator"
                          style={{ backgroundColor: leaveType.color || '#3B82F6' }}
                        ></span>
                        <div>
                          <div className="leave-type-name">{leaveType.name}</div>
                          {leaveType.description && (
                            <div className="leave-type-desc">{leaveType.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="max-days">{t('leave_types.table.days', { days: leaveType.maxDays })}</span>
                    </td>
                    <td>
                      <span className={`status-badge ${leaveType.requiresHRApproval ? 'yes' : 'no'}`}>
                        {leaveType.requiresHRApproval ? t('common.yes') : t('common.no')}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${leaveType.carryOver ? 'yes' : 'no'}`}>
                        {leaveType.carryOver ? t('common.yes') : t('common.no')}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${leaveType.isActive ? 'active' : 'inactive'}`}>
                        {leaveType.isActive ? t('leave_types.table.active_label') : t('leave_types.table.inactive_label')}
                      </span>
                    </td>
                    <td>
                      <span className="created-date">
                        {formatDate(leaveType.createdAt)}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="edit-btn"
                          onClick={() => handleEdit(leaveType)}
                          title={t('leave_types.table.edit_title')}
                        >
                          ✏️ {t('leave_types.table.edit')}
                        </button>
                        <button
                          className={`toggle-btn ${leaveType.isActive ? 'deactivate' : 'activate'}`}
                          onClick={() => toggleStatus(leaveType)}
                          disabled={actionLoading === leaveType.id}
                          title={leaveType.isActive ? t('leave_types.table.deactivate') : t('leave_types.table.activate')}
                        >
                          {actionLoading === leaveType.id ? '...' : 
                           leaveType.isActive ? `⏸️ ${t('leave_types.table.deactivate')}` : `▶️ ${t('leave_types.table.activate')}`}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeaveTypes;
