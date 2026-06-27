import React, { useState } from 'react';
import './AdminLogin.css';

const AdminLogin = ({ onLogin, onCancel }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const result = await Promise.resolve(onLogin(username, password));
      const success = typeof result === 'object' && result !== null ? Boolean(result.ok) : Boolean(result);
      const message = typeof result === 'object' && result !== null ? String(result.message || '').trim() : '';

      if (!success) {
        setError(message || 'Unable to sign in. Check your credentials and API connection.');
      }
    } catch {
      setError('Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className='admin-login'>
      <div className='admin-login-card'>
        <h2>Admin Login</h2>
        <p>Sign in with an admin account to manage website content.</p>

        <form onSubmit={handleSubmit} className='admin-login-form'>
          <label htmlFor='username'>Username</label>
          <input
            id='username'
            type='text'
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              if (error) {
                setError('');
              }
            }}
            placeholder='Enter username'
            autoComplete='off'
          />

          <label htmlFor='password'>Password</label>
          <input
            id='password'
            type='password'
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              if (error) {
                setError('');
              }
            }}
            placeholder='Enter password'
            autoComplete='off'
          />

          {error && <p className='admin-login-error'>{error}</p>}

          <div className='admin-login-actions'>
            <button type='submit' disabled={isSubmitting}>
              {isSubmitting ? 'Logging In...' : 'Log In'}
            </button>
            <button type='button' className='secondary' onClick={onCancel} disabled={isSubmitting}>
              Back to Website
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default AdminLogin;
