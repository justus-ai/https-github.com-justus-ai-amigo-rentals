import React, { useRef } from 'react';

const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL || '').trim();
const AUTH_TOKEN_STORAGE_KEY = 'amigo-rentals-auth-token';

// Helper to get a pre-signed URL from your backend
async function getPresignedUrl(file) {
  const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE_URL}/sign-s3?filename=${encodeURIComponent(file.name)}&filetype=${encodeURIComponent(file.type)}`, {
    headers,
  });
  if (!res.ok) throw new Error('Failed to get pre-signed URL');
  const { url } = await res.json();
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
