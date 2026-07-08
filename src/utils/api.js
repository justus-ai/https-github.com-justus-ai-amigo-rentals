import { API_BASE_URL } from './apiBaseUrl';

const buildUrl = (path) => `${API_BASE_URL}${path}`;

const createHttpError = (message, status) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

const request = async (path, { method = 'GET', body, token } = {}) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    // Add timeout for better mobile network handling (30 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    
    try {
      response = await fetch(buildUrl(path), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    const originHint = API_BASE_URL || window.location.origin;
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout: API at ${originHint} took too long to respond. Check your connection.`);
    }
    throw new Error(`Network error: could not reach API at ${originHint}. Check VITE_API_BASE_URL for this build.`);
  }

  const contentType = response.headers.get('content-type') || '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => ({})) : {};
  const text = isJson ? '' : await response.text().catch(() => '');
  const looksLikeHtml = !isJson && /<!doctype html>|<html[\s>]/i.test(text);

  if (!isJson && response.status === 413) {
    throw createHttpError(
      'Property media payload is too large. Re-upload media so entries are S3 links instead of embedded data URLs, then save again.',
      413
    );
  }

  if (looksLikeHtml) {
    const target = API_BASE_URL || window.location.origin;
    throw createHttpError(
      `API request reached a web page instead of JSON. Update VITE_API_BASE_URL so it points to your backend API (current: ${target}).`,
      502
    );
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload.error === 'string' && payload.error.trim()) ||
      text.trim() ||
      `Request failed (${response.status})`;
    throw createHttpError(message, response.status);
  }

  return payload;
};

export const api = {
  getProperties: () => request('/api/properties'),
  getPropertyAvailability: (propertyId, checkInDate, checkOutDate) => {
    const params = new URLSearchParams();
    if (checkInDate) {
      params.set('checkInDate', checkInDate);
    }
    if (checkOutDate) {
      params.set('checkOutDate', checkOutDate);
    }

    const suffix = params.toString() ? `?${params.toString()}` : '';
    return request(`/api/properties/${propertyId}/availability${suffix}`);
  },
  createProperty: (property, token) => request('/api/properties', { method: 'POST', body: property, token }),
  updateProperty: (propertyId, property, token) =>
    request(`/api/properties/${propertyId}`, { method: 'PUT', body: property, token }),
  deleteProperty: (propertyId, token) => request(`/api/properties/${propertyId}`, { method: 'DELETE', token }),

  getSiteContent: () => request('/api/site-content'),
  updateSiteContent: (siteContent, token) =>
    request('/api/site-content', { method: 'PUT', body: siteContent, token }),

  login: async (username, password) => {
    try {
      return await request('/api/auth/login', { method: 'POST', body: { username, password } });
    } catch (error) {
      if (error?.status === 401) {
        throw new Error('Invalid username or password.');
      }

      throw error;
    }
  },
  getSession: (token) => request('/api/auth/session', { token }),
  logout: (token) => request('/api/auth/logout', { method: 'POST', token }),

  getAdmins: (token) => request('/api/admins', { token }),
  addAdmin: (username, password, token) =>
    request('/api/admins', { method: 'POST', body: { username, password }, token }),
  changeOwnPassword: (currentPassword, newPassword, token) =>
    request('/api/admins/password', {
      method: 'PUT',
      body: { currentPassword, newPassword },
      token,
    }),
  deleteAdmin: (username, token) => request(`/api/admins/${encodeURIComponent(username)}`, { method: 'DELETE', token }),

  getPaymentConfig: () => request('/api/payments/config'),
  createBooking: (booking) => request('/api/bookings', { method: 'POST', body: booking }),
  getBooking: (bookingId) => request(`/api/bookings/${bookingId}`),
  submitEnquiry: (enquiry) => request('/api/enquiries', { method: 'POST', body: enquiry }),

  createStripeCheckoutSession: (bookingId) =>
    request('/api/payments/stripe/checkout-session', { method: 'POST', body: { bookingId } }),
  verifyStripeSession: (bookingId, sessionId) =>
    request('/api/payments/stripe/verify-session', {
      method: 'POST',
      body: { bookingId, sessionId },
    }),

  startMpesaStkPush: (bookingId, phoneNumber) =>
    request('/api/payments/mpesa/stk-push', {
      method: 'POST',
      body: { bookingId, phoneNumber },
    }),

  getAdminReconciliation: (token) => request('/api/admin/reconciliation', { token }),
  getAdminEnquiries: (token) => request('/api/admin/enquiries', { token }),
  updateEnquiryStatus: (enquiryId, status, token) =>
    request(`/api/admin/enquiries/${enquiryId}/status`, {
      method: 'PUT',
      body: { status },
      token,
    }),
  refundBookingPayment: (bookingId, reason, token) =>
    request('/api/payments/refund', {
      method: 'POST',
      body: { bookingId, reason },
      token,
    }),
};