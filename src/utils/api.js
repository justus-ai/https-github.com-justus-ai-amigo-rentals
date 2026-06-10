const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000' : '');

const buildUrl = (path) => `${API_BASE_URL}${path}`;

const request = async (path, { method = 'GET', body, token } = {}) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed');
  }

  return payload;
};

export const api = {
  getProperties: () => request('/api/properties'),
  createProperty: (property, token) => request('/api/properties', { method: 'POST', body: property, token }),
  updateProperty: (propertyId, property, token) =>
    request(`/api/properties/${propertyId}`, { method: 'PUT', body: property, token }),
  deleteProperty: (propertyId, token) => request(`/api/properties/${propertyId}`, { method: 'DELETE', token }),

  getSiteContent: () => request('/api/site-content'),
  updateSiteContent: (siteContent, token) =>
    request('/api/site-content', { method: 'PUT', body: siteContent, token }),

  login: (username, password) => request('/api/auth/login', { method: 'POST', body: { username, password } }),
  getSession: (token) => request('/api/auth/session', { token }),
  logout: (token) => request('/api/auth/logout', { method: 'POST', token }),

  getAdmins: (token) => request('/api/admins', { token }),
  addAdmin: (username, password, token) =>
    request('/api/admins', { method: 'POST', body: { username, password }, token }),
  deleteAdmin: (username, token) => request(`/api/admins/${encodeURIComponent(username)}`, { method: 'DELETE', token }),

  getPaymentConfig: () => request('/api/payments/config'),
  createBooking: (booking) => request('/api/bookings', { method: 'POST', body: booking }),
  getBooking: (bookingId) => request(`/api/bookings/${bookingId}`),

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
  refundBookingPayment: (bookingId, reason, token) =>
    request('/api/payments/refund', {
      method: 'POST',
      body: { bookingId, reason },
      token,
    }),
};