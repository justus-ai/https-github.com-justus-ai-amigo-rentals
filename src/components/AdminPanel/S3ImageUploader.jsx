import React, { useRef } from 'react';
import { API_BASE_URL } from '../../utils/apiBaseUrl';
const AUTH_TOKEN_STORAGE_KEY = 'amigo-rentals-auth-token';
const EMBEDDED_IMAGE_FALLBACK_LIMIT = 5 * 1024 * 1024;

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
    return presignedUrl.split('?')[0];
  } catch (error) {
    if (file.size > EMBEDDED_IMAGE_FALLBACK_LIMIT) {
      throw error;
    }

    return readFileAsDataUrl(file);
  }
}

// Main component
const S3ImageUploader = ({ onUpload, previewUrl = '' }) => {
  const fileInputRef = useRef();

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const imageUrl = await uploadWithFallback(file);
      onUpload(imageUrl);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (!file) return;
    try {
      const imageUrl = await uploadWithFallback(file);
      onUpload(imageUrl);
    } catch (err) {
      alert('Upload failed: ' + err.message);
    }
  };

  return (
    <div
      style={{
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
      {previewUrl ? (
        <img
          src={previewUrl}
          alt='Property preview'
          style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }}
        />
      ) : (
        <p>Drag & drop or click to upload image</p>
      )}
    </div>
  );
};

export default S3ImageUploader;
