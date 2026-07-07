import React from 'react';
import { API_BASE_URL } from '../../utils/apiBaseUrl';
const AUTH_TOKEN_STORAGE_KEY = 'amigo-rentals-auth-token';
const EMBEDDED_IMAGE_FALLBACK_LIMIT = 5 * 1024 * 1024;
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

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
  };
  return mimeMap[ext] || 'image/jpeg';
}

// Helper to get a pre-signed URL from your backend
async function getPresignedUrl(file) {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  
  // Use file.type if available, otherwise detect from filename (mobile fallback)
  const filetype = file.type || getMimeTypeFromFilename(file.name);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
  
  try {
    const res = await fetch(`${API_BASE_URL}/sign-s3?filename=${encodeURIComponent(file.name)}&filetype=${encodeURIComponent(filetype)}`, {
      headers,
      signal: controller.signal,
    });

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');
    const payload = isJson ? await res.json().catch(() => ({})) : {};
    const text = isJson ? '' : await res.text().catch(() => '');
    const looksLikeHtml = !isJson && /<!doctype html>|<html[\s>]/i.test(text);

    if (looksLikeHtml) {
      throw new Error(`Upload signer returned a web page. Check VITE_API_BASE_URL (current: ${API_BASE_URL || window.location.origin}).`);
    }

    if (!res.ok) {
      const message =
        (payload && typeof payload.error === 'string' && payload.error.trim()) ||
        text.trim() ||
        'Failed to get pre-signed URL';
      throw new Error(message);
    }

    const { url } = payload;
    if (!url) {
      throw new Error('Upload signer response is missing a URL.');
    }
    return url;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Upload request timed out. Check your internet connection.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Upload file to S3 using the pre-signed URL
async function uploadFileToS3(file, presignedUrl) {
  // Use detected MIME type for Content-Type header (important for mobile)
  const contentType = file.type || getMimeTypeFromFilename(file.name);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
  
  try {
    const res = await fetch(presignedUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Upload failed with status ${res.status}`);
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Upload timed out. Your file may be too large or connection is slow.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

async function uploadWithFallback(file) {
  try {
    const presignedUrl = await getPresignedUrl(file);
    await uploadFileToS3(file, presignedUrl);
    // Return the full presigned URL (with auth params) so the image can be viewed
    // Pre-signed URLs are self-authenticating and expire after a period
    return presignedUrl;
  } catch (error) {
    if (file.size > EMBEDDED_IMAGE_FALLBACK_LIMIT) {
      throw error;
    }

    return readFileAsDataUrl(file);
  }
}

// Main component
const S3ImageUploader = ({ onUpload, previewUrl = '', previewUrls = [], multiple = false }) => {
  const uploadFiles = async (fileList) => {
    const files = Array.from(fileList || []).filter((file) => file);
    if (!files.length) {
      return;
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        alert(`File is too large. File size: ${formatFileSize(file.size)}. Maximum allowed: ${formatFileSize(MAX_FILE_SIZE)}.`);
        return;
      }
    }

    try {
      const urls = [];
      for (const file of files) {
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
      onDragOver={e => e.preventDefault()}
    >
      <input
        type="file"
        accept="image/*"
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
          {effectivePreviewUrls.slice(0, multiple ? 4 : 1).map((url, index) => (
            <img
              key={`${url}-${index}`}
              src={url}
              alt='Property preview'
              style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }}
            />
          ))}
        </div>
      ) : (
        <p>{multiple ? 'Drag & drop or click to upload images' : 'Drag & drop or click to upload image'}</p>
      )}
    </div>
  );
};

export default S3ImageUploader;
