// utils/api.ts
import { User, Leave, LeaveType, LeaveBalance, DashboardStats, SystemSetting, Notification, TeamMember, ReportData } from '../types';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  timestamp?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  skipAuth?: boolean;
}

// Cache interface
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

class ApiService {
  private baseURL: string;
  private cache: Map<string, CacheEntry>;
  private pendingRequests: Map<string, Promise<any>>;
  private requestQueue: Map<string, Array<(value: any) => void>>;

  constructor() {
    this.baseURL = 'http://localhost:5000/api';
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.requestQueue = new Map();
  }

  // Enhanced request method with caching, queuing, and retry logic
  private async request<T>(
    endpoint: string,
    options: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      timeout = 15000,
      retries = 3,
      skipAuth = false,
      ...fetchOptions
    } = options;

    const cacheKey = this.getCacheKey(endpoint, fetchOptions.body);
    const requestKey = `${fetchOptions.method || 'GET'}:${endpoint}`;

    // Check cache for GET requests
    if (fetchOptions.method === 'GET' || !fetchOptions.method) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        console.log(`📦 Serving from cache: ${endpoint}`);
        return cached;
      }
    }

    // Check for pending identical requests
    if (this.pendingRequests.has(requestKey)) {
      console.log(`⏳ Joining pending request: ${requestKey}`);
      return this.pendingRequests.get(requestKey)!;
    }

    let lastError: Error | null = null;

    const requestPromise = (async () => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const token = localStorage.getItem('token');
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            console.warn(`⏰ Request timeout: ${endpoint}`);
            controller.abort();
          }, timeout);

          const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(!skipAuth && token && { Authorization: `Bearer ${token}` }),
            ...fetchOptions.headers,
          };

          const config: RequestInit = {
            signal: controller.signal,
            headers,
            ...fetchOptions,
          };

          console.log(`🌐 API Request [${attempt}/${retries}]:`, {
            method: fetchOptions.method || 'GET',
            endpoint,
            hasToken: !!token && !skipAuth
          });

          const response = await fetch(`${this.baseURL}${endpoint}`, config);
          clearTimeout(timeoutId);

          console.log(`📨 API Response: ${endpoint} - Status: ${response.status}`);

          // Handle unauthorized access
          if (response.status === 401 && !skipAuth) {
            console.warn('🔐 Unauthorized access - triggering logout');
            this.handleUnauthorized();
            throw new Error('Authentication required');
          }

          // Handle other HTTP errors
          if (!response.ok) {
            const errorData = await this.parseResponse(response);
            const errorMessage = errorData?.message || 
                               errorData?.error || 
                               `HTTP error! status: ${response.status}`;
            
            console.error(`❌ API Error [${response.status}]:`, errorMessage);
            
            // Don't retry on client errors (4xx) except 429 (rate limit)
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              throw new Error(errorMessage);
            }
            
            throw new Error(errorMessage);
          }

          const data = await this.parseResponse<T>(response);
          console.log(`✅ API Success: ${endpoint}`, data);

          // Cache successful GET responses
          if ((fetchOptions.method === 'GET' || !fetchOptions.method) && data.success) {
            this.setCache(cacheKey, data, 300000); // 5 minutes cache
          }

          return data;

        } catch (error: any) {
          lastError = error;
          
          if (attempt === retries) break;

          // Don't retry on certain errors
          if (error.name === 'AbortError' || 
              error.message.includes('401') || 
              error.message.includes('400') ||
              error.message.includes('403') ||
              error.message.includes('404')) {
            break;
          }

          // Wait before retrying (exponential backoff)
          const delayTime = Math.pow(2, attempt) * 100 + Math.random() * 100;
          console.log(`⏳ Retrying in ${delayTime}ms... (Attempt ${attempt + 1}/${retries})`);
          await this.delay(delayTime);
        }
      }

      console.error('💥 API request failed after all retries:', lastError);
      throw lastError || new Error('Request failed');
    })();

    // Store the pending request
    this.pendingRequests.set(requestKey, requestPromise);

    try {
      return await requestPromise;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(requestKey);
    }
  }

  private async parseResponse<T>(response: Response): Promise<ApiResponse<T>> {
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    const text = await response.text();
    throw new Error(`Unexpected response type: ${contentType}. Response: ${text}`);
  }

  private handleUnauthorized(): void {
    // Clear all storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_state');
    sessionStorage.clear();
    
    // Clear cache
    this.clearCache();
    
    // Redirect to login with return url
    const currentPath = window.location.pathname + window.location.search;
    if (currentPath !== '/login') {
      window.location.href = `/login?returnUrl=${encodeURIComponent(currentPath)}`;
    } else {
      window.location.href = '/login';
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cache management
  private getCacheKey(endpoint: string, body?: any): string {
    const key = `api_cache_${endpoint}`;
    return body ? `${key}_${JSON.stringify(body)}` : key;
  }

  private getFromCache<T>(key: string): ApiResponse<T> | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    });
  }

  public clearCache(endpointPattern?: string): void {
    if (endpointPattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(endpointPattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // Basic HTTP methods
  async get<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      ...config,
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { ...config, method: 'DELETE' });
  }

  // ==================== AUTH ENDPOINTS ====================
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
    const response = await this.post<AuthResponse>('/auth/login', credentials, { skipAuth: true });
    
    if (response.success && response.data) {
      // Store token immediately upon successful login
      localStorage.setItem('token', response.data.token);
      this.setCache('current_user', response.data.user, 300000); // Cache user data
    }
    
    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    // Check cache first
    const cached = this.getFromCache<{ user: User }>('current_user');
    if (cached) {
      return cached;
    }

    const response = await this.get<{ user: User }>('/auth/me');
    
    if (response.success && response.data) {
      this.setCache('current_user', response, 300000); // Cache for 5 minutes
    }
    
    return response;
  }

  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    const response = await this.post<{ token: string }>('/auth/refresh', {}, { skipAuth: false });
    
    if (response.success && response.data) {
      localStorage.setItem('token', response.data.token);
      this.clearCache('current_user'); // Clear user cache to force refresh
    }
    
    return response;
  }

  // ==================== DASHBOARD ENDPOINTS ====================
  async getDashboardStats(): Promise<ApiResponse<DashboardStats>> {
    return this.get<DashboardStats>('/dashboard/stats');
  }

  // ==================== USER MANAGEMENT ENDPOINTS ====================
  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.get<User[]>('/users');
  }

  async createUser(userData: {
    name: string;
    email: string;
    role: string;
    department: string;
    position?: string;
    phone?: string;
    password: string;
    managerId?: number | string;
  }): Promise<ApiResponse<User>> {
    // Normalize and clean the data before sending
    const cleanData: any = {
      name: userData.name.trim(),
      email: userData.email.toLowerCase().trim(), // Normalize email
      role: userData.role,
      department: userData.department.trim(),
      password: userData.password
    };

    // Only add optional fields if they exist and are not empty
    if (userData.position?.trim()) cleanData.position = userData.position.trim();
    if (userData.phone?.trim()) cleanData.phone = userData.phone.trim();
    
    // Only add managerId for employees and if provided
    if (userData.role === 'employee' && userData.managerId) {
      cleanData.managerId = typeof userData.managerId === 'string' 
        ? parseInt(userData.managerId) 
        : userData.managerId;
    }

    console.log('📤 Sending user data to backend:', cleanData);
    
    const response = await this.post<User>('/users', cleanData);
    
    // Clear users cache when creating new user
    if (response.success) {
      this.clearCache('/users');
    }
    
    return response;
  }

  async updateUser(userId: number, userData: Partial<User>): Promise<ApiResponse<User>> {
    const response = await this.put<User>(`/users/${userId}`, userData);
    
    // Clear relevant caches
    if (response.success) {
      this.clearCache('/users');
      this.clearCache('current_user');
    }
    
    return response;
  }

  async deleteUser(userId: number): Promise<ApiResponse<void>> {
  const response = await this.delete<void>(`/users/${userId}`);
  
  if (response.success) {
    this.clearCache('/users');
  }
  
  return response;
}

  async getManagersByDepartment(department: string): Promise<ApiResponse<User[]>> {
    return this.get<User[]>(`/managers/department/${department}`);
  }

  async assignManager(userId: number, managerId: number): Promise<ApiResponse<User>> {
    return this.put<User>(`/users/${userId}/manager`, { managerId });
  }

  // ==================== LEAVE ENDPOINTS ====================
  async applyLeave(leaveData: {
    leaveTypeId: number;
    startDate: string;
    endDate: string;
    reason: string;
  }): Promise<ApiResponse<Leave>> {
    const response = await this.post<Leave>('/leaves/apply', leaveData);
    
    if (response.success) {
      // Clear relevant caches
      this.clearCache('/leaves');
      this.clearCache('/dashboard');
    }
    
    return response;
  }

  async getLeaveHistory(limit?: number): Promise<ApiResponse<Leave[]>> {
    const endpoint = limit ? `/leaves/history?limit=${limit}` : '/leaves/history';
    return this.get<Leave[]>(endpoint);
  }

  async getLeaveBalances(): Promise<ApiResponse<LeaveBalance[]>> {
    return this.get<LeaveBalance[]>('/leave-balances');
  }

  async getPendingRequests(): Promise<ApiResponse<Leave[]>> {
    return this.get<Leave[]>('/leaves/pending');
  }

  async approveLeave(leaveId: number, notes?: string): Promise<ApiResponse<Leave>> {
    const response = await this.post<Leave>(`/leaves/${leaveId}/approve`, { notes });
    
    if (response.success) {
      this.clearCache('/leaves');
      this.clearCache('/dashboard');
    }
    
    return response;
  }

  async rejectLeave(leaveId: number, notes?: string): Promise<ApiResponse<Leave>> {
    const response = await this.post<Leave>(`/leaves/${leaveId}/reject`, { notes });
    
    if (response.success) {
      this.clearCache('/leaves');
      this.clearCache('/dashboard');
    }
    
    return response;
  }

  // ==================== HR APPROVAL ENDPOINTS ====================
 async approveHRLeave(leaveId: number, notes?: string): Promise<ApiResponse<Leave>> {
  const response = await this.post<Leave>(`/leaves/${leaveId}/hr-approve`, { notes });
  
  if (response.success) {
    this.clearCache('/leaves');
    this.clearCache('/dashboard');
     this.clearCache('/hr/pending-approvals');
  }
  
  return response;
}
     
   

  async rejectHRLeave(leaveId: number, notes?: string): Promise<ApiResponse<Leave>> {
    const response = await this.post<Leave>(`/leaves/${leaveId}/hr-reject`, { notes });
    
    if (response.success) {
      this.clearCache('/leaves');
      this.clearCache('/dashboard');
      this.clearCache('/hr/pending-approvals');
    }
    
    return response;
  }

  // ==================== PROFILE ENDPOINTS ====================
  async updateProfile(profileData: {
    name?: string;
    phone?: string;
    department?: string;
    position?: string;
  }): Promise<ApiResponse<User>> {
    const response = await this.put<User>('/profile', profileData);
    
    if (response.success && response.data) {
      // Update cached user data
      this.setCache('current_user', { user: response.data }, 300000);
    }
    
    return response;
  }

  async changePassword(passwordData: {
    currentPassword: string;
    newPassword: string;
  }): Promise<ApiResponse<void>> {
    return this.post<void>('/profile/change-password', passwordData);
  }

  // ==================== AVATAR ENDPOINTS ====================
  async uploadAvatar(file: File): Promise<ApiResponse<User>> {
    const formData = new FormData();
    formData.append('avatar', file);
    
    const token = localStorage.getItem('token');
    const response = await fetch(`${this.baseURL}/users/avatar`, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await this.parseResponse(response);
      throw new Error(errorData?.message || `Upload failed! status: ${response.status}`);
    }

    const data = await this.parseResponse<User>(response);
    
    // Update cached user data
    if (data.success && data.data) {
      this.setCache('current_user', { user: data.data }, 300000);
    }
    
    return data;
  }

  async deleteAvatar(): Promise<ApiResponse<User>> {
    const response = await this.delete<User>('/users/avatar');
    
    if (response.success && response.data) {
      this.setCache('current_user', { user: response.data }, 300000);
    }
    
    return response;
  }

  // ==================== MANAGER ENDPOINTS ====================
  async getManagerTeamOverview(): Promise<ApiResponse<TeamMember[]>> {
    return this.get<TeamMember[]>('/manager/team-overview');
  }

  async getApprovalsHistory(): Promise<ApiResponse<Leave[]>> {
    return this.get<Leave[]>('/manager/approvals-history');
  }

  async getManagerReports(): Promise<ApiResponse<ReportData>> {
    return this.get<ReportData>('/manager/reports');
  }

  // ==================== HR ADMIN ENDPOINTS ====================
  async getHRPendingApprovals(): Promise<ApiResponse<Leave[]>> {
    return this.get<Leave[]>('/hr/pending-approvals');
  }

  async getLeaveOverview(): Promise<ApiResponse<Leave[]>> {
    return this.get<Leave[]>('/hr/leave-overview');
  }

