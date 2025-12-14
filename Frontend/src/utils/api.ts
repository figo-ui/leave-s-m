// utils/api.ts
import { 
  User, 
  Leave, 
  LeaveType, 
  LeaveBalance, 
  DashboardStats, 
  SystemSetting, 
  Notification, 
  TeamMember, 
  ReportData 
} from '../types';

// Environment detection
const getEnvironment = (): 'development' | 'production' | 'test' => {
  const hostname = window.location.hostname;
  
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'development';
  } else if (hostname.includes('test.') || hostname.includes('staging.')) {
    return 'test';
  } else {
    return 'production';
  }
};

const isDevelopment = getEnvironment() === 'development';
const isProduction = getEnvironment() === 'production';

// Auto-configure base URL
const getBaseURL = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  const protocol = window.location.protocol;
  const hostname = window.location.hostname;
  
  if (isDevelopment) {
    return 'http://localhost:5000/api';
  }
  
  // In production, use same hostname with /api path
  return `${protocol}//${hostname}/api`;
};

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
  rememberMe?: boolean;
}

export interface AuthResponse {
  token: string;
  refreshToken?: string;
  user: User;
  expiresIn: number;
}

export interface RequestConfig extends RequestInit {
  timeout?: number;
  retries?: number;
  skipAuth?: boolean;
  skipCache?: boolean;
  cacheTtl?: number;
}

// Cache interface with LRU support
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
  hits: number;
}

// Queue item interface
interface QueueItem {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  controller: AbortController;
}

// Performance metrics
interface RequestMetrics {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  timestamp: number;
  success: boolean;
}

class ApiService {
  private baseURL: string;
  private cache: Map<string, CacheEntry>;
  private pendingRequests: Map<string, Promise<any>>;
  private requestQueue: Map<string, QueueItem[]>;
  private metrics: RequestMetrics[];
  private maxCacheSize: number;
  private offlineQueue: Array<() => Promise<void>>;
  private isOnline: boolean;
  private refreshPromise: Promise<string | null> | null;
  private appVersion: string;

  constructor() {
    this.baseURL = getBaseURL();
    this.cache = new Map();
    this.pendingRequests = new Map();
    this.requestQueue = new Map();
    this.metrics = [];
    this.maxCacheSize = 100; // Maximum cache entries
    this.offlineQueue = [];
    this.isOnline = navigator.onLine;
    this.refreshPromise = null;
    this.appVersion = import.meta.env.VITE_APP_VERSION || '1.0.0';
    
    this.setupEventListeners();
    this.setupInterceptors();
    this.startMetricsCollection();
  }

