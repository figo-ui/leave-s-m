// src/utils/leaveService.ts

export interface LeaveApplication {
  id: number;
  employeeName: string;
  employeeId: string;
  employeeEmail: string;
  department: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  status: 'pending' | 'approved' | 'rejected' | 'hr_pending' | 'hr_approved' | 'hr_rejected';
  reason: string;
  appliedDate: string;
  currentApprover: 'manager' | 'hr';
  managerNotes?: string;
  managerApprovedDate?: string;
  hrNotes?: string;
  hrApprovedDate?: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  role: 'employee' | 'manager' | 'hr-admin';
  leaveBalance: {
    sick: number;
    vacation: number;
    personal: number;
  };
}

// Import your existing NotificationService
import { NotificationService } from './notificationService';

class DataService {
  private currentId = 1;

  // Employee Management
  addEmployee(employee: Omit<Employee, 'id'>): string {
    try {
      const employees = this.getEmployees();
      const id = (employees.length + 1).toString();
      const newEmployee: Employee = {
        ...employee,
        id
      };
      employees.push(newEmployee);
      this.saveEmployees(employees);
      return id;
    } catch (error) {
      console.error('Error adding employee:', error);
      throw new Error('Failed to add employee');
    }
  }

  getEmployee(employeeId: string): Employee | undefined {
    const employees = this.getEmployees();
    return employees.find(emp => emp.id === employeeId);
  }

  getAllEmployees(): Employee[] {
    return this.getEmployees();
  }

