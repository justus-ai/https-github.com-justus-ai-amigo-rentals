import React from 'react';
import './Header.css';
import { Phone, Mail, MessageCircle } from 'lucide-react';
import { KNOWN_PROPERTY_TYPES, groupPropertiesByKnownType } from '../../utils/propertyTypes';
import { getPrimaryPropertyImage } from '../../utils/propertyImages';

const Header = ({
  contactPhone,
  contactEmail,
  isAuthenticated,
  isAdminMode,
  onToggleAdmin,
  properties = [],
  onPropertySelect = () => {},
}) => {
  const groupedProperties = groupPropertiesByKnownType(properties);
  const getCoverImage = (property) => getPrimaryPropertyImage(property);

  const getTypeList = (type) =>
    (groupedProperties[type] || []).filter((property) => Boolean(getCoverImage(property)));

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
      <div className="property-dropdowns spaced">
        {KNOWN_PROPERTY_TYPES.map((type) => (
          <div className="dropdown" key={type}>
            <button className="dropbtn">{type}</button>
            <div className="dropdown-content">
              {getTypeList(type).length === 0 && (
                <span className="dropdown-empty">No properties</span>
              )}
              {getTypeList(type).map((p) => (
                <a
                  href="#"
                  key={p.id}
                  onClick={(e) => {
                    e.preventDefault();
                    onPropertySelect(p);
                  }}
                >
                  <img src={getCoverImage(p)} alt={p.title} className="dropdown-img" />
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
