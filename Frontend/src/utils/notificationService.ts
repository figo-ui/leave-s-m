import { Notification, LeaveApplication } from '../types';

export class NotificationService {
  static createNotification(notification: Omit<Notification, 'id'>): void {
    try {
      const existingNotifications = this.getNotifications();
      const newNotification: Notification = {
        ...notification,
        id: Date.now() + Math.random() // Simple ID generation
      };
      
      const updatedNotifications = [...existingNotifications, newNotification];
      localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  }

  static getNotifications(): Notification[] {
    try {
      const notifications = localStorage.getItem('notifications');
      return notifications ? JSON.parse(notifications) : [];
    } catch (error) {
      console.error('Error getting notifications:', error);
      return [];
    }
  }

  static getUserNotifications(userId: string): Notification[] {
    try {
      const allNotifications = this.getNotifications();
      return allNotifications.filter(notif => 
        notif.userId === userId || notif.userId === 'all'
      ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      console.error('Error getting user notifications:', error);
      return [];
    }
  }

  static markAsRead(notificationId: number): void {
    try {
      const notifications = this.getNotifications();
      const updatedNotifications = notifications.map(notif =>
        notif.id === notificationId ? { ...notif, read: true } : notif
      );
      localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  }

  static markAllAsRead(userId: string): void {
    try {
      const notifications = this.getNotifications();
      const updatedNotifications = notifications.map(notif =>
        notif.userId === userId && !notif.read ? { ...notif, read: true } : notif
      );
      localStorage.setItem('notifications', JSON.stringify(updatedNotifications));
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  }

  // Notification templates for different workflow stages
  static notifyManagerNewRequest(application: LeaveApplication): void {
    this.createNotification({
      userId: 'manager',
      title: 'New Leave Request',
      message: `${application.employeeName} has applied for ${application.leaveType} (${application.days} days)`,
      type: 'info',
      read: false,
      createdAt: new Date().toISOString(),
      relatedTo: application.id.toString()
    });
  }

  static notifyEmployeeManagerApproved(application: LeaveApplication): void {
    this.createNotification({
      userId: application.employeeId,
      title: 'Manager Approved Your Leave',
      message: `Your ${application.leaveType} request was approved by manager. Waiting for HR final approval.`,
      type: 'success',
      read: false,
      createdAt: new Date().toISOString(),
      relatedTo: application.id.toString()
    });
  }

  static notifyEmployeeManagerRejected(application: LeaveApplication, reason: string): void {
    this.createNotification({
      userId: application.employeeId,
      title: 'Leave Request Rejected',
      message: `Your leave request was rejected by manager. Reason: ${reason}`,
      type: 'error',
      read: false,
      createdAt: new Date().toISOString(),
      relatedTo: application.id.toString()
    });
  }

  static notifyHRManagerApproved(application: LeaveApplication): void {
    this.createNotification({
      userId: 'hr-admin',
      title: 'Leave Request Needs HR Approval',
      message: `${application.employeeName}'s ${application.leaveType} request was manager-approved and needs HR review.`,
      type: 'info',
      read: false,
      createdAt: new Date().toISOString(),
      relatedTo: application.id.toString()
    });
  }

  static notifyEmployeeFinalApproved(application: LeaveApplication): void {
    this.createNotification({
      userId: application.employeeId,
      title: 'Leave Fully Approved! 🎉',
      message: `Your ${application.leaveType} request has been fully approved! Enjoy your ${application.days} days off.`,
      type: 'success',
      read: false,
      createdAt: new Date().toISOString(),
      relatedTo: application.id.toString()
    });
  }

  static notifyEmployeeFinalRejected(application: LeaveApplication, reason: string): void {
    this.createNotification({
      userId: application.employeeId,
      title: 'Leave Request Finally Rejected',
      message: `HR has rejected your leave request. Reason: ${reason}`,
      type: 'error',
      read: false,
      createdAt: new Date().toISOString(),
      relatedTo: application.id.toString()
    });
  }
}