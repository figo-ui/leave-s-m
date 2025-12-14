import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import './LeaveTypes.css';

interface LeaveType {
  id: number;
  name: string;
  maxDays: number;
  description?: string;
  color?: string;
  isActive: boolean;
  requiresHRApproval: boolean;
  carryOver: boolean;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

const LeaveTypes: React.FC = () => {
  const { user } = useAuth();
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
        setError(response.message || 'Failed to load leave types');
      }
    } catch (error: any) {
      console.error('Error loading leave types:', error);
      setError(error.message || 'Failed to load leave types');
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
        setSuccess(`Leave type "${leaveType.name}" ${!leaveType.isActive ? 'activated' : 'deactivated'} successfully`);
        
        // Update local state
        setLeaveTypes(prev => 
          prev.map(lt => 
            lt.id === leaveType.id 
              ? { ...lt, isActive: !lt.isActive }
              : lt
          )
        );
      } else {
        throw new Error(response.message || 'Failed to update status');
      }
    } catch (error: any) {
      console.error('Error toggling leave type status:', error);
      setError(error.message || 'Failed to update leave type status');
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
        setError('Leave type name is required');
        return;
      }

      if (formData.maxDays < 1) {
        setError('Maximum days must be at least 1');
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
        setSuccess(`Leave type "${formData.name}" ${editingType ? 'updated' : 'created'} successfully`);
        resetForm();
        await loadLeaveTypes();
      } else {
        throw new Error(response.message || `Failed to ${editingType ? 'update' : 'create'} leave type`);
      }
    } catch (error: any) {
      console.error('Error saving leave type:', error);
      setError(error.message || `Failed to ${editingType ? 'update' : 'create'} leave type`);
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
      name: leaveType.name,
      maxDays: leaveType.maxDays,
      description: leaveType.description || '',
      color: leaveType.color || '#3B82F6',
      requiresHRApproval: leaveType.requiresHRApproval,
      carryOver: leaveType.carryOver,
      requiresApproval: leaveType.requiresApproval
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
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
          <h1>Leave Types Management</h1>
          <p>Configure different types of leave available in the system</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading leave types...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="leave-types">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>Leave Types Management</h1>
            <p>Configure different types of leave available in the system</p>
          </div>
          <button 
            className="add-btn primary"
            onClick={() => {
              resetForm();
              setShowAddForm(true);
            }}
            disabled={showAddForm}
          >
            + Add Leave Type
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
            <h3>{editingType ? 'Edit Leave Type' : 'Add New Leave Type'}</h3>
            <button className="close-btn" onClick={resetForm}>×</button>
          </div>
          
          <form onSubmit={handleSubmit} className="leave-type-form">
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Leave Type Name *</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  placeholder="e.g., Annual Leave, Sick Leave"
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="maxDays">Maximum Days *</label>
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
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Brief description of this leave type..."
                rows={3}
              />
            </div>

            <div className="form-group">
              <label htmlFor="color">Color</label>
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
                  Requires HR Approval
                </label>
                <small>This leave type will require additional HR approval after manager approval</small>
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
                  Allow Carry Over
                </label>
                <small>Unused days can be carried over to next year</small>
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
                  Requires Approval
                </label>
                <small>Leave requests require manager approval</small>
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="save-btn primary">
                {editingType ? 'Update Leave Type' : 'Create Leave Type'}
              </button>
              <button type="button" className="cancel-btn" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Leave Types Table */}
      <div className="table-section">
        <div className="table-header">
          <h3>Available Leave Types</h3>
          <div className="table-stats">
            <span className="stat">
              Total: {leaveTypes.length}
            </span>
            <span className="stat">
              Active: {leaveTypes.filter(lt => lt.isActive).length}
            </span>
          </div>
        </div>

        {leaveTypes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No Leave Types Configured</h3>
            <p>Get started by adding your first leave type to the system.</p>
            <button 
              className="add-btn primary"
              onClick={() => {
                resetForm();
                setShowAddForm(true);
              }}
            >
              + Add First Leave Type
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="leave-types-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Max Days</th>
                  <th>HR Approval</th>
                  <th>Carry Over</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
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
                      <span className="max-days">{leaveType.maxDays} days</span>
                    </td>
                    <td>
                      <span className={`status-badge ${leaveType.requiresHRApproval ? 'yes' : 'no'}`}>
                        {leaveType.requiresHRApproval ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${leaveType.carryOver ? 'yes' : 'no'}`}>
                        {leaveType.carryOver ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${leaveType.isActive ? 'active' : 'inactive'}`}>
                        {leaveType.isActive ? 'Active' : 'Inactive'}
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
                          title="Edit leave type"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className={`toggle-btn ${leaveType.isActive ? 'deactivate' : 'activate'}`}
                          onClick={() => toggleStatus(leaveType)}
                          disabled={actionLoading === leaveType.id}
                          title={leaveType.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {actionLoading === leaveType.id ? '...' : 
                           leaveType.isActive ? '⏸️ Deactivate' : '▶️ Activate'}
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