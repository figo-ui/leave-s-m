export type NotificationCategory =
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'alert'
  | 'urgent';

  
export type UserStatus = 'active' | 'inactive';
export type LanguageCode = 'en' | 'am' | 'om';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  status?: UserStatus;
  language?: LanguageCode;
  department?: string;
  position?: string;
  phone?: string;
  avatar?: string;
  joinDate?: string;
  managerId?: number;
  manager?: {
    id?: number;
    name: string;
    email: string;
  };

  leaveBalances?: LeaveBalance[];
}

export type UserRole = 'employee' | 'manager' | 'hr-admin' | 'super-admin';

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
export type LeaveStatus =
  | 'PENDING'
  | 'PENDING_MANAGER'
  | 'PENDING_HR'
  | 'APPROVED'
  | 'HR_APPROVED'
  | 'HR_REJECTED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'pending'
  | 'pending_manager'
  | 'pending_hr'
  | 'approved'
  | 'hr_approved'
  | 'hr_rejected'
  | 'rejected'
  | 'cancelled'
  | 'hr_pending';


export interface LeaveApplication {
  id: number;
  employeeId?: string;
  employeeName?: string;
  employeeDepartment: string;
  employee?: User;
  department?: string;
  leaveType?: LeaveType | string;
  leaveTypeId?: number;
  startDate: string;
  endDate: string;
  days: number;
  appliedDate:string;
  reason?: string;
  status: LeaveStatus;
  managerNotes?: string;
  hrNotes?: string;
  managerApprovedDate?: string;
  hrApprovedDate?: string;
  createdAt?: string;
  updatedAt?: string;
  currentApprover: 'manager' | 'hr' | 'MANAGER' | 'HR' | 'SYSTEM';
}


/* Common alias used across UI */


export interface LeaveType {
  id: number;
  name?: string;
  description?: string;
  color: string;
  maxDays: number;
  carryOver: boolean;

  requiresApproval: boolean;
  requiresHRApproval?: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Form Types
export interface LeaveFormData {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason: string;
  leaveTypeId:string;
}

export interface UserFormData {
  name: string;
  email: string;
  role: UserRole;
  department: string;
  phone:string;
  managerId: string;
  position: string;
  password: string;
  language?: LanguageCode;
}

// Navigation Types
export interface MenuItem {
  path: string;
  label: string;
  icon: string;
   badge?: string;
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
  department?: string;
  position?: string;
  phone?: string;
  joinDate?: string;
  avatar?: string;
  language?: LanguageCode;
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
  title: string;
  date: string;
  employeeId: number;
  leaveTypeId: number;
  department?: string;
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
  leaveType?: LeaveType | string;
  manager?: User;
  hrAdmin?: User;
      leaves?: Leave[];
}


export interface LeaveAction {
  type: 'approve' | 'reject';
  role: 'manager' | 'hr';
  notes?: string;
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
  leaveTypeId: number;
  userId?: number;
  totalDays?: number;
  remainingDays?: number;
   leaveType?: {
    id: number
    name: string
    color: string
  }
}

// Manager Dashboard & Team Types
export interface TeamMember {
  id: number;
  name: string;
  position: string;
  department: string;
  leavesTaken: number;
   leaves?: Leave[];
  todayOnLeave:number;
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

export interface HRReportData {
  summary: {
    totalEmployees: number;
    totalLeaves: number;
    approvedLeaves: number;
    pendingLeaves: number;
    rejectedLeaves: number;
    averageLeaveDuration: number;
    totalLeaveDays: number;
    onLeaveToday: number;
    pendingApprovals: number;
  };
  departmentStats: Array<{
    department: string;
    employeeCount: number;
    totalLeaves: number;
    approvedLeaves: number;
    rejectedLeaves: number;
    averageDuration: number;
    approvalRate: number;
  }>;
  leaveTypeStats: Array<{
    leaveType: string;
    totalRequests: number;
    approvedRequests: number;
    rejectedRequests: number;
    averageDuration: number;
    utilizationRate: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    leavesTaken: number;
    approvalRate: number;
    averageDuration: number;
  }>;
  employeeInsights: Array<{
    employeeName: string;
    department: string;
    leavesTaken: number;
    totalDays: number;
    approvalRate: number;
  }>;
  complianceData: {
    policyViolations: number;
    lateApplications: number;
    overlappingLeaves: number;
    highFrequencyEmployees: number;
  };
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
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

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description?: string;
  category: string;
  isPublic: boolean;
  updatedAt: string;
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
  pendingApprovals?: number;
  availableLeaves?: number;
  leavesTaken?: number;
  teamSize?: number;
  title: string;
  value?: number;
  totalEmployees?: number;
  onLeaveToday?: number;
  approvalRate?: number;
  systemAlerts?: number;
    progress?: number;
  badge?: 'urgent' | 'alert' | 'info' | 'active';
  trend?: string;
  icon?: React.ReactNode;
  color:string;
  subtitle:string;


}
export interface member{

}
export interface EnhancedDashboardStats extends DashboardStats {
  trend?: 'up' | 'down' | 'neutral';
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
  error?: string[];
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
  title: string;
  message: string;
  userId?: string;
  relatedTo: string;
  createdAt:string;
  type: NotificationCategory;
  isRead?: boolean;
  read: boolean
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

