import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiService, getServerOrigin } from '../../utils/api';
import type { User } from '../../types';
import './AvatarUpload.css';

interface AvatarUploadProps {
  currentAvatar?: string;
  userName: string;
  onAvatarUpdate: (user: User) => void;
  size?: 'small' | 'medium' | 'large';
  showGuidelines?: boolean;
}

type CheckStatus = 'idle' | 'pass' | 'fail';
type CheckKey = 'format' | 'size' | 'dimensions' | 'ratio';

type CheckState = Record<CheckKey, { status: CheckStatus; message: string }>;

const AVATAR_RULES = {
  allowedTypes: ['image/jpeg', 'image/jpg', 'image/png'],
  minSizeBytes: 10 * 1024,
  maxSizeBytes: 2 * 1024 * 1024,
  minWidth: 200,
  minHeight: 200,
  maxWidth: 2000,
  maxHeight: 2000,
  minAspectRatio: 0.8,
  maxAspectRatio: 1.25
};

const defaultChecks = (): CheckState => ({
  format: { status: 'idle', message: 'File type must be JPG or PNG.' },
  size: { status: 'idle', message: 'File size must be between 10KB and 2MB.' },
  dimensions: { status: 'idle', message: 'Dimensions must be between 200x200 and 2000x2000.' },
  ratio: { status: 'idle', message: 'Photo should be close to square (portrait/headshot).' }
});

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatar,
  userName,
  onAvatarUpdate,
  size = 'medium',
  showGuidelines = true
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState<CheckState>(defaultChecks());
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [cacheBust, setCacheBust] = useState<number>(Date.now());

  useEffect(() => {
    setImageLoadFailed(false);
    setCacheBust(Date.now());
  }, [currentAvatar]);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      const objectUrl = URL.createObjectURL(file);

      image.onload = () => {
        const width = image.naturalWidth;
        const height = image.naturalHeight;
        URL.revokeObjectURL(objectUrl);
        resolve({ width, height });
      };

      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Unable to read image dimensions.'));
      };

      image.src = objectUrl;
    });
  };

  const validateProfessionalPhoto = async (file: File): Promise<{ valid: boolean; checks: CheckState; messages: string[] }> => {
    const nextChecks = defaultChecks();
    const messages: string[] = [];

    const fileTypeOk = AVATAR_RULES.allowedTypes.includes(file.type);
    nextChecks.format = {
      status: fileTypeOk ? 'pass' : 'fail',
      message: fileTypeOk
        ? 'File type is valid.'
        : `Unsupported file type: ${file.type || 'unknown'}. Use JPG or PNG.`
    };
    if (!fileTypeOk) messages.push(nextChecks.format.message);

    const sizeOk = file.size >= AVATAR_RULES.minSizeBytes && file.size <= AVATAR_RULES.maxSizeBytes;
    nextChecks.size = {
      status: sizeOk ? 'pass' : 'fail',
      message: sizeOk
        ? 'File size is valid.'
        : `Invalid file size: ${Math.round(file.size / 1024)}KB. Allowed range is 10KB to 2048KB.`
    };
    if (!sizeOk) messages.push(nextChecks.size.message);

    try {
      const { width, height } = await getImageDimensions(file);
      const dimensionsOk =
        width >= AVATAR_RULES.minWidth &&
        height >= AVATAR_RULES.minHeight &&
        width <= AVATAR_RULES.maxWidth &&
        height <= AVATAR_RULES.maxHeight;

      nextChecks.dimensions = {
        status: dimensionsOk ? 'pass' : 'fail',
        message: dimensionsOk
          ? `Dimensions are valid (${width}x${height}).`
          : `Invalid dimensions: ${width}x${height}. Allowed range is 200x200 to 2000x2000.`
      };

      const ratio = width / height;
      const ratioOk = ratio >= AVATAR_RULES.minAspectRatio && ratio <= AVATAR_RULES.maxAspectRatio;
      nextChecks.ratio = {
        status: ratioOk ? 'pass' : 'fail',
        message: ratioOk
          ? 'Aspect ratio is valid.'
          : `Invalid aspect ratio: ${ratio.toFixed(2)}. Acceptable range is 0.80 to 1.25.`
      };

      if (!dimensionsOk) messages.push(nextChecks.dimensions.message);
      if (!ratioOk) messages.push(nextChecks.ratio.message);
    } catch {
      nextChecks.dimensions = {
        status: 'fail',
        message: 'Unable to read image dimensions. Upload a valid JPG or PNG image.'
      };
      nextChecks.ratio = {
        status: 'fail',
        message: 'Unable to validate aspect ratio because image metadata could not be read.'
      };
      messages.push(nextChecks.dimensions.message);
    }

    const valid = Object.values(nextChecks).every((item) => item.status !== 'fail');
    return { valid, checks: nextChecks, messages };
  };

  const getUploadErrorMessage = (uploadError: unknown): string => {
    const errorData = uploadError as { message?: string; code?: string; details?: any };

    switch (errorData?.code) {
      case 'AVATAR_INVALID_FILE_TYPE':
      case 'AVATAR_INVALID_EXTENSION':
        return 'Upload rejected: only JPG and PNG images are allowed.';
      case 'AVATAR_FILE_TOO_LARGE':
        return 'Upload rejected: file size must be 2MB or less.';
      case 'AVATAR_FILE_TOO_SMALL':
        return 'Upload rejected: file size is too small. Use a higher quality image.';
      case 'AVATAR_INVALID_DIMENSIONS': {
        const width = errorData?.details?.width;
        const height = errorData?.details?.height;
        if (width && height) {
          return `Upload rejected: image is ${width}x${height}. Required range is 200x200 to 2000x2000.`;
        }
        return 'Upload rejected: image dimensions are outside allowed range.';
      }
      case 'AVATAR_INVALID_ASPECT_RATIO': {
        const ratio = errorData?.details?.aspectRatio;
        if (ratio) {
          return `Upload rejected: aspect ratio ${Number(ratio).toFixed(2)} is outside 0.80 to 1.25.`;
        }
        return 'Upload rejected: image aspect ratio is outside allowed range.';
      }
      default:
        return errorData?.message || 'Failed to upload profile photo.';
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = await validateProfessionalPhoto(file);
    setChecks(validation.checks);

    if (!validation.valid) {
      setError(validation.messages.join(' '));
      if (fileInputRef.current) fileInputRef.current.value = '';
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
        setError(response.message || 'Failed to upload profile photo.');
      }
    } catch (uploadError: unknown) {
      console.error('Avatar upload error:', uploadError);
      setError(getUploadErrorMessage(uploadError));
    } finally {
      setUploading(false);
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
      } else {
        setError(response.message || 'Failed to remove profile photo.');
      }
    } catch (removeError: unknown) {
      const message = removeError instanceof Error ? removeError.message : 'Failed to remove profile photo.';
      setError(message);
    } finally {
      setUploading(false);
    }
  };

  const getAvatarUrl = (avatarPath?: string) => {
    if (!avatarPath) return null;
    if (avatarPath.startsWith('http')) return avatarPath;
    return `${getServerOrigin()}${avatarPath}`;
  };

  const avatarSrc = useMemo(() => {
    const url = getAvatarUrl(currentAvatar);
    if (!url) return null;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}v=${cacheBust}`;
  }, [currentAvatar, cacheBust]);

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
      {showGuidelines && (
        <div className="professional-photo-guidelines">
          <h4>Photo upload criteria</h4>
          <ul className="validation-checklist">
            {Object.entries(checks).map(([key, value]) => (
              <li key={key} className={`check-item check-${value.status}`}>
                <span className="check-dot" aria-hidden="true"></span>
                <span>{value.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={`avatar-container ${getSizeClass()} ${uploading ? 'uploading' : ''}`}>
        {currentAvatar && !imageLoadFailed ? (
          <img
            key={avatarSrc || currentAvatar}
            src={avatarSrc || ''}
            alt={`${userName}'s profile photo`}
            className="avatar-image"
            onLoad={() => setImageLoadFailed(false)}
            onError={() => setImageLoadFailed(true)}
          />
        ) : null}

        {(!currentAvatar || imageLoadFailed) && (
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
            title="Upload photo"
          >
            {uploading ? '...' : 'Upload'}
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
          {error}
        </div>
      )}

      {uploading && (
        <div className="uploading-message">
          Uploading photo...
        </div>
      )}
    </div>
  );
};

export default AvatarUpload;