  updateEmployeeLeaveBalance(employeeId: string, leaveType: string, days: number): boolean {
    try {
      const employees = this.getEmployees();
      const employee = employees.find(emp => emp.id === employeeId);
      if (employee && employee.leaveBalance[leaveType as keyof typeof employee.leaveBalance] !== undefined) {
        employee.leaveBalance[leaveType as keyof typeof employee.leaveBalance] -= days;
        this.saveEmployees(employees);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating leave balance:', error);
      return false;
    }
  }

  // Leave Applications Management
  createApplication(application: Omit<LeaveApplication, 'id'>): boolean {
    try {
      const applications = this.getLeaveApplications();
      const newApplication: LeaveApplication = {
        ...application,
        id: this.currentId++
      };
      applications.push(newApplication);
      this.saveLeaveApplications(applications);
      
      // Notify manager about new request
      NotificationService.notifyManagerNewRequest(newApplication);
      return true;
    } catch (error) {
      console.error('Error creating application:', error);
      return false;
    }
  }

  getAllApplications(): LeaveApplication[] {
    return this.getLeaveApplications();
  }

  getApplicationsByEmployee(employeeId: string): LeaveApplication[] {
    const applications = this.getLeaveApplications();
    return applications.filter(app => app.employeeId === employeeId);
  }

  getPendingHRApplications(): LeaveApplication[] {
    const applications = this.getLeaveApplications();
    return applications.filter(app => 
      app.status === 'hr_pending' && app.currentApprover === 'hr'
    );
  }

  getPendingManagerApplications(): LeaveApplication[] {
    const applications = this.getLeaveApplications();
    return applications.filter(app => 
      app.status === 'pending' && app.currentApprover === 'manager'
    );
  }

  getManagerApprovalHistory(managerDepartment: string): LeaveApplication[] {
    const applications = this.getLeaveApplications();
    return applications.filter(app => 
      app.department === managerDepartment && 
      (app.status === 'approved' || app.status === 'rejected' || app.status === 'hr_pending')
    );
  }

  updateApplicationStatus(applicationId: number, updates: Partial<LeaveApplication>): boolean {
    try {
      const applications = this.getLeaveApplications();
      const applicationIndex = applications.findIndex(app => app.id === applicationId);
      
      if (applicationIndex === -1) {
        throw new Error('Leave application not found');
      }

      const previousApp = { ...applications[applicationIndex] };
      const updatedApplication = {
        ...applications[applicationIndex],
        ...updates
      };

      applications[applicationIndex] = updatedApplication;
      this.saveLeaveApplications(applications);

      // Handle notifications based on status change
      this.handleStatusChangeNotifications(updatedApplication, previousApp);
      return true;
    } catch (error) {
      console.error('Error updating application:', error);
      return false;
    }
  }

  private handleStatusChangeNotifications(updatedApp: LeaveApplication, previousApp: LeaveApplication): void {
    if (updatedApp.status === 'hr_pending' && previousApp.status === 'pending') {
      NotificationService.notifyEmployeeManagerApproved(updatedApp);
      NotificationService.notifyHRManagerApproved(updatedApp);
    } else if (updatedApp.status === 'rejected' && previousApp.status === 'pending') {
      NotificationService.notifyEmployeeManagerRejected(updatedApp, updatedApp.managerNotes || 'No reason provided');
    } else if (updatedApp.status === 'hr_approved' && previousApp.status === 'hr_pending') {
      NotificationService.notifyEmployeeFinalApproved(updatedApp);
    } else if (updatedApp.status === 'hr_rejected' && previousApp.status === 'hr_pending') {
      NotificationService.notifyEmployeeFinalRejected(updatedApp, updatedApp.hrNotes || 'No reason provided');
    }
  }

  // Statistics and Analytics
  getOverallStats() {
    const applications = this.getLeaveApplications();
    return {
      total: applications.length,
      pending: applications.filter(app => app.status.includes('pending')).length,
      approved: applications.filter(app => app.status.includes('approved')).length,
      rejected: applications.filter(app => app.status.includes('rejected')).length,
    };
  }

  getDepartmentStats() {
    const applications = this.getLeaveApplications();
    const departments = [...new Set(applications.map(app => app.department))];
    return departments.map(dept => {
      const deptApps = applications.filter(app => app.department === dept);
      return {
        department: dept,
        total: deptApps.length,
        approved: deptApps.filter(app => app.status.includes('approved')).length,
        pending: deptApps.filter(app => app.status.includes('pending')).length,
        rejected: deptApps.filter(app => app.status.includes('rejected')).length,
      };
    });
  }

  getLeaveTypeStats() {
    const applications = this.getLeaveApplications();
    const leaveTypes = [...new Set(applications.map(app => app.leaveType))];
    return leaveTypes.map(type => {
      const typeApps = applications.filter(app => app.leaveType === type);
      return {
        type,
        count: typeApps.length,
        percentage: applications.length > 0 ? 
          ((typeApps.length / applications.length) * 100).toFixed(1) : '0'
      };
    });
  }

  // LocalStorage Methods
  private getLeaveApplications(): LeaveApplication[] {
    try {
      const applications = localStorage.getItem('leaveApplications');
      return applications ? JSON.parse(applications) : [];
    } catch (error) {
      console.error('Error getting leave applications:', error);
      return [];
    }
  }

  private saveLeaveApplications(applications: LeaveApplication[]): void {
    try {
      localStorage.setItem('leaveApplications', JSON.stringify(applications));
    } catch (error) {
      console.error('Error saving leave applications:', error);
      throw new Error('Failed to save leave applications');
    }
  }

  private getEmployees(): Employee[] {
    try {
      const employees = localStorage.getItem('employees');
      return employees ? JSON.parse(employees) : [];
    } catch (error) {
      console.error('Error getting employees:', error);
      return [];
    }
  }

  private saveEmployees(employees: Employee[]): void {
    try {
      localStorage.setItem('employees', JSON.stringify(employees));
    } catch (error) {
      console.error('Error saving employees:', error);
      throw new Error('Failed to save employees');
    }
  }

  // Initialize with current ID from existing data
  private initializeCurrentId(): void {
    const applications = this.getLeaveApplications();
    if (applications.length > 0) {
      this.currentId = Math.max(...applications.map(app => app.id)) + 1;
    }
  }

  constructor() {
    this.initializeCurrentId();
  }
}

// Create singleton instance
export const dataService = new DataService();

// Main LeaveService class that uses the DataService
export class LeaveService {
  // Employee Methods
  static addEmployee(employee: Omit<Employee, 'id'>): string {
    return dataService.addEmployee(employee);
  }

