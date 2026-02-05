// AboutMe.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import AvatarUpload from '../common/AvatarUpload';

import './AboutMe.css';

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  position?: string;
  phone?: string;
  avatar?: string;
  status: string;
  joinDate?: string;
  employeeId?: string;
  manager?: {
    name: string;
    email: string;
    phone?: string;
  };
}

const AboutMe: React.FC = () => {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  // States for password change modal
  const [showChangePassword, setShowChangePassword] = useState(false);
  
  // States for phone editing
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [originalPhone, setOriginalPhone] = useState('');

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const response = await apiService.getCurrentUser();
      
      if (response.success && response.data) {
        const userData = response.data.user;
        setProfile(userData);
        setPhoneValue(userData.phone || '');
        setOriginalPhone(userData.phone || '');
      } else {
        setError('Failed to load profile data');
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      setError(error.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpdate = (updatedUser: any) => {
    if (updateUser && typeof updateUser === 'function') {
      updateUser(updatedUser);
    }
    setProfile(prev => prev ? { ...prev, avatar: updatedUser.avatar } : null);
    showMessage('Profile picture updated successfully!');
  };

  const handleSavePhone = async () => {
    if (!profile) return;

    // Validate phone format (optional)
    if (phoneValue && !isValidPhone(phoneValue)) {
      setError('Please enter a valid phone number');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await apiService.updateProfile({
        phone: phoneValue 
      });

      if (response.success && response.data) {
        // Update local state
        if (updateUser && typeof updateUser === 'function') {
          updateUser(response.data);
        }
        setProfile(response.data);
        setOriginalPhone(phoneValue);
        setEditingPhone(false);
        showMessage('Phone number updated successfully!');
      } else {
        setError(response.message || 'Failed to update phone number');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update phone number');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelPhoneEdit = () => {
    setPhoneValue(originalPhone);
    setEditingPhone(false);
    setError('');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneValue(e.target.value);
  };

  const isValidPhone = (phone: string): boolean => {
    // Basic validation - adjust as needed
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  };

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getEmploymentDuration = (joinDate: string) => {
    const join = new Date(joinDate);
    const now = new Date();
    const years = now.getFullYear() - join.getFullYear();
    const months = now.getMonth() - join.getMonth();
    
    let duration = '';
    if (years > 0) {
      duration += `${years} year${years > 1 ? 's' : ''}`;
    }
    if (months > 0) {
      if (duration) duration += ', ';
      duration += `${months} month${months > 1 ? 's' : ''}`;
    }
    return duration || 'Less than a month';
  };

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      'employee': 'Employee',
      'manager': 'Manager',
      'hr-admin': 'HR Administrator',
      'super-admin': 'System Administrator'
    };
    return roleLabels[role] || role;
  };

  if (loading) {
    return (
      <div className="about-me">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="about-me">
        <div className="error-state">
          <h2>Unable to Load Profile</h2>
          <p>There was an error loading your profile information.</p>
          <button onClick={loadUserProfile} className="retry-btn">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="about-me">
      {/* Change Password Modal */}
      {showChangePassword && (
        <ChangePasswordModal
          onClose={() => setShowChangePassword(false)}
          onSuccess={() => {
            showMessage('Password changed successfully!');
            setShowChangePassword(false);
          }}
        />
      )}

      <div className="about-me-header">
        <h1>About Me</h1>
        <p>Your professional profile and information</p>
      </div>

      {/* Messages */}
      {message && (
        <div className="success-message">
          <div className="message-icon">✅</div>
          <div className="message-text">{message}</div>
          <button onClick={() => setMessage('')} className="message-close">×</button>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <div className="message-icon">⚠️</div>
          <div className="message-text">{error}</div>
          <button onClick={() => setError('')} className="message-close">×</button>
        </div>
      )}

      <div className="about-me-content">
        {/* Profile Header Section */}
        <div className="profile-header-section">
          <div className="avatar-section">
            <AvatarUpload
              currentAvatar={profile.avatar}
              userName={profile.name}
              onAvatarUpdate={handleAvatarUpdate}
              size="large"
            />
          </div>
          
          <div className="profile-basic-info">
            <div className="profile-name-role">
              <h2>{profile.name}</h2>
              <div className="role-department">
                <span className="role-badge">{getRoleLabel(profile.role)}</span>
                <span className="department">{profile.department}</span>
              </div>
              {profile.position && (
                <p className="position">{profile.position}</p>
              )}
            </div>
            
            <div className="profile-stats">
              <div className="stat-item">
                <span className="stat-label">Status</span>
                <span className={`status-badge status-${profile.status.toLowerCase()}`}>
                  {profile.status}
                </span>
              </div>
              {profile.joinDate && (
                <div className="stat-item">
                  <span className="stat-label">Joined</span>
                  <span className="stat-value">
                    {formatDate(profile.joinDate)}
                  </span>
                </div>
              )}
              {profile.employeeId && (
                <div className="stat-item">
                  <span className="stat-label">Employee ID</span>
                  <span className="stat-value">{profile.employeeId}</span>
                </div>
              )}
            </div>
          </div>

          <div className="profile-actions">
            <div className="action-buttons">
              <button 
                className="action-btn password-btn"
                onClick={() => setShowChangePassword(true)}
                title="Change your password"
              >
                🔒 Change Password
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Information */}
        <div className="profile-details-grid">
          {/* Personal Information Card */}
          <div className="info-card">
            <div className="card-header">
              <h3>👤 Personal Information</h3>
            </div>
            <div className="card-content">
              <div className="info-group">
                <label>Full Name</label>
                <div className="info-value readonly">
                  {profile.name}
                  <span className="readonly-badge">Cannot edit</span>
                </div>
              </div>

              <div className="info-group">
                <label>Email Address</label>
                <div className="info-value readonly">
                  {profile.email}
                  <span className="readonly-badge">University Email</span>
                </div>
              </div>

              <div className="info-group">
                <label>Phone Number</label>
                {editingPhone ? (
                  <div className="edit-phone-container">
                    <input
                      type="tel"
                      value={phoneValue}
                      onChange={handlePhoneChange}
                      className="editable-input"
                      placeholder="+251 91 234 5678"
                      disabled={saving}
                    />
                    <div className="edit-phone-actions">
                      <button 
                        className="save-btn small"
                        onClick={handleSavePhone}
                        disabled={saving || phoneValue === originalPhone}
                      >
                        {saving ? '...' : 'Save'}
                      </button>
                      <button 
                        className="cancel-btn small"
                        onClick={handleCancelPhoneEdit}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="info-value-with-action">
                    <span className="phone-value">
                      {profile.phone || 'Not provided'}
                    </span>
                    <button 
                      className="edit-field-btn"
                      onClick={() => setEditingPhone(true)}
                      title="Edit phone number"
                    >
                      ✏️
                    </button>
                  </div>
                )}
              </div>

              <div className="info-group">
                <label>Profile Picture</label>
                <div className="info-value">
                  <div className="avatar-info">
                    <div className="avatar-preview">
                      {profile.avatar ? (
                        <img src={`http://localhost:5000${profile.avatar}`} alt={profile.name} />
                      ) : (
                        <div className="avatar-placeholder">
                          {profile.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="avatar-actions">
                      <p className="avatar-hint">Click on your picture to upload a new one</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Information Card */}
          <div className="info-card">
            <div className="card-header">
              <h3>💼 Professional Information</h3>
            </div>
            <div className="card-content">
              <div className="info-group">
                <label>Department</label>
                <div className="info-value readonly">
                  {profile.department}
                  <span className="readonly-badge">Managed by HR</span>
                </div>
              </div>

              <div className="info-group">
                <label>Position</label>
                <div className="info-value readonly">
                  {profile.position || 'Not specified'}
                  <span className="readonly-badge">Managed by HR</span>
                </div>
              </div>

              <div className="info-group">
                <label>Role</label>
                <div className="info-value">
                  <span className={`role-badge role-${profile.role}`}>
                    {getRoleLabel(profile.role)}
                  </span>
                </div>
              </div>

              {profile.joinDate && (
                <div className="info-group">
                  <label>Employment Duration</label>
                  <div className="info-value">
                    {getEmploymentDuration(profile.joinDate)}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Manager Information Card */}
          {profile.manager && (
            <div className="info-card">
              <div className="card-header">
                <h3>👨‍💼 Reporting Manager</h3>
              </div>
              <div className="card-content">
                <div className="manager-info">
                  <div className="manager-avatar">
                    {profile.manager.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="manager-details">
                    <div className="manager-name">{profile.manager.name}</div>
                    <div className="manager-email">{profile.manager.email}</div>
                    {profile.manager.phone && (
                      <div className="manager-phone">{profile.manager.phone}</div>
                    )}
                  </div>
                </div>
                <div className="manager-actions">
                  <a 
                    href={`mailto:${profile.manager.email}`}
                    className="contact-btn"
                  >
                    📧 Send Email
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* System Information Card */}
          <div className="info-card">
            <div className="card-header">
              <h3>⚙️ System Information</h3>
            </div>
            <div className="card-content">
              <div className="info-group">
                <label>User Status</label>
                <div className="info-value">
                  <span className={`status-badge status-${profile.status.toLowerCase()}`}>
                    {profile.status}
                  </span>
                </div>
              </div>

              <div className="info-group">
                <label>Account Type</label>
                <div className="info-value">
                  {getRoleLabel(profile.role)}
                </div>
              </div>

              {profile.joinDate && (
                <div className="info-group">
                  <label>Member Since</label>
                  <div className="info-value">
                    {formatDate(profile.joinDate)}
                  </div>
                </div>
              )}

              <div className="info-group">
                <label>Account Security</label>
                <div className="info-value">
                  <button 
                    className="security-btn"
                    onClick={() => setShowChangePassword(true)}
                  >
                    🔐 Change Password
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions - Role-based */}
        <div className="quick-actions-section">
          <h3>Quick Actions</h3>
          <div className="actions-grid">
            {profile.role === 'employee' && (
              <>
                <button className="action-card" onClick={() => window.location.href = '/apply-leave'}>
                  <span className="action-icon">📝</span>
                  <span className="action-label">Apply for Leave</span>
                </button>
                
                <button className="action-card" onClick={() => window.location.href = '/leave-history'}>
                  <span className="action-icon">📋</span>
                  <span className="action-label">View Leave History</span>
                </button>
              </>
            )}

            {profile.role === 'manager' && (
              <>
                <button className="action-card" onClick={() => window.location.href = '/pending-requests'}>
                  <span className="action-icon">✅</span>
                  <span className="action-label">Review Leave Requests</span>
                </button>
                
                <button className="action-card" onClick={() => window.location.href = '/team-overview'}>
                  <span className="action-icon">👥</span>
                  <span className="action-label">View Team</span>
                </button>
              </>
            )}

            {['hr-admin', 'super-admin'].includes(profile.role) && (
              <>
                <button className="action-card" onClick={() => window.location.href = '/hr/pending-approvals'}>
                  <span className="action-icon">✅</span>
                  <span className="action-label">HR Approvals</span>
                </button>
                
                <button className="action-card" onClick={() => window.location.href = '/users'}>
                  <span className="action-icon">👥</span>
                  <span className="action-label">Manage Users</span>
                </button>
              </>
            )}

            <button className="action-card" onClick={() => window.location.href = '/notifications'}>
              <span className="action-icon">🔔</span>
              <span className="action-label">Notifications</span>
            </button>

            <button className="action-card" onClick={() => window.location.href = '/help'}>
              <span className="action-icon">❓</span>
              <span className="action-label">Help & Support</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutMe;