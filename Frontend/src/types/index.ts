// User and Auth Types
export interface User {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  department: string;
  position: string;
  phone?: string;
  joinDate?: string;
  status: 'active' | 'inactive';
  avatar?: string;
  managerId?: number;
}

export type UserRole = 'employee' | 'manager' | 'hr-admin';

export interface ApprovalsHistoryProps {
  filters?: LeaveFilter;
  onFilterChange?: (filters: LeaveFilter) => void;
}

export interface TeamOverviewProps {
  departmentId?: number;
}

export interface ReportsProps {
  exportEnabled?: boolean;
  onExport?: (options: ExportOptions) => void;
}

export interface SystemConfigProps {
  onSettingsUpdate?: (settings: SystemSettings) => void;
}
// Leave Types
export interface LeaveApplication {
  id: number;
  employeeId: number;
  employeeName: string;
  employeeDepartment: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedDate: string;
  approvedBy?: string;
  approvedDate?: string;
  comments?: string;
  attachment?: string;
}

// Enhanced Leave type with workflow information
export interface Leave {
  id: number;
  employeeId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  currentApprover: 'MANAGER' | 'HR' | 'SYSTEM';
  appliedDate: string;
  managerApproved?: boolean;
  managerApprovedBy?: number;
  managerApprovedDate?: string;
  managerNotes?: string;
  hrApproved?: boolean;
  hrApprovedBy?: number;
  hrApprovedDate?: string;
  hrNotes?: string;
  employee?: User;
  leaveType?: LeaveType;
  manager?: User;
  hrAdmin?: User;
}

export type LeaveStatus = 
  | 'PENDING_MANAGER' 
  | 'PENDING_HR' 
  | 'APPROVED' 
  | 'HR_APPROVED' 
  | 'REJECTED';

export interface LeaveAction {
  type: 'approve' | 'reject';
  role: 'manager' | 'hr';
  notes?: string;
}
export interface LeaveType {
  id: number;
  name: string;
  maxDays: number;
  description?: string;
  isActive: boolean;
}

// Form Types
export interface LeaveFormData {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface UserFormData {
  name: string;
  email: string;
  role: UserRole;
  department: string;
}

// Navigation Types
export interface MenuItem {
  path: string;
  label: string;
  icon: string;
   badge?: string;
}
interface PendingLeave {
  id: number;
  employee: {
    name: string;
    email: string;
    department: string;
    position: string;
  };
  leaveType: {
    name: string;
    color: string;
  };
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  appliedDate: string;
}


// Props Types
export interface LayoutProps {
  children: React.ReactNode;
  userRole: UserRole;
}
export interface SidebarProps {
   userRole: UserRole;
  isMobileOpen?: boolean;
  onClose?: () => void;
}
export interface DashboardProps {
  userRole: UserRole;
}
// Add these to your existing types
export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthContextType {
  user: User | null;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

export interface LoginResponse {
  success: boolean;
  user?: User;
  message?: string;
}
// Add these to your existing types

// User Profile types
export interface UserProfile {
  id: number;
  name: string;
  email: string;
  employeeId: string;
  department: string;
  position: string;
  phone: string;
  joinDate: string;
  avatar?: string;
}

export interface ProfileFormData {
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
// Enhanced Leave type with workflow information
export interface Leave {
  id: number;
  employeeId: number;
  leaveTypeId: number;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  currentApprover: 'MANAGER' | 'HR' | 'SYSTEM';
  appliedDate: string;
  managerApproved?: boolean;
  managerApprovedBy?: number;
  managerApprovedDate?: string;
  managerNotes?: string;
  hrApproved?: boolean;
  hrApprovedBy?: number;
  hrApprovedDate?: string;
  hrNotes?: string;
  employee?: User;
  leaveType?: LeaveType;
  manager?: User;
  hrAdmin?: User;
}


export interface LeaveAction {
  type: 'approve' | 'reject';
  role: 'manager' | 'hr';
  notes?: string;
}



export interface User {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  position?: string;
  phone?: string;
  status: string;
  avatar?: string;
  joinDate?: string;
  createdAt?: string;
  manager?: {
    name: string;
    email: string;
  };
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  position?: string;
  phone?: string;
  status: string;
  avatar?: string;
  joinDate?: string;
  managerId?: number;
  manager?: {
    name: string;
    email: string;
  };
}

export interface LeaveBalance {
  type: string;
  total: number;
  used: number;
  remaining: number;
}

// Manager Dashboard & Team Types
export interface TeamMember {
  id: number;
  name: string;
  position: string;
  department: string;
  leavesTaken: number;
  remainingLeaves: number;
  onLeave: boolean;
  avatar?: string;
}

export interface ApprovalHistoryItem {
  id: number;
  employee: string;
  employeeId: number;
  type: string;
  dates: string;
  status: LeaveStatus;
  decisionDate: string;
  reason?: string;
}

export interface UpcomingLeave {
  id: number;
  employee: string;
  employeeId: number;
  type: string;
  dates: string;
  status: LeaveStatus;
}

// Reports & Analytics Types
export interface LeaveUsageReport {
  period: string;
  totalLeaves: number;
  approvals: number;
  rejections: number;
  approvalRate: number;
}

export interface DepartmentUsage {
  department: string;
  totalLeaves: number;
  averageDuration: number;
  approvalRate: number;
}

export interface LeaveTypeAnalysis {
  type: string;
  usage: number;
  remaining: number;
  trend: 'increasing' | 'decreasing' | 'stable';
}

export interface TeamPerformance {
  employee: string;
  leavesTaken: number;
  onTimeCompletion: number;
  productivityScore: number;
}

// System Configuration Types
export interface SystemSettings {
  maxConsecutiveLeaves: number;
  advanceNoticeDays: number;
  autoApproveEnabled: boolean;
  autoApproveThreshold: number;
  notificationEmails: boolean;
  carryOverEnabled: boolean;
  carryOverLimit: number;
  fiscalYearStart: string;
  workingDays: string[]; // ['monday', 'tuesday', ...]
}

// HR Admin Types
export interface Department {
  id: number;
  name: string;
  managerId: number;
  managerName: string;
  employeeCount: number;
}

export interface LeaveOverviewStats {
  totalEmployees: number;
  onLeaveToday: number;
  pendingRequests: number;
  approvalRate: number;
  monthlyLeaves: number;
}

// Dashboard Stats Types
export interface DashboardStats {
  pendingRequests?: number;
  availableLeaves?: number;
  leavesTaken?: number;
  teamOnLeave?: number;
  approvalRate?: number;
  recentActivity?: LeaveApplication[];
}

// Filter Types
export interface DateRangeFilter {
  startDate: string;
  endDate: string;
}

export interface LeaveFilter {
  status?: LeaveStatus;
  type?: string;
  department?: string;
  dateRange?: DateRangeFilter;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Notification Types
export interface Notification {
  id: number;
  type: 'leave_application' | 'approval' | 'rejection' | 'system';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  link?: string;
}

// Calendar Types
export interface CalendarEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  type: string;
  status: LeaveStatus;
  employeeName: string;
  department: string;
}

// Chart Data Types
export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor: string[];
    borderColor: string[];
    borderWidth: number;
  }[];
}

// Export Types
export interface ExportOptions {
  format: 'excel' | 'pdf' | 'csv';
  dateRange: DateRangeFilter;
  includeFields: string[];
  department?: string;
}
// Add these specific report types
export interface DepartmentUsageReport {
  department: string;
  totalLeaves: number;
  averageDuration: number;
  approvalRate: number;
}

export interface LeaveTypeAnalysisReport {
  type: string;
  usage: number;
  remaining: number;
  trend?: 'high' | 'low' | 'medium';
}

export interface TeamPerformanceReport {
  employee: string;
  leavesTaken: number;
  onTimeCompletion: number;
}

// Update the report data structure
export interface ReportData {
  'department-usage': DepartmentUsageReport[];
  'leave-types': LeaveTypeAnalysisReport[];
  'team-performance': TeamPerformanceReport[];
  'employee-trends': any[];
  'compliance': 
}