import React from 'react';
import './Header.css';
import { Phone, Mail, MessageCircle } from 'lucide-react';

const Header = ({
  contactPhone,
  contactEmail,
  isAuthenticated,
  isAdminMode,
  onToggleAdmin,
}) => {
  return (
    <header className="header">
      <div className='item brand'>
        <img src="/images/amigologo.png" alt="Amigo Rentals Logo" className="logo-img-full" />
      </div>
      <div className='item'>
        <a href={`https://wa.me/${contactPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="contact-link">
          <MessageCircle className='icon' />
          <span>Chat with Anthony</span>
        </a>
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
              : 'Admin Login'}
        </button>
      </div>
    </header>
  );
};

export default Header;
