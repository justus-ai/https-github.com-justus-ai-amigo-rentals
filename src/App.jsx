import React, { useEffect, useState } from 'react';
import Header from './components/Header/Header';
import PropertyList from './components/PropertyList/PropertyList';
import Footer from './components/Footer/Footer';
import AdminLogin from './components/AdminLogin/AdminLogin';
import AdminPanel from './components/AdminPanel/AdminPanel';
import CommercialPages from './components/CommercialPages/CommercialPages';
import CookieBanner from './components/CookieBanner/CookieBanner';
import BookingCheckout from './components/BookingCheckout/BookingCheckout';
import PaymentResult from './components/PaymentResult/PaymentResult';
import PropertyDetailPage from './components/PropertyDetailPage/PropertyDetailPage';
import './components/App.css';
import defaultProperties from './Data/properties';
import { trackEvent, trackPageView } from './utils/analytics';
import { api } from './utils/api';

/* ── Slug utilities ── */
const slugify = (text) => {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
};

const buildPropertySlug = (property) => {
  const bedrooms = property.bedrooms ? `${property.bedrooms}-bedroom` : '';
  const type = slugify(property.type);
  const location = slugify(property.location);
  const parts = [bedrooms, type, location].filter(Boolean);
  return parts.join('-');
};

const buildPropertyUrl = (property, listingMode = 'rent') => {
  const slug = buildPropertySlug(property);
  const modeSlug = listingMode === 'buy' ? 'for-sale' : listingMode === 'rent' ? 'for-rent' : 'rent-or-sale';
  return `/property/${modeSlug}/${slug}-${property.id}`;
};

const extractPropertyIdFromSlug = (slugPart) => {
  if (!slugPart) return null;
  const lastPart = slugPart.split('-').pop();
  const id = Number(lastPart);
  return Number.isFinite(id) && id > 0 ? id : null;
};

const AUTH_TOKEN_STORAGE_KEY = 'amigo-rentals-auth-token';

const DEFAULT_SITE_CONTENT = {
  brandName: 'Amigo Rentals',
  contactPhone: '0790443776',
  contactEmail: 'info@amigorentals.com',
  pageTitle: 'Rental Properties',
};

const VALID_PAGES = new Set(['home', 'privacy', 'terms', 'refund', 'support', 'payment-result', 'property', 'login', 'admin']);

const parsePathState = () => {
  const pathname = String(window.location.pathname || '/').trim();
  const queryPart = String(window.location.search || '').replace(/^\?/, '');
  const normalizedPath = pathname === '/' ? '/home' : pathname;
  const segments = normalizedPath
    .replace(/^\//, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
  const pageName = segments[0];
  const page = VALID_PAGES.has(pageName) ? pageName : 'home';
  const params = Object.fromEntries(new URLSearchParams(queryPart));
  if (page === 'property' && segments[1]) {
    const mode = segments[1];
    if (['for-sale', 'for-rent', 'rent-or-sale'].includes(mode) && segments[2]) {
      const id = extractPropertyIdFromSlug(segments[2]);
      if (id) {
        params.id = id;
        params.mode = mode === 'for-sale' ? 'buy' : mode === 'for-rent' ? 'rent' : 'mixed';
      }
    } else {
      const id = extractPropertyIdFromSlug(segments[1]);
      if (id) {
        params.id = id;
      }
    }
  }
  return { page, params };
};

const navigateTo = (path) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
};

const migrateLegacyHashRoute = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const hash = String(window.location.hash || '').trim();
  if (!hash.startsWith('#/')) {
    return;
  }

  const route = hash.slice(1);
  window.history.replaceState({}, '', route || '/home');
};

const getStoredToken = () => localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);

const saveToken = (token) => {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  }
};

const toAdminMap = (usernames = []) =>
  usernames.reduce((result, username) => {
    result[username] = true;
    return result;
  }, {});

const getAuthUsername = (payload = {}) =>
  String(payload?.user?.username || payload?.username || payload?.admin?.username || '').trim();

