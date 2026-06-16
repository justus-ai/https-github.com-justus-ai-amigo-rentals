import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { formatKES } from '../../utils/currency';
import { api } from '../../utils/api';
import { trackEvent } from '../../utils/analytics';
import './BookingCheckout.css';

const stripePromiseCache = new Map();

const getStripeClient = (publishableKey) => {
  if (!publishableKey) {
    return null;
  }

  if (!stripePromiseCache.has(publishableKey)) {
    stripePromiseCache.set(publishableKey, loadStripe(publishableKey));
  }

  return stripePromiseCache.get(publishableKey);
};

const initialForm = {
  fullName: '',
  email: '',
  phoneNumber: '',
  checkInDate: '',
  checkOutDate: '',
  notes: '',
};

const CLEANING_FEE_RATE = 0.08;
const SERVICE_FEE = 1500;

const toUtcDate = (value) => {
  if (!value) {
    return null;
  }

  const [year, month, day] = String(value).split('-').map(Number);
  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
};

const getNightCount = (checkInDate, checkOutDate) => {
  const startDate = toUtcDate(checkInDate);
  const endDate = toUtcDate(checkOutDate);

  if (!startDate || !endDate) {
    return 0;
  }

  const milliseconds = endDate.getTime() - startDate.getTime();
  const nights = Math.floor(milliseconds / (24 * 60 * 60 * 1000));
  return nights > 0 ? nights : 0;
};

