import React, { useState, useEffect } from 'react';
import { apiService } from '../../utils/api';
import type { SystemSetting } from '../../types';
import { useTranslation } from 'react-i18next';
import './SystemConfig.css';

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
  const { t } = useTranslation();
  
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
        setError(t('system_config.errors.load_failed'));
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      setError(error.message || t('system_config.errors.load_failed'));
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

      setSuccess(t('system_config.messages.saved'));
      setOriginalSettings(settings);
      setHasChanges(false);
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(''), 5000);
      
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setError(error.message || t('system_config.errors.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const validateSettings = (): string | null => {
    if (settings.maxConsecutiveLeaves < 1) {
      return t('system_config.validation.max_consecutive');
    }
    
    if (settings.advanceNoticeDays < 0) {
      return t('system_config.validation.advance_notice');
    }
    
    if (settings.carryOverEnabled && settings.carryOverLimit < 0) {
      return t('system_config.validation.carry_over_limit');
    }
    
    if (settings.maxLeaveDaysPerYear < 1) {
      return t('system_config.validation.max_leave_days');
    }
    
    if (settings.minLeaveDuration < 0) {
      return t('system_config.validation.min_leave_duration');
    }
    
    if (settings.autoApproveEnabled && settings.autoApproveMaxDays < 0) {
      return t('system_config.validation.auto_approve_max');
    }
    
    if (settings.approvalReminderHours < 1) {
      return t('system_config.validation.approval_reminder');
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
          <h1>{t('system_config.title')}</h1>
          <p>{t('system_config.subtitle')}</p>
        </div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>{t('system_config.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="system-config">
      <div className="page-header">
        <div className="header-content">
          <div>
            <h1>{t('system_config.title')}</h1>
            <p>{t('system_config.subtitle')}</p>
          </div>
          <div className="header-actions">
            {hasChanges && (
              <span className="changes-indicator">• {t('system_config.unsaved_changes')}</span>
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
          <button onClick={() => setError('')} className="message-close" aria-label={t('common.close')}>×</button>
        </div>
      )}

      {success && (
        <div className="message-banner success">
          <div className="message-content">
            <span className="message-icon">✅</span>
            {success}
          </div>
          <button onClick={() => setSuccess('')} className="message-close" aria-label={t('common.close')}>×</button>
        </div>
      )}

      <div className="config-sections">
        {/* Leave Policies Section */}
        <div className="config-section">
          <div className="section-header">
            <h2>📅 {t('system_config.sections.leave_policies.title')}</h2>
            <p>{t('system_config.sections.leave_policies.subtitle')}</p>
          </div>
          <div className="setting-group">
            <div className="setting-row">
              <div className="setting-item">
                <label>{t('system_config.fields.max_consecutive')}</label>
                <input 
                  type="number" 
                  value={settings.maxConsecutiveLeaves}
                  onChange={(e) => handleSettingChange('maxConsecutiveLeaves', parseInt(e.target.value) || 1)}
                  min="1"
                  max="365"
                />
                <span className="help-text">{t('system_config.help.max_consecutive')}</span>
              </div>
              
              <div className="setting-item">
                <label>{t('system_config.fields.advance_notice')}</label>
                <input 
                  type="number" 
                  value={settings.advanceNoticeDays}
                  onChange={(e) => handleSettingChange('advanceNoticeDays', parseInt(e.target.value) || 0)}
                  min="0"
                  max="30"
                />
                <span className="help-text">{t('system_config.help.advance_notice')}</span>
              </div>
            </div>

            <div className="setting-row">
              <div className="setting-item">
                <label>{t('system_config.fields.max_per_year')}</label>
                <input 
                  type="number" 
                  value={settings.maxLeaveDaysPerYear}
                  onChange={(e) => handleSettingChange('maxLeaveDaysPerYear', parseInt(e.target.value) || 1)}
                  min="1"
                  max="365"
                />
                <span className="help-text">{t('system_config.help.max_per_year')}</span>
              </div>
              
              <div className="setting-item">
                <label>{t('system_config.fields.min_duration')}</label>
                <input 
                  type="number" 
                  value={settings.minLeaveDuration}
                  onChange={(e) => handleSettingChange('minLeaveDuration', parseFloat(e.target.value) || 0)}
                  min="0"
                  max="1"
                  step="0.5"
                />
                <span className="help-text">{t('system_config.help.min_duration')}</span>
              </div>
            </div>

            <div className="setting-item checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={settings.carryOverEnabled}
                  onChange={(e) => handleSettingChange('carryOverEnabled', e.target.checked)}
                />
                {t('system_config.fields.carry_over_enabled')}
              </label>
              <span className="help-text">{t('system_config.help.carry_over_enabled')}</span>
            </div>

            {settings.carryOverEnabled && (
              <div className="setting-item">
                <label>{t('system_config.fields.carry_over_limit')}</label>
                <input 
                  type="number" 
                  value={settings.carryOverLimit}
                  onChange={(e) => handleSettingChange('carryOverLimit', parseInt(e.target.value) || 0)}
                  min="0"
                  max="30"
                />
                <span className="help-text">{t('system_config.help.carry_over_limit')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Approval Settings Section */}
        <div className="config-section">
          <div className="section-header">
            <h2>✅ {t('system_config.sections.approvals.title')}</h2>
            <p>{t('system_config.sections.approvals.subtitle')}</p>
          </div>
          <div className="setting-group">
            <div className="setting-item checkbox-group">
              <label className="checkbox-label">
                <input 
                  type="checkbox" 
                  checked={settings.autoApproveEnabled}
                  onChange={(e) => handleSettingChange('autoApproveEnabled', e.target.checked)}
                />
                {t('system_config.fields.auto_approve')}
              </label>
              <span className="help-text">{t('system_config.help.auto_approve')}</span>
            </div>

            {settings.autoApproveEnabled && (
              <div className="setting-item">
                <label>{t('system_config.fields.auto_approve_max')}</label>
                <input 
                  type="number" 
                  value={settings.autoApproveMaxDays}
                  onChange={(e) => handleSettingChange('autoApproveMaxDays', parseInt(e.target.value) || 1)}
                  min="1"
                  max="7"
                />
                <span className="help-text">{t('system_config.help.auto_approve_max')}</span>
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
                  {t('system_config.fields.require_manager')}
                </label>
              </div>
              
              <div className="setting-item checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={settings.requireHRApproval}
                    onChange={(e) => handleSettingChange('requireHRApproval', e.target.checked)}
                  />
                  {t('system_config.fields.require_hr')}
                </label>
              </div>
            </div>

            <div className="setting-item">
              <label>{t('system_config.fields.approval_reminder')}</label>
              <input 
                type="number" 
                value={settings.approvalReminderHours}
                onChange={(e) => handleSettingChange('approvalReminderHours', parseInt(e.target.value) || 24)}
                min="1"
                max="168"
              />
              <span className="help-text">{t('system_config.help.approval_reminder')}</span>
            </div>
          </div>
        </div>

        {/* Notification Settings Section */}
        <div className="config-section">
          <div className="section-header">
            <h2>🔔 {t('system_config.sections.notifications.title')}</h2>
            <p>{t('system_config.sections.notifications.subtitle')}</p>
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
                  {t('system_config.fields.notify_email')}
                </label>
              </div>
              
              <div className="setting-item checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={settings.notificationSMS}
                    onChange={(e) => handleSettingChange('notificationSMS', e.target.checked)}
                  />
                  {t('system_config.fields.notify_sms')}
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
                  {t('system_config.fields.notify_managers')}
                </label>
              </div>
              
              <div className="setting-item checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={settings.hrNotifications}
                    onChange={(e) => handleSettingChange('hrNotifications', e.target.checked)}
                  />
                  {t('system_config.fields.notify_hr')}
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
                {t('system_config.fields.system_alerts')}
              </label>
              <span className="help-text">{t('system_config.help.system_alerts')}</span>
            </div>
          </div>
        </div>

        {/* System Behavior Section */}
        <div className="config-section">
          <div className="section-header">
            <h2>⚙️ {t('system_config.sections.behavior.title')}</h2>
            <p>{t('system_config.sections.behavior.subtitle')}</p>
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
                  {t('system_config.fields.allow_backdate')}
                </label>
              </div>
              
              <div className="setting-item checkbox-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={settings.allowOverlappingLeaves}
                    onChange={(e) => handleSettingChange('allowOverlappingLeaves', e.target.checked)}
                  />
                  {t('system_config.fields.allow_overlap')}
                </label>
              </div>
            </div>

            <div className="setting-item">
              <label>{t('system_config.fields.fiscal_start')}</label>
              <input 
                type="date" 
                value={settings.fiscalYearStart}
                onChange={(e) => handleSettingChange('fiscalYearStart', e.target.value)}
              />
              <span className="help-text">{t('system_config.help.fiscal_start')}</span>
            </div>

            <div className="setting-item">
              <label>{t('system_config.fields.working_days')}</label>
              <div className="checkbox-grid">
                {[
                  { value: 'monday', label: t('common.days.monday') },
                  { value: 'tuesday', label: t('common.days.tuesday') },
                  { value: 'wednesday', label: t('common.days.wednesday') },
                  { value: 'thursday', label: t('common.days.thursday') },
                  { value: 'friday', label: t('common.days.friday') },
                  { value: 'saturday', label: t('common.days.saturday') },
                  { value: 'sunday', label: t('common.days.sunday') }
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
              <span className="help-text">{t('system_config.help.working_days')}</span>
            </div>

            <div className="setting-item">
              <label>{t('system_config.fields.holiday_calendar')}</label>
              <select 
                value={settings.holidayCalendar}
                onChange={(e) => handleSettingChange('holidayCalendar', e.target.value)}
              >
                <option value="ethiopian">{t('system_config.options.calendar.ethiopian')}</option>
                <option value="gregorian">{t('system_config.options.calendar.gregorian')}</option>
                <option value="custom">{t('system_config.options.calendar.custom')}</option>
              </select>
              <span className="help-text">{t('system_config.help.holiday_calendar')}</span>
            </div>
          </div>
        </div>

        {/* UI Settings Section */}
        <div className="config-section">
          <div className="section-header">
            <h2>🎨 {t('system_config.sections.ui.title')}</h2>
            <p>{t('system_config.sections.ui.subtitle')}</p>
          </div>
          <div className="setting-group">
            <div className="setting-row">
              <div className="setting-item">
                <label>{t('system_config.fields.theme')}</label>
                <select 
                  value={settings.theme}
                  onChange={(e) => handleSettingChange('theme', e.target.value)}
                >
                  <option value="light">{t('system_config.options.theme.light')}</option>
                  <option value="dark">{t('system_config.options.theme.dark')}</option>
                  <option value="auto">{t('system_config.options.theme.auto')}</option>
                </select>
              </div>
              
              <div className="setting-item">
                <label>{t('system_config.fields.language')}</label>
                <select 
                  value={settings.language}
                  onChange={(e) => handleSettingChange('language', e.target.value)}
                >
                  <option value="en">{t('languages.en')}</option>
                  <option value="am">{t('languages.am')}</option>
                  <option value="om">{t('languages.om')}</option>
                </select>
              </div>
            </div>

            <div className="setting-item">
              <label>{t('system_config.fields.timezone')}</label>
              <select 
                value={settings.timezone}
                onChange={(e) => handleSettingChange('timezone', e.target.value)}
              >
                <option value="Africa/Addis_Ababa">{t('system_config.options.timezone.eat')}</option>
                <option value="UTC">{t('system_config.options.timezone.utc')}</option>
              </select>
              <span className="help-text">{t('system_config.help.timezone')}</span>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="config-actions">
          <div className="actions-info">
            {hasChanges && (
              <div className="changes-warning">
                ⚠️ {t('system_config.unsaved_warning')}
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
                  {t('system_config.saving')}
                </>
              ) : (
                t('system_config.save')
              )}
            </button>
            
            {hasChanges && (
              <button 
                className="discard-btn"
                onClick={discardChanges}
                disabled={saving}
              >
                {t('system_config.discard')}
              </button>
            )}
            
            <button 
              className="reset-btn"
              onClick={resetToDefaults}
              disabled={saving}
            >
              {t('system_config.reset')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemConfig;
