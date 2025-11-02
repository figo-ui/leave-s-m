import React, { useState, useEffect, useRef } from 'react';
import Notifications from './Notifications';
import { useAuth } from '../../contexts/AuthContext';
import './Navbar.css';

// Import the logo image
import universityLogo from '../../assets/university-logo.png';

interface NavbarProps {
  onMenuToggle?: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ onMenuToggle }) => {
  const { user, logout } = useAuth();
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

  const getWelcomeMessage = () => {
    if (!user) return 'Welcome';
    
    const name = user.name || user.firstName || 'User';
    return `Welcome, ${name}`;
  };

  const getUserRole = () => {
    if (!user) return 'Employee';
    
    const role = user.role || 'employee';
    return role.charAt(0).toUpperCase() + role.slice(1);
  };

  const getUserInitials = () => {
    if (!user) return 'U';
    
    const firstName = user.firstName || '';
    const lastName = user.lastName || '';
    
    if (firstName && lastName) {
      return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
    }
    
    return user.name ? user.name.charAt(0).toUpperCase() : 'U';
  };

  const getUserFullName = () => {
    if (!user) return 'User';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User';
  };

  return (
    <nav className="navbar">
      <div className="navbar-left">
        {/* Hamburger Menu - Only visible on mobile */}
        <button 
          className="mobile-menu-toggle"
          onClick={onMenuToggle}
          aria-label="Toggle menu"
        >
          ☰
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
        
        {/* User Profile Dropdown - Chrome Style */}
        <div className="user-profile-dropdown" ref={dropdownRef}>
          <button 
            className="profile-trigger"
            onClick={handleProfileClick}
            aria-label="User profile menu"
          >
            <div className="profile-avatar">
              {getUserInitials()}
            </div>
          </button>

          {isProfileOpen && (
            <div className="chrome-profile-menu">
              {/* User Header */}
              <div className="profile-header">
                <div className="profile-avatar-large">
                  {getUserInitials()}
                </div>
                <div className="profile-info">
                  <div className="profile-name">{getUserFullName()}</div>
                  <div className="profile-email">{user?.email}</div>
                </div>
              </div>

              <div className="menu-section">
                <button className="menu-item">
                  <span className="menu-icon">🔐</span>
                  <span className="menu-text">Password & Security</span>
                </button>
                
                <button className="menu-item">
                  <span className="menu-icon">👤</span>
                  <span className="menu-text">Manage Your Account</span>
                </button>
                
                <button className="menu-item">
                  <span className="menu-icon">🎨</span>
                  <span className="menu-text">Customize Profile</span>
                </button>
                
                <button className="menu-item">
                  <span className="menu-icon">🔄</span>
                  <span className="menu-text">Sync is on</span>
                </button>
              </div>

              <div className="menu-divider"></div>

              <div className="menu-section">
                <button className="menu-item">
                  <span className="menu-icon">⚙️</span>
                  <span className="menu-text">Manage Profiles</span>
                </button>
              </div>

              <div className="menu-divider"></div>

              <div className="menu-section">
                <button className="menu-item">
                  <span className="menu-icon">❓</span>
                  <span className="menu-text">Help & Support</span>
                </button>
                
                <button className="menu-item">
                  <span className="menu-icon">🌐</span>
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
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;