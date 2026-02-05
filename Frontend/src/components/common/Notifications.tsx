import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationService } from '../../utils/notificationService';
import './Notifications.css';




const Notifications: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user) {
      loadNotifications();
    }
  }, [user]);

  const loadNotifications = () => {
    try {
      const userNotifications = NotificationService.getUserNotifications(user!.id.toString());
      setNotifications(userNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  const markAsRead = (notificationId: number) => {
    try {
      NotificationService.markAsRead(notificationId);
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, read: true } : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = () => {
    try {
      if (user) {
        NotificationService.markAllAsRead(user.id.toString());
        setNotifications(prev => prev.map(notif => ({ ...notif, read: true })));
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const unreadCount = notifications.filter(notif => !notif.read).length;

  if (!user) return null;

  return (
    <div className="notifications-container">
      <button 
        className="notification-bell"
        onClick={() => setIsOpen(!isOpen)}
        title="Notifications"
      >
        🔔
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>

      {isOpen && (
        <div className="notifications-dropdown">
          <div className="notifications-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button className="mark-all-read" onClick={markAllAsRead}>
                Mark all read
              </button>
            )}
          </div>

          <div className="notifications-list">
            {notifications.length === 0 ? (
              <div className="no-notifications">
                <p>No notifications yet</p>
                <small>You'll see updates about your leave requests here</small>
              </div>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`notification-item ${notification.type} ${notification.read ? 'read' : 'unread'}`}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div className="notification-icon">
                    {notification.type === 'success' && '✅'}
                    {notification.type === 'error' && '❌'}
                    {notification.type === 'warning' && '⚠️'}
                    {notification.type === 'info' && 'ℹ️'}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">
                      {new Date(notification.createdAt).toLocaleDateString()} 
                      {' '}
                      {new Date(notification.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {!notification.read && <div className="unread-dot"></div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Notifications;