import React, { useEffect, useState } from 'react';
import { api } from '../../utils/api';
import './PaymentResult.css';

const PaymentResult = ({ status, bookingId, sessionId }) => {
  const [message, setMessage] = useState('Verifying payment...');

  useEffect(() => {
    const verifyPayment = async () => {
      if (status !== 'success' || !bookingId || !sessionId) {
        if (status === 'cancel') {
          setMessage('Payment was cancelled. You can retry checkout from the property page.');
          return;
        }

        setMessage('Payment details are incomplete. Please contact support if you were charged.');
        return;
      }

      try {
        const response = await api.verifyStripeSession(Number(bookingId), sessionId);
        if (response.verified) {
          setMessage('Payment successful. Your booking is confirmed.');
          return;
        }

        setMessage('Payment received but not fully confirmed yet. Please check again shortly.');
      } catch (error) {
        setMessage(error.message || 'Unable to verify payment right now.');
      }
    };

    verifyPayment();
  }, [status, bookingId, sessionId]);

  return (
    <section className='payment-result'>
      <h2>Payment Status</h2>
      <p>{message}</p>
      <a href='#/home'>Back to listings</a>
    </section>
  );
};

export default PaymentResult;
