import React, { useState, useRef, useEffect } from 'react';
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
      setError('Please enter a valid Ethiopian phone number (e.g., +251 91 234 5678)');
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
        setError(response.message || 'Failed to update phone number');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update phone number');
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
        setError(response.message || 'Failed to update language');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to update language');
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
      setError('Please enter your current password');
      return;
    }

    if (!passwordData.newPassword) {
      setError('Please enter a new password');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match!');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      setError('New password must be at least 8 characters long!');
      return;
    }

    // Additional password strength validation
    const passwordErrors = validatePasswordStrength(passwordData.newPassword);
    if (passwordErrors.length > 0) {
      setError(`Password requirements: ${passwordErrors.join(', ')}`);
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
        setError(response.message || 'Failed to change password');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const validatePasswordStrength = (password: string): string[] => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('At least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('At least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('At least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('At least one number');
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
    const roleLabels: Record<string, string> = {
      'employee': 'Employee',
      'manager': 'Manager',
      'hr-admin': 'HR Administrator',
      'super-admin': 'System Administrator'
    };
    return roleLabels[role] || role;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not available';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatPhoneNumber = (phone: string = ''): string => {
    if (!phone.trim()) return 'Not provided';
    
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
        <p>Manage your personal information and security preferences</p>
      </div>

      {/* Messages */}
      {message && (
        <div className="success-message">
          <div className="message-content">
            <span className="message-icon">✅</span>
            <span className="message-text">{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="message-close">×</button>
        </div>
      )}
      
      {error && (
        <div className="error-message">
          <div className="message-content">
            <span className="message-icon">⚠️</span>
            <span className="message-text">{error}</span>
          </div>
          <button onClick={() => setError('')} className="message-close">×</button>
        </div>
      )}

      <div className="profile-content">
        {/* Sidebar Navigation */}
        <div className="profile-sidebar">
          <div className="sidebar-section">
            <h3>Settings</h3>
            <nav className="sidebar-nav">
              <button 
                className={`nav-item ${activeTab === 'personal' ? 'active' : ''}`}
                onClick={() => setActiveTab('personal')}
                type="button"
              >
                <span className="nav-icon">👤</span>
                <span className="nav-text">Personal Information</span>
              </button>
              <button 
                className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
                type="button"
              >
                <span className="nav-icon">🔐</span>
                <span className="nav-text">Security & Password</span>
              </button>
            </nav>
          </div>

          <div className="sidebar-help">
            <h4>Need Help?</h4>
            <p>Contact HR department for changes to:</p>
            <ul className="help-list">
              <li>• Name changes</li>
              <li>• Email address</li>
              <li>• Department changes</li>
              <li>• Position updates</li>
            </ul>
            <button className="help-btn">Contact HR</button>
          </div>
        </div>

        {/* Main Content */}
        <div className="profile-main">
          {activeTab === 'personal' && (
            <div className="personal-info-section">
              <div className="section-header">
                <h2>Personal Information</h2>
                <p className="section-subtitle">
                  <span className="editable-info">You can edit: Profile picture and phone number</span>
                  <span className="non-editable-info">Other fields are managed by HR</span>
                </p>
              </div>

              {/* Profile Picture Section */}
              <div className="profile-picture-section">
                <div className="picture-container">
                  <AvatarUpload
                    currentAvatar={profile.avatar}
                    userName={profile.name}
                    onAvatarUpdate={handleAvatarUpdate}
                    size="large"
                  />
                </div>
                <div className="picture-info">
                  <h4>Profile Picture</h4>
                  <p className="picture-guidelines">
                    Upload a professional photo for your profile.
                    <br/>
                    <span className="guideline-detail">Supported: JPG, PNG • Max: 5MB • Recommended: 400x400px</span>
                  </p>
                  <div className="picture-status">
                    <span className="editable-badge">Editable</span>
                  </div>
                </div>
              </div>

              {/* Personal Information Grid */}
              <div className="info-grid">
                {/* Read-only Fields */}
                <div className="info-group read-only">
                  <label className="info-label">Full Name</label>
                  <div className="info-value">
                    {profile.name}
                    <span className="readonly-badge">Managed by HR</span>
                  </div>
                  <div className="info-help">Legal name as per university records</div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">Email Address</label>
                  <div className="info-value">
                    {profile.email}
                    <span className="readonly-badge">University Email</span>
                  </div>
                  <div className="info-help">Primary university email address</div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">Employee ID</label>
                  <div className="info-value">
                    {profile.employeeId || 'Not assigned'}
                    <span className="readonly-badge">System Generated</span>
                  </div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">Department</label>
                  <div className="info-value">
                    {profile.department}
                    <span className="readonly-badge">Managed by HR</span>
                  </div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">Position</label>
                  <div className="info-value">
                    {profile.position || 'Not specified'}
                    <span className="readonly-badge">Managed by HR</span>
                  </div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">Join Date</label>
                  <div className="info-value">
                    {formatDate(profile.joinDate || '')}
                    <span className="readonly-badge">System Record</span>
                  </div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">Status</label>
                  <div className="info-value">
                    <span className={`status-badge ${(profile.status || 'active').toLowerCase()}`}>
                      {profile.status || 'active'}
                    </span>
                    <span className="readonly-badge">System Status</span>
                  </div>
                </div>

                {/* Editable Phone Number Field */}
                <div className="info-group editable">
                  <label className="info-label">
                    Phone Number
                    <span className="editable-indicator">(You can edit)</span>
                  </label>
                  {isEditingPhone ? (
                    <div className="edit-phone-container">
                      <input
                        ref={phoneInputRef}
                        type="tel"
                        value={profile.phone || ''}
                        onChange={(e) => handlePhoneNumberChange(e.target.value)}
                        className="phone-input"
                        placeholder="+251 91 234 5678"
                        disabled={loading}
                      />
                      <div className="phone-format-hint">
                        Format: +251 XX XXX XXXX or 09XX XXX XXX
                      </div>
                      <div className="phone-actions">
                        <button 
                          type="button"
                          className="save-btn"
                          onClick={handlePhoneNumberSave}
                          disabled={loading}
                        >
                          {loading ? 'Saving...' : 'Save'}
                        </button>
                        <button 
                          type="button"
                          className="cancel-btn"
                          onClick={handlePhoneNumberCancel}
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="info-value-with-action">
                      <div className="phone-display">
                        {formatPhoneNumber(profile.phone)}
                        <div className="phone-status">
                          <span className="editable-badge">Editable</span>
                        </div>
                      </div>
                      <button 
                        type="button"
                        className="edit-btn"
                        onClick={() => setIsEditingPhone(true)}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                  <div className="info-help">Your personal contact number (will not be shared publicly)</div>
                </div>

                {/* Language Selection */}
                <div className="info-group editable">
                  <label className="info-label">
                    {t('profile.language_label')}
                    <span className="editable-indicator">(You can edit)</span>
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
                  <div className="info-help">Choose the language you want to use in the system</div>
                </div>

                <div className="info-group read-only">
                  <label className="info-label">User Role</label>
                  <div className="info-value">
                    <span className={`role-badge role-${profile.role}`}>
                      {getRoleLabel(profile.role)}
                    </span>
                    <span className="readonly-badge">System Assigned</span>
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
                  Go to Security Settings
                </button>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="security-section">
              <div className="section-header">
                <h2>Security & Password</h2>
                <p className="section-subtitle">
                  <span className="editable-info">Change your password anytime for account security</span>
                </p>
              </div>

              <form onSubmit={handlePasswordChange} className="password-form">
                <div className="form-group">
                  <label htmlFor="currentPassword" className="form-label">
                    Current Password
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
                      placeholder="Enter your current password"
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
                  <div className="input-help">Enter your current account password</div>
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword" className="form-label">
                    New Password
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
                      placeholder="Enter new password (min 8 characters)"
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
                    <div className="requirements-title">Password must contain:</div>
                    <ul className="requirements-list">
                      <li className={passwordData.newPassword.length >= 8 ? 'met' : ''}>
                        ✓ At least 8 characters
                      </li>
                      <li className={/[A-Z]/.test(passwordData.newPassword) ? 'met' : ''}>
                        ✓ One uppercase letter
                      </li>
                      <li className={/[a-z]/.test(passwordData.newPassword) ? 'met' : ''}>
                        ✓ One lowercase letter
                      </li>
                      <li className={/[0-9]/.test(passwordData.newPassword) ? 'met' : ''}>
                        ✓ One number
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword" className="form-label">
                    Confirm New Password
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
                      placeholder="Confirm your new password"
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
                          '✓ Passwords match' : '✗ Passwords do not match'}
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
                        Changing Password...
                      </>
                    ) : (
                      'Change Password'
                    )}
                  </button>
                  <button 
                    type="button"
                    className="cancel-btn"
                    onClick={() => setActiveTab('personal')}
                    disabled={loading}
                  >
                    Back to Personal Info
                  </button>
                </div>
              </form>

              <div className="security-tips">
                <h4>Security Best Practices</h4>
                <ul className="tips-list">
                  <li>
                    <span className="tip-text">Use a unique password that you don't use elsewhere</span>
                  </li>
                  <li>
                    <span className="tip-text">Change your password every 90 days for maximum security</span>
                  </li>
                  <li>
                    <span className="tip-text">Never share your password, even with colleagues or IT support</span>
                  </li>
                  <li>
                    <span className="tip-text">Log out when using shared or public computers</span>
                  </li>
                  <li>
                    <span className="tip-text">Contact IT immediately if you suspect unauthorized access</span>
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
