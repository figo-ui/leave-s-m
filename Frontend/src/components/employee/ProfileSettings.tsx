import React, { useState, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './ProfileSettings.css';

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  employeeId: string;
  phoneNumber: string;
  hireDate: string;
  position: string;
  profilePicture: string;
  status: string;
}

const ProfileSettings: React.FC = () => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<UserProfile>({
    id: 1,
    name: user?.name || 'John Doe',
    email: user?.email || 'john.doe@obu.edu.et',
    role: user?.role || 'employee',
    department: user?.department || 'Computer Science',
    employeeId: 'OBU-2024-001',
    phoneNumber: '+251 91 234 5678',
    hireDate: '2023-01-15',
    position: 'Software Developer',
    profilePicture: '',
    status: 'Active'
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [activeTab, setActiveTab] = useState<'personal' | 'security'>('personal');
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  const handleProfilePictureChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setProfile(prev => ({
          ...prev,
          profilePicture: e.target?.result as string
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhoneNumberChange = (value: string) => {
    setProfile(prev => ({
      ...prev,
      phoneNumber: value
    }));
  };

  const handlePhoneNumberSave = () => {
    // Validate phone number format
    const phoneRegex = /^\+251\s?\d{2}\s?\d{3}\s?\d{4}$/;
    if (!phoneRegex.test(profile.phoneNumber)) {
      alert('Please enter a valid Ethiopian phone number (e.g., +251 91 234 5678)');
      return;
    }
    
    setIsEditingPhone(false);
    alert('Phone number updated successfully!');
  };

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      alert('New passwords do not match!');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      alert('New password must be at least 6 characters long!');
      return;
    }

    // Simulate password change
    alert('Password changed successfully!');
    setPasswordData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <div className="profile-settings">
      <div className="profile-header">
        <h1>Profile Settings</h1>
        <p>Manage your personal information and security settings</p>
      </div>

      <div className="profile-content">
        {/* Sidebar Navigation */}
        <div className="profile-sidebar">
          <div className="sidebar-section">
            <h3>Settings</h3>
            <nav className="sidebar-nav">
              <button 
                className={`nav-item ${activeTab === 'personal' ? 'active' : ''}`}
                onClick={() => setActiveTab('personal')}
              >
                👤 Personal Information
              </button>
              <button 
                className={`nav-item ${activeTab === 'security' ? 'active' : ''}`}
                onClick={() => setActiveTab('security')}
              >
                🔐 Security & Password
              </button>
            </nav>
          </div>

          <div className="sidebar-help">
            <h4>Need Help?</h4>
            <p>Contact HR department for changes to personal information.</p>
            <button className="help-btn">📞 Contact HR</button>
          </div>
        </div>

        {/* Main Content */}
        <div className="profile-main">
          {activeTab === 'personal' && (
            <div className="personal-info-section">
              <div className="section-header">
                <h2>Personal Information</h2>
                <p>View your personal details. Contact HR to update restricted information.</p>
              </div>

              {/* Profile Picture Section */}
              <div className="profile-picture-section">
                <div className="picture-container">
                  {profile.profilePicture ? (
                    <img 
                      src={profile.profilePicture} 
                      alt="Profile" 
                      className="profile-picture"
                    />
                  ) : (
                    <div className="profile-initials">
                      {getInitials(profile.name)}
                    </div>
                  )}
                  <button 
                    className="change-picture-btn"
                    onClick={triggerFileInput}
                  >
                    📷 Change Photo
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleProfilePictureChange}
                    accept="image/*"
                    style={{ display: 'none' }}
                  />
                </div>
                <div className="picture-info">
                  <h4>Profile Picture</h4>
                  <p>Upload a professional photo. Max size: 2MB</p>
                </div>
              </div>

              {/* Personal Information Grid */}
              <div className="info-grid">
                <div className="info-group">
                  <label>Full Name</label>
                  <div className="info-value readonly">
                    {profile.name}
                    <span className="readonly-badge">Read Only</span>
                  </div>
                  <div className="info-help">Contact HR to change name</div>
                </div>

                <div className="info-group">
                  <label>Email Address</label>
                  <div className="info-value readonly">
                    {profile.email}
                    <span className="readonly-badge">Read Only</span>
                  </div>
                  <div className="info-help">University email cannot be changed</div>
                </div>

                <div className="info-group">
                  <label>Employee ID</label>
                  <div className="info-value readonly">
                    {profile.employeeId}
                    <span className="readonly-badge">Read Only</span>
                  </div>
                </div>

                <div className="info-group">
                  <label>Department</label>
                  <div className="info-value readonly">
                    {profile.department}
                    <span className="readonly-badge">Read Only</span>
                  </div>
                </div>

                <div className="info-group">
                  <label>Position</label>
                  <div className="info-value readonly">
                    {profile.position}
                    <span className="readonly-badge">Read Only</span>
                  </div>
                </div>

                <div className="info-group">
                  <label>Hire Date</label>
                  <div className="info-value readonly">
                    {new Date(profile.hireDate).toLocaleDateString()}
                    <span className="readonly-badge">Read Only</span>
                  </div>
                </div>

                <div className="info-group">
                  <label>Status</label>
                  <div className="info-value">
                    <span className={`status-badge ${profile.status.toLowerCase()}`}>
                      {profile.status}
                    </span>
                  </div>
                </div>

                <div className="info-group editable">
                  <label>Phone Number</label>
                  {isEditingPhone ? (
                    <div className="edit-phone-container">
                      <input
                        type="tel"
                        value={profile.phoneNumber}
                        onChange={(e) => handlePhoneNumberChange(e.target.value)}
                        className="phone-input"
                        placeholder="+251 91 234 5678"
                      />
                      <div className="phone-actions">
                        <button 
                          className="save-btn"
                          onClick={handlePhoneNumberSave}
                        >
                          Save
                        </button>
                        <button 
                          className="cancel-btn"
                          onClick={() => {
                            setIsEditingPhone(false);
                            // Reset to original value
                            setProfile(prev => ({
                              ...prev,
                              phoneNumber: '+251 91 234 5678'
                            }));
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="info-value editable">
                      {profile.phoneNumber}
                      <button 
                        className="edit-btn"
                        onClick={() => setIsEditingPhone(true)}
                      >
                        ✏️ Edit
                      </button>
                    </div>
                  )}
                  <div className="info-help">Ethiopian format: +251 XX XXX XXXX</div>
                </div>

                <div className="info-group">
                  <label>User Role</label>
                  <div className="info-value">
                    <span className="role-badge">{profile.role}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="security-section">
              <div className="section-header">
                <h2>Security & Password</h2>
                <p>Change your password and manage security settings</p>
              </div>

              <form onSubmit={handlePasswordChange} className="password-form">
                <div className="form-group">
                  <label htmlFor="currentPassword">Current Password</label>
                  <input
                    type="password"
                    id="currentPassword"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({
                      ...prev,
                      currentPassword: e.target.value
                    }))}
                    placeholder="Enter your current password"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="newPassword">New Password</label>
                  <input
                    type="password"
                    id="newPassword"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({
                      ...prev,
                      newPassword: e.target.value
                    }))}
                    placeholder="Enter new password (min 6 characters)"
                    minLength={6}
                    required
                  />
                  <div className="password-requirements">
                    Password must be at least 6 characters long
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="confirmPassword">Confirm New Password</label>
                  <input
                    type="password"
                    id="confirmPassword"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({
                      ...prev,
                      confirmPassword: e.target.value
                    }))}
                    placeholder="Confirm your new password"
                    required
                  />
                </div>

                <div className="form-actions">
                  <button type="submit" className="change-password-btn">
                    🔒 Change Password
                  </button>
                </div>
              </form>

              <div className="security-tips">
                <h4>🔒 Security Tips</h4>
                <ul>
                  <li>Use a strong, unique password</li>
                  <li>Don't reuse passwords from other sites</li>
                  <li>Change your password regularly</li>
                  <li>Never share your password with anyone</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;