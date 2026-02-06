import React, { useState, useEffect, useRef } from 'react';
import { useNavigate,  } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiService, getServerOrigin } from '../../utils/api';
import { LanguageCode } from '../../types';
import './Navbar.css';

// Import the logo image
import universityLogo from '../../assets/university-logo.png';

interface NavbarProps {
  onMenuToggle?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuToggle }) => {
  const { user, logout, updateUser } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
 
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isUpdatingLanguage, setIsUpdatingLanguage] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = () => {
    logout();
    setIsProfileOpen(false);
  };

  const handleProfileClick = () => {
    setIsProfileOpen(!isProfileOpen);
  };

  const handleNavigation = (path: string) => {
    navigate(path);
    setIsProfileOpen(false);
  };

  const getWelcomeMessage = () => {
    if (!user) return t('common.welcome_generic');
    return t('common.welcome', { name: user.name });
  };

  const getUserRole = () => {
    if (!user) return t('roles.employee');
    return t(`roles.${user.role}`);
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    return user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
  };

  const getAvatarUrl = (avatarPath?: string) => {
    if (!avatarPath) return '';
    if (avatarPath.startsWith('http')) return avatarPath;
    return `${getServerOrigin()}${avatarPath}`;
  };

  const handleLanguageChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedLanguage = event.target.value as LanguageCode;

    if (i18n.language === selectedLanguage) return;

    i18n.changeLanguage(selectedLanguage);
    localStorage.setItem('language', selectedLanguage);

    if (!user) return;

    try {
      setIsUpdatingLanguage(true);
      const response = await apiService.updateProfile({ language: selectedLanguage });
      if (response.success && response.data) {
        updateUser(response.data);
      }
    } catch (error) {
      console.error('Failed to update language preference:', error);
    } finally {
      setIsUpdatingLanguage(false);
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        {/* Hamburger Menu */}
        <button 
          className="mobile-menu-toggle"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
          <span className="hamburger-line"></span>
        </button>
        
        <div className="navbar-brand">
          <div className="logo-container">
            <img 
              src={universityLogo} 
              alt="Bultum University Logo" 
              className="navbar-logo"
            />
            <div className="university-name">
              <h2>{t('app.university_name')}</h2>
              <p>{t('app.system_name')}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="navbar-center">
        <div className="welcome-section">
          <span className="welcome-text">{getWelcomeMessage()}</span>
          <span className="user-role">({getUserRole()})</span>
        </div>
      </div>

      <div className="navbar-right">
        <div className="language-select">
          <label className="language-label" htmlFor="navbar-language">
            {t('common.language')}
          </label>
          <select
            id="navbar-language"
            className="language-dropdown"
            value={i18n.language}
            onChange={handleLanguageChange}
            disabled={isUpdatingLanguage}
            aria-label={t('common.language')}
          >
            <option value="en">{t('languages.en')}</option>
            <option value="om">{t('languages.om')}</option>
            <option value="am">{t('languages.am')}</option>
          </select>
        </div>
        {/* User Profile Dropdown */}
        <div className="user-profile-dropdown" ref={dropdownRef}>
          <button 
            className={`profile-trigger ${isProfileOpen ? 'active' : ''}`}
            onClick={handleProfileClick}
            aria-label="User profile menu"
          >
            <div className="profile-avatar">
              {user?.avatar ? (
                <img src={getAvatarUrl(user.avatar)} alt={user.name} className="avatar-image" />
              ) : (
                <span className="avatar-initials">{getUserInitials()}</span>
              )}
            </div>
            <span className="profile-arrow">▼</span>
          </button>

          {isProfileOpen && (
            <div className="profile-menu">
              {/* User Header */}
              <div className="profile-header">
                <div className="profile-avatar-large">
                  {user?.avatar ? (
                    <img src={getAvatarUrl(user.avatar)} alt={user.name} className="avatar-image-large" />
                  ) : (
                    <span className="avatar-initials-large">{getUserInitials()}</span>
                  )}
                </div>
                <div className="profile-info">
                  <div className="profile-name">{user?.name}</div>
                  <div className="profile-email">{user?.email}</div>
                  <div className="profile-role-badge">{getUserRole()}</div>
                </div>
              </div>

              <div className="menu-divider"></div>

              {/* Quick Profile Section */}
              <div className="menu-section">
                <div className="section-label">{t('common.profile')}</div>
                <button 
                  className="menu-item primary"
                  onClick={() => handleNavigation('/about-me')}
                >
                  <span className="menu-icon">👤</span>
                  <span className="menu-text">{t('nav.about_me')}</span>
                  <span className="menu-arrow">→</span>
                </button>
                
                <button 
                  className="menu-item"
                  onClick={() => handleNavigation('/profile-settings')}
                >
                  <span className="menu-icon">⚙️</span>
                  <span className="menu-text">{t('menu.profile_settings')}</span>
                </button>
              </div>

              <div className="menu-divider"></div>

              {/* Security Section */}
              <div className="menu-section">
                <div className="section-label">{t('common.security')}</div>
                <button 
                  className="menu-item"
                  onClick={() => handleNavigation('/profile-settings')}
                >
                  <span className="menu-icon">🔐</span>
                  <span className="menu-text">{t('nav.password_security')}</span>
                </button>
              </div>

              <div className="menu-divider"></div>

              {/* Help & Support Section */}
              <div className="menu-section">
                <button className="menu-item">
                  <span className="menu-icon">❓</span>
                  <span className="menu-text">{t('common.help_support')}</span>
                </button>
                
                <button className="menu-item">
                  <span className="menu-icon">ℹ️</span>
                  <span className="menu-text">{t('common.about_system')}</span>
                </button>
                
                <button 
                  className="menu-item logout"
                  onClick={handleLogout}
                >
                  <span className="menu-icon">🚪</span>
                  <span className="menu-text">{t('common.sign_out')}</span>
                </button>
              </div>

              {/* Footer */}
              <div className="menu-footer">
                <div className="system-info">
                  <span className="system-version">v2.1.0</span>
                  <span className="system-status">• All systems operational</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