async getHrReportsAnalytics(params?: {
  startDate?: string;
  endDate?: string;
}): Promise<ApiResponse<any>> {
  const queryParams = new URLSearchParams();
  if (params?.startDate) queryParams.append('startDate', params.startDate);
  if (params?.endDate) queryParams.append('endDate', params.endDate);
  
  const endpoint = `/hr/reports/analytics${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return this.get<any>(endpoint);
}

async exportHrReport(params: {
  startDate?: string;
  endDate?: string;
  reportType: string;
}): Promise<ApiResponse<any>> {
  const queryParams = new URLSearchParams();
  if (params.startDate) queryParams.append('startDate', params.startDate);
  if (params.endDate) queryParams.append('endDate', params.endDate);
  queryParams.append('reportType', params.reportType);
  
  const endpoint = `/hr/reports/export?${queryParams.toString()}`;
  return this.get<any>(endpoint);
}

// Update the existing getHrReports method to use the new endpoint
async getHrReports(): Promise<ApiResponse<ReportData>> {
  return this.getHrReportsAnalytics();
}
  // ==================== LEAVE TYPES ENDPOINTS ====================
  async getLeaveTypes(): Promise<ApiResponse<LeaveType[]>> {
    return this.get<LeaveType[]>('/leave-types');
  }

  async createLeaveType(leaveTypeData: {
    name: string;
    maxDays: number;
    description?: string;
    color?: string;
    requiresHRApproval?: boolean;
    carryOver?: boolean;
    requiresApproval?: boolean;
  }): Promise<ApiResponse<LeaveType>> {
    // Ensure all required fields are present
    const data = {
      name: leaveTypeData.name.trim(),
      maxDays: leaveTypeData.maxDays,
      description: leaveTypeData.description?.trim() || '',
      color: leaveTypeData.color || '#667eea',
      requiresHRApproval: leaveTypeData.requiresHRApproval || false,
      carryOver: leaveTypeData.carryOver || false,
      requiresApproval: leaveTypeData.requiresApproval !== false // Default to true
    };

    console.log('📤 Creating leave type with data:', data);
    return this.post<LeaveType>('/leave-types', data);
  }

  async updateLeaveType(leaveTypeId: number, leaveTypeData: {
    name?: string;
    maxDays?: number;
    description?: string;
    color?: string;
    requiresHRApproval?: boolean;
    carryOver?: boolean;
    requiresApproval?: boolean;
    isActive?: boolean;
  }): Promise<ApiResponse<LeaveType>> {
    // Clean and validate the data
    const cleanData: any = {};
    
    if (leaveTypeData.name !== undefined) cleanData.name = leaveTypeData.name.trim();
    if (leaveTypeData.maxDays !== undefined) cleanData.maxDays = leaveTypeData.maxDays;
    if (leaveTypeData.description !== undefined) cleanData.description = leaveTypeData.description.trim();
    if (leaveTypeData.color !== undefined) cleanData.color = leaveTypeData.color;
    if (leaveTypeData.requiresHRApproval !== undefined) cleanData.requiresHRApproval = leaveTypeData.requiresHRApproval;
    if (leaveTypeData.carryOver !== undefined) cleanData.carryOver = leaveTypeData.carryOver;
    if (leaveTypeData.requiresApproval !== undefined) cleanData.requiresApproval = leaveTypeData.requiresApproval;
    if (leaveTypeData.isActive !== undefined) cleanData.isActive = leaveTypeData.isActive;

    console.log('📤 Updating leave type with data:', cleanData);
    const response = await this.put<LeaveType>(`/leave-types/${leaveTypeId}`, cleanData);
    
    if (response.success) {
      this.clearCache('/leave-types');
    }
    
    return response;
  }

  async toggleLeaveTypeStatus(leaveTypeId: number, isActive: boolean): Promise<ApiResponse<LeaveType>> {
    // For status toggle, we only need to send the isActive field
    const response = await this.patch<LeaveType>(`/leave-types/${leaveTypeId}/status`, { isActive });
    
    if (response.success) {
      this.clearCache('/leave-types');
    }
    
    return response;
  }

  async deleteLeaveType(leaveTypeId: number): Promise<ApiResponse<void>> {
    const response = await this.delete<void>(`/leave-types/${leaveTypeId}`);
    
    if (response.success) {
      this.clearCache('/leave-types');
    }
    
    return response;
  }

  // ==================== SYSTEM ENDPOINTS ====================
  async getSystemSettings(): Promise<ApiResponse<SystemSetting[]>> {
    return this.get<SystemSetting[]>('/system/settings');
  }

  
// In your ApiService class
async updateSystemSetting(key: string, value: string): Promise<ApiResponse<SystemSetting>> {
  const response = await this.put<SystemSetting>(`/system/settings/${key}`, { value });
  
  if (response.success) {
    this.clearCache('/system/settings');
  }
  
  return response;
}


  // ==================== NOTIFICATION ENDPOINTS ====================
  async getNotifications(): Promise<ApiResponse<Notification[]>> {
    return this.get<Notification[]>('/notifications');
  }

  async markNotificationAsRead(notificationId: number): Promise<ApiResponse<Notification>> {
    return this.patch<Notification>(`/notifications/${notificationId}/read`);
  }

  // ==================== DEBUG ENDPOINTS ====================
  async debugUserRelationships(): Promise<ApiResponse<any>> {
    return this.get('/debug/user-relationships');
  }

  async debugUser(userId: number): Promise<ApiResponse<any>> {
    return this.get(`/debug/user/${userId}`);
  }

  
  // Enhanced auth state management
  isAuthenticated(): boolean {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
      // Check token expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp < Date.now() / 1000;
      
      if (isExpired) {
        this.handleUnauthorized();
        return false;
      }
      
      return true;
    } catch {
      // If we can't parse the token, assume it's invalid
      this.handleUnauthorized();
      return false;
    }
  }

  getStoredUser(): User | null {
    try {
      const cached = this.getFromCache<{ user: User }>('current_user');
      if (cached?.data?.user) {
        return cached.data.user;
      }

      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  }

  logout(redirect: boolean = true): void {
    // Clear all storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_state');
    sessionStorage.clear();
    
    // Clear all caches
    this.clearCache();
    this.pendingRequests.clear();
    
    if (redirect) {
      window.location.href = '/login';
    }
  }

  // Role checking utilities
  hasRole(requiredRole: string): boolean {
    const user = this.getStoredUser();
    return user?.role === requiredRole;
  }

  hasAnyRole(requiredRoles: string[]): boolean {
    const user = this.getStoredUser();
    return user ? requiredRoles.includes(user.role) : false;
  }

  // Request interceptor for adding auth headers
  getAuthHeaders(): HeadersInit {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }
}

// Create singleton instance
export const apiService = new ApiService();

// Export types for use in components
export type { 
  User, 
  Leave, 
  LeaveType, 
  LeaveBalance, 
  DashboardStats, 
  SystemSetting,
  Notification,
  TeamMember,
  ReportData
};