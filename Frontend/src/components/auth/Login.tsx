import React from 'react';
import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { LoginCredentials } from '../../types';
import './Login.css';

// Import logo
import universityLogo from '../../assets/university-logo.png';

const Login: React.FC = () => {
  const { login, loading, error, clearError } = useAuth();
  const [credentials, setCredentials] = useState<LoginCredentials>({
    email: '',
    password: ''
  });
  const [localError, setLocalError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear errors when user starts typing
    if (localError) setLocalError('');
    if (error) clearError();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');

    // Basic validation
    if (!credentials.email || !credentials.password) {
      setLocalError('Please enter both email and password');
      return;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(credentials.email)) {
      setLocalError('Please enter a valid email address');
      return;
    }

    const success = await login(credentials);
    if (!success) {
      // Error is already set in the AuthContext, so we don't need to set it here
      console.log('Login failed');
    }
  };

  // Demo credentials helper - UPDATED WITH REAL PASSWORDS
  const fillDemoCredentials = (role: 'employee' | 'manager' | 'hr-admin') => {
    const demoCredentials = {
      employee: { email: 'employee@bultum.edu.et', password: 'password123' },
      manager: { email: 'manager@bultum.edu.et', password: 'password123' },
      'hr-admin': { email: 'hr@bultum.edu.et', password: 'password123' }
    };
    
    setCredentials(demoCredentials[role]);
    // Clear any existing errors when filling demo credentials
    setLocalError('');
    clearError();
  };

  // Display either local validation errors or AuthContext errors
  const displayError = localError || error;

  return (
    <div className="login-container">
      <div className="login-card">
        {/* University Logo Header */}
        <div className="university-header">
          <div className="logo-container">
            <img 
              src={universityLogo} 
              alt="Oda Bultum University Logo" 
              className="university-logo"
            />
          </div>
          <div className="university-name-large">
            <h1>ODA BULTUM UNIVERSITY</h1>
            <p>Leave Management System</p>
          </div>
        </div>

        {/* Login Header */}
        <div className="login-header">
          <h2>LOGIN TO SECURE ACCESS</h2>
          <p className="login-subtitle">Enter your university credentials</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {displayError && (
            <div className="error-message">
              {displayError}
            </div>
          )}

          {/* Email Field - CHANGED from Username to Email */}
          <div className="form-group">
            <label htmlFor="email">University Email</label>
            <input
              type="email" // CHANGED to email type for better validation
              id="email"
              name="email"
              value={credentials.email}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="your.email@bultum.edu.et"
              autoComplete="email"
            />
          </div>

          {/* Password Field */}
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              required
              disabled={loading}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <button 
            type="submit" 
            className="login-btn"
            disabled={loading || !credentials.email || !credentials.password}
          >
            {loading ? (
              <>
                <span className="loading-spinner"></span>
                Logging in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>

        {/* Demo Credentials Section - UPDATED */}
        <div className="demo-section">
          <div className="demo-header">
            <h3>Demo Access</h3>
            <p>Quick login with test accounts:</p>
          </div>
          
          <div className="demo-buttons">
            <button 
              type="button"
              className="demo-btn employee"
              onClick={() => fillDemoCredentials('employee')}
              disabled={loading}
            >
              <span className="demo-icon">👨‍💼</span>
              Employee Login
            </button>
            
            <button 
              type="button"
              className="demo-btn manager"
              onClick={() => fillDemoCredentials('manager')}
              disabled={loading}
            >
              <span className="demo-icon">👔</span>
              Manager Login
            </button>
            
            <button 
              type="button"
              className="demo-btn hr"
              onClick={() => fillDemoCredentials('hr-admin')}
              disabled={loading}
            >
              <span className="demo-icon">🏢</span>
              HR Admin Login
            </button>
          </div>

          <div className="demo-credentials-info">
            <p><strong>All demo accounts use password:</strong> <code>password123</code></p>
          </div>
        </div>

        <div className="login-footer">
          <p>For account assistance, contact the HR department</p>
          <p className="technical-info">
            <small>Backend: localhost:5000 | Database: PostgreSQL</small>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;