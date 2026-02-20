import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import { useTranslation } from 'react-i18next';
import { LanguageCode } from '../../types';
import AvatarUpload from '../common/AvatarUpload';
import './ProfileSettings.css';

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  department?: string;
  employeeId?: string;
  phone: string;
  position?: string;
  avatar?: string;
  status?: string;
  joinDate?: string;
  language?: LanguageCode;
}

const ProfileSettings: React.FC = () => {
  const { user, updateUser } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [profile, setProfile] = useState<UserProfile>({
    id: user?.id || 0,
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || '',
    department: user?.department || '',
    phone: user?.phone || '',
    position: user?.position || '',
    avatar: user?.avatar || '',
    status: user?.status || 'active',
    joinDate: user?.joinDate || '',
    language: (user?.language as LanguageCode) || 'en'
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [activeTab, setActiveTab] = useState<'personal' | 'security'>('personal');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [showPassword, setShowPassword] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const phoneInputRef = useRef<HTMLInputElement>(null);

  // Update profile when user changes
  useEffect(() => {
    if (user) {
      setProfile({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || '',
        phone: user.phone || '',
        position: user.position || '',
        avatar: user.avatar || '',
        status: user.status || 'active',
        joinDate: user.joinDate || '',
        language: (user.language as LanguageCode) || 'en'
      });
    }
  }, [user]);

  // Focus phone input when editing starts
  useEffect(() => {
    if (isEditingPhone && phoneInputRef.current) {
      phoneInputRef.current.focus();
    }
  }, [isEditingPhone]);

  const handleAvatarUpdate = (updatedUser: any) => {
    updateUser(updatedUser);
    setProfile(prev => ({ ...prev, avatar: updatedUser.avatar }));
    showSuccessMessage(t('profile.avatar_updated'));
  };

  const handlePhoneNumberChange = (value: string) => {
    setProfile(prev => ({
      ...prev,
      phone: value
    }));
  };

  const validatePhoneNumber = (phone: string): boolean => {
    if (!phone.trim()) return true; // Empty is okay
    
    // Ethiopian phone validation
    const ethiopianRegex = /^(\+251|251|0)?(9|7)[0-9]{8}$/;
    const cleanedPhone = phone.replace(/\s+/g, '');
    return ethiopianRegex.test(cleanedPhone);
  };

  const handlePhoneNumberSave = async () => {
    const phone = profile.phone?.trim() || '';
    
    // Validate phone number format
    if (phone && !validatePhoneNumber(phone)) {
      setError(t('profile_settings.phone.invalid'));
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const response = await apiService.updateProfile({ phone: phone || undefined });
      
      if (response.success && response.data) {
        updateUser(response.data);
        showSuccessMessage(t('profile.phone_updated'));
        setIsEditingPhone(false);
      } else {
        setError(response.message || t('profile_settings.messages.update_phone_failed'));
      }
    } catch (error: any) {
      setError(error.message || t('profile_settings.messages.update_phone_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneNumberCancel = () => {
    setIsEditingPhone(false);
    setProfile(prev => ({
      ...prev,
      phone: user?.phone || ''
    }));
    setError('');
  };

  const handleLanguageChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLanguage = e.target.value as LanguageCode;
    setProfile(prev => ({ ...prev, language: selectedLanguage }));

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await apiService.updateProfile({ language: selectedLanguage });
      if (response.success && response.data) {
        updateUser(response.data);
        showSuccessMessage(t('profile.language_updated'));
      } else {
        setError(response.message || t('profile_settings.messages.update_language_failed'));
      }
    } catch (error: any) {
      setError(error.message || t('profile_settings.messages.update_language_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    // Validation
    if (!passwordData.currentPassword) {
      setError(t('profile_settings.messages.enter_current'));
      return;
    }

    if (!passwordData.newPassword) {
      setError(t('profile_settings.messages.enter_new'));
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError(t('profile_settings.messages.no_match'));
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError(t('profile_settings.messages.min_length'));
      return;
    }

    // Additional password strength validation
    const passwordErrors = validatePasswordStrength(passwordData.newPassword);
    if (passwordErrors.length > 0) {
      setError(t('profile_settings.messages.password_requirements', { details: passwordErrors.join(', ') }));
      return;
    }

    setLoading(true);

    try {
      const response = await apiService.changePassword({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      });

      if (response.success) {
        showSuccessMessage(t('profile.password_changed'));
        // Reset form
        setPasswordData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setShowPassword({
          current: false,
          new: false,
          confirm: false
        });
      } else {
        setError(response.message || t('profile_settings.messages.change_password_failed'));
      }
    } catch (error: any) {
      setError(error.message || t('profile_settings.messages.change_password_failed'));
    } finally {
      setLoading(false);
    }
  };

  const validatePasswordStrength = (password: string): string[] => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push(t('profile_settings.password.requirements.min_length'));
    }
    if (!/[A-Z]/.test(password)) {
      errors.push(t('profile_settings.password.requirements.uppercase'));
    }
    if (!/[a-z]/.test(password)) {
      errors.push(t('profile_settings.password.requirements.lowercase'));
    }
    if (!/[0-9]/.test(password)) {
      errors.push(t('profile_settings.password.requirements.number'));
    }
    
    return errors;
  };

  const showSuccessMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const getRoleLabel = (role: string): string => {
    return t(`roles.${role}`, role);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return t('profile_settings.values.not_available');
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPhoneNumber = (phone: string = ''): string => {
    if (!phone.trim()) return t('profile_settings.values.not_provided');
    
    // Format Ethiopian phone numbers
    const cleaned = phone.replace(/\D/g, '');
    
    if (cleaned.startsWith('251') && cleaned.length === 12) {
      // +251 XX XXX XXXX format
      return `+251 ${cleaned.slice(3, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
    } else if (cleaned.startsWith('0') && cleaned.length === 10) {
      // 0XX XXX XXXX format
      return `0${cleaned.slice(1, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    } else if (cleaned.length === 9) {
      // 9XX XXX XXX format
      return `0${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5)}`;
    }
    
    return phone; // Return as is if doesn't match expected patterns
  };

  return (
    <div className="profile-settings">
      <div className="profile-header">
        <h1>{t('profile.profile_settings')}</h1>
        <p>{t('profile_settings.header_subtitle')}</p>
      </div>

      {/* Messages */}
      {message && (
        <div className="success-message">
          <div className="message-content">
            <span className="message-icon">✅</span>
            <span className="message-text">{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="message-close" aria-label={t('common.close')}>×</button>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <div className="message-content">
            <span className="message-icon">⚠️</span>
            <span className="message-text">{error}</span>
          </div>
          <button onClick={() => setError('')} className="message-close" aria-label={t('common.close')}>×</button>
        </div>
      )}

      <div className="profile-content">
        {/* Sidebar Navigation */}
        <div className="profile-sidebar">
          <div className="sidebar-section">
            <h3>{t('profile_settings.tabs.settings')}</h3>
            <nav className="sidebar-nav">
              <button 
                className={`nav-item ${activeTab === 'personal' ? 'active' : ''}`}
                onClick={() => setActiveTab('personal')}
                type="button"
              >
                <span className="nav-icon">👤</span>
                <span className="nav-text">{t('profile_settings.tabs.personal_info')}</span>
              </button>
              <button 
                className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
                type="button"
              >
                <span className="nav-icon">🔐</span>
                <span className="nav-text">{t('profile_settings.tabs.security_password')}</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-help">
            <h4>{t('profile_settings.sidebar_help.title')}</h4>
            <p>{t('profile_settings.sidebar_help.subtitle')}</p>
            <ul className="help-list">
              <li>• {t('profile_settings.sidebar_help.items.name')}</li>
              <li>• {t('profile_settings.sidebar_help.items.email')}</li>
              <li>• {t('profile_settings.sidebar_help.items.department')}</li>
              <li>• {t('profile_settings.sidebar_help.items.position')}</li>
            </ul>
            <button
              className="help-btn"
              onClick={() => navigate('/help-support')}
            >
              {t('profile_settings.sidebar_help.contact_hr')}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="profile-main">
          {activeTab === 'personal' && (
            <div className="personal-info-section">
              <div className="section-header">
                <h2>{t('profile_settings.sections.personal_title')}</h2>
                <p className="section-subtitle">
                  <span className="editable-info">{t('profile_settings.sections.personal_editable')}</span>
                  <span className="non-editable-info">{t('profile_settings.sections.personal_non_editable')}</span>
                </p>
              </div>

              {/* Personal Information Grid */}
              <div className="info-grid">
                <div className="info-group editable profile-photo-card">
                  <label className="info-label">
                    {t('profile_settings.profile_picture.title')}
                    <span className="editable-indicator">({t('profile_settings.actions.editable')})</span>
                  </label>
                  <div className="profile-photo-card-content">
                    <AvatarUpload
                      currentAvatar={profile.avatar}
                      userName={profile.name}
                      onAvatarUpdate={handleAvatarUpdate}
                      size="medium"
                      showGuidelines={false}
                    />
                    <div className="profile-photo-meta">
                      <p className="picture-guidelines">
                        {t('profile_settings.profile_picture.guidelines')}
                      </p>
                      <p className="guideline-detail">{t('profile_settings.profile_picture.details')}</p>
                      <button
                        type="button"
                        className="edit-btn"
                        onClick={() => navigate('/about-me')}
                      >
                        {t('nav.about_me')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Read-only Fields */}
                <div className="info-group read-only">
                  <label className="info-label">{t('profile_settings.fields.full_name')}</label>
                  <div className="info-value">
                    {profile.name}
                    <span className="readonly-badge">{t('profile_settings.badges.managed_by_hr')}</span>
                  </div>
                  <div className="info-help">{t('profile_settings.help.legal_name')}</div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">{t('profile_settings.fields.email')}</label>
                  <div className="info-value">
                    {profile.email}
                    <span className="readonly-badge">{t('profile_settings.badges.university_email')}</span>
                  </div>
                  <div className="info-help">{t('profile_settings.help.primary_email')}</div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">{t('profile_settings.fields.employee_id')}</label>
                  <div className="info-value">
                    {profile.employeeId || t('profile_settings.values.not_assigned')}
                    <span className="readonly-badge">{t('profile_settings.badges.system_generated')}</span>
                  </div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">{t('profile_settings.fields.department')}</label>
                  <div className="info-value">
                    {profile.department}
                    <span className="readonly-badge">{t('profile_settings.badges.managed_by_hr')}</span>
                  </div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">{t('profile_settings.fields.position')}</label>
                  <div className="info-value">
                    {profile.position || t('profile_settings.values.not_specified')}
                    <span className="readonly-badge">{t('profile_settings.badges.managed_by_hr')}</span>
                  </div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">{t('profile_settings.fields.join_date')}</label>
                  <div className="info-value">
                    {formatDate(profile.joinDate || '')}
                    <span className="readonly-badge">{t('profile_settings.badges.system_record')}</span>
                  </div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">{t('profile_settings.fields.status')}</label>
                  <div className="info-value">
                    <span className={`status-badge ${(profile.status || 'active').toLowerCase()}`}>
                      {profile.status || 'active'}
                    </span>
                    <span className="readonly-badge">{t('profile_settings.badges.system_status')}</span>
                  </div>
                </div>

                {/* Editable Phone Number Field */}
                <div className="info-group editable">
                  <label className="info-label">
                    {t('profile_settings.fields.phone')}
                    <span className="editable-indicator">({t('profile_settings.actions.editable')})</span>
                  </label>
                  {isEditingPhone ? (
                    <div className="edit-phone-container">
                      <input
                        ref={phoneInputRef}
                        type="tel"
                        value={profile.phone || ''}
                        onChange={(e) => handlePhoneNumberChange(e.target.value)}
                        className="phone-input"
                        placeholder={t('profile_settings.phone.placeholder')}
                        disabled={loading}
                      />
                      <div className="phone-format-hint">
                        {t('profile_settings.phone.format_hint')}
                      </div>
                      <div className="phone-actions">
                        <button 
                          type="button"
                          className="save-btn"
                          onClick={handlePhoneNumberSave}
                          disabled={loading}
                        >
                          {loading ? t('profile_settings.messages.saving') : t('common.save')}
                        </button>
                        <button 
                          type="button"
                          className="cancel-btn"
                          onClick={handlePhoneNumberCancel}
                          disabled={loading}
                        >
                          {t('common.cancel')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="info-value-with-action">
                      <div className="phone-display">
                        {formatPhoneNumber(profile.phone)}
                        <div className="phone-status">
                          <span className="editable-badge">{t('profile_settings.badges.editable')}</span>
                        </div>
                      </div>
                      <button 
                        type="button"
                        className="edit-btn"
                        onClick={() => setIsEditingPhone(true)}
                      >
                        {t('profile_settings.actions.edit')}
                      </button>
                    </div>
                  )}
                  <div className="info-help">{t('profile_settings.phone.help')}</div>
                </div>

                {/* Language Selection */}
                <div className="info-group editable">
                  <label className="info-label">
                    {t('profile.language_label')}
                    <span className="editable-indicator">({t('profile_settings.actions.editable')})</span>
                  </label>
                  <div className="info-value-with-action">
                    <select
                      className="phone-input"
                      value={profile.language || 'en'}
                      onChange={handleLanguageChange}
                      disabled={loading}
                    >
                      <option value="en">{t('languages.en')}</option>
                      <option value="om">{t('languages.om')}</option>
                      <option value="am">{t('languages.am')}</option>
                    </select>
                  </div>
                  <div className="info-help">{t('profile_settings.language_help')}</div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">{t('profile_settings.fields.user_role')}</label>
                  <div className="info-value">
                    <span className={`role-badge role-${profile.role}`}>
                      {getRoleLabel(profile.role)}
                    </span>
                    <span className="readonly-badge">{t('profile_settings.badges.system_assigned')}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="section-actions">
                <button 
                  type="button"
                  className="switch-tab-btn"
                  onClick={() => setActiveTab('security')}
                >
                  {t('profile_settings.actions.go_to_security')}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="security-section">
              <div className="section-header">
                <h2>{t('profile_settings.sections.security_title')}</h2>
                <p className="section-subtitle">
                  <span className="editable-info">{t('profile_settings.sections.security_subtitle')}</span>
                </p>
              </div>

              <form onSubmit={handlePasswordChange} className="password-form">
                <div className="form-group">
                  <label htmlFor="currentPassword" className="form-label">
                    {t('profile_settings.password.current')}
                  </label>
                  <div className="password-input-container">
                    <input
                      type={showPassword.current ? 'text' : 'password'}
                      id="currentPassword"
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        currentPassword: e.target.value
                      }))}
                      placeholder={t('profile_settings.password.placeholder_current')}
                      required
                      disabled={loading}
                      className="password-input"
                    />
                    <button
                      type="button"
                      className="toggle-password-btn"
                      onClick={() => togglePasswordVisibility('current')}
                      tabIndex={-1}
                    >
                      {showPassword.current ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                  <div className="input-help">{t('profile_settings.password.help_current')}</div>
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword" className="form-label">
                    {t('profile_settings.password.new')}
                  </label>
                  <div className="password-input-container">
                    <input
                      type={showPassword.new ? 'text' : 'password'}
                      id="newPassword"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        newPassword: e.target.value
                      }))}
                      placeholder={t('profile_settings.password.placeholder_new')}
                      minLength={8}
                      required
                      disabled={loading}
                      className="password-input"
                    />
                    <button
                      type="button"
                      className="toggle-password-btn"
                      onClick={() => togglePasswordVisibility('new')}
                      tabIndex={-1}
                    >
                      {showPassword.new ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                  <div className="password-requirements">
                    <div className="requirements-title">{t('profile_settings.password.requirements_title')}</div>
                    <ul className="requirements-list">
                      <li className={passwordData.newPassword.length >= 8 ? 'met' : ''}>
                        ✓ {t('profile_settings.password.requirements.min_length')}
                      </li>
                      <li className={/[A-Z]/.test(passwordData.newPassword) ? 'met' : ''}>
                        ✓ {t('profile_settings.password.requirements.uppercase')}
                      </li>
                      <li className={/[a-z]/.test(passwordData.newPassword) ? 'met' : ''}>
                        ✓ {t('profile_settings.password.requirements.lowercase')}
                      </li>
                      <li className={/[0-9]/.test(passwordData.newPassword) ? 'met' : ''}>
                        ✓ {t('profile_settings.password.requirements.number')}
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword" className="form-label">
                    {t('profile_settings.password.confirm')}
                  </label>
                  <div className="password-input-container">
                    <input
                      type={showPassword.confirm ? 'text' : 'password'}
                      id="confirmPassword"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData(prev => ({
                        ...prev,
                        confirmPassword: e.target.value
                      }))}
                      placeholder={t('profile_settings.password.placeholder_confirm')}
                      required
                      disabled={loading}
                      className="password-input"
                    />
                    <button
                      type="button"
                      className="toggle-password-btn"
                      onClick={() => togglePasswordVisibility('confirm')}
                      tabIndex={-1}
                    >
                      {showPassword.confirm ? '👁️' : '👁️‍🗨️'}
                    </button>
                  </div>
                  <div className="password-match-indicator">
                    {passwordData.confirmPassword && (
                      <span className={passwordData.newPassword === passwordData.confirmPassword ? 'match' : 'no-match'}>
                        {passwordData.newPassword === passwordData.confirmPassword ? 
                          `✓ ${t('profile_settings.password.match')}` : `✗ ${t('profile_settings.password.no_match')}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="form-actions">
                  <button 
                    type="submit" 
                    className="change-password-btn"
                    disabled={loading || 
                      !passwordData.currentPassword || 
                      !passwordData.newPassword || 
                      !passwordData.confirmPassword ||
                      passwordData.newPassword !== passwordData.confirmPassword
                    }
                  >
                    {loading ? (
                      <>
                        <span className="spinner"></span>
                        {t('profile_settings.buttons.changing_password')}
                      </>
                    ) : (
                      t('profile_settings.buttons.change_password')
                    )}
                  </button>
                  <button 
                    type="button"
                    className="cancel-btn"
                    onClick={() => setActiveTab('personal')}
                    disabled={loading}
                  >
                    {t('profile_settings.actions.back_to_personal')}
                  </button>
                </div>
              </form>

              <div className="security-tips">
                <h4>{t('profile_settings.security_tips.title')}</h4>
                <ul className="tips-list">
                  <li>
                    <span className="tip-text">{t('profile_settings.security_tips.items.unique')}</span>
                  </li>
                  <li>
                    <span className="tip-text">{t('profile_settings.security_tips.items.rotate')}</span>
                  </li>
                  <li>
                    <span className="tip-text">{t('profile_settings.security_tips.items.share')}</span>
                  </li>
                  <li>
                    <span className="tip-text">{t('profile_settings.security_tips.items.logout')}</span>
                  </li>
                  <li>
                    <span className="tip-text">{t('profile_settings.security_tips.items.contact')}</span>
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