const formatDateLabel = (value) => {
  const date = toUtcDate(value);
  if (!date) {
    return value || 'N/A';
  }

  return date.toLocaleDateString('en-KE', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

const BookingCheckout = ({ property, onClose }) => {
  const [form, setForm] = useState(initialForm);
  const [paymentMethod, setPaymentMethod] = useState('stripe');
  const [config, setConfig] = useState({
    stripeEnabled: false,
    stripePublishableKey: '',
    mpesaEnabled: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [availability, setAvailability] = useState({
    blockedRanges: [],
    isRequestedRangeAvailable: null,
    propertyAvailable: true,
  });
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [enquiryMessage, setEnquiryMessage] = useState('');
  const [isEnquiryLoading, setIsEnquiryLoading] = useState(false);

  const quote = useMemo(() => {
    const nightlyRate = Number(property?.price || 0);
    const nights = getNightCount(form.checkInDate, form.checkOutDate);
    const effectiveNights = nights > 0 ? nights : 1;
    const subtotal = nightlyRate * effectiveNights;
    const cleaningFee = subtotal > 0 ? Math.round(subtotal * CLEANING_FEE_RATE) : 0;
    const serviceFee = subtotal > 0 ? SERVICE_FEE : 0;
    const total = subtotal + cleaningFee + serviceFee;

    return {
      nights,
      nightlyRate,
      subtotal,
      cleaningFee,
      serviceFee,
      total,
    };
  }, [form.checkInDate, form.checkOutDate, property?.price]);

  const minCheckInDate = useMemo(() => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const minCheckOutDate = useMemo(() => {
    if (!form.checkInDate) {
      return minCheckInDate;
    }

    const checkIn = toUtcDate(form.checkInDate);
    if (!checkIn) {
      return minCheckInDate;
    }

    checkIn.setUTCDate(checkIn.getUTCDate() + 1);
    const year = checkIn.getUTCFullYear();
    const month = String(checkIn.getUTCMonth() + 1).padStart(2, '0');
    const day = String(checkIn.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [form.checkInDate, minCheckInDate]);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await api.getPaymentConfig();
        setConfig({
          stripeEnabled: Boolean(response.stripeEnabled),
          stripePublishableKey: response.stripePublishableKey || '',
          mpesaEnabled: Boolean(response.mpesaEnabled),
        });

        if (response.stripeEnabled) {
          setPaymentMethod('stripe');
        } else if (response.mpesaEnabled) {
          setPaymentMethod('mpesa');
        }
      } catch {
        setMessage('Unable to load payment providers right now.');
      }
    };

    loadConfig();
  }, []);

  useEffect(() => {
    const loadAvailability = async () => {
      if (!property?.id) {
        return;
      }

      setIsCheckingAvailability(true);
      try {
        const response = await api.getPropertyAvailability(
          property.id,
          form.checkInDate,
          form.checkOutDate
        );
        setAvailability({
          blockedRanges: Array.isArray(response.blockedRanges) ? response.blockedRanges : [],
          isRequestedRangeAvailable: response.isRequestedRangeAvailable,
          propertyAvailable: Boolean(response.propertyAvailable),
        });
      } catch {
        setAvailability((previous) => ({
          ...previous,
          isRequestedRangeAvailable: null,
        }));
      } finally {
        setIsCheckingAvailability(false);
      }
    };

    loadAvailability();
  }, [property?.id, form.checkInDate, form.checkOutDate]);

  const handleInput = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const submitCheckout = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!property?.id) {
      setMessage('Please choose a property first.');
      return;
    }

    if (!form.fullName.trim() || !form.email.trim() || !form.phoneNumber.trim()) {
      setMessage('Name, email, and phone are required.');
      return;
    }

    if (availability.isRequestedRangeAvailable === false) {
      setMessage('Selected dates are unavailable. Please choose different dates.');
      return;
    }

    trackEvent('checkout_submit', {
      property_id: property.id,
      payment_method: paymentMethod,
      nights: quote.nights,
      total_amount: quote.total,
    });

    setIsLoading(true);

    try {
      const bookingResponse = await api.createBooking({
        propertyId: property.id,
        fullName: form.fullName,
        email: form.email,
        phoneNumber: form.phoneNumber,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        notes: form.notes,
      });

      const bookingId = bookingResponse.booking?.id;
      if (!bookingId) {
        throw new Error('Could not create booking.');
      }

      trackEvent('booking_created', {
        booking_id: bookingId,
        property_id: property.id,
        total_amount: quote.total,
      });

      if (paymentMethod === 'stripe') {
        const sessionResponse = await api.createStripeCheckoutSession(bookingId);
        const stripe = await getStripeClient(config.stripePublishableKey);

        if (!stripe) {
          throw new Error('Stripe is not configured.');
        }

        const result = await stripe.redirectToCheckout({
          sessionId: sessionResponse.sessionId,
        });

        if (result?.error) {
          throw new Error(result.error.message || 'Unable to redirect to Stripe checkout.');
        }

        return;
      }

      if (paymentMethod === 'mpesa') {
        const mpesaResponse = await api.startMpesaStkPush(bookingId, form.phoneNumber);
        setMessage(
          `M-Pesa request sent. Check your phone and complete PIN entry. Ref: ${mpesaResponse.checkoutRequestId || 'N/A'}`
        );
        return;
      }

      throw new Error('Please choose a payment method.');
    } catch (error) {
      setMessage(error.message || 'Checkout failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const submitEnquiry = async (event) => {
    event.preventDefault();
    setEnquiryMessage('');

    if (!property?.id) {
      setEnquiryMessage('Please choose a property first.');
      return;
    }

    if (!form.fullName.trim() || !form.email.trim()) {
      setEnquiryMessage('Name and email are required to send an enquiry.');
      return;
    }

    setIsEnquiryLoading(true);
    try {
      await api.submitEnquiry({
        propertyId: property.id,
        fullName: form.fullName,
        email: form.email,
        phoneNumber: form.phoneNumber,
        checkInDate: form.checkInDate,
        checkOutDate: form.checkOutDate,
        message: form.notes,
      });

      trackEvent('submit_enquiry', {
        property_id: property.id,
        has_dates: Boolean(form.checkInDate && form.checkOutDate),
      });

      setEnquiryMessage('Enquiry sent. Our team will contact you shortly.');
    } catch (error) {
      setEnquiryMessage(error.message || 'Unable to send enquiry right now.');
    } finally {
      setIsEnquiryLoading(false);
    }
  };

  return (
    <section className='booking-checkout' aria-labelledby='booking-checkout-title'>
      <div className='booking-checkout-head'>
        <h2 id='booking-checkout-title'>Book This Property</h2>
        <button type='button' className='secondary' onClick={onClose}>Close</button>
      </div>

      <p className='booking-subtitle'>
        {property?.title} in {property?.location} - {formatKES(quote.nightlyRate)} per night
      </p>

      <section className='booking-quote-panel' aria-label='Instant quote'>
        <h3>Instant Quote</h3>
        <p>
          {quote.nights > 0
            ? `${quote.nights} night${quote.nights === 1 ? '' : 's'} selected`
            : 'Pick check-in and check-out dates for an exact quote.'}
        </p>
        <ul>
          <li>Stay subtotal: {formatKES(quote.subtotal)}</li>
          <li>Cleaning fee: {formatKES(quote.cleaningFee)}</li>
          <li>Service fee: {formatKES(quote.serviceFee)}</li>
          <li className='booking-quote-total'>Estimated total: {formatKES(quote.total)}</li>
        </ul>
      </section>

      <section className='booking-availability-panel' aria-label='Availability calendar summary'>
        <h3>Availability Calendar</h3>
        <p>
          {isCheckingAvailability
            ? 'Checking availability...'
            : availability.isRequestedRangeAvailable === false
              ? 'Selected dates are unavailable.'
              : availability.isRequestedRangeAvailable === true
                ? 'Selected dates are currently available.'
                : availability.propertyAvailable
                  ? 'Property is open for booking. See blocked dates below.'
                  : 'Property is currently marked unavailable.'}
        </p>
        {availability.blockedRanges.length > 0 ? (
          <ul className='booking-blocked-list'>
            {availability.blockedRanges.slice(0, 6).map((range) => (
              <li key={`${range.check_in_date}-${range.check_out_date}-${range.status}`}>
                {formatDateLabel(range.check_in_date)} - {formatDateLabel(range.check_out_date)} ({range.status.replace(/_/g, ' ')})
              </li>
            ))}
          </ul>
        ) : (
          <p>No blocked dates yet.</p>
        )}
      </section>

      <form className='booking-form' onSubmit={submitCheckout}>
        <div className='booking-grid'>
          <label>
            Full Name
            <input value={form.fullName} onChange={(e) => handleInput('fullName', e.target.value)} required />
          </label>
          <label>
            Email
            <input type='email' value={form.email} onChange={(e) => handleInput('email', e.target.value)} required />
          </label>
          <label>
            Phone Number
            <input value={form.phoneNumber} onChange={(e) => handleInput('phoneNumber', e.target.value)} required placeholder='e.g. 2547XXXXXXXX' />
          </label>
          <label>
            Check-in Date
            <input
              type='date'
              value={form.checkInDate}
              min={minCheckInDate}
              onChange={(e) => handleInput('checkInDate', e.target.value)}
              required
            />
          </label>
          <label>
            Check-out Date
            <input
              type='date'
              value={form.checkOutDate}
              min={minCheckOutDate}
              onChange={(e) => handleInput('checkOutDate', e.target.value)}
              required
            />
          </label>
          <label>
            Notes
            <input value={form.notes} onChange={(e) => handleInput('notes', e.target.value)} placeholder='Any special requests' />
          </label>
        </div>

        <div className='payment-methods'>
          <span>Payment Method</span>
          <div className='payment-method-options'>
            <label>
              <input
                type='radio'
                name='payment-method'
                value='stripe'
                checked={paymentMethod === 'stripe'}
                onChange={() => {
                  setPaymentMethod('stripe');
                  trackEvent('select_payment_method', { payment_method: 'stripe' });
                }}
                disabled={!config.stripeEnabled}
              />
              Credit / Debit Card (Stripe)
            </label>
            <label>
              <input
                type='radio'
                name='payment-method'
                value='mpesa'
                checked={paymentMethod === 'mpesa'}
                onChange={() => {
                  setPaymentMethod('mpesa');
                  trackEvent('select_payment_method', { payment_method: 'mpesa' });
                }}
                disabled={!config.mpesaEnabled}
              />
              M-Pesa
            </label>
          </div>
        </div>

        {message && <p className='booking-message'>{message}</p>}
        {enquiryMessage && <p className='booking-message'>{enquiryMessage}</p>}

        <div className='booking-actions'>
          <button
            type='button'
            className='secondary'
            onClick={submitEnquiry}
            disabled={isEnquiryLoading}
          >
            {isEnquiryLoading ? 'Sending Enquiry...' : 'Send Enquiry First'}
          </button>
          <button type='submit' disabled={isLoading}>Confirm and Pay</button>
        </div>
      </form>
    </section>
  );
};

export default BookingCheckout;
