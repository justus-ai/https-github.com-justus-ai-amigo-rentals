import React from 'react';
import './CommercialPages.css';

const policyUpdatedDate = '2026-06-10';

const CommercialPages = ({ page = 'privacy', siteContent }) => {
  const brandName = siteContent?.brandName || 'Amigo Rentals';
  const contactEmail = siteContent?.contactEmail || 'info@amigorentals.com';
  const contactPhone = siteContent?.contactPhone || '00254790443776';

  if (page === 'support') {
    return (
      <section className='commercial-page' aria-labelledby='support-title'>
        <h2 id='support-title'>Customer Support</h2>
        <p>
          Need help with a listing, booking, payment, or cancellation? Reach out and our
          support team will respond as quickly as possible.
        </p>
        <div className='commercial-card'>
          <h3>Support Channels</h3>
          <p>Email: {contactEmail}</p>
          <p>Phone: {contactPhone}</p>
          <p>Hours: Monday - Sunday, 08:00 - 20:00</p>
        </div>
        <div className='commercial-card'>
          <h3>What To Include</h3>
          <ul>
            <li>Property name or link</li>
            <li>Your booking reference number</li>
            <li>Short summary of the issue</li>
            <li>Preferred reply channel</li>
          </ul>
        </div>
      </section>
    );
  }

  if (page === 'terms') {
    return (
      <section className='commercial-page' aria-labelledby='terms-title'>
        <h2 id='terms-title'>Terms of Service</h2>
        <p className='policy-date'>Last updated: {policyUpdatedDate}</p>
        <div className='commercial-card'>
          <h3>Use of Platform</h3>
          <p>
            By using {brandName}, you agree to provide accurate booking details and use the
            platform lawfully. We may suspend accounts that abuse listings, payments, or support
            systems.
          </p>
        </div>
        <div className='commercial-card'>
          <h3>Bookings and Payments</h3>
          <p>
            Prices, fees, and taxes shown at checkout are binding once payment is confirmed.
            Bookings are only final after successful payment authorization and confirmation.
          </p>
        </div>
        <div className='commercial-card'>
          <h3>Disputes</h3>
          <p>
            For disputes, contact support first at {contactEmail}. If unresolved, disputes are
            handled under applicable local laws and venue.
          </p>
        </div>
      </section>
    );
  }

  if (page === 'refund') {
    return (
      <section className='commercial-page' aria-labelledby='refund-title'>
        <h2 id='refund-title'>Refund and Cancellation Policy</h2>
        <p className='policy-date'>Last updated: {policyUpdatedDate}</p>
        <div className='commercial-card'>
          <h3>Cancellation Windows</h3>
          <ul>
            <li>More than 7 days before check-in: full refund</li>
            <li>2 to 7 days before check-in: 50% refund</li>
            <li>Less than 48 hours before check-in: non-refundable</li>
          </ul>
        </div>
        <div className='commercial-card'>
          <h3>Refund Processing</h3>
          <p>
            Approved refunds are returned to the original payment method. Processing time depends
            on your payment provider and bank.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className='commercial-page' aria-labelledby='privacy-title'>
      <h2 id='privacy-title'>Privacy Policy</h2>
      <p className='policy-date'>Last updated: {policyUpdatedDate}</p>
      <div className='commercial-card'>
        <h3>Information We Collect</h3>
        <p>
          We collect information needed to provide listings, bookings, support, and payment
          services, including contact details and transaction records.
        </p>
      </div>
      <div className='commercial-card'>
        <h3>How We Use Data</h3>
        <p>
          Data is used to manage reservations, prevent fraud, provide customer support, and improve
          platform performance and user experience.
        </p>
      </div>
      <div className='commercial-card'>
        <h3>Your Rights</h3>
        <p>
          You can request data updates or deletion by contacting {contactEmail}. We process requests
          according to applicable privacy laws.
        </p>
      </div>
    </section>
  );
};

export default CommercialPages;