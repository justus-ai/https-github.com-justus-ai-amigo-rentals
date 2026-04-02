import React from 'react';
import './PropertyAttribute.css';

const PropertyAttribute = ({ label, value, emphasize = false }) => {
  return (
    <div className="property-attribute">
      <span className="property-attribute-label">{label}: </span>
      <span className={emphasize ? 'property-attribute-value is-emphasized' : 'property-attribute-value'}>
        {value}
      </span>
    </div>
  );
};

export default PropertyAttribute;
