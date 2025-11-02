import React, { useState } from 'react';
import './LeaveTypes.css';

interface LeaveType {
  id: string;
  name: string;
  description: string;
  maxDays: number;
  requiresApproval: boolean;
  isActive: boolean;
  carryOverAllowed: boolean;
  maxCarryOverDays: number;
  requiresDocumentation: boolean;
  color: string;
}

const LeaveTypes: React.FC = () => {
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([
    {
      id: '1',
      name: 'Annual Leave',
      description: 'Paid time off for vacation, personal reasons, or rest',
      maxDays: 30,
      requiresApproval: true,
      isActive: true,
      carryOverAllowed: true,
      maxCarryOverDays: 10,
      requiresDocumentation: false,
      color: '#3498db'
    },
    {
      id: '2',
      name: 'Sick Leave',
      description: 'Paid time off for personal illness or medical appointments',
      maxDays: 15,
      requiresApproval: false,
      isActive: true,
      carryOverAllowed: true,
      maxCarryOverDays: 5,
      requiresDocumentation: true,
      color: '#e74c3c'
    },
    {
      id: '3',
      name: 'Maternity Leave',
      description: 'Paid leave for childbirth and postnatal care',
      maxDays: 90,
      requiresApproval: true,
      isActive: true,
      carryOverAllowed: false,
      maxCarryOverDays: 0,
      requiresDocumentation: true,
      color: '#9b59b6'
    },
    {
      id: '4',
      name: 'Court Leave',
      description: 'Leave for court appearances or legal obligations',
      maxDays: 10,
      requiresApproval: true,
      isActive: true,
      carryOverAllowed: false,
      maxCarryOverDays: 0,
      requiresDocumentation: true,
      color: '#f39c12'
    },
    {
      id: '5',
      name: 'Other Leave',
      description: 'Miscellaneous leave for special circumstances',
      maxDays: 5,
      requiresApproval: true,
      isActive: true,
      carryOverAllowed: false,
      maxCarryOverDays: 0,
      requiresDocumentation: false,
      color: '#95a5a6'
    }
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveType | null>(null);
  const [formData, setFormData] = useState<Partial<LeaveType>>({
    name: '',
    description: '',
    maxDays: 0,
    requiresApproval: true,
    isActive: true,
    carryOverAllowed: false,
    maxCarryOverDays: 0,
    requiresDocumentation: false,
    color: '#3498db'
  });

  const handleAddNew = () => {
    setEditingLeaveType(null);
    setFormData({
      name: '',
      description: '',
      maxDays: 0,
      requiresApproval: true,
      isActive: true,
      carryOverAllowed: false,
      maxCarryOverDays: 0,
      requiresDocumentation: false,
      color: '#3498db'
    });
    setIsModalOpen(true);
  };

  const handleEdit = (leaveType: LeaveType) => {
    setEditingLeaveType(leaveType);
    setFormData({ ...leaveType });
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (editingLeaveType) {
      // Update existing leave type
      setLeaveTypes(prev => prev.map(lt => 
        lt.id === editingLeaveType.id ? { ...formData, id: lt.id } as LeaveType : lt
      ));
    } else {
      // Add new leave type
      const newLeaveType: LeaveType = {
        ...formData as LeaveType,
        id: Date.now().toString()
      };
      setLeaveTypes(prev => [...prev, newLeaveType]);
    }
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Are you sure you want to delete this leave type?')) {
      setLeaveTypes(prev => prev.filter(lt => lt.id !== id));
    }
  };

  const toggleStatus = (id: string) => {
    setLeaveTypes(prev => prev.map(lt => 
      lt.id === id ? { ...lt, isActive: !lt.isActive } : lt
    ));
  };

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? 'Active' : 'Inactive';
  };

  const getStatusClass = (isActive: boolean) => {
    return isActive ? 'active' : 'inactive';
  };

  return (
    <div className="leave-types">
      {/* Header Section */}
      <div className="leave-types-header">
        <div className="header-content">
          <h1>Leave Types Management</h1>
          <p>Configure and manage different types of leave available in the system</p>
        </div>
        <button className="btn-add-new" onClick={handleAddNew}>
          <span className="btn-icon">+</span>
          Add New Leave Type
        </button>
      </div>

      {/* Statistics Cards */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <div className="stat-number">{leaveTypes.length}</div>
            <div className="stat-label">Total Leave Types</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">✅</div>
          <div className="stat-content">
            <div className="stat-number">{leaveTypes.filter(lt => lt.isActive).length}</div>
            <div className="stat-label">Active Types</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⏸️</div>
          <div className="stat-content">
            <div className="stat-number">{leaveTypes.filter(lt => !lt.isActive).length}</div>
            <div className="stat-label">Inactive Types</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <div className="stat-number">{leaveTypes.filter(lt => lt.requiresDocumentation).length}</div>
            <div className="stat-label">Require Documentation</div>
          </div>
        </div>
      </div>

      {/* Leave Types Grid */}
      <div className="leave-types-grid">
        {leaveTypes.map((leaveType) => (
          <div key={leaveType.id} className="leave-type-card">
            <div className="card-header">
              <div 
                className="type-color" 
                style={{ backgroundColor: leaveType.color }}
              ></div>
              <h3 className="type-name">{leaveType.name}</h3>
              <span className={`status-badge ${getStatusClass(leaveType.isActive)}`}>
                {getStatusBadge(leaveType.isActive)}
              </span>
            </div>
            
            <p className="type-description">{leaveType.description}</p>
            
            <div className="type-details">
              <div className="detail-item">
                <span className="detail-label">Max Days:</span>
                <span className="detail-value">{leaveType.maxDays} days</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Approval:</span>
                <span className="detail-value">
                  {leaveType.requiresApproval ? 'Required' : 'Not Required'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Carry Over:</span>
                <span className="detail-value">
                  {leaveType.carryOverAllowed ? 
                    `Yes (max ${leaveType.maxCarryOverDays} days)` : 'No'}
                </span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Documentation:</span>
                <span className="detail-value">
                  {leaveType.requiresDocumentation ? 'Required' : 'Not Required'}
                </span>
              </div>
            </div>

            <div className="card-actions">
              <button 
                className="btn-edit"
                onClick={() => handleEdit(leaveType)}
              >
                Edit
              </button>
              <button 
                className={`btn-toggle ${leaveType.isActive ? 'deactivate' : 'activate'}`}
                onClick={() => toggleStatus(leaveType.id)}
              >
                {leaveType.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button 
                className="btn-delete"
                onClick={() => handleDelete(leaveType.id)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingLeaveType ? 'Edit Leave Type' : 'Add New Leave Type'}</h2>
              <button 
                className="modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Leave Type Name *</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Annual Leave"
                  />
                </div>

                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe this leave type..."
                    rows={3}
                  />
                </div>

                <div className="form-group">
                  <label>Maximum Days Per Year *</label>
                  <input
                    type="number"
                    value={formData.maxDays || 0}
                    onChange={(e) => setFormData({ ...formData, maxDays: parseInt(e.target.value) })}
                    min="0"
                  />
                </div>

                <div className="form-group">
                  <label>Color</label>
                  <div className="color-picker">
                    {['#3498db', '#e74c3c', '#9b59b6', '#f39c12', '#2ecc71', '#95a5a6'].map(color => (
                      <button
                        key={color}
                        className={`color-option ${formData.color === color ? 'selected' : ''}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setFormData({ ...formData, color })}
                      />
                    ))}
                  </div>
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.requiresApproval || false}
                      onChange={(e) => setFormData({ ...formData, requiresApproval: e.target.checked })}
                    />
                    Requires Manager Approval
                  </label>
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.carryOverAllowed || false}
                      onChange={(e) => setFormData({ ...formData, carryOverAllowed: e.target.checked })}
                    />
                    Allow Carry Over to Next Year
                  </label>
                </div>

                {formData.carryOverAllowed && (
                  <div className="form-group">
                    <label>Maximum Carry Over Days</label>
                    <input
                      type="number"
                      value={formData.maxCarryOverDays || 0}
                      onChange={(e) => setFormData({ ...formData, maxCarryOverDays: parseInt(e.target.value) })}
                      min="0"
                    />
                  </div>
                )}

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.requiresDocumentation || false}
                      onChange={(e) => setFormData({ ...formData, requiresDocumentation: e.target.checked })}
                    />
                    Requires Documentation
                  </label>
                </div>

                <div className="form-group checkbox-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={formData.isActive !== false}
                      onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    Active (Available for use)
                  </label>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => setIsModalOpen(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-save"
                onClick={handleSave}
                disabled={!formData.name || !formData.description}
              >
                {editingLeaveType ? 'Update Leave Type' : 'Create Leave Type'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LeaveTypes;