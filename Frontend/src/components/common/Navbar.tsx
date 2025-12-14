import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Navbar.css';

// Import the logo image
import universityLogo from '../../assets/university-logo.png';

interface NavbarProps {
  onMenuToggle?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
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
    if (!user) return 'Welcome';
    return `Welcome, ${user.name}`;
  };

  const getUserRole = () => {
    if (!user) return 'Employee';
    return user.role.charAt(0).toUpperCase() + user.role.slice(1);
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    return user.name ? user.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'U';
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
              <h2>ODA BULTUM UNIVERSITY</h2>
              <p>Leave Management System</p>
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
        {/* User Profile Dropdown */}
        <div className="user-profile-dropdown" ref={dropdownRef}>
          <button 
            className={`profile-trigger ${isProfileOpen ? 'active' : ''}`}
            onClick={handleProfileClick}
            aria-label="User profile menu"
          >
            <div className="profile-avatar">
              {user?.avatar ? (
                <img src={user.avatar} alt={user.name} className="avatar-image" />
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
                    <img src={user.avatar} alt={user.name} className="avatar-image-large" />
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
                <div className="section-label">Profile</div>
                <button 
                  className="menu-item primary"
                  onClick={() => handleNavigation('/about-me')}
                >
                  <span className="menu-icon">👤</span>
                  <span className="menu-text">About Me</span>
                  <span className="menu-arrow">→</span>
                </button>
                
                <button 
                  className="menu-item"
                  onClick={() => handleNavigation('/profile-settings')}
                >
                  <span className="menu-icon">⚙️</span>
                  <span className="menu-text">Profile Settings</span>
                </button>
              </div>

              <div className="menu-divider"></div>

              {/* Security Section */}
              <div className="menu-section">
                <div className="section-label">Security</div>
                <button 
                  className="menu-item"
                  onClick={() => handleNavigation('/security')}
                >
                  <span className="menu-icon">🔐</span>
                  <span className="menu-text">Password & Security</span>
                </button>
              </div>

              <div className="menu-divider"></div>

              {/* Help & Support Section */}
              <div className="menu-section">
                <button className="menu-item">
                  <span className="menu-icon">❓</span>
                  <span className="menu-text">Help & Support</span>
                </button>
                
                <button className="menu-item">
                  <span className="menu-icon">ℹ️</span>
                  <span className="menu-text">About System</span>
                </button>
                
                <button 
                  className="menu-item logout"
                  onClick={handleLogout}
                >
                  <span className="menu-icon">🚪</span>
                  <span className="menu-text">Sign Out</span>
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