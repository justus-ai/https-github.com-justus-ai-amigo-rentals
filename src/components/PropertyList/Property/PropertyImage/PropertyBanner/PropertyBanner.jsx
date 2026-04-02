import React from 'react';
import './PropertyBanner.css';

const PropertyBanner = ({ text = 'Let Agreed' }) => {
  return (
    <div className="property-banner">
      <span>{text}</span>
    </div>
  );
};

export default PropertyBanner;
