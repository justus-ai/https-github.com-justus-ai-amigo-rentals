import React from 'react';
import './Header.css';
import { Phone, Mail, MessageCircle } from 'lucide-react';

const Header = ({
  contactPhone,
  contactEmail,
  isAuthenticated,
  isAdminMode,
  onToggleAdmin,
  properties = [],
  onPropertySelect = () => {},
}) => {
  // Only show properties with image and type match
  const getTypeList = (type) =>
    properties.filter(
      (p) =>
        p.type &&
        p.image &&
        p.image.length > 0 &&
        p.type.toLowerCase().includes(type.toLowerCase())
    );

  const dropdownTypes = [
    { label: 'Bungalow', match: 'bungalow' },
    { label: 'Apartment', match: 'apartment' },
    { label: 'Cottage', match: 'cottage' },
  ];

  return (
    <header className="header">
      <div className='item brand'>
        <img src="/images/amigologo.png" alt="Amigo Rentals Logo" className="logo-img-full" />
      </div>
      <div className='item'>
        <a href={`https://wa.me/${contactPhone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="contact-link">
          <MessageCircle className='icon' />
          <span>Chat with Antony</span>
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
      <div className="property-dropdowns spaced">
        {dropdownTypes.map((dt) => (
          <div className="dropdown" key={dt.label}>
            <button className="dropbtn">{dt.label}</button>
            <div className="dropdown-content">
              {getTypeList(dt.match).length === 0 && (
                <span className="dropdown-empty">No properties</span>
              )}
              {getTypeList(dt.match).map((p) => (
                <a
                  href="#"
                  key={p.id}
                  onClick={(e) => {
                    e.preventDefault();
                    onPropertySelect(p);
                  }}
                >
                  <img src={p.image} alt={p.title} className="dropdown-img" />
                  {p.title}
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </header>
  );
};

export default Header;
