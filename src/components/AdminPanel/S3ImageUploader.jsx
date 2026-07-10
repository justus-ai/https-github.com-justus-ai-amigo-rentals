import React from 'react';
import { API_BASE_URL } from '../../utils/apiBaseUrl';
import { detectMediaType } from '../../utils/propertyImages';

const AUTH_TOKEN_STORAGE_KEY = 'amigo-rentals-auth-token';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB limit

// Helper to format file size for display
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Helper to detect MIME type from filename extension (for mobile compatibility)
function getMimeTypeFromFilename(filename) {
  const ext = String(filename || '').toLowerCase().split('.').pop();
  const mimeMap = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
    'bmp': 'image/bmp',
    'heic': 'image/heic',
    'heif': 'image/heif',
    'mp4': 'video/mp4',
    'mov': 'video/quicktime',
    'webm': 'video/webm',
    'm4v': 'video/x-m4v',
    '3gp': 'video/3gpp',
    '3gpp': 'video/3gpp',
  };
  return mimeMap[ext] || 'image/jpeg';
}

// Helper to get a pre-signed URL from backend.
// Returns { url: presignedUploadUrl, publicUrl: permanentStorageUrl }
async function getPresignedUrl(file) {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const filetype = file.type || getMimeTypeFromFilename(file.name);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(
      `${API_BASE_URL}/sign-s3?filename=${encodeURIComponent(file.name)}&filetype=${encodeURIComponent(filetype)}`,
      {
        headers,
        signal: controller.signal,
      }
    );

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await res.json().catch(() => ({})) : {};
    const text = isJson ? '' : await res.text().catch(() => '');
    const looksLikeHtml = !isJson && /<!doctype html>|<html[\s>]/i.test(text);

    if (looksLikeHtml) {
      throw new Error(
        `Upload signer returned a web page. Check VITE_API_BASE_URL (current: ${API_BASE_URL || window.location.origin}).`
      );
    }

    if (!res.ok) {
      const message =
        (payload && typeof payload.error === 'string' && payload.error.trim()) ||
        text.trim() ||
        'Failed to get pre-signed URL';
      throw new Error(message);
    }

    const { url, publicUrl } = payload;
    if (!url) {
      throw new Error('Upload signer response is missing a URL.');
    }

    const resolveUrl = (value) => {
      if (!value) return value;
      if (value.startsWith('/')) return `${API_BASE_URL}${value}`;
      return value;
    };

    return { url: resolveUrl(url), publicUrl: resolveUrl(publicUrl || url) };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Upload request timed out. Check your internet connection.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function uploadViaPresignedUrl(file) {
  const filetype = file.type || getMimeTypeFromFilename(file.name);
  const { url, publicUrl } = await getPresignedUrl(file);

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': filetype,
    },
    body: file,
  });

  if (!res.ok) {
    throw new Error(`S3 upload failed with status ${res.status}`);
  }

  return publicUrl;
}

// Upload file via the server proxy — server forwards to S3, no S3 CORS needed.
async function uploadViaServer(file) {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const filetype = file.type || getMimeTypeFromFilename(file.name);
  const headers = {
    'Content-Type': filetype,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 second timeout

  try {
    const url = `${API_BASE_URL}/api/upload?filename=${encodeURIComponent(file.name)}&filetype=${encodeURIComponent(filetype)}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: file,
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const data = isJson ? await res.json().catch(() => ({})) : {};

    if (!res.ok) {
      throw new Error((data && data.error) || `Upload failed with status ${res.status}`);
    }

    const { publicUrl } = data;
    if (!publicUrl) throw new Error('Server did not return a publicUrl after upload.');

    // Resolve relative URLs (local fallback) against the API origin
    return publicUrl.startsWith('/') ? `${API_BASE_URL}${publicUrl}` : publicUrl;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Upload timed out. Your file may be too large or connection is slow.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function uploadWithFallback(file) {
  try {
    return await uploadViaPresignedUrl(file);
  } catch {
    return uploadViaServer(file);
  }
}

// Main component
const S3ImageUploader = ({
  onUpload,
  previewUrl = '',
  previewUrls = [],
  multiple = false,
  maxFiles = 6,
  currentCount = 0,
  onLimitReached = () => {},
}) => {
  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file);
    if (!files.length) {
      return;
    }

    const availableSlots = multiple ? Math.max(0, maxFiles - Number(currentCount || 0)) : 1;
    if (availableSlots <= 0) {
      const message = `You can upload up to ${maxFiles} files per property.`;
      onLimitReached(message);
      alert(message);
      return;
    }

    const filesToUpload = multiple ? files.slice(0, availableSlots) : files.slice(0, 1);
    if (multiple && files.length > filesToUpload.length) {
      const message = `Only ${availableSlots} more file(s) can be added (max ${maxFiles}).`;
      onLimitReached(message);
      alert(message);
    }

    for (const file of filesToUpload) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File is too large. File size: ${formatFileSize(file.size)}. Maximum allowed: ${formatFileSize(MAX_FILE_SIZE)}.`);
        return;
      }
    }

    try {
      const urls = [];
      for (const file of filesToUpload) {
        const imageUrl = await uploadWithFallback(file);
        urls.push(imageUrl);
      }

      onUpload(multiple ? urls : urls[0]);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  };

  const handleFileChange = async (event) => {
    await uploadFiles(event.target.files);
    event.target.value = '';
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    await uploadFiles(event.dataTransfer.files);
  };

  const effectivePreviewUrls = Array.isArray(previewUrls) && previewUrls.length
    ? previewUrls
    : (previewUrl ? [previewUrl] : []);

  return (
    <div
      style={{
        position: 'relative',
        border: '2px dashed #aaa',
        height: 140,
        padding: 12,
        textAlign: 'center',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
      onDrop={handleDrop}
      onDragOver={(event) => event.preventDefault()}
    >
      <input
        type='file'
        accept='image/*,video/*,.heic,.heif'
        multiple={multiple}
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          cursor: 'pointer',
          zIndex: 3,
        }}
        onClick={(event) => {
          event.currentTarget.value = '';
        }}
        onChange={handleFileChange}
      />
      {effectivePreviewUrls.length ? (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'grid',
            gridTemplateColumns: multiple ? 'repeat(4, 1fr)' : '1fr',
            gap: 6,
          }}
        >
          {effectivePreviewUrls.slice(0, multiple ? 4 : 1).map((url, index) => {
            const mediaType = detectMediaType(url);

            if (mediaType === 'video') {
              return (
                <video
                  key={`${url}-${index}`}
                  src={url}
                  muted
                  controls
                  playsInline
                  preload='metadata'
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, background: '#000' }}
                />
              );
            }

            return (
              <img
                key={`${url}-${index}`}
                src={url}
                alt='Property preview'
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }}
              />
            );
          })}
        </div>
      ) : (
        <p>{multiple ? 'Drag & drop or click to upload photos or motion videos' : 'Drag & drop or click to upload a photo or motion video'}</p>
      )}
    </div>
  );
};

export default S3ImageUploader;