const App = () => {
  const [properties, setProperties] = useState(defaultProperties);
  const [isPublicDataLoading, setIsPublicDataLoading] = useState(true);
  const [siteContent, setSiteContent] = useState(DEFAULT_SITE_CONTENT);
  const [admins, setAdmins] = useState({});
  const [authToken, setAuthToken] = useState(getStoredToken);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState('');
  const [currentPage, setCurrentPage] = useState(parsePathState().page);
  const [pageParams, setPageParams] = useState(parsePathState().params);
  const [checkoutProperty, setCheckoutProperty] = useState(null);
  const [reconciliationItems, setReconciliationItems] = useState([]);
  const [enquiryItems, setEnquiryItems] = useState([]);

  useEffect(() => {
    migrateLegacyHashRoute();

    const handleRouteChange = () => {
      const next = parsePathState();
      setCurrentPage(next.page);
      setPageParams(next.params);
    };

    // Ensure first render state matches URL after hash-route migration.
    handleRouteChange();

    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('hashchange', handleRouteChange);
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('hashchange', handleRouteChange);
    };
  }, []);

  useEffect(() => {
    trackPageView(currentPage);
  }, [currentPage]);

  const loadPublicData = async () => {
    setIsPublicDataLoading(true);

    try {
      const [propertiesResponse, siteContentResponse] = await Promise.all([
        api.getProperties(),
        api.getSiteContent(),
      ]);
      setProperties(Array.isArray(propertiesResponse.properties) ? propertiesResponse.properties : defaultProperties);
      setSiteContent({
        ...DEFAULT_SITE_CONTENT,
        ...(siteContentResponse.siteContent || {}),
      });
    } catch {
      setProperties(defaultProperties);
      setSiteContent(DEFAULT_SITE_CONTENT);
    } finally {
      setIsPublicDataLoading(false);
    }
  };

  const loadAdmins = async (token) => {
    if (!token) {
      setAdmins({});
      return false;
    }

    try {
      const response = await api.getAdmins(token);
      setAdmins(toAdminMap(response.admins || []));
      return true;
    } catch {
      setAdmins({});
      return false;
    }
  };

  const loadReconciliation = async (token) => {
    if (!token) {
      setReconciliationItems([]);
      return;
    }

    try {
      const response = await api.getAdminReconciliation(token);
      setReconciliationItems(Array.isArray(response.items) ? response.items : []);
    } catch {
      setReconciliationItems([]);
    }
  };

  const loadEnquiries = async (token) => {
    if (!token) {
      setEnquiryItems([]);
      return;
    }

    try {
      const response = await api.getAdminEnquiries(token);
      setEnquiryItems(Array.isArray(response.enquiries) ? response.enquiries : []);
    } catch {
      setEnquiryItems([]);
    }
  };

  useEffect(() => {
    loadPublicData();
  }, []);

  useEffect(() => {
    const restoreSession = async () => {
      if (!authToken) {
        return;
      }

      try {
        const response = await api.getSession(authToken);
        const username = getAuthUsername(response);
        setCurrentAdmin(username);
        setIsAuthenticated(true);
        await loadAdmins(authToken);
        await loadReconciliation(authToken);
        await loadEnquiries(authToken);
      } catch {
        saveToken(null);
        setAuthToken(null);
        setCurrentAdmin('');
        setIsAuthenticated(false);
        setAdmins({});
        setReconciliationItems([]);
        setEnquiryItems([]);
      }
    };

    restoreSession();
  }, [authToken]);

  const handleCreateProperty = async (propertyInput) => {
    const response = await api.createProperty(propertyInput, authToken);
    setProperties((previous) => [response.property, ...previous]);
  };

  const handleUpdateProperty = async (propertyId, propertyInput) => {
    const response = await api.updateProperty(propertyId, propertyInput, authToken);
    setProperties((previous) =>
      previous.map((property) => (property.id === propertyId ? response.property : property))
    );
  };

  const handleDeleteProperty = async (propertyId) => {
    await api.deleteProperty(propertyId, authToken);
    setProperties((previous) => previous.filter((property) => property.id !== propertyId));
  };

  const handleSaveSiteContent = async (nextSiteContent) => {
    const response = await api.updateSiteContent(nextSiteContent, authToken);
    setSiteContent({
      ...DEFAULT_SITE_CONTENT,
      ...(response.siteContent || {}),
    });
  };

  const handleAdminLogin = async (username, password) => {
    try {
      const response = await api.login(username, password);
      const nextToken = response.token;
      const nextAdmin = getAuthUsername(response);
      if (!nextToken) {
        return { ok: false, message: 'Login succeeded but no session token was returned.' };
      }
      setAuthToken(nextToken);
      saveToken(nextToken);
      setCurrentAdmin(nextAdmin);
      setIsAuthenticated(true);
      setIsAdminMode(true);
      await loadAdmins(nextToken);
      await loadReconciliation(nextToken);
      await loadEnquiries(nextToken);
      navigateTo('/admin');
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        message: error?.message || 'Unable to log in right now. Please try again.',
      };
    }
  };

  const handleAdminLogout = async () => {
    if (authToken) {
      try {
        await api.logout(authToken);
      } catch {
        // Ignore logout API errors and clear local state anyway.
      }
    }

    saveToken(null);
    setAuthToken(null);
    setIsAuthenticated(false);
    setIsAdminMode(false);
    setCurrentAdmin('');
    setAdmins({});
    setReconciliationItems([]);
    setEnquiryItems([]);
    navigateTo('/login');
  };

  const handleAddAdmin = async (username, password) => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername || !password.trim()) {
      return { ok: false, message: 'Username and password are required.' };
    }

    try {
      await api.addAdmin(normalizedUsername, password, authToken);
      await loadAdmins(authToken);
      return { ok: true, message: `Admin ${normalizedUsername} added.` };
    } catch (error) {
      return { ok: false, message: error.message || 'Unable to add admin.' };
    }
  };

  const handleChangeOwnPassword = async (currentPassword, newPassword) => {
    if (!currentPassword || !newPassword) {
      return { ok: false, message: 'Current password and new password are required.' };
    }

    try {
      const response = await api.changeOwnPassword(currentPassword, newPassword, authToken);
      return { ok: true, message: response.message || 'Password updated successfully.' };
    } catch (error) {
      return { ok: false, message: error.message || 'Unable to update password.' };
    }
  };

  const handleDeleteAdmin = async (username) => {
    const normalizedUsername = username.trim().toLowerCase();
    try {
      await api.deleteAdmin(normalizedUsername, authToken);
      await loadAdmins(authToken);
      return { ok: true, message: `Admin ${normalizedUsername} removed.` };
    } catch (error) {
      return { ok: false, message: error.message || 'Unable to remove admin.' };
    }
  };

  const handleRefundBooking = async (bookingId, reason) => {
    const response = await api.refundBookingPayment(bookingId, reason, authToken);
    await loadReconciliation(authToken);
    return response;
  };

  const handleRefreshEnquiries = async () => {
    await loadEnquiries(authToken);
  };

  const handleUpdateEnquiryStatus = async (enquiryId, status) => {
    const response = await api.updateEnquiryStatus(enquiryId, status, authToken);
    await loadEnquiries(authToken);
    return response;
  };

  return (
    <div className='app'>
      <Header
        brandName={siteContent.brandName}
        contactPhone={siteContent.contactPhone}
        contactEmail={siteContent.contactEmail}
        isAuthenticated={isAuthenticated}
        isAdminMode={isAdminMode}
        onToggleAdmin={() => setIsAdminMode((previous) => !previous)}
      />
      <main className='app-main'>
        {currentPage === 'login' && (
          <AdminLogin
            onLogin={handleAdminLogin}
            onCancel={() => { navigateTo('/home'); }}
          />
        )}

        {currentPage === 'admin' && !isAuthenticated && (
          <AdminLogin
            onLogin={handleAdminLogin}
            onCancel={() => { navigateTo('/home'); }}
          />
        )}

        {currentPage === 'admin' && isAuthenticated && (
          <AdminPanel
            properties={properties}
            siteContent={siteContent}
            admins={admins}
            currentAdmin={currentAdmin}
            onSaveSiteContent={handleSaveSiteContent}
            onCreateProperty={handleCreateProperty}
            onUpdateProperty={handleUpdateProperty}
            onDeleteProperty={handleDeleteProperty}
            onAddAdmin={handleAddAdmin}
            onChangeOwnPassword={handleChangeOwnPassword}
            onDeleteAdmin={handleDeleteAdmin}
            reconciliationItems={reconciliationItems}
            onRefreshReconciliation={() => loadReconciliation(authToken)}
            onRefundBooking={handleRefundBooking}
            enquiryItems={enquiryItems}
            onRefreshEnquiries={handleRefreshEnquiries}
            onUpdateEnquiryStatus={handleUpdateEnquiryStatus}
            onExit={() => { navigateTo('/home'); }}
            onLogout={handleAdminLogout}
          />
        )}

        {currentPage === 'home' && !isAdminMode && (
          <>
            {checkoutProperty && (
              <BookingCheckout
                property={checkoutProperty}
                onClose={() => setCheckoutProperty(null)}
              />
            )}
            <PropertyList
              properties={properties}
              onBookProperty={(property) => {
                trackEvent('begin_checkout', {
                  property_id: property.id,
                  property_title: property.title,
                  property_location: property.location,
                });
                setCheckoutProperty(property);
              }}
              buildPropertyUrl={buildPropertyUrl}
            />
          </>
        )}

        {currentPage === 'home' && isAdminMode && !isAuthenticated && (
          <AdminLogin
            onLogin={handleAdminLogin}
            onCancel={() => setIsAdminMode(false)}
          />
        )}

        {currentPage === 'home' && isAdminMode && isAuthenticated && (
          <AdminPanel
            properties={properties}
            siteContent={siteContent}
            admins={admins}
            currentAdmin={currentAdmin}
            onSaveSiteContent={handleSaveSiteContent}
            onCreateProperty={handleCreateProperty}
            onUpdateProperty={handleUpdateProperty}
            onDeleteProperty={handleDeleteProperty}
            onAddAdmin={handleAddAdmin}
            onChangeOwnPassword={handleChangeOwnPassword}
            onDeleteAdmin={handleDeleteAdmin}
            reconciliationItems={reconciliationItems}
            onRefreshReconciliation={() => loadReconciliation(authToken)}
            onRefundBooking={handleRefundBooking}
            enquiryItems={enquiryItems}
            onRefreshEnquiries={handleRefreshEnquiries}
            onUpdateEnquiryStatus={handleUpdateEnquiryStatus}
            onExit={() => setIsAdminMode(false)}
            onLogout={handleAdminLogout}
          />
        )}

        {currentPage === 'property' && (() => {
          const pid = pageParams.id ? Number(pageParams.id) : null;
          const found = pid ? properties.find((p) => p.id === pid) : null;
          return (
            <>
              {checkoutProperty && (
                <BookingCheckout
                  property={checkoutProperty}
                  onClose={() => setCheckoutProperty(null)}
                />
              )}
              <PropertyDetailPage
                property={found || null}
                siteContent={siteContent}
                listingMode={pageParams.mode}
                isLoading={isPublicDataLoading}
                onBookNow={(property) => {
                  trackEvent('begin_checkout', {
                    property_id: property.id,
                    property_title: property.title,
                    property_location: property.location,
                  });
                  setCheckoutProperty(property);
                }}
              />
            </>
          );
        })()}

        {currentPage === 'payment-result' && (
          <PaymentResult
            status={pageParams.status}
            bookingId={pageParams.bookingId}
            sessionId={pageParams.session_id}
          />
        )}

        {currentPage !== 'home' && currentPage !== 'payment-result' && currentPage !== 'property' && currentPage !== 'login' && currentPage !== 'admin' && (
          <CommercialPages page={currentPage} siteContent={siteContent} />
        )}
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
};

export default App;
