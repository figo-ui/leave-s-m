import React, { useState } from 'react';
import { LayoutProps, } from '../../types';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import './Layout.css';



const Layout: React.FC<LayoutProps> = ({ children, userRole }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleSidebarClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="layout">
      <Sidebar 
        userRole={userRole} 
        isMobileOpen={isMobileMenuOpen}
        onClose={handleSidebarClose}
      />
      <div className="layout-content">
        <Navbar onMenuToggle={handleMobileToggle} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;