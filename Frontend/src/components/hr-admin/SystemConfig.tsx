import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../utils/api';
import './SystemConfig.css';

interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description?: string;
  category: string;
  isPublic: boolean;
  updatedAt: string;
}

interface SystemConfigState {
  // Leave Policies
  maxConsecutiveLeaves: number;
  advanceNoticeDays: number;
  carryOverEnabled: boolean;
  carryOverLimit: number;
  maxLeaveDaysPerYear: number;
  minLeaveDuration: number;
  
  // Approval Settings
  autoApproveEnabled: boolean;
  autoApproveMaxDays: number;
  requireManagerApproval: boolean;
  requireHRApproval: boolean;
  approvalReminderHours: number;
  
  // Notification Settings
  notificationEmails: boolean;
  notificationSMS: boolean;
  managerNotifications: boolean;
  hrNotifications: boolean;
  systemAlerts: boolean;
  
  // System Behavior
  allowBackdateLeaves: boolean;
  allowOverlappingLeaves: boolean;
  fiscalYearStart: string;
  workingDays: string[];
  holidayCalendar: string;
  
  // UI Settings
  theme: 'light' | 'dark' | 'auto';
  language: string;
  timezone: string;
}

const SystemConfig: React.FC = () => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<SystemConfigState>({
    // Leave Policies
    maxConsecutiveLeaves: 15,
    advanceNoticeDays: 3,
    carryOverEnabled: true,
    carryOverLimit: 10,
    maxLeaveDaysPerYear: 30,
    minLeaveDuration: 0.5,
    
    // Approval Settings
    autoApproveEnabled: false,
    autoApproveMaxDays: 1,
    requireManagerApproval: true,
    requireHRApproval: true,
    approvalReminderHours: 24,
    
    // Notification Settings
    notificationEmails: true,
    notificationSMS: false,
    managerNotifications: true,
    hrNotifications: true,
    systemAlerts: true,
    
    // System Behavior
    allowBackdateLeaves: false,
    allowOverlappingLeaves: false,
    fiscalYearStart: '2024-01-01',
    workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    holidayCalendar: 'ethiopian',
    
    // UI Settings
    theme: 'light',
    language: 'en',
    timezone: 'Africa/Addis_Ababa'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<SystemConfigState | null>(null);

  // Load settings from backend
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await apiService.getSystemSettings();
      
      if (response.success && response.data) {
        const backendSettings = transformBackendSettings(response.data);
        setSettings(backendSettings);
        setOriginalSettings(backendSettings);
      } else {
        setError('Failed to load system settings');
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      setError(error.message || 'Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  // Transform backend settings to frontend format
  const transformBackendSettings = (backendSettings: SystemSetting[]): SystemConfigState => {
    const config: any = {};
    
    backendSettings.forEach(setting => {
      try {
        // Parse JSON values or use as-is
        config[setting.key] = isJsonString(setting.value) 
          ? JSON.parse(setting.value) 
          : setting.value;
      } catch (error) {
        console.warn(`Failed to parse setting ${setting.key}:`, setting.value);
        config[setting.key] = setting.value;
      }
    });
    
    return { ...settings, ...config };
  };

  const isJsonString = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const handleSettingChange = (key: keyof SystemConfigState, value: any) => {
    setSettings(prev => {
      const newSettings = { ...prev, [key]: value };
      
      // Check if there are changes compared to original
      if (originalSettings) {
        setHasChanges(JSON.stringify(newSettings) !== JSON.stringify(originalSettings));
      }
      
      return newSettings;
    });
  };

  const handleArraySettingChange = (key: keyof SystemConfigState, item: string, checked: boolean) => {
    setSettings(prev => {
      const currentArray = Array.isArray(prev[key]) ? [...prev[key] as string[]] : [];
      let newArray: string[];
      
      if (checked) {
        newArray = [...currentArray, item];
      } else {
        newArray = currentArray.filter(i => i !== item);
      }
      
      const newSettings = { ...prev, [key]: newArray };
      
      if (originalSettings) {
        setHasChanges(JSON.stringify(newSettings) !== JSON.stringify(originalSettings));
      }
      
      return newSettings;
    });
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');

      // Validate settings
      const validationError = validateSettings();
      if (validationError) {
        setError(validationError);
        return;
      }

      // Transform settings for backend
      const settingsToSave = transformSettingsForBackend(settings);

      // Save each setting individually
      const savePromises = Object.entries(settingsToSave).map(([key, value]) =>
        apiService.updateSystemSetting(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
      );

      const results = await Promise.all(savePromises);
      const failedSaves = results.filter(result => !result.success);
      
      if (failedSaves.length > 0) {
        throw new Error(`Failed to save ${failedSaves.length} settings`);
      }

      setSuccess('System configuration saved successfully!');
      setOriginalSettings(settings);
      setHasChanges(false);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
      
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setError(error.message || 'Failed to save system configuration');
    } finally {
      setSaving(false);
    }
  };

  const validateSettings = (): string | null => {
    if (settings.maxConsecutiveLeaves < 1) {
      return 'Maximum consecutive leaves must be at least 1 day';
    }
    
    if (settings.advanceNoticeDays < 0) {
      return 'Advance notice days cannot be negative';
    }
    
    if (settings.carryOverEnabled && settings.carryOverLimit < 0) {
      return 'Carry over limit cannot be negative';
    }
    
    if (settings.maxLeaveDaysPerYear < 1) {
      return 'Maximum leave days per year must be at least 1';
    }
    
    if (settings.minLeaveDuration < 0) {
      return 'Minimum leave duration cannot be negative';
    }
    
    if (settings.autoApproveEnabled && settings.autoApproveMaxDays < 0) {
      return 'Auto-approve maximum days cannot be negative';
    }
    
    if (settings.approvalReminderHours < 1) {
      return 'Approval reminder hours must be at least 1';
    }
    
    return null;
  };

  const transformSettingsForBackend = (frontendSettings: SystemConfigState): any => {
    return {
      // Leave Policies
      maxConsecutiveLeaves: frontendSettings.maxConsecutiveLeaves,
      advanceNoticeDays: frontendSettings.advanceNoticeDays,
      carryOverEnabled: frontendSettings.carryOverEnabled,
      carryOverLimit: frontendSettings.carryOverLimit,
      maxLeaveDaysPerYear: frontendSettings.maxLeaveDaysPerYear,
      minLeaveDuration: frontendSettings.minLeaveDuration,
      
      // Approval Settings
      autoApproveEnabled: frontendSettings.autoApproveEnabled,
      autoApproveMaxDays: frontendSettings.autoApproveMaxDays,
      requireManagerApproval: frontendSettings.requireManagerApproval,
      requireHRApproval: frontendSettings.requireHRApproval,
      approvalReminderHours: frontendSettings.approvalReminderHours,
      
      // Notification Settings
      notificationEmails: frontendSettings.notificationEmails,
      notificationSMS: frontendSettings.notificationSMS,
      managerNotifications: frontendSettings.managerNotifications,
      hrNotifications: frontendSettings.hrNotifications,
      systemAlerts: frontendSettings.systemAlerts,
      
      // System Behavior
      allowBackdateLeaves: frontendSettings.allowBackdateLeaves,
      allowOverlappingLeaves: frontendSettings.allowOverlappingLeaves,
      fiscalYearStart: frontendSettings.fiscalYearStart,
      workingDays: frontendSettings.workingDays,
      holidayCalendar: frontendSettings.holidayCalendar,
      
      // UI Settings
      theme: frontendSettings.theme,
      language: frontendSettings.language,
      timezone: frontendSettings.timezone
    };
  };

  const resetToDefaults = () => {
    const defaultSettings: SystemConfigState = {
      // Leave Policies
      maxConsecutiveLeaves: 15,
      advanceNoticeDays: 3,
      carryOverEnabled: true,
      carryOverLimit: 10,
      maxLeaveDaysPerYear: 30,
      minLeaveDuration: 0.5,
      
      // Approval Settings
      autoApproveEnabled: false,
      autoApproveMaxDays: 1,
      requireManagerApproval: true,
      requireHRApproval: true,
      approvalReminderHours: 24,
      
      // Notification Settings
      notificationEmails: true,
      notificationSMS: false,
      managerNotifications: true,
      hrNotifications: true,
      systemAlerts: true,
      
      // System Behavior
      allowBackdateLeaves: false,
      allowOverlappingLeaves: false,
      fiscalYearStart: '2024-01-01',
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      holidayCalendar: 'ethiopian',
      
      // UI Settings
      theme: 'light',
      language: 'en',
      timezone: 'Africa/Addis_Ababa'
    };
    
    setSettings(defaultSettings);
    setHasChanges(true);
  };

  const discardChanges = () => {
    if (originalSettings) {
      setSettings(originalSettings);
      setHasChanges(false);
    }
  };

  if (loading) {
    return (
      <div className="system-config">
        <div className="page-header">
          <h1>System Configuration</h1>
          <p>Manage system-wide settings and preferences</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading system configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="system-config">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>System Configuration</h1>
            <p>Manage system-wide settings and preferences</p>
          </div>
          <div className="header-actions">
            {hasChanges && (
              <span className="changes-indicator">• Unsaved Changes</span>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="message-banner error">
          <div className="message-content">
            <span className="message-icon">❌</span>
            {error}
          </div>
          <button onClick={() => setError('')} className="message-close">×</button>
        </div>
      )}

      {success && (
        <div className="message-banner success">
          <div className="message-content">
            <span className="message-icon">✅</span>
            {success}
          </div>
          <button onClick={() => setSuccess('')} className="message-close">×</button>
        </div>
      )}

      <div className="config-sections">
        {/* Leave Policies Section */}
        <div className="config-section">
          <div className="section-header">
            <h2>📅 Leave Policies</h2>
            <p>Configure leave duration, notice periods, and carry-over rules</p>
          </div>
          <div className="setting-group">
            <div className="setting-row">
              <div className="setting-item">
                <label>Maximum Consecutive Leave Days</label>
                <input 
                  type="number" 
                  value={settings.maxConsecutiveLeaves}
                  onChange={(e) => handleSettingChange('maxConsecutiveLeaves', parseInt(e.target.value) || 1)}
                  min="1"
                  max="365"
                />
                <span className="help-text">Maximum allowed continuous leave duration</span>
              </div>
              
              <div className="setting-item">
                <label>Advance Notice Required (Days)</label>
                <input 
                  type="number" 
                  value={settings.advanceNoticeDays}
                  onChange={(e) => handleSettingChange('advanceNoticeDays', parseInt(e.target.value) || 0)}
                  min="0"
                  max="30"
                />
                <span className="help-text">Minimum notice period before leave starts</span>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-item">
                <label>Maximum Leave Days Per Year</label>
                <input 
                  type="number" 
                  value={settings.maxLeaveDaysPerYear}
                  onChange={(e) => handleSettingChange('maxLeaveDaysPerYear', parseInt(e.target.value) || 1)}
                  min="1"
                  max="365"
                />
                <span className="help-text">Total leave days allowed per calendar year</span>
              </div>
              
              <div className="setting-item">
                <label>Minimum Leave Duration (Days)</label>
                <input 
                  type="number" 
                  value={settings.minLeaveDuration}
                  onChange={(e) => handleSettingChange('minLeaveDuration', parseFloat(e.target.value) || 0)}
                  min="0"
                  max="1"
                  step="0.5"
                />
                <span className="help-text">Minimum allowed leave duration (0.5 = half day)</span>
              </div>
            </div>

            <div className="setting-item checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={settings.carryOverEnabled}
                  onChange={(e) => handleSettingChange('carryOverEnabled', e.target.checked)}
                />
                Allow Leave Carry Over to Next Year
              </label>
              <span className="help-text">Enable unused leave days to be carried over</span>
            </div>

            {settings.carryOverEnabled && (
              <div className="setting-item">
                <label>Maximum Carry Over Days</label>
                <input 
                  type="number" 
                  value={settings.carryOverLimit}
                  onChange={(e) => handleSettingChange('carryOverLimit', parseInt(e.target.value) || 0)}
                  min="0"
                  max="30"
                />
                <span className="help-text">Maximum days that can be carried over to next year</span>
              </div>
            )}
          </div>
        </div>

        {/* Approval Settings Section */}
        <div className="config-section">
          <div className="section-header">
            <h2>✅ Approval Settings</h2>
            <p>Configure approval workflows and automation</p>
          </div>
          <div className="setting-group">
            <div className="setting-item checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={settings.autoApproveEnabled}
                  onChange={(e) => handleSettingChange('autoApproveEnabled', e.target.checked)}
                />
                Enable Auto-Approval for Short Leaves
              </label>
              <span className="help-text">Automatically approve leaves shorter than specified duration</span>
            </div>

            {settings.autoApproveEnabled && (
              <div className="setting-item">
                <label>Auto-Approval Maximum Days</label>
                <input 
                  type="number" 
                  value={settings.autoApproveMaxDays}
                  onChange={(e) => handleSettingChange('autoApproveMaxDays', parseInt(e.target.value) || 1)}
                  min="1"
                  max="7"
                />
                <span className="help-text">Maximum duration for auto-approval (in days)</span>
              </div>
            )}

            <div className="setting-row">
              <div className="setting-item checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={settings.requireManagerApproval}
                    onChange={(e) => handleSettingChange('requireManagerApproval', e.target.checked)}
                  />
                  Require Manager Approval
                </label>
              </div>
              
              <div className="setting-item checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={settings.requireHRApproval}
                    onChange={(e) => handleSettingChange('requireHRApproval', e.target.checked)}
                  />
                  Require HR Approval
                </label>
              </div>
            </div>

            <div className="setting-item">
              <label>Approval Reminder (Hours)</label>
              <input 
                type="number" 
                value={settings.approvalReminderHours}
                onChange={(e) => handleSettingChange('approvalReminderHours', parseInt(e.target.value) || 24)}
                min="1"
                max="168"
              />
              <span className="help-text">Send reminder after this many hours if not approved</span>
            </div>
          </div>
        </div>

        {/* Notification Settings Section */}
        <div className="config-section">
          <div className="section-header">
            <h2>🔔 Notification Settings</h2>
            <p>Configure notification channels and recipients</p>
          </div>
          <div className="setting-group">
            <div className="setting-row">
              <div className="setting-item checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={settings.notificationEmails}
                    onChange={(e) => handleSettingChange('notificationEmails', e.target.checked)}
                  />
                  Email Notifications
                </label>
              </div>
              
              <div className="setting-item checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={settings.notificationSMS}
                    onChange={(e) => handleSettingChange('notificationSMS', e.target.checked)}
                  />
                  SMS Notifications
                </label>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-item checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={settings.managerNotifications}
                    onChange={(e) => handleSettingChange('managerNotifications', e.target.checked)}
                  />
                  Notify Managers
                </label>
              </div>
              
              <div className="setting-item checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={settings.hrNotifications}
                    onChange={(e) => handleSettingChange('hrNotifications', e.target.checked)}
                  />
                  Notify HR Team
                </label>
              </div>
            </div>

            <div className="setting-item checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={settings.systemAlerts}
                  onChange={(e) => handleSettingChange('systemAlerts', e.target.checked)}
                />
                System Alerts & Reports
              </label>
              <span className="help-text">Receive system health alerts and weekly reports</span>
            </div>
          </div>
        </div>

        {/* System Behavior Section */}
        <div className="config-section">
          <div className="section-header">
            <h2>⚙️ System Behavior</h2>
            <p>Configure system rules and calendar settings</p>
          </div>
          <div className="setting-group">
            <div className="setting-row">
              <div className="setting-item checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={settings.allowBackdateLeaves}
                    onChange={(e) => handleSettingChange('allowBackdateLeaves', e.target.checked)}
                  />
                  Allow Backdated Leaves
                </label>
              </div>
              
              <div className="setting-item checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={settings.allowOverlappingLeaves}
                    onChange={(e) => handleSettingChange('allowOverlappingLeaves', e.target.checked)}
                  />
                  Allow Overlapping Leaves
                </label>
              </div>
            </div>

            <div className="setting-item">
              <label>Fiscal Year Start Date</label>
              <input 
                type="date" 
                value={settings.fiscalYearStart}
                onChange={(e) => handleSettingChange('fiscalYearStart', e.target.value)}
              />
              <span className="help-text">Start date for the fiscal year (affects leave balances)</span>
            </div>

            <div className="setting-item">
              <label>Working Days</label>
              <div className="checkbox-grid">
                {[
                  { value: 'monday', label: 'Monday' },
                  { value: 'tuesday', label: 'Tuesday' },
                  { value: 'wednesday', label: 'Wednesday' },
                  { value: 'thursday', label: 'Thursday' },
                  { value: 'friday', label: 'Friday' },
                  { value: 'saturday', label: 'Saturday' },
                  { value: 'sunday', label: 'Sunday' }
                ].map(day => (
                  <label key={day.value} className="checkbox-label small">
                    <input 
                      type="checkbox" 
                      checked={settings.workingDays.includes(day.value)}
                      onChange={(e) => handleArraySettingChange('workingDays', day.value, e.target.checked)}
                    />
                    {day.label}
                  </label>
                ))}
              </div>
              <span className="help-text">Select which days are considered working days</span>
            </div>

            <div className="setting-item">
              <label>Holiday Calendar</label>
              <select 
                value={settings.holidayCalendar}
                onChange={(e) => handleSettingChange('holidayCalendar', e.target.value)}
              >
                <option value="ethiopian">Ethiopian Calendar</option>
                <option value="gregorian">Gregorian Calendar</option>
                <option value="custom">Custom Calendar</option>
              </select>
              <span className="help-text">Holiday calendar for automatic leave calculations</span>
            </div>
          </div>
        </div>

        {/* UI Settings Section */}
        <div className="config-section">
          <div className="section-header">
            <h2>🎨 Interface Settings</h2>
            <p>Customize the user interface appearance and behavior</p>
          </div>
          <div className="setting-group">
            <div className="setting-row">
              <div className="setting-item">
                <label>Theme</label>
                <select 
                  value={settings.theme}
                  onChange={(e) => handleSettingChange('theme', e.target.value)}
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto (System)</option>
                </select>
              </div>
              
              <div className="setting-item">
                <label>Language</label>
                <select 
                  value={settings.language}
                  onChange={(e) => handleSettingChange('language', e.target.value)}
                >
                  <option value="en">English</option>
                  <option value="am">Amharic</option>
                </select>
              </div>
            </div>

            <div className="setting-item">
              <label>Timezone</label>
              <select 
                value={settings.timezone}
                onChange={(e) => handleSettingChange('timezone', e.target.value)}
              >
                <option value="Africa/Addis_Ababa">East Africa Time (EAT)</option>
                <option value="UTC">UTC</option>
              </select>
              <span className="help-text">Time zone for all date and time displays</span>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="config-actions">
          <div className="actions-info">
            {hasChanges && (
              <div className="changes-warning">
                ⚠️ You have unsaved changes. Don't forget to save your configuration.
              </div>
            )}
          </div>
          
          <div className="actions-buttons">
            <button 
              className="save-btn primary" 
              onClick={saveSettings}
              disabled={saving || !hasChanges}
            >
              {saving ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Saving...
                </>
              ) : (
                'Save Configuration'
              )}
            </button>
            
            {hasChanges && (
              <button 
                className="discard-btn"
                onClick={discardChanges}
                disabled={saving}
              >
                Discard Changes
              </button>
            )}
            
            <button 
              className="reset-btn"
              onClick={resetToDefaults}
              disabled={saving}
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemConfig;