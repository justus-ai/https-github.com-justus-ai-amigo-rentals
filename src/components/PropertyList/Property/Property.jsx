import React from 'react';
import { Bath, Bed, Home, Scan } from 'lucide-react';
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
  purchasePrice,
  description,
  type,
  bedrooms = 3,
  bathrooms = 2,
  area = 120,
  landSize,
  available = true,
  id,
  onBookNow = () => {},
  onOpenGallery = () => {},
  listingMode = 'rent',
  buildPropertyUrl = (p, mode) => `/property/${mode === 'buy' ? 'for-sale' : 'for-rent'}/${p.id}`,
}) => {
  const coverImage = getPrimaryPropertyImage({ images, image });
  const property = { id, title, location, price, purchasePrice, type, bedrooms, bathrooms, area, landSize, description, available };
  const detailHref = buildPropertyUrl(property, listingMode);
  const hasRentPrice = Number(price) > 0;
  const hasPurchasePrice = Number(purchasePrice) > 0;
  const canBook = available && hasRentPrice && listingMode !== 'buy';
  const hasArea = Number(area) > 0;
  const hasLandSize = Number(landSize) > 0;

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
          {hasArea && <IconWithText icon={Home} text={`${area} m²`} className='overlay' />}
          {hasLandSize && <IconWithText icon={Scan} text={`${landSize} m²`} className='overlay' />}
        </div>
      </PropertyImage>

      <a href={detailHref} className='property-details property-details--link'>
        <h3>{title}</h3>
        <p>{location}</p>
        {(hasRentPrice || hasPurchasePrice) && (
          <div className='property-price-stack'>
            {hasRentPrice && <PropertyAttribute label='Rent' value={formatKES(price)} emphasize />}
            {hasPurchasePrice && <PropertyAttribute label='Purchase' value={formatKES(purchasePrice)} emphasize />}
          </div>
        )}
        <p>{description}</p>
      </a>
      {canBook ? (
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
