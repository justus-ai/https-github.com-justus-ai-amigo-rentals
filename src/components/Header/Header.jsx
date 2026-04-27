import React from 'react';
import './Header.css';
import { House, Phone, Mail } from 'lucide-react';

const Header = ({
  brandName,
  contactPhone,
  contactEmail,
  isAuthenticated,
  isAdminMode,
  onToggleAdmin,
}) => {
  return (
    <header className="header">
      <div className='item brand'>
        <House className='icon' />
        <span>{brandName}</span>
      </div>
      <div className='item'>
        <Phone className='icon' />
        <span>Contact Us @ {contactPhone}</span>
      </div>
      <div className='item'>
        <Mail className='icon' />
        <span>Email: {contactEmail}</span>
      </div>
      <div className='item admin-item'>
        <button type='button' onClick={onToggleAdmin}>
          {isAdminMode
            ? 'Back to Listings'
            : isAuthenticated
              ? 'Open Admin'
              : 'Super User Login'}
        </button>
      </div>
    </header>
  );
};

export default Header;
