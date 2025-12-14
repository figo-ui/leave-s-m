import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { SidebarProps, MenuItem, UserRole } from '../../types';
import './Sidebar.css';

// Import logo
import universityLogo from '../../assets/university-logo.png';

const Sidebar: React.FC<SidebarProps> = ({ userRole, isMobileOpen, onClose }) => {
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
        { path: '/dashboard', label: 'Dashboard', icon: '📊' },
        { path: '/apply-leave', label: 'Apply for Leave', icon: '📝' },
        { path: '/leave-history', label: 'My Leave History', icon: '📋' },
        { path: '/profile', label: 'Profile Settings', icon: '👤' }
      ],
      manager: [
        { path: '/profile', label: 'Profile Settings', icon: '👤' },
        { path: '/dashboard', label: 'Dashboard', icon: '📊' },
        { path: '/pending-requests', label: 'Pending Requests', icon: '⏳', },
        { path: '/approvals-history', label: 'Approvals History', icon: '✅' },
        { path: '/team-overview', label: 'Team Overview', icon: '👥' },
        { path: '/reports', label: 'Reports', icon: '📈' }
      ],
      'hr-admin': [
         { path: '/profile', label: 'Profile Settings', icon: '👤' },
        { path: '/dashboard', label: 'Dashboard', icon: '📊' },
        { path: '/leave-overview', label: 'Leave Overview', icon: '👁️', },
        { path: '/user-management', label: 'User Management', icon: '👥' },
        { path: '/leave-types', label: 'Leave Types', icon: '🏷️' },
        { path: '/system-config', label: 'Configuration', icon: '⚙️' },
        { path: '/hr-reports', label: 'Reports', icon: '📈' },
        { path: '/hr-approvals', label: 'Approvals', icon: '✅' }

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

  const handleNavClick = () => {
    if (isMobile && onClose) {
      onClose();
    }
  };

  const getRoleDisplayName = (role: UserRole): string => {
    const roleNames = {
      employee: 'Employee Portal',
      manager: 'Manager Portal',
      'hr-admin': 'HR Admin Portal'
    };
    return roleNames[role];
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
                <div className="system-name">OBU Leave</div>
                <div className="system-subtitle">Management System</div>
              </div>
            )}
          </div>
          
          {/* Close Button - Always visible when expanded */}
          {isSidebarExpanded && (
            <button 
              className="sidebar-close"
              onClick={handleClose}
              title="Close sidebar"
            >
              ×
            </button>
          )}
        </div>

       
        {/* Navigation Menu */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            {isSidebarExpanded && (
              <div className="section-label">LEAVE MANAGEMENT</div>
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