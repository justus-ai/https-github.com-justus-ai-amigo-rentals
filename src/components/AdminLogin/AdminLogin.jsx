import React, { useState } from 'react';
import './AdminLogin.css';

const AdminLogin = ({ onLogin, onCancel }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event) => {
    event.preventDefault();

    const success = onLogin(username, password);
    if (!success) {
      setError('Invalid username or password.');
      return;
    }
  };

  return (
    <section className='admin-login'>
      <div className='admin-login-card'>
        <h2>Super User Login</h2>
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
            <button type='submit'>Log In</button>
            <button type='button' className='secondary' onClick={onCancel}>
              Back to Website
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};

export default AdminLogin;