  private setupEventListeners(): void {
    // Online/offline detection
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processOfflineQueue();
      console.log('🌐 Online - processing queued requests');
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.warn('⚠️ Offline - requests will be queued');
    });

    // Visibility change (tab focus)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        // Refresh stale cache when tab becomes visible
        this.refreshStaleCache();
      }
    });
  }

  private setupInterceptors(): void {
    // Can be extended for request/response transformations
  }

  // Enhanced request method with comprehensive features
  private async request<T>(
    endpoint: string,
    options: RequestConfig = {}
  ): Promise<ApiResponse<T>> {
    const {
      timeout = isProduction ? 30000 : 15000, // Longer timeout in production
      retries = isProduction ? 3 : 2,
      skipAuth = false,
      skipCache = false,
      cacheTtl = 300000, // 5 minutes default
      ...fetchOptions
    } = options;

    const method = fetchOptions.method || 'GET';
    const cacheKey = this.getCacheKey(method, endpoint, fetchOptions.body);
    const requestKey = `${method}:${endpoint}`;

    // Check cache first (only for GET requests)
    if (method === 'GET' && !skipCache) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached) {
        if (isDevelopment) {
          console.log(`📦 Cache hit: ${endpoint}`);
        }
        return cached;
      }
    }

    // Check for pending identical requests
    if (this.pendingRequests.has(requestKey)) {
      if (isDevelopment) {
        console.log(`⏳ Joining pending request: ${requestKey}`);
      }
      return this.pendingRequests.get(requestKey)!;
    }

    // Handle offline mode
    if (!this.isOnline && method !== 'GET') {
      if (isDevelopment) {
        console.log(`📴 Offline - queuing request: ${requestKey}`);
      }
      return this.queueOfflineRequest<T>(endpoint, options);
    }

    const startTime = performance.now();
    let lastError: Error | null = null;
    let responseStatus = 0;

    const requestPromise = (async () => {
      for (let attempt = 1; attempt <= retries; attempt++) {
        try {
          const token = this.getToken();
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => {
            if (isDevelopment) {
              console.warn(`⏰ Request timeout: ${endpoint}`);
            }
            controller.abort();
          }, timeout);

          // Enhanced headers
          const headers: HeadersInit = {
            'Content-Type': 'application/json',
            'X-Application-Version': this.appVersion,
            'X-Client-ID': this.getClientId(),
            'X-Request-ID': this.generateRequestId(),
            ...(!skipAuth && token && { Authorization: `Bearer ${token}` }),
            ...(fetchOptions.headers as Record<string, string>),
          };

          const config: RequestInit = {
            signal: controller.signal,
            headers,
            ...fetchOptions,
          };

          if (isDevelopment) {
            console.log(`🌐 API Request [${attempt}/${retries}]:`, {
              method,
              endpoint,
              hasToken: !!token && !skipAuth,
              baseURL: this.baseURL
            });
          }

          const response = await fetch(`${this.baseURL}${endpoint}`, config);
          clearTimeout(timeoutId);
          
          responseStatus = response.status;
          const responseTime = performance.now() - startTime;

          if (isDevelopment) {
            console.log(`📨 API Response: ${endpoint} - Status: ${response.status} (${responseTime.toFixed(0)}ms)`);
          }

          // Handle specific status codes
          switch (response.status) {
            case 401:
              if (!skipAuth) {
                await this.handleUnauthorized(response);
              }
              throw new Error('Authentication required');
              
            case 403:
              throw new Error('Access forbidden');
              
            case 404:
              throw new Error('Resource not found');
              
            case 429:
              const retryAfter = response.headers.get('Retry-After');
              const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
              await this.delay(waitTime);
              throw new Error('Rate limited');
              
            case 503:
              throw new Error('Service temporarily unavailable');
          }

          // Handle other HTTP errors
          if (!response.ok) {
            const errorData = await this.parseResponse(response);
            const errorMessage = errorData?.message || 
                               errorData?.error || 
                               `HTTP error! status: ${response.status}`;
            
            if (isDevelopment) {
              console.error(`❌ API Error [${response.status}]:`, errorMessage);
            }
            
            // Don't retry on client errors (4xx) except 429 (rate limit)
            if (response.status >= 400 && response.status < 500 && response.status !== 429) {
              throw new Error(errorMessage);
            }
            
            throw new Error(errorMessage);
          }

          const data = await this.parseResponse<T>(response);
          const totalTime = performance.now() - startTime;

          if (isDevelopment) {
            console.log(`✅ API Success: ${endpoint} (${totalTime.toFixed(0)}ms)`, data);
          }

          // Cache successful GET responses
          if (method === 'GET' && data.success && !skipCache) {
            this.setCache(cacheKey, data, cacheTtl);
          }

          // Collect metrics
          this.collectMetrics({
            endpoint,
            method,
            duration: totalTime,
            status: response.status,
            timestamp: Date.now(),
            success: true
          });

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

          // Wait before retrying (exponential backoff with jitter)
          const baseDelay = Math.pow(2, attempt) * 100;
          const jitter = Math.random() * 100;
          const delayTime = baseDelay + jitter;
          
          if (isDevelopment) {
            console.log(`⏳ Retrying in ${delayTime.toFixed(0)}ms... (Attempt ${attempt + 1}/${retries})`);
          }
          
          await this.delay(delayTime);
        }
      }

      // Collect failure metrics
      this.collectMetrics({
        endpoint,
        method,
        duration: performance.now() - startTime,
        status: responseStatus,
        timestamp: Date.now(),
        success: false
      });

      const errorMessage = lastError?.message || 'Request failed';
      console.error('💥 API request failed after all retries:', errorMessage);
      
      // Check if it's a network error
      if (!this.isOnline) {
        throw new Error('Network unavailable. Please check your connection.');
      }
      
      throw new Error(errorMessage);
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
    try {
      const contentType = response.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        return await response.json();
      }
      
      if (contentType.includes('text/')) {
        const text = await response.text();
        return {
          success: response.ok,
          message: text,
          timestamp: new Date().toISOString()
        };
      }
      
      // For other content types (like file downloads)
      return {
        success: response.ok,
        data: response as any,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to parse response:', error);
      throw new Error('Failed to parse response');
    }
  }

  private async handleUnauthorized(response: Response): Promise<void> {
    // Try to refresh token first
    try {
      const newToken = await this.refreshToken();
      if (newToken) {
        return; // Token refreshed, continue with request
      }
    } catch {
      // Refresh failed, proceed with logout
    }
    
    // Clear all storage
    this.clearAuthData();
    
    // Redirect to login with return url
    const currentPath = window.location.pathname + window.location.search;
    const loginUrl = `/login?returnUrl=${encodeURIComponent(currentPath)}&reason=session_expired`;
    
    // Use window.location.replace to prevent back navigation
    setTimeout(() => {
      window.location.replace(loginUrl);
    }, 100);
  }

  private clearAuthData(): void {
    // Clear all storage
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('auth_state');
    sessionStorage.clear();
    
    // Clear cache
    this.clearCache();
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Enhanced cache management with LRU eviction
  private getCacheKey(method: string, endpoint: string, body?: any): string {
    const key = `${method}_${endpoint}`;
    if (body) {
      // Create a stable string representation of the body
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
      return `${key}_${this.hashString(bodyStr)}`;
    }
    return key;
  }

  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }

  private getFromCache<T>(key: string): ApiResponse<T> | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    cached.hits++;
    this.cache.set(key, cached);

    return cached.data;
  }

  private setCache(key: string, data: any, ttl: number): void {
    // LRU eviction if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].hits - b[1].hits); // Sort by hits
      
      // Remove 10% of least used entries
      const toRemove = Math.max(1, Math.floor(this.maxCacheSize * 0.1));
      for (let i = 0; i < toRemove; i++) {
        this.cache.delete(entries[i][0]);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl,
      hits: 1
    });
  }

  public clearCache(pattern?: string): void {
    if (pattern) {
      for (const [key] of this.cache.entries()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  private refreshStaleCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt - 60000) { // Refresh if expires in less than 1 minute
        this.cache.delete(key);
      }
    }
  }

  // Offline queue management
  private async queueOfflineRequest<T>(endpoint: string, options: RequestConfig): Promise<ApiResponse<T>> {
    return new Promise((resolve, reject) => {
      this.offlineQueue.push(async () => {
        try {
          const result = await this.request<T>(endpoint, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      
      // Store queue in localStorage for persistence
      this.saveOfflineQueue();
    });
  }

  private async processOfflineQueue(): Promise<void> {
    while (this.offlineQueue.length > 0) {
      const request = this.offlineQueue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          console.error('Failed to process queued request:', error);
        }
      }
    }
    this.saveOfflineQueue();
  }

  private saveOfflineQueue(): void {
    try {
      localStorage.setItem('offline_queue', JSON.stringify(this.offlineQueue.length));
    } catch {
      // Ignore storage errors
    }
  }

  // Token management
  private getToken(): string | null {
    // Check localStorage first (remember me), then sessionStorage
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  private setToken(token: string, rememberMe = false): void {
    if (rememberMe) {
      localStorage.setItem('token', token);
    } else {
      sessionStorage.setItem('token', token);
      // Also set in localStorage for current session
      localStorage.setItem('token', token);
    }
  }

  private getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  private setRefreshToken(token: string): void {
    localStorage.setItem('refresh_token', token);
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientId(): string {
    let clientId = localStorage.getItem('client_id');
    if (!clientId) {
      clientId = 'client_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('client_id', clientId);
    }
    return clientId;
  }

  // Metrics collection
  private collectMetrics(metric: RequestMetrics): void {
    this.metrics.push(metric);
    
    // Keep only last 1000 metrics
    if (this.metrics.length > 1000) {
      this.metrics.shift();
    }
  }

  private startMetricsCollection(): void {
    // Periodically send metrics to analytics (optional)
    setInterval(() => {
      if (this.metrics.length > 0 && isProduction) {
        // this.sendMetricsToAnalytics(); // Implement if needed
      }
    }, 60000); // Every minute
  }

  public getMetrics(): RequestMetrics[] {
    return [...this.metrics];
  }

  public getPerformanceStats(): {
    avgResponseTime: number;
    successRate: number;
    totalRequests: number;
    errorCount: number;
  } {
    const successful = this.metrics.filter(m => m.success);
    const failed = this.metrics.filter(m => !m.success);
    
    const avgResponseTime = successful.length > 0
      ? successful.reduce((sum, m) => sum + m.duration, 0) / successful.length
      : 0;
    
    return {
      avgResponseTime,
      successRate: this.metrics.length > 0 
        ? (successful.length / this.metrics.length) * 100 
        : 0,
      totalRequests: this.metrics.length,
      errorCount: failed.length
    };
  }

  // Basic HTTP methods with improved error handling
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

  // File upload with progress tracking
  async uploadFile<T>(
    endpoint: string, 
    file: File, 
    onProgress?: (percentage: number) => void,
    fieldName: string = 'file'
  ): Promise<ApiResponse<T>> {
    const formData = new FormData();
    formData.append(fieldName, file);

    const token = this.getToken();
    const xhr = new XMLHttpRequest();

    return new Promise((resolve, reject) => {
      xhr.open('POST', `${this.baseURL}${endpoint}`);
      
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      // Track upload progress
      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percentage = (event.loaded / event.total) * 100;
            onProgress(percentage);
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } catch {
            resolve({
              success: true,
              data: xhr.responseText as any,
              timestamp: new Date().toISOString()
            });
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText);
            reject(new Error(error.message || 'Upload failed'));
          } catch {
            reject(new Error(`Upload failed with status: ${xhr.status}`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Network error during upload'));
      };

      xhr.send(formData);
    });
  }

  // ==================== AUTH ENDPOINTS ====================
  async login(credentials: LoginCredentials): Promise<ApiResponse<AuthResponse>> {
    const response = await this.post<AuthResponse>('/auth/login', credentials, { 
      skipAuth: true,
      retries: 1 // Don't retry login requests
    });
    
    if (response.success && response.data) {
      // Store tokens
      this.setToken(response.data.token, credentials.rememberMe);
      
      if (response.data.refreshToken) {
        this.setRefreshToken(response.data.refreshToken);
      }
      
      // Cache user data
      this.setCache('current_user', { user: response.data.user }, 300000);
      
      // Clear sensitive caches
      this.clearCache('/users');
    }
    
    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: User }>> {
    // Check cache first with shorter TTL for user data
    const cached = this.getFromCache<{ user: User }>('current_user');
    if (cached && (Date.now() - cached.timestamp) < 60000) { // 1 minute
      return cached;
    }

    const response = await this.get<{ user: User }>('/auth/me');
    
    if (response.success && response.data) {
      this.setCache('current_user', response, 300000);
    }
    
    return response;
  }

  async refreshToken(): Promise<string | null> {
    // Prevent multiple concurrent refresh attempts
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    this.refreshPromise = (async () => {
      try {
        const response = await this.post<{ token: string }>('/auth/refresh', {
          refreshToken,
        }, { skipAuth: true });

        if (response.success && response.data) {
          this.setToken(response.data.token, true);
          return response.data.token;
        }
        return null;
      } catch (error) {
        this.clearAuthData();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
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
      email: userData.email.toLowerCase().trim(),
      role: userData.role,
      department: userData.department.trim(),
      password: userData.password
    };

    // Only add optional fields if they exist and are not empty
    if (userData.position?.trim()) cleanData.position = userData.position.trim();
    if (userData.phone?.trim()) cleanData.phone = userData.phone.trim();
    
    // Validate managerId for employees
    if (userData.role === 'employee' && userData.managerId) {
      cleanData.managerId = typeof userData.managerId === 'string' 
        ? parseInt(userData.managerId) 
        : userData.managerId;
    }

    if (isDevelopment) {
      console.log('📤 Creating user:', cleanData);
    }
    
    const response = await this.post<User>('/users', cleanData);
    
    if (response.success) {
      this.clearCache('/users');
      this.clearCache('/manager'); // Clear manager-related caches
    }
    
    return response;
  }

  async updateUser(userId: number, userData: Partial<User>): Promise<ApiResponse<User>> {
    const response = await this.put<User>(`/users/${userId}`, userData);
    
    if (response.success) {
      this.clearCache('/users');
      this.clearCache('current_user');
      
      // If updating current user, refresh cache
      const currentUser = this.getStoredUser();
      if (currentUser?.id === userId) {
        this.clearCache('current_user');
      }
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
    const cacheKey = `managers_${department}`;
    const cached = this.getFromCache<User[]>(cacheKey);
    if (cached) return cached;

    const response = await this.get<User[]>(`/managers/department/${department}`);
    
    if (response.success) {
      this.setCache(cacheKey, response, 900000); // 15 minutes cache
    }
    
    return response;
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
      // Clear all leave-related caches
      this.clearCache('/leaves');
      this.clearCache('/dashboard');
      this.clearCache('/leave-balances');
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
      this.clearCache('/pending');
    }
    
    return response;
  }

  async rejectLeave(leaveId: number, notes?: string): Promise<ApiResponse<Leave>> {
    const response = await this.post<Leave>(`/leaves/${leaveId}/reject`, { notes });
    
    if (response.success) {
      this.clearCache('/leaves');
      this.clearCache('/dashboard');
      this.clearCache('/pending');
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
    return this.uploadFile<User>('/users/avatar', file);
  }

  async deleteAvatar(): Promise<ApiResponse<User>> {
    const response = await this.delete<User>('/users/avatar');
    
    if (response.success && response.data) {
      this.setCache('current_user', { user: response.data }, 300000);
    }
    
    return response;
  }

  // ==================== OTHER ENDPOINTS (keeping your existing methods) ====================
  async getManagerTeamOverview(): Promise<ApiResponse<TeamMember[]>> {
    return this.get<TeamMember[]>('/manager/team-overview');
  }

  async getApprovalsHistory(): Promise<ApiResponse<Leave[]>> {
    return this.get<Leave[]>('/manager/approvals-history');
  }

  async getManagerReports(): Promise<ApiResponse<ReportData>> {
    return this.get<ReportData>('/manager/reports');
  }

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
    const data = {
      name: leaveTypeData.name.trim(),
      maxDays: leaveTypeData.maxDays,
      description: leaveTypeData.description?.trim() || '',
      color: leaveTypeData.color || '#667eea',
      requiresHRApproval: leaveTypeData.requiresHRApproval || false,
      carryOver: leaveTypeData.carryOver || false,
      requiresApproval: leaveTypeData.requiresApproval !== false
    };

    const response = await this.post<LeaveType>('/leave-types', data);
    
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
    const token = this.getToken();
    if (!token) return false;

    try {
      // Check token expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp < Date.now() / 1000;
      
      if (isExpired) {
        // Try to refresh token
        this.refreshToken().catch(() => {
          this.clearAuthData();
        });
        return false;
      }
      
      return true;
    } catch {
      this.clearAuthData();
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
    this.clearAuthData();
    
    // Clear all caches
    this.clearCache();
    this.pendingRequests.clear();
    
    if (redirect) {
      // Use replace to prevent back navigation
      window.location.replace('/login?reason=logout');
    }
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseURL.replace('/api', '')}/health`, {
        method: 'GET',
        timeout: 5000
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  // Connectivity check
  async checkConnectivity(): Promise<{
    online: boolean;
    apiReachable: boolean;
    latency: number;
  }> {
    const start = performance.now();
    
    try {
      const response = await fetch(`${this.baseURL}/auth/me`, {
        method: 'HEAD',
        cache: 'no-cache'
      });
      
      const latency = performance.now() - start;
      
      return {
        online: true,
        apiReachable: response.ok,
        latency
      };
    } catch {
      return {
        online: false,
        apiReachable: false,
        latency: -1
      };
    }
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