  static getEmployee(employeeId: string): Employee | undefined {
    return dataService.getEmployee(employeeId);
  }

  static getAllEmployees(): Employee[] {
    return dataService.getAllEmployees();
  }

  static updateEmployeeLeaveBalance(employeeId: string, leaveType: string, days: number): boolean {
    return dataService.updateEmployeeLeaveBalance(employeeId, leaveType, days);
  }

  // Leave Application Methods (Your existing methods)
  static getLeaveApplications(): LeaveApplication[] {
    return dataService.getAllApplications();
  }

  static saveLeaveApplication(application: LeaveApplication): void {
    dataService.updateApplicationStatus(application.id, application);
  }

  static createLeaveApplication(applicationData: Omit<LeaveApplication, 'id'>): void {
    const success = dataService.createApplication(applicationData);
    if (!success) {
      throw new Error('Failed to create leave application');
    }
  }

  static updateApplicationStatus(applicationId: number, updates: Partial<LeaveApplication>): void {
    const success = dataService.updateApplicationStatus(applicationId, updates);
    if (!success) {
      throw new Error('Failed to update application status');
    }
  }

  static getPendingManagerApplications(): LeaveApplication[] {
    return dataService.getPendingManagerApplications();
  }

  static getPendingHRApplications(): LeaveApplication[] {
    return dataService.getPendingHRApplications();
  }

  static getEmployeeApplications(employeeId: string): LeaveApplication[] {
    return dataService.getApplicationsByEmployee(employeeId);
  }

  // New methods for enhanced functionality
  static getAllApplications(): LeaveApplication[] {
    return dataService.getAllApplications();
  }

  // FIXED: This method was missing - added alias for getEmployeeApplications
  static getApplicationsByEmployee(employeeId: string): LeaveApplication[] {
    return dataService.getApplicationsByEmployee(employeeId);
  }

  static getManagerApprovalHistory(managerDepartment: string): LeaveApplication[] {
    return dataService.getManagerApprovalHistory(managerDepartment);
  }

  static createApplication(application: Omit<LeaveApplication, 'id'>): Promise<boolean> {
    return Promise.resolve(dataService.createApplication(application));
  }

  // Statistics methods
  static getStatistics() {
    return {
      ...dataService.getOverallStats(),
      byDepartment: dataService.getDepartmentStats(),
      byLeaveType: dataService.getLeaveTypeStats()
    };
  }

  static getDepartmentStats() {
    return dataService.getDepartmentStats();
  }

  static getLeaveTypeStats() {
    return dataService.getLeaveTypeStats();
  }

  static getOverallStats() {
    return dataService.getOverallStats();
  }

  // Add this method to initialize default employees
  static initializeDefaultEmployees(): void {
    try {
      const employees = this.getAllEmployees();
      if (employees.length === 0) {
        console.log('Initializing default employees...');
        
        // Create default employees for testing
        this.addEmployee({
          name: 'John Employee',
          email: 'john@university.edu',
          department: 'Academic',
          role: 'employee',
          leaveBalance: { sick: 10, vacation: 18, personal: 5 }
        });
        
        this.addEmployee({
          name: 'Manager User', 
          email: 'manager@university.edu',
          department: 'Academic',
          role: 'manager',
          leaveBalance: { sick: 10, vacation: 18, personal: 5 }
        });
        
        this.addEmployee({
          name: 'HR Admin',
          email: 'hr@university.edu', 
          department: 'HR',
          role: 'hr-admin',
          leaveBalance: { sick: 10, vacation: 18, personal: 5 }
        });
        
        console.log('Default employees created successfully');
      }
    } catch (error) {
      console.error('Error initializing default employees:', error);
    }
  }
}

export default LeaveService;