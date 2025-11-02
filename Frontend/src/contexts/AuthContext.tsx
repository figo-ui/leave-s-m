import React, { createContext, useState, useContext, useEffect, useMemo } from 'react';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'employee' | 'manager' | 'hr-admin' | 'super-admin';
  department: string;
  position: string;
  phone?: string;
  joinDate?: string;
  status: 'active' | 'inactive' | 'suspended';
  avatar?: string;
  managerId?: number;
  manager?: {
    id: number;
    name: string;
    email: string;
  };
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  loading: boolean;
  error: string;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_BASE_URL = 'http://localhost:5000/api';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const testResponse = await fetch(`${API_BASE_URL}/test`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (testResponse.ok) {
          console.log('✅ Token is valid');
        } else {
          localStorage.removeItem('token');
        }
      } catch (error) {
        console.error('Token validation failed:', error);
        localStorage.removeItem('token');
      }

      setLoading(false);
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
      setLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    try {
      setLoading(true);
      setError('');

      console.log('🔄 Attempting login with:', credentials);

      // Test backend connection first
      try {
        const testResponse = await fetch(`${API_BASE_URL}/test`);
        const testData = await testResponse.json();
        console.log('✅ Backend test response:', testData);
        
        if (!testResponse.ok) {
          throw new Error(`Backend test failed: ${testResponse.status}`);
        }
      } catch (testError) {
        console.error('❌ Backend is NOT reachable:', testError);
        setError('Backend server is not running. Please start the backend on port 5000.');
        setLoading(false);
        return false;
      }

      console.log('📤 Sending login request to:', `${API_BASE_URL}/auth/login`);
      
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers);

      const data = await response.json();
      console.log('📦 Full response data:', data);

      if (!response.ok) {
        console.log('❌ Login failed with status:', response.status);
        console.log('❌ Error message:', data.message);
        
        if (response.status === 401) {
          setError(data.message || 'Invalid email or password. Please check your credentials.');
        } else if (response.status === 400) {
          setError(data.message || 'Invalid request data. Please check your input.');
        } else {
          setError(data.message || `Login failed with status: ${response.status}`);
        }
        return false;
      }

      if (data.success && data.data.token) {
        console.log('✅ Login successful! Token received');
        localStorage.setItem('token', data.data.token);
        
        // Transform backend user data to frontend format
        const userData: User = {
          id: data.data.user.id,
          name: data.data.user.name,
          email: data.data.user.email,
          role: data.data.user.role as 'employee' | 'manager' | 'hr-admin' | 'super-admin',
          department: data.data.user.department,
          position: data.data.user.position,
          status: data.data.user.status as 'active' | 'inactive' | 'suspended',
          phone: data.data.user.phone,
          joinDate: data.data.user.joinDate,
          avatar: data.data.user.avatar,
          managerId: data.data.user.managerId,
          manager: data.data.user.manager
        };
        
        setUser(userData);
        setError('');
        console.log('✅ User data set:', userData);
        return true;
      } else {
        console.log('❌ Login response indicates failure');
        setError(data.message || 'Login failed. Please try again.');
        return false;
      }
    } catch (error) {
      console.error('💥 Login error:', error);
      if (error instanceof TypeError) {
        setError('Network error: Cannot connect to server. Make sure backend is running on port 5000.');
      } else {
        setError('An unexpected error occurred during login.');
      }
      return false;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setError('');
    console.log('🚪 User logged out');
  };

  const clearError = () => {
    setError('');
  };

  const contextValue = useMemo(() => ({
    user,
    login,
    logout,
    isAuthenticated: !!user,
    loading,
    error,
    clearError
  }), [user, loading, error]);

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