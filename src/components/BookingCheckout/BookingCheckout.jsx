import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { formatKES } from '../../utils/currency';
import { api } from '../../utils/api';
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

  const estimatedTotal = useMemo(() => Number(property?.price || 0), [property?.price]);

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

  return (
    <section className='booking-checkout' aria-labelledby='booking-checkout-title'>
      <div className='booking-checkout-head'>
        <h2 id='booking-checkout-title'>Book This Property</h2>
        <button type='button' className='secondary' onClick={onClose}>Close</button>
      </div>

      <p className='booking-subtitle'>
        {property?.title} in {property?.location} - {formatKES(estimatedTotal)}
      </p>

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
            <input type='date' value={form.checkInDate} onChange={(e) => handleInput('checkInDate', e.target.value)} required />
          </label>
          <label>
            Check-out Date
            <input type='date' value={form.checkOutDate} onChange={(e) => handleInput('checkOutDate', e.target.value)} required />
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
                onChange={() => setPaymentMethod('stripe')}
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
                onChange={() => setPaymentMethod('mpesa')}
                disabled={!config.mpesaEnabled}
              />
              M-Pesa
            </label>
          </div>
        </div>

        {message && <p className='booking-message'>{message}</p>}

        <div className='booking-actions'>
          <button type='submit' disabled={isLoading}>Confirm and Pay</button>
        </div>
      </form>
    </section>
  );
};

export default BookingCheckout;
