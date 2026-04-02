import React from 'react';
import { Bath, Bed, Maximize } from 'lucide-react';
import './Property.css';
import PropertyImage from './PropertyImage/PropertyImage';
import PropertyTypeLabel from './PropertyImage/PropertyTypeLabel/PropertyTypeLabel';
import PropertyBanner from './PropertyImage/PropertyBanner/PropertyBanner';
import IconWithText from './PropertyImage/IconWithText/IconWithText';
import PropertyAttribute from './PropertyAttribute/PropertyAttribute';

const Property = ({
  image,
  title,
  location,
  price,
  description,
  type,
  bedrooms = 3,
  bathrooms = 2,
  area = 120,
  available = true,
}) => {
  return (
    <div className='property-card'
     style={{ opacity: !available ? 0.5 : 1 }}>
    <PropertyImage image={image}>
      <PropertyTypeLabel type={type} />
      {!available && <PropertyBanner text='Occupied' />}
      <div className='property-image-meta'>
        <IconWithText icon={Bed} text={`${bedrooms} Beds`} className='overlay' />
        <IconWithText icon={Bath} text={`${bathrooms} Baths`} className='overlay' />
        <IconWithText icon={Maximize} text={`${area} m2`} className='overlay' />
      </div>
      </PropertyImage>
   
      <div className='property-details'>
        <h3>{title}</h3>
        <p>{location}</p>
        <PropertyAttribute label='Rent' value={`$${price}`} emphasize />
        <p>{description}</p>
      </div>
    </div>
  );
};

export default Property;
