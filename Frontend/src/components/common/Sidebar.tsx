import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { SidebarProps, MenuItem, UserRole } from '../../types';
import { useTranslation } from 'react-i18next';
import './Sidebar.css';

// Import logo
import universityLogo from '../../assets/university-logo.png';

const Sidebar: React.FC<SidebarProps> = ({ userRole, isMobileOpen, onClose }) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();

  // Detect screen size and handle responsive behavior
  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      
      if (mobile) {
        setIsCollapsed(false);
      } else {
        setIsCollapsed(true);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);

    return () => {
      window.removeEventListener('resize', checkScreenSize);
    };
  }, []);

  const getMenuItems = (): MenuItem[] => {
    const menuItems: Record<UserRole, MenuItem[]> = {
      employee: [
        { path: '/dashboard', label: t('menu.dashboard'), icon: '📊' },
        { path: '/apply-leave', label: t('menu.apply_leave'), icon: '📝' },
        { path: '/leave-history', label: t('menu.leave_history'), icon: '📋' },
        { path: '/about-me', label: t('nav.about_me'), icon: '👤' },
        { path: '/profile-settings', label: t('menu.profile_settings'), icon: '⚙️' }
      ],
      manager: [
        { path: '/about-me', label: t('nav.about_me'), icon: '👤' },
        { path: '/profile-settings', label: t('menu.profile_settings'), icon: '⚙️' },
        { path: '/dashboard', label: t('menu.dashboard'), icon: '📊' },
        { path: '/pending-requests', label: t('menu.pending_requests'), icon: '⏳', },
        { path: '/approvals-history', label: t('menu.approvals_history'), icon: '✅' },
        { path: '/team-overview', label: t('menu.team_overview'), icon: '👥' },
        { path: '/manager-reports', label: t('menu.reports'), icon: '📈' }
      ],
      'hr-admin': [
         { path: '/about-me', label: t('nav.about_me'), icon: '👤' },
         { path: '/profile-settings', label: t('menu.profile_settings'), icon: '⚙️' },
        { path: '/dashboard', label: t('menu.dashboard'), icon: '📊' },
        { path: '/leave-overview', label: t('menu.leave_overview'), icon: '👁️', },
        { path: '/user-management', label: t('menu.user_management'), icon: '👥' },
        { path: '/leave-types', label: t('menu.leave_types'), icon: '🏷️' },
        { path: '/system-config', label: t('menu.configuration'), icon: '⚙️' },
        { path: '/hr-reports', label: t('menu.reports'), icon: '📈' },
        { path: '/hr-approvals', label: t('menu.approvals'), icon: '✅' }

      ],
      'super-admin': [
        { path: '/about-me', label: t('nav.about_me'), icon: '👤' },
        { path: '/profile-settings', label: t('menu.profile_settings'), icon: '⚙️' },
        { path: '/dashboard', label: t('menu.dashboard'), icon: '📊' },
        { path: '/leave-overview', label: t('menu.leave_overview'), icon: '👁️', },
        { path: '/user-management', label: t('menu.user_management'), icon: '👥' },
        { path: '/leave-types', label: t('menu.leave_types'), icon: '🏷️' },
        { path: '/system-config', label: t('menu.configuration'), icon: '⚙️' },
        { path: '/hr-reports', label: t('menu.reports'), icon: '📈' },
        { path: '/hr-approvals', label: t('menu.approvals'), icon: '✅' }
      ],
    };

    return menuItems[userRole] || [];
  };

  const handleMouseEnter = () => {
    if (isCollapsed && !isMobile) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (isCollapsed && !isMobile) {
      setIsHovered(false);
    }
  };

  const handleClose = () => {
    if (!isMobile) {
      setIsCollapsed(true);
      setIsHovered(false);
    } else if (onClose) {
      onClose();
    }
  };

  const handleToggle = () => {
    if (isMobile) return;
    setIsCollapsed(prev => !prev);
    setIsHovered(false);
  };

  const handleNavClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  // Determine if sidebar should show expanded content
  const isSidebarExpanded = isHovered || !isCollapsed || (isMobile && isMobileOpen);

  return (
    <>
      {/* Mobile Overlay */}
      {isMobile && isMobileOpen && (
        <div 
          className="sidebar-overlay"
          onClick={handleClose}
        />
      )}

      <aside 
        className={`sidebar ${isCollapsed ? 'collapsed' : ''} ${isHovered ? 'hover-expanded' : ''} ${isMobile ? 'mobile' : 'desktop'} ${isMobileOpen ? 'mobile-open' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        aria-label={t('nav.leave_management')}
      >
        {/* Sidebar Header with OBU Logo */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img 
              src={universityLogo} 
              alt="Oda Bultum University Logo" 
              className="sidebar-logo"
            />
            {isSidebarExpanded && (
              <div className="brand-text">
                <div className="system-name">{t('app.system_short')}</div>
                <div className="system-subtitle">{t('app.management_system')}</div>
              </div>
            )}
          </div>
          
          <div className="sidebar-actions">
            {!isMobile && (
              <button
                className="sidebar-toggle"
                onClick={handleToggle}
                aria-label={isCollapsed ? t('common.expand_sidebar') : t('common.collapse_sidebar')}
                title={isCollapsed ? t('common.expand_sidebar') : t('common.collapse_sidebar')}
              >
                {isCollapsed ? '›' : '‹'}
              </button>
            )}

            {/* Close Button - Always visible when expanded */}
            {isSidebarExpanded && (
              <button 
                className="sidebar-close"
                onClick={handleClose}
                aria-label={t('common.close_sidebar')}
                title={t('common.close_sidebar')}
              >
                ×
              </button>
            )}
          </div>
        </div>

       
        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            {isSidebarExpanded && (
              <div className="section-label">{t('nav.leave_management')}</div>
            )}
            <ul>
              {getMenuItems().map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <NavLink 
                      to={item.path} 
                      className={({ isActive }) => 
                        `nav-link ${isActive ? 'active' : ''}`
                      }
                      title={!isSidebarExpanded ? item.label : ''}
                      onClick={handleNavClick}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      {isSidebarExpanded && (
                        <>
                          <span className="nav-label">{item.label}</span>
                          {item.badge && (
                            <span className="nav-badge">{item.badge}</span>
                          )}
                        </>
                      )}
                      {isActive && isSidebarExpanded && (
                        <span className="active-indicator">●</span>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

      
      </aside>
    </>
  );
};

export default Sidebar;
