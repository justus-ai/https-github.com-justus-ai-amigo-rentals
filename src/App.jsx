import React, { useEffect, useState } from 'react';
import Header from './components/Header/Header';
import Title from './components/Title/Title';
import PropertyList from './components/PropertyList/PropertyList';
import Footer from './components/Footer/Footer';
import AdminLogin from './components/AdminLogin/AdminLogin';
import AdminPanel from './components/AdminPanel/AdminPanel';
import CommercialPages from './components/CommercialPages/CommercialPages';
import CookieBanner from './components/CookieBanner/CookieBanner';
import BookingCheckout from './components/BookingCheckout/BookingCheckout';
import PaymentResult from './components/PaymentResult/PaymentResult';
import './components/App.css';
import defaultProperties from './Data/properties';
import { trackEvent, trackPageView } from './utils/analytics';
import { api } from './utils/api';

const AUTH_TOKEN_STORAGE_KEY = 'amigo-rentals-auth-token';

const DEFAULT_SITE_CONTENT = {
  brandName: 'Amigo Rentals',
  contactPhone: '00254790443776',
  contactEmail: 'info@amigorentals.com',
  pageTitle: 'Rental Properties',
};

const VALID_PAGES = new Set(['home', 'privacy', 'terms', 'refund', 'support', 'payment-result']);

const parseHashState = () => {
  const hash = window.location.hash || '#/home';
  const [routePart, queryPart = ''] = hash.replace('#/', '').split('?');
  const normalizedPage = String(routePart || 'home').trim().toLowerCase();
  const page = VALID_PAGES.has(normalizedPage) ? normalizedPage : 'home';
  const params = Object.fromEntries(new URLSearchParams(queryPart));

  return { page, params };
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
  const [siteContent, setSiteContent] = useState(DEFAULT_SITE_CONTENT);
  const [admins, setAdmins] = useState({});
  const [authToken, setAuthToken] = useState(getStoredToken);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState('');
  const [currentPage, setCurrentPage] = useState(parseHashState().page);
  const [pageParams, setPageParams] = useState(parseHashState().params);
  const [checkoutProperty, setCheckoutProperty] = useState(null);
  const [reconciliationItems, setReconciliationItems] = useState([]);
  const [enquiryItems, setEnquiryItems] = useState([]);

  useEffect(() => {
    const handleHashChange = () => {
      const next = parseHashState();
      setCurrentPage(next.page);
      setPageParams(next.params);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    trackPageView(currentPage);
  }, [currentPage]);

  const loadPublicData = async () => {
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
        properties={properties}
        onPropertySelect={(property) => {
          // Scroll to property card or filter, for now just highlight
          const el = document.getElementById(`property-${property.id}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('highlight-property');
            setTimeout(() => el.classList.remove('highlight-property'), 2000);
          }
        }}
      />
      <Title title={currentPage === 'home' ? siteContent.pageTitle : 'Customer Information'} />
      <main className='app-main'>
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

        {currentPage === 'payment-result' && (
          <PaymentResult
            status={pageParams.status}
            bookingId={pageParams.bookingId}
            sessionId={pageParams.session_id}
          />
        )}

        {currentPage !== 'home' && currentPage !== 'payment-result' && (
          <CommercialPages page={currentPage} siteContent={siteContent} />
        )}
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
};

export default App;
