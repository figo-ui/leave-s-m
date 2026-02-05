import React, { useRef, useState } from 'react';
import { apiService } from '../../utils/api';
import type { User } from '../../types';
import './AvatarUpload.css';

interface AvatarUploadProps {
  currentAvatar?: string;
  userName: string;
  onAvatarUpdate: (user: User) => void;
  size?: 'small' | 'medium' | 'large';
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatar,
  userName,
  onAvatarUpdate,
  size = 'medium'
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const validateProfessionalPhoto = (file: File): string | null => {
    // File type validation
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      return 'Only JPG and PNG images are allowed';
    }

    // File size validation (2MB max)
    if (file.size > 2 * 1024 * 1024) {
      return 'Image size must be less than 2MB';
    }

    // File size minimum (10KB min to avoid tiny images)
    if (file.size < 10 * 1024) {
      return 'Image file is too small. Please upload a higher quality photo.';
    }

    // Check filename extension
    const fileName = file.name.toLowerCase();
    if (!fileName.match(/\.(jpg|jpeg|png)$/)) {
      return 'Invalid file type. Only JPG, JPEG, and PNG are allowed';
    }

    return null;
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Professional photo validation
    const validationError = validateProfessionalPhoto(file);
    if (validationError) {
      setError(validationError);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploading(true);
    setError('');

    try {
      const response = await apiService.uploadAvatar(file);
      if (response.success && response.data) {
        onAvatarUpdate(response.data);
        setError('');
      } else {
        setError(response.message || 'Failed to upload profile photo');
      }
    } catch (error: unknown) {
      console.error('Avatar upload error:', error);
      const message = error instanceof Error ? error.message : 'Failed to upload profile photo';
      setError(message);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = async () => {
    if (!currentAvatar) return;

    setUploading(true);
    setError('');

    try {
      const response = await apiService.deleteAvatar();
      if (response.success && response.data) {
        onAvatarUpdate(response.data);
        setError('');
      } else {
        setError(response.message || 'Failed to remove profile photo');
      }
    } catch (error: any) {
      console.error('Avatar remove error:', error);
      setError(error.message || 'Failed to remove profile photo');
    } finally {
      setUploading(false);
    }
  };

  const getAvatarUrl = (avatarPath?: string) => {
    if (!avatarPath) return null;
    if (avatarPath.startsWith('http')) return avatarPath;
    return `http://localhost:5000${avatarPath}`;
  };

  const getSizeClass = () => {
    switch (size) {
      case 'small': return 'avatar-small';
      case 'large': return 'avatar-large';
      default: return 'avatar-medium';
    }
  };

  const getInitials = () => {
    return userName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase())
      .join('')
      .slice(0, 2);
  };

  return (
    <div className="avatar-upload">
      <div className="professional-photo-guidelines">
        <h4>📸 Professional Photo Requirements</h4>
        <ul>
          <li>✅ Recent, clear headshot photo</li>
          <li>✅ Plain light-colored background</li>
          <li>✅ Professional attire</li>
          <li>✅ Face clearly visible</li>
          <li>✅ No filters or heavy editing</li>
          <li>✅ JPG or PNG format only</li>
          <li>✅ Max file size: 2MB</li>
        </ul>
      </div>

      <div className={`avatar-container ${getSizeClass()} ${uploading ? 'uploading' : ''}`}>
        {currentAvatar ? (
          <img
            src={getAvatarUrl(currentAvatar) || ''}
            alt={`${userName}'s professional photo`}
            className="avatar-image"
            onError={(e) => {
              // If image fails to load, show initials
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.remove('hidden');
            }}
          />
        ) : null}
        
        {!currentAvatar && (
          <div className="avatar-placeholder">
            {getInitials()}
          </div>
        )}
        
        <div className="avatar-overlay">
          <button
            type="button"
            className="avatar-change-btn"
            onClick={handleAvatarClick}
            disabled={uploading}
            title="Upload professional photo"
          >
            {uploading ? '⏳' : '📷'}
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      <div className="avatar-actions">
        {currentAvatar && (
          <button
            type="button"
            className="remove-avatar-btn"
            onClick={handleRemoveAvatar}
            disabled={uploading}
          >
            Remove Photo
          </button>
        )}
        
        <button
          type="button"
          className="upload-new-btn"
          onClick={handleAvatarClick}
          disabled={uploading}
        >
          {currentAvatar ? 'Change Photo' : 'Upload Photo'}
        </button>
      </div>

      {error && (
        <div className="avatar-error">
          ⚠️ {error}
        </div>
      )}

      {uploading && (
        <div className="uploading-message">
          ⏳ Uploading professional photo...
        </div>
      )}
    </div>
  );
};

export default AvatarUpload;
