import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiService, getServerOrigin } from '../../utils/api';
import type { User } from '../../types';
import { useTranslation } from 'react-i18next';
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

const defaultChecks = (t: (key: string, opts?: any) => string): CheckState => ({
  format: { status: 'idle', message: t('avatar_upload.checks.format_idle') },
  size: { status: 'idle', message: t('avatar_upload.checks.size_idle') },
  dimensions: { status: 'idle', message: t('avatar_upload.checks.dimensions_idle') },
  ratio: { status: 'idle', message: t('avatar_upload.checks.ratio_idle') }
});

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  currentAvatar,
  userName,
  onAvatarUpdate,
  size = 'medium',
  showGuidelines = true
}) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState<CheckState>(defaultChecks(t));
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [cacheBust, setCacheBust] = useState<number>(Date.now());

  useEffect(() => {
    setImageLoadFailed(false);
    setCacheBust(Date.now());
  }, [currentAvatar]);

  useEffect(() => {
    setChecks(defaultChecks(t));
  }, [t]);

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
    const nextChecks = defaultChecks(t);
    const messages: string[] = [];

    const fileTypeOk = AVATAR_RULES.allowedTypes.includes(file.type);
    nextChecks.format = {
      status: fileTypeOk ? 'pass' : 'fail',
      message: fileTypeOk
        ? t('avatar_upload.checks.format_valid')
        : t('avatar_upload.checks.format_invalid', { type: file.type || 'unknown' })
    };
    if (!fileTypeOk) messages.push(nextChecks.format.message);

    const sizeOk = file.size >= AVATAR_RULES.minSizeBytes && file.size <= AVATAR_RULES.maxSizeBytes;
    nextChecks.size = {
      status: sizeOk ? 'pass' : 'fail',
      message: sizeOk
        ? t('avatar_upload.checks.size_valid')
        : t('avatar_upload.checks.size_invalid', { sizeKb: Math.round(file.size / 1024) })
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
          ? t('avatar_upload.checks.dimensions_valid', { width, height })
          : t('avatar_upload.checks.dimensions_invalid', { width, height })
      };

      const ratio = width / height;
      const ratioOk = ratio >= AVATAR_RULES.minAspectRatio && ratio <= AVATAR_RULES.maxAspectRatio;
      nextChecks.ratio = {
        status: ratioOk ? 'pass' : 'fail',
        message: ratioOk
          ? t('avatar_upload.checks.ratio_valid')
          : t('avatar_upload.checks.ratio_invalid', { ratio: ratio.toFixed(2) })
      };

      if (!dimensionsOk) messages.push(nextChecks.dimensions.message);
      if (!ratioOk) messages.push(nextChecks.ratio.message);
    } catch {
      nextChecks.dimensions = {
        status: 'fail',
        message: t('avatar_upload.checks.dimensions_unreadable')
      };
      nextChecks.ratio = {
        status: 'fail',
        message: t('avatar_upload.checks.ratio_unreadable')
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
        return t('avatar_upload.errors.invalid_file_type');
      case 'AVATAR_FILE_TOO_LARGE':
        return t('avatar_upload.errors.file_too_large');
      case 'AVATAR_FILE_TOO_SMALL':
        return t('avatar_upload.errors.file_too_small');
      case 'AVATAR_INVALID_DIMENSIONS': {
        const width = errorData?.details?.width;
        const height = errorData?.details?.height;
        if (width && height) {
          return t('avatar_upload.errors.invalid_dimensions_with_values', { width, height });
        }
        return t('avatar_upload.errors.invalid_dimensions');
      }
      case 'AVATAR_INVALID_ASPECT_RATIO': {
        const ratio = errorData?.details?.aspectRatio;
        if (ratio) {
          return t('avatar_upload.errors.invalid_ratio_with_value', { ratio: Number(ratio).toFixed(2) });
        }
        return t('avatar_upload.errors.invalid_ratio');
      }
      default:
        return errorData?.message || t('avatar_upload.errors.upload_failed');
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
        setError(response.message || t('avatar_upload.errors.upload_failed'));
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
        setError(response.message || t('avatar_upload.errors.remove_failed'));
      }
    } catch (removeError: unknown) {
      const message = removeError instanceof Error ? removeError.message : t('avatar_upload.errors.remove_failed');
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
          <h4>{t('avatar_upload.title')}</h4>
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
            title={t('avatar_upload.actions.upload_photo')}
          >
            {uploading ? '...' : t('avatar_upload.actions.upload')}
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
            {t('avatar_upload.actions.remove_photo')}
          </button>
        )}

        <button
          type="button"
          className="upload-new-btn"
          onClick={handleAvatarClick}
          disabled={uploading}
        >
          {currentAvatar ? t('avatar_upload.actions.change_photo') : t('avatar_upload.actions.upload_photo')}
        </button>
      </div>

      {error && (
        <div className="avatar-error">
          {error}
        </div>
      )}

      {uploading && (
        <div className="uploading-message">
          {t('avatar_upload.messages.uploading')}
        </div>
      )}
    </div>
  );
};

export default AvatarUpload;
