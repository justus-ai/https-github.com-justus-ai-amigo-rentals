import React from 'react';
import { Bath, Bed, Maximize } from 'lucide-react';
import './Property.css';
import PropertyImage from './PropertyImage/PropertyImage';
import PropertyTypeLabel from './PropertyImage/PropertyTypeLabel/PropertyTypeLabel';
import PropertyBanner from './PropertyImage/PropertyBanner/PropertyBanner';
import IconWithText from './PropertyImage/IconWithText/IconWithText';
import PropertyAttribute from './PropertyAttribute/PropertyAttribute';
import { formatKES } from '../../../utils/currency';
import { getPrimaryPropertyImage } from '../../../utils/propertyImages';

const Property = ({
  image,
  images = [],
  title,
  location,
  price,
  description,
  type,
  bedrooms = 3,
  bathrooms = 2,
  area = 120,
  available = true,
  id,
  onBookNow = () => {},
  onOpenGallery = () => {},
  listingMode = 'rent',
  buildPropertyUrl = (p, mode) => `#/property/${mode === 'buy' ? 'for-sale' : 'for-rent'}/${p.id}`,
}) => {
  const coverImage = getPrimaryPropertyImage({ images, image });
  const property = { id, title, location, price, type, bedrooms, bathrooms, area, description, available };
  const detailHref = buildPropertyUrl(property, listingMode);

  return (
    <div
      className={`property-card ${!available ? 'is-unavailable' : ''}`.trim()}
      id={`property-${id}`}
    >
      <PropertyImage image={coverImage} onClick={onOpenGallery}>
        <PropertyTypeLabel type={type} />
        {!available && <PropertyBanner text='Occupied' />}
        <div className='property-image-meta'>
          <IconWithText icon={Bed} text={`${bedrooms} Beds`} className='overlay' />
          <IconWithText icon={Bath} text={`${bathrooms} Baths`} className='overlay' />
          <IconWithText icon={Maximize} text={`${area} m²`} className='overlay' />
        </div>
      </PropertyImage>

      <a href={detailHref} className='property-details property-details--link'>
        <h3>{title}</h3>
        <p>{location}</p>
        <PropertyAttribute label='Rent' value={formatKES(price)} emphasize />
        <p>{description}</p>
      </a>
      {available ? (
        <div className='property-actions'>
          <button
            type='button'
            className='book-now-btn'
            onClick={(e) => { e.stopPropagation(); onBookNow({ id, title, location, price }); }}
          >
            Book Now
          </button>
          <a href={detailHref} className='view-details-link'>View Details</a>
        </div>
      ) : (
        <div className='property-actions'>
          <a href={detailHref} className='view-details-link'>View Details</a>
        </div>
      )}
    </div>
  );
};

export default Property;
