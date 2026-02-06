// AboutMe.tsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService, getServerOrigin } from '../../utils/api';
import AvatarUpload from '../common/AvatarUpload';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

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

const AboutMe: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile>();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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


  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const handleAvatarUpdate = (updatedUser: any) => {
    if (updateUser && typeof updateUser === 'function') {
      updateUser(updatedUser);
    }
    setProfile(prev => prev ? { ...prev, avatar: updatedUser.avatar } : undefined);
    showMessage(t('profile.avatar_updated'));
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

  const getAvatarUrl = (avatarPath?: string) => {
    if (!avatarPath) return '';
    if (avatarPath.startsWith('http')) return avatarPath;
    return `${getServerOrigin()}${avatarPath}`;
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
      <div className="about-me-header">
        <h1>{t('nav.about_me')}</h1>
        <p>{t('about_me.subtitle')}</p>
      </div>

      {message && (
        <div className="success-message">
          <div className="message-icon">✅</div>
          <div className="message-text">{message}</div>
          <button onClick={() => setMessage('')} className="message-close" aria-label={t('common.close')}>×</button>
        </div>
      )}

      {error && (
        <div className="error-message">
          <div className="message-icon">⚠️</div>
          <div className="message-text">{error}</div>
          <button onClick={() => setError('')} className="message-close" aria-label={t('common.close')}>×</button>
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
              showGuidelines={false}
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
                onClick={() => navigate('/profile-settings')}
                title={t('about_me.password.change_title')}
              >
                {t('profile.profile_settings')}
              </button>
              <button
                className="action-btn secondary-btn"
                onClick={() => navigate('/profile-settings')}
              >
                {t('common.security')}
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
                <div className="info-value">
                  {profile.phone || t('about_me.not_provided')}
                </div>
              </div>

              <div className="info-group">
                <label>{t('about_me.profile_picture')}</label>
                <div className="info-value">
                  <div className="avatar-info">
                    <div className="avatar-preview">
                      {profile.avatar ? (
                        <img src={getAvatarUrl(profile.avatar)} alt={profile.name} />
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
                    {t('about_me.send_email')}
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
                    onClick={() => navigate('/profile-settings')}
                  >
                    {t('about_me.password.change')}
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
                <button className="action-card" onClick={() => window.location.href = '/hr-approvals'}>
                  <span className="action-icon">✅</span>
                  <span className="action-label">{t('dashboard.actions.hr_approvals')}</span>
                </button>
                
                <button className="action-card" onClick={() => window.location.href = '/user-management'}>
                  <span className="action-icon">👥</span>
                  <span className="action-label">{t('menu.user_management')}</span>
                </button>
              </>
            )}

            <button className="action-card" onClick={() => window.location.href = '/notifications'}>
              <span className="action-icon">🔔</span>
              <span className="action-label">{t('dashboard.stats.notifications')}</span>
            </button>

            <button className="action-card" onClick={() => window.location.href = '/profile-settings'}>
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
