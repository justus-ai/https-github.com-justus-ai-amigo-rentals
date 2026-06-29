import React, { useRef } from 'react';

const rawApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim();
const HOST_FALLBACK_API_BASE_URLS = {
  'amigorentals.co.ke': 'https://https-github-com-justus-ai-amigo-rentals-8cak.onrender.com',
  'www.amigorentals.co.ke': 'https://https-github-com-justus-ai-amigo-rentals-8cak.onrender.com',
};

const resolveApiBaseUrl = () => {
  if (rawApiBaseUrl) {
    return rawApiBaseUrl;
  }

  if (typeof window === 'undefined') {
    return '';
  }

  const hostname = String(window.location.hostname || '').toLowerCase();
  return HOST_FALLBACK_API_BASE_URLS[hostname] || '';
};

const API_BASE_URL = resolveApiBaseUrl().replace(/\/$/, '');
const AUTH_TOKEN_STORAGE_KEY = 'amigo-rentals-auth-token';

// Helper to get a pre-signed URL from your backend
async function getPresignedUrl(file) {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE_URL}/sign-s3?filename=${encodeURIComponent(file.name)}&filetype=${encodeURIComponent(file.type)}`, {
    headers,
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
}

// Upload file to S3 using the pre-signed URL
async function uploadFileToS3(file, presignedUrl) {
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error('Failed to upload to S3');
}

// Main component
const S3ImageUploader = ({ onUpload }) => {
  const fileInputRef = useRef();

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const presignedUrl = await getPresignedUrl(file);
      await uploadFileToS3(file, presignedUrl);
      // S3 public URL
      const s3Url = presignedUrl.split('?')[0];
      onUpload(s3Url);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    try {
      const presignedUrl = await getPresignedUrl(file);
      await uploadFileToS3(file, presignedUrl);
      const s3Url = presignedUrl.split('?')[0];
      onUpload(s3Url);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  };

  return (
    <div
      style={{ border: '2px dashed #aaa', padding: 16, textAlign: 'center', cursor: 'pointer' }}
      onClick={() => fileInputRef.current.click()}
      onDrop={handleDrop}
      onDragOver={e => e.preventDefault()}
    >
      <input
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={handleFileChange}
      />
      <p>Drag & drop or click to upload image</p>
    </div>
  );
};

export default S3ImageUploader;
