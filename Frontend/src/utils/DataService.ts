// src/utils/DataService.ts

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

class DataService {
  private leaveApplications: LeaveApplication[] = [];
  private employees: Employee[] = [
    {
      id: '1',
      name: 'John Employee',
      email: 'john@university.edu',
      department: 'Academic',
      role: 'employee',
      leaveBalance: { sick: 10, vacation: 18, personal: 5 }
    },
    {
      id: '2',
      name: 'Manager User',
      email: 'manager@university.edu',
      department: 'Academic',
      role: 'manager',
      leaveBalance: { sick: 10, vacation: 18, personal: 5 }
    },
    {
      id: '3',
      name: 'HR Admin',
      email: 'hr@university.edu',
      department: 'HR',
      role: 'hr-admin',
      leaveBalance: { sick: 10, vacation: 18, personal: 5 }
    }
  ];

  private currentId = 1;

  // Leave Applications Methods
  getAllApplications(): LeaveApplication[] {
    return [...this.leaveApplications];
  }

  getApplicationsByEmployee(employeeId: string): LeaveApplication[] {
    return this.leaveApplications.filter(app => app.employeeId === employeeId);
  }

  getPendingHRApplications(): LeaveApplication[] {
    return this.leaveApplications.filter(app => 
      app.status === 'hr_pending' && app.currentApprover === 'hr'
    );
  }

  getPendingManagerApplications(): LeaveApplication[] {
    return this.leaveApplications.filter(app => 
      app.status === 'pending' && app.currentApprover === 'manager'
    );
  }

  getManagerApprovalHistory(managerDepartment: string): LeaveApplication[] {
    return this.leaveApplications.filter(app => 
      app.department === managerDepartment && 
      (app.status === 'approved' || app.status === 'rejected' || app.status === 'hr_pending')
    );
  }

  createApplication(application: Omit<LeaveApplication, 'id'>): boolean {
    try {
      const newApplication: LeaveApplication = {
        ...application,
        id: this.currentId++
      };
      this.leaveApplications.push(newApplication);
      return true;
    } catch (error) {
      console.error('Error creating application:', error);
      return false;
    }
  }

  updateApplicationStatus(applicationId: number, updates: Partial<LeaveApplication>): boolean {
    try {
      const index = this.leaveApplications.findIndex(app => app.id === applicationId);
      if (index !== -1) {
        this.leaveApplications[index] = { ...this.leaveApplications[index], ...updates };
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating application:', error);
      return false;
    }
  }

  // Employee Methods
  getEmployee(employeeId: string): Employee | undefined {
    return this.employees.find(emp => emp.id === employeeId);
  }

  updateEmployeeLeaveBalance(employeeId: string, leaveType: string, days: number): boolean {
    try {
      const employee = this.employees.find(emp => emp.id === employeeId);
      if (employee && employee.leaveBalance[leaveType as keyof typeof employee.leaveBalance] !== undefined) {
        employee.leaveBalance[leaveType as keyof typeof employee.leaveBalance] -= days;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error updating leave balance:', error);
      return false;
    }
  }

  // Statistics Methods
  getDepartmentStats() {
    const departments = [...new Set(this.leaveApplications.map(app => app.department))];
    return departments.map(dept => {
      const deptApps = this.leaveApplications.filter(app => app.department === dept);
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
    const leaveTypes = [...new Set(this.leaveApplications.map(app => app.leaveType))];
    return leaveTypes.map(type => {
      const typeApps = this.leaveApplications.filter(app => app.leaveType === type);
      return {
        type,
        count: typeApps.length,
        percentage: this.leaveApplications.length > 0 ? 
          ((typeApps.length / this.leaveApplications.length) * 100).toFixed(1) : '0'
      };
    });
  }

  getOverallStats() {
    return {
      total: this.leaveApplications.length,
      pending: this.leaveApplications.filter(app => app.status.includes('pending')).length,
      approved: this.leaveApplications.filter(app => app.status.includes('approved')).length,
      rejected: this.leaveApplications.filter(app => app.status.includes('rejected')).length,
    };
  }
}

export const dataService = new DataService();