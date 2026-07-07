const rawApiBaseUrl = String(import.meta.env.VITE_API_BASE_URL || '').trim();
const DEFAULT_API_BASE_URL = 'https://https-github-com-justus-ai-amigo-rentals-8cak.onrender.com';

const HOST_FALLBACK_API_BASE_URLS = {
  'amigorentals.co.ke': 'https://https-github-com-justus-ai-amigo-rentals-8cak.onrender.com',
  'www.amigorentals.co.ke': 'https://https-github-com-justus-ai-amigo-rentals-8cak.onrender.com',
};

export const resolveApiBaseUrl = () => {
  if (rawApiBaseUrl) {
    return rawApiBaseUrl;
  }

  if (typeof window === 'undefined') {
    return '';
  }

  const hostname = String(window.location.hostname || '').toLowerCase();
  if (HOST_FALLBACK_API_BASE_URLS[hostname]) {
    return HOST_FALLBACK_API_BASE_URLS[hostname];
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return '';
  }

  return DEFAULT_API_BASE_URL;
};

export const API_BASE_URL = resolveApiBaseUrl().replace(/\/$/, '');
