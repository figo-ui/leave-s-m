import React, { useState } from 'react';
import './SystemConfig.css';

const SystemConfig: React.FC = () => {
  const [settings, setSettings] = useState({
    maxConsecutiveLeaves: 15,
    advanceNoticeDays: 3,
    autoApproveEnabled: false,
    notificationEmails: true,
    carryOverEnabled: true,
    carryOverLimit: 10
  });

  const handleSettingChange = (key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const saveSettings = () => {
    // In a real app, this would save to your backend
    alert('Settings saved successfully!');
  };

  return (
    <div className="system-config">
      <div className="page-header">
        <h1>System Configuration</h1>
        <p>Manage system-wide settings and preferences</p>
      </div>

      <div className="config-sections">
        <div className="config-section">
          <h2>Leave Policies</h2>
          <div className="setting-group">
            <label>
              Maximum Consecutive Leave Days
              <input 
                type="number" 
                value={settings.maxConsecutiveLeaves}
                onChange={(e) => handleSettingChange('maxConsecutiveLeaves', parseInt(e.target.value))}
              />
            </label>
            
            <label>
              Advance Notice Required (Days)
              <input 
                type="number" 
                value={settings.advanceNoticeDays}
                onChange={(e) => handleSettingChange('advanceNoticeDays', parseInt(e.target.value))}
              />
            </label>

            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={settings.carryOverEnabled}
                onChange={(e) => handleSettingChange('carryOverEnabled', e.target.checked)}
              />
              Allow Leave Carry Over
            </label>

            {settings.carryOverEnabled && (
              <label>
                Maximum Carry Over Days
                <input 
                  type="number" 
                  value={settings.carryOverLimit}
                  onChange={(e) => handleSettingChange('carryOverLimit', parseInt(e.target.value))}
                />
              </label>
            )}
          </div>
        </div>

        <div className="config-section">
          <h2>Approval Settings</h2>
          <div className="setting-group">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={settings.autoApproveEnabled}
                onChange={(e) => handleSettingChange('autoApproveEnabled', e.target.checked)}
              />
              Enable Auto-Approval for Short Leaves
            </label>
            
            <div className="help-text">
              When enabled, leaves shorter than 2 days will be automatically approved
            </div>
          </div>
        </div>

        <div className="config-section">
          <h2>Notification Settings</h2>
          <div className="setting-group">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={settings.notificationEmails}
                onChange={(e) => handleSettingChange('notificationEmails', e.target.checked)}
              />
              Send Email Notifications
            </label>
          </div>
        </div>

        <div className="config-actions">
          <button className="save-btn" onClick={saveSettings}>
            Save Configuration
          </button>
          <button className="reset-btn">
            Reset to Defaults
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemConfig;