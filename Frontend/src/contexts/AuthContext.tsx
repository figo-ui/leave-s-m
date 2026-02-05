// contexts/AuthContext.tsx
import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { User, LoginCredentials } from '../types';
import { apiService, } from '../utils/api';
import i18n from '../i18n';

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  updateUser: (userData: User) => void;
  refreshUser: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
  initializing: boolean;
  error: string;
  clearError: () => void;
  clearSuccess: () => void;
  success: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Persistent auth state
interface AuthState {
  user: User | null;
  token: string | null;
  lastChecked: number;
}

const STORAGE_KEY = 'auth_state';

const getStoredAuthState = (): AuthState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to parse stored auth state:', error);
  }
  
  return {
    user: null,
    token: null,
    lastChecked: 0
  };
};

const setStoredAuthState = (state: AuthState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to store auth state:', error);
  }
};

const clearStoredAuthState = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  } catch (error) {
    console.error('Failed to clear auth state:', error);
  }
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [initializing, setInitializing] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Transform backend user data to frontend format
  const transformBackendUser = useCallback((backendUser: any): User => {
    return {
      id: backendUser.id,
      name: backendUser.name,
      email: backendUser.email,
      role: backendUser.role,
      department: backendUser.department,
      position: backendUser.position || '',
      phone: backendUser.phone || '',
      status: backendUser.status,
      language: backendUser.language || 'en',
      joinDate: backendUser.joinDate,
      avatar: backendUser.avatar,
      managerId: backendUser.managerId,
      manager: backendUser.manager,
      leaveBalances: backendUser.leaveBalances || []
    };
  }, []);

  // Validate token with backend
  const validateToken = useCallback(async (): Promise<boolean> => {
    try {
      const response = await apiService.getCurrentUser();
      return response.success;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  }, []);

  // Load user from backend
  const loadUser = useCallback(async (): Promise<User | null> => {
    try {
      const response = await apiService.getCurrentUser();
      
      if (response.success && response.data) {
        const userData = transformBackendUser(response.data.user);
        return userData;
      }
      
      return null;
    } catch (error) {
      console.error('Failed to load user:', error);
      return null;
    }
  }, [transformBackendUser]);

  // Initialize auth state
  const initializeAuth = useCallback(async () => {
    try {
      setInitializing(true);
      
      const storedState = getStoredAuthState();
      const token = localStorage.getItem('token');
      
      console.log('🔄 Initializing auth state...', {
        hasStoredState: !!storedState.user,
        hasToken: !!token,
        tokenValid: token ? apiService.isAuthenticated() : false
      });

      // If we have a token, validate it and load user
      if (token && apiService.isAuthenticated()) {
        const isValid = await validateToken();
        
        if (isValid) {
          const userData = await loadUser();
          
          if (userData) {
            setUser(userData);
            const preferredLanguage = userData.language || localStorage.getItem('language') || 'en';
            localStorage.setItem('language', preferredLanguage);
            i18n.changeLanguage(preferredLanguage);
            setStoredAuthState({
              user: userData,
              token,
              lastChecked: Date.now()
            });
            console.log('✅ Auth initialized successfully');
          } else {
            console.warn('❌ Failed to load user data');
            clearStoredAuthState();
          }
        } else {
          console.warn('❌ Token validation failed');
          clearStoredAuthState();
        }
      } else {
        console.log('🔐 No valid token found');
        clearStoredAuthState();
      }
    } catch (error) {
      console.error('💥 Auth initialization failed:', error);
      clearStoredAuthState();
    } finally {
      setInitializing(false);
    }
  }, [validateToken, loadUser]);

  // Initialize on mount
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Auto-refresh user data periodically
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        const userData = await loadUser();
        if (userData) {
          setUser(userData);
          setStoredAuthState({
            user: userData,
            token: localStorage.getItem('token'),
            lastChecked: Date.now()
          });
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    }, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(interval);
  }, [user, loadUser]);

  const login = useCallback(async (
    credentials: LoginCredentials
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      setUser(null);

      console.log('🔐 Attempting login for:', credentials.email);

      const response = await apiService.login(credentials);
      
      if (response.success && response.data) {
        const userData = transformBackendUser(response.data.user);
        
        setUser(userData);
        const preferredLanguage = userData.language || localStorage.getItem('language') || 'en';
        localStorage.setItem('language', preferredLanguage);
        i18n.changeLanguage(preferredLanguage);
        setStoredAuthState({
          user: userData,
          token: response.data.token,
          lastChecked: Date.now()
        });
        
        setSuccess('Login successful!');
        
        console.log('✅ Login successful:', {
          email: userData.email,
          role: userData.role,
          managerId: userData.managerId
        });
        
        return { success: true };
      } else {
        const errorMessage = response.message || 'Login failed. Please try again.';
        setError(errorMessage);
        return { success: false, message: errorMessage };
      }
    } catch (error: any) {
      console.error('💥 Login error:', error);
      
      let errorMessage = 'An unexpected error occurred during login.';
      
      if (error instanceof TypeError) {
        errorMessage = 'Cannot connect to server. Please make sure the backend is running on port 5000.';
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [transformBackendUser]);

  const logout = useCallback(() => {
    console.log('🚪 Logging out user');
    
    setUser(null);
    setError('');
    setSuccess('');
    
    // Clear all storage and caches
    clearStoredAuthState();
    apiService.logout(false);
    
    // Redirect to login
    window.location.href = '/login';
  }, []);

  const updateUser = useCallback((userData: User) => {
    setUser(userData);
    if (userData.language) {
      localStorage.setItem('language', userData.language);
      i18n.changeLanguage(userData.language);
    }
    setStoredAuthState({
      user: userData,
      token: localStorage.getItem('token'),
      lastChecked: Date.now()
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      console.log('🔄 Refreshing user data...');
      
      const userData = await loadUser();
      if (userData) {
        setUser(userData);
        if (userData.language) {
          localStorage.setItem('language', userData.language);
          i18n.changeLanguage(userData.language);
        }
        setStoredAuthState({
          user: userData,
          token: localStorage.getItem('token'),
          lastChecked: Date.now()
        });
        console.log('✅ User data refreshed');
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, [loadUser]);

  const clearError = useCallback(() => {
    setError('');
  }, []);

  const clearSuccess = useCallback(() => {
    setSuccess('');
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    login,
    logout,
    updateUser,
    refreshUser,
    isAuthenticated: !!user && apiService.isAuthenticated(),
    loading,
    initializing,
    error,
    success,
    clearError,
    clearSuccess
  }), [
    user,
    login,
    logout,
    updateUser,
    refreshUser,
    loading,
    initializing,
    error,
    success,
    clearError,
    clearSuccess
  ]);

  // Show loading state during initialization
  if (initializing) {
    return (
      <div className="auth-initializing">
        <div className="loading-spinner large"></div>
        <p>Initializing authentication...</p>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Higher-order component for protected routes
export function withAuth<P extends object>(
  Component: React.ComponentType<P>,
  requiredRole?: string
) {
  return function ProtectedComponent(props: P) {
    const { isAuthenticated, user, initializing } = useAuth();

    if (initializing) {
      return (
        <div className="auth-loading">
          <div className="loading-spinner"></div>
          <p>Checking authentication...</p>
        </div>
      );
    }

    if (!isAuthenticated) {
      window.location.href = '/login';
      return null;
    }

    if (requiredRole && user?.role !== requiredRole) {
      return (
        <div className="unauthorized">
          <h2>Access Denied</h2>
          <p>You don't have permission to access this page.</p>
        </div>
      );
    }

    return <Component {...props} />;
  };
}
