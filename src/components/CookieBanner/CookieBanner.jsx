import React, { useState } from 'react';
import './CookieBanner.css';

const COOKIE_CONSENT_KEY = 'amigo-rentals-cookie-consent';

const getInitialConsent = () => {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    return 'accepted';
  }
};

const CookieBanner = () => {
  const [consent, setConsent] = useState(getInitialConsent);

  const updateConsent = (nextValue) => {
    setConsent(nextValue);
    localStorage.setItem(COOKIE_CONSENT_KEY, nextValue);
  };

  if (consent) {
    return null;
  }

  return (
    <aside className='cookie-banner' aria-live='polite'>
      <p>
        We use cookies for core site performance and optional analytics. Read our{' '}
        <a href='#/privacy'>Privacy Policy</a>.
      </p>
      <div className='cookie-actions'>
        <button type='button' onClick={() => updateConsent('accepted')}>Accept</button>
        <button type='button' className='secondary' onClick={() => updateConsent('essential-only')}>
          Essential Only
        </button>
      </div>
    </aside>
  );
};

export default CookieBanner;