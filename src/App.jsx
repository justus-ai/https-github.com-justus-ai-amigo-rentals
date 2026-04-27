import React, { useMemo, useState } from 'react';
import Header from './components/Header/Header';
import Title from './components/Title/Title';
import PropertyList from './components/PropertyList/PropertyList';
import Footer from './components/Footer/Footer';
import AdminLogin from './components/AdminLogin/AdminLogin';
import AdminPanel from './components/AdminPanel/AdminPanel';
import './components/App.css';
import defaultProperties from './Data/properties';

const PROPERTIES_STORAGE_KEY = 'amigo-rentals-properties';
const SITE_CONTENT_STORAGE_KEY = 'amigo-rentals-site-content';
const ADMINS_STORAGE_KEY = 'amigo-rentals-admins';
const SUPERUSER_NAME = 'justus';
const INITIAL_SUPERUSER_PASSWORD = 'Unbeatable 12345.';

const DEFAULT_SITE_CONTENT = {
  brandName: 'Amigo Rentals',
  contactPhone: '00254790443776',
  contactEmail: 'info@amigorentals.com',
  pageTitle: 'Rental Properties',
};

const loadStoredProperties = () => {
  try {
    const stored = localStorage.getItem(PROPERTIES_STORAGE_KEY);
    if (!stored) {
      return defaultProperties;
    }

    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : defaultProperties;
  } catch {
    return defaultProperties;
  }
};

const loadStoredSiteContent = () => {
  try {
    const stored = localStorage.getItem(SITE_CONTENT_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_SITE_CONTENT;
    }

    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_SITE_CONTENT,
      ...parsed,
    };
  } catch {
    return DEFAULT_SITE_CONTENT;
  }
};

const loadStoredAdmins = () => {
  const fallback = {
    [SUPERUSER_NAME]: INITIAL_SUPERUSER_PASSWORD,
  };

  try {
    const stored = localStorage.getItem(ADMINS_STORAGE_KEY);
    if (!stored) {
      return fallback;
    }

    const parsed = JSON.parse(stored);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return fallback;
    }

    if (!parsed[SUPERUSER_NAME]) {
      return {
        ...parsed,
        [SUPERUSER_NAME]: INITIAL_SUPERUSER_PASSWORD,
      };
    }

    return parsed;
  } catch {
    return fallback;
  }
};

const App = () => {
  const [properties, setProperties] = useState(loadStoredProperties);
  const [siteContent, setSiteContent] = useState(loadStoredSiteContent);
  const [admins, setAdmins] = useState(loadStoredAdmins);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState('');

  const nextId = useMemo(() => {
    const ids = properties.map((property) => Number(property.id)).filter((id) => Number.isFinite(id));
    return ids.length ? Math.max(...ids) + 1 : 1;
  }, [properties]);

  const persistProperties = (nextProperties) => {
    setProperties(nextProperties);
    localStorage.setItem(PROPERTIES_STORAGE_KEY, JSON.stringify(nextProperties));
  };

  const persistSiteContent = (nextSiteContent) => {
    setSiteContent(nextSiteContent);
    localStorage.setItem(SITE_CONTENT_STORAGE_KEY, JSON.stringify(nextSiteContent));
  };

  const persistAdmins = (nextAdmins) => {
    setAdmins(nextAdmins);
    localStorage.setItem(ADMINS_STORAGE_KEY, JSON.stringify(nextAdmins));
  };

  const handleCreateProperty = (propertyInput) => {
    const createdProperty = {
      id: nextId,
      ...propertyInput,
    };
    persistProperties([createdProperty, ...properties]);
  };

  const handleUpdateProperty = (propertyId, propertyInput) => {
    const nextProperties = properties.map((property) =>
      property.id === propertyId
        ? {
            ...property,
            ...propertyInput,
          }
        : property
    );
    persistProperties(nextProperties);
  };

  const handleDeleteProperty = (propertyId) => {
    const nextProperties = properties.filter((property) => property.id !== propertyId);
    persistProperties(nextProperties);
  };

  const handleAdminLogin = (username, password) => {
    const normalizedUsername = username.trim().toLowerCase();
    const savedPassword = admins[normalizedUsername];

    if (!savedPassword || savedPassword !== password) {
      return false;
    }

    setCurrentAdmin(normalizedUsername);
    setIsAuthenticated(true);
    setIsAdminMode(true);
    return true;
  };

  const handleAdminLogout = () => {
    setIsAuthenticated(false);
    setIsAdminMode(false);
    setCurrentAdmin('');
  };

  const handleAddAdmin = (username, password) => {
    const normalizedUsername = username.trim().toLowerCase();
    if (!normalizedUsername || !password.trim()) {
      return { ok: false, message: 'Username and password are required.' };
    }

    if (admins[normalizedUsername]) {
      return { ok: false, message: 'That admin already exists.' };
    }

    const nextAdmins = {
      ...admins,
      [normalizedUsername]: password,
    };
    persistAdmins(nextAdmins);
    return { ok: true, message: `Admin ${normalizedUsername} added.` };
  };

  const handleDeleteAdmin = (username) => {
    const normalizedUsername = username.trim().toLowerCase();
    if (normalizedUsername === SUPERUSER_NAME) {
      return { ok: false, message: 'Super user justus cannot be removed.' };
    }

    if (!admins[normalizedUsername]) {
      return { ok: false, message: 'Admin account not found.' };
    }

    const nextAdmins = { ...admins };
    delete nextAdmins[normalizedUsername];
    persistAdmins(nextAdmins);

    if (currentAdmin === normalizedUsername) {
      setIsAuthenticated(false);
      setIsAdminMode(false);
      setCurrentAdmin('');
    }

    return { ok: true, message: `Admin ${normalizedUsername} removed.` };
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
      <Title title={siteContent.pageTitle} />
      <main className='app-main'>
        {!isAdminMode && <PropertyList properties={properties} />}

        {isAdminMode && !isAuthenticated && (
          <AdminLogin
            onLogin={handleAdminLogin}
            onCancel={() => setIsAdminMode(false)}
          />
        )}

        {isAdminMode && isAuthenticated && (
          <AdminPanel
            properties={properties}
            siteContent={siteContent}
            admins={admins}
            currentAdmin={currentAdmin}
            onSaveSiteContent={persistSiteContent}
            onCreateProperty={handleCreateProperty}
            onUpdateProperty={handleUpdateProperty}
            onDeleteProperty={handleDeleteProperty}
            onAddAdmin={handleAddAdmin}
            onDeleteAdmin={handleDeleteAdmin}
            onExit={() => setIsAdminMode(false)}
            onLogout={handleAdminLogout}
          />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default App;
