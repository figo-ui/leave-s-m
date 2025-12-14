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
      // Error is already set in the AuthContext
      console.log('Login failed');
    }
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

          {/* Email Field */}
          <div className="form-group">
            <label htmlFor="email">University Email</label>
            <input
              type="email"
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

        <div className="login-footer">
          <p>For account assistance, contact the HR department</p>
        </div>
      </div>
    </div>
  );
};

export default Login;