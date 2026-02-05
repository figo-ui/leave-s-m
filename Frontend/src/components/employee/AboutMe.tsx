// AboutMe.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import AvatarUpload from '../common/AvatarUpload';
import { useTranslation } from 'react-i18next';

import './AboutMe.css';

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  position?: string;
  phone?: string;
  avatar?: string;
  status?: string;
  joinDate?: string;
  employeeId?: string;
  manager?: {
    name: string;
    email: string;
    phone?: string;
  };
}

interface ChangePasswordModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ onClose, onSuccess }) => {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!currentPassword) {
      setError(t('about_me.password.current_required'));
      return;
    }
    if (!newPassword) {
      setError(t('about_me.password.new_required'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('about_me.password.mismatch'));
      return;
    }
    if (newPassword.length < 8) {
      setError(t('about_me.password.min_length'));
      return;
    }

    try {
      setLoading(true);
      const response = await apiService.changePassword({
        currentPassword,
        newPassword
      });

      if (response.success) {
        onSuccess();
      } else {
        setError(response.message || t('about_me.password.failed'));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('about_me.password.failed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{t('about_me.password.title')}</h3>
          <button onClick={onClose} className="close-btn">×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label htmlFor="currentPassword">{t('about_me.password.current')}</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="newPassword">{t('about_me.password.new')}</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="confirmPassword">{t('about_me.password.confirm')}</label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="secondary-btn" disabled={loading}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="primary-btn" disabled={loading}>
              {loading ? t('about_me.password.updating') : t('about_me.password.update')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const AboutMe: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { t, i18n } = useTranslation();
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
        setError(t('about_me.errors.load_profile'));
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      setError(error.message || t('about_me.errors.load_profile'));
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpdate = (updatedUser: any) => {
    if (updateUser && typeof updateUser === 'function') {
      updateUser(updatedUser);
    }
    setProfile(prev => prev ? { ...prev, avatar: updatedUser.avatar } : undefined);
    showMessage(t('profile.avatar_updated'));
  };

  const handleSavePhone = async () => {
    if (!profile) return;

    // Validate phone format (optional)
    if (phoneValue && !isValidPhone(phoneValue)) {
      setError(t('about_me.errors.invalid_phone'));
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
        showMessage(t('profile.phone_updated'));
      } else {
        setError(response.message || t('about_me.errors.update_phone'));
      }
    } catch (error: any) {
      setError(error.message || t('about_me.errors.update_phone'));
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
    const phoneRegex = /^\+?[0-9\s\-()]{10,}$/;
    return phoneRegex.test(phone);
  };

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const formatDate = (dateString: string) => {
    const localeMap: Record<string, string> = { en: 'en-US', am: 'am-ET', om: 'om-ET' };
    const locale = localeMap[i18n.language] || 'en-US';
    return new Date(dateString).toLocaleDateString(locale, {
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
      duration += `${years} ${t('about_me.years', { count: years })}`;
    }
    if (months > 0) {
      if (duration) duration += ', ';
      duration += `${months} ${t('about_me.months', { count: months })}`;
    }
    return duration || t('about_me.less_than_month');
  };

  const getRoleLabel = (role: string) => {
    const roleLabels: Record<string, string> = {
      'employee': t('roles.employee'),
      'manager': t('roles.manager'),
      'hr-admin': t('about_me.hr_admin'),
      'super-admin': t('about_me.super_admin')
    };
    return roleLabels[role] || role;
  };

  if (loading) {
    return (
      <div className="about-me">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{t('about_me.loading')}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="about-me">
        <div className="error-state">
          <h2>{t('about_me.unable_title')}</h2>
          <p>{t('about_me.unable_subtitle')}</p>
          <button onClick={loadUserProfile} className="retry-btn">
            {t('common.try_again')}
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
            showMessage(t('profile.password_changed'));
            setShowChangePassword(false);
          }}
        />
      )}

      <div className="about-me-header">
        <h1>{t('nav.about_me')}</h1>
        <p>{t('about_me.subtitle')}</p>
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
                <span className="stat-label">{t('about_me.status')}</span>
                <span className={`status-badge status-${(profile.status || 'active').toLowerCase()}`}>
                  {profile.status || 'active'}
                </span>
              </div>
              {profile.joinDate && (
                <div className="stat-item">
                  <span className="stat-label">{t('about_me.joined')}</span>
                  <span className="stat-value">
                    {formatDate(profile.joinDate)}
                  </span>
                </div>
              )}
              {profile.employeeId && (
                <div className="stat-item">
                  <span className="stat-label">{t('about_me.employee_id')}</span>
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
                title={t('about_me.password.change_title')}
              >
                🔒 {t('about_me.password.change')}
              </button>
            </div>
          </div>
        </div>

        {/* Detailed Information */}
        <div className="profile-details-grid">
          {/* Personal Information Card */}
          <div className="info-card">
            <div className="card-header">
              <h3>{t('about_me.personal_info')}</h3>
            </div>
            <div className="card-content">
              <div className="info-group">
                <label>{t('about_me.full_name')}</label>
                <div className="info-value readonly">
                  {profile.name}
                  <span className="readonly-badge">{t('about_me.cannot_edit')}</span>
                </div>
              </div>

              <div className="info-group">
                <label>{t('about_me.email')}</label>
                <div className="info-value readonly">
                  {profile.email}
                  <span className="readonly-badge">{t('about_me.university_email')}</span>
                </div>
              </div>

              <div className="info-group">
                <label>{t('about_me.phone')}</label>
                {editingPhone ? (
                  <div className="edit-phone-container">
                    <input
                      type="tel"
                      value={phoneValue}
                      onChange={handlePhoneChange}
                      className="editable-input"
                      placeholder={t('about_me.phone_placeholder')}
                      disabled={saving}
                    />
                    <div className="edit-phone-actions">
                      <button 
                        className="save-btn small"
                        onClick={handleSavePhone}
                        disabled={saving || phoneValue === originalPhone}
                      >
                        {saving ? '...' : t('common.save')}
                      </button>
                      <button 
                        className="cancel-btn small"
                        onClick={handleCancelPhoneEdit}
                        disabled={saving}
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="info-value-with-action">
                    <span className="phone-value">
                      {profile.phone || t('about_me.not_provided')}
                    </span>
                    <button 
                      className="edit-field-btn"
                      onClick={() => setEditingPhone(true)}
                      title={t('about_me.edit_phone')}
                    >
                      ✏️
                    </button>
                  </div>
                )}
              </div>

              <div className="info-group">
                <label>{t('about_me.profile_picture')}</label>
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
                      <p className="avatar-hint">{t('about_me.avatar_hint')}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Professional Information Card */}
          <div className="info-card">
            <div className="card-header">
              <h3>{t('about_me.professional_info')}</h3>
            </div>
            <div className="card-content">
              <div className="info-group">
                <label>{t('about_me.department')}</label>
                <div className="info-value readonly">
                  {profile.department}
                  <span className="readonly-badge">{t('about_me.managed_by_hr')}</span>
                </div>
              </div>

              <div className="info-group">
                <label>{t('about_me.position')}</label>
                <div className="info-value readonly">
                  {profile.position || t('about_me.not_specified')}
                  <span className="readonly-badge">{t('about_me.managed_by_hr')}</span>
                </div>
              </div>

              <div className="info-group">
                <label>{t('about_me.role')}</label>
                <div className="info-value">
                  <span className={`role-badge role-${profile.role}`}>
                    {getRoleLabel(profile.role)}
                  </span>
                </div>
              </div>

              {profile.joinDate && (
                <div className="info-group">
                  <label>{t('about_me.employment_duration')}</label>
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
                <h3>{t('about_me.reporting_manager')}</h3>
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
                    📧 {t('about_me.send_email')}
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* System Information Card */}
          <div className="info-card">
            <div className="card-header">
              <h3>{t('about_me.system_info')}</h3>
            </div>
            <div className="card-content">
              <div className="info-group">
                <label>{t('about_me.user_status')}</label>
                <div className="info-value">
                  <span className={`status-badge status-${(profile.status || 'active').toLowerCase()}`}>
                    {profile.status || 'active'}
                  </span>
                </div>
              </div>

              <div className="info-group">
                <label>{t('about_me.account_type')}</label>
                <div className="info-value">
                  {getRoleLabel(profile.role)}
                </div>
              </div>

              {profile.joinDate && (
                <div className="info-group">
                  <label>{t('about_me.member_since')}</label>
                  <div className="info-value">
                    {formatDate(profile.joinDate)}
                  </div>
                </div>
              )}

              <div className="info-group">
                <label>{t('about_me.account_security')}</label>
                <div className="info-value">
                  <button 
                    className="security-btn"
                    onClick={() => setShowChangePassword(true)}
                  >
                    🔐 {t('about_me.password.change')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions - Role-based */}
        <div className="quick-actions-section">
          <h3>{t('dashboard.quick_actions.title')}</h3>
          <div className="actions-grid">
            {profile.role === 'employee' && (
              <>
                <button className="action-card" onClick={() => window.location.href = '/apply-leave'}>
                  <span className="action-icon">📝</span>
                  <span className="action-label">{t('menu.apply_leave')}</span>
                </button>
                
                <button className="action-card" onClick={() => window.location.href = '/leave-history'}>
                  <span className="action-icon">📋</span>
                  <span className="action-label">{t('leave_history.view_details')}</span>
                </button>
              </>
            )}

            {profile.role === 'manager' && (
              <>
                <button className="action-card" onClick={() => window.location.href = '/pending-requests'}>
                  <span className="action-icon">✅</span>
                  <span className="action-label">{t('dashboard.actions.review_pending')}</span>
                </button>
                
                <button className="action-card" onClick={() => window.location.href = '/team-overview'}>
                  <span className="action-icon">👥</span>
                  <span className="action-label">{t('menu.team_overview')}</span>
                </button>
              </>
            )}

            {['hr-admin', 'super-admin'].includes(profile.role) && (
              <>
                <button className="action-card" onClick={() => window.location.href = '/hr/pending-approvals'}>
                  <span className="action-icon">✅</span>
                  <span className="action-label">{t('dashboard.actions.hr_approvals')}</span>
                </button>
                
                <button className="action-card" onClick={() => window.location.href = '/users'}>
                  <span className="action-icon">👥</span>
                  <span className="action-label">{t('menu.user_management')}</span>
                </button>
              </>
            )}

            <button className="action-card" onClick={() => window.location.href = '/notifications'}>
              <span className="action-icon">🔔</span>
              <span className="action-label">{t('dashboard.stats.notifications')}</span>
            </button>

            <button className="action-card" onClick={() => window.location.href = '/help'}>
              <span className="action-icon">❓</span>
              <span className="action-label">{t('common.help_support')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutMe;
