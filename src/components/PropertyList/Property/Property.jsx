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
  lat,
  lng,
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

  const whatsappLocationUrl =
    lat != null && lng != null
      ? `https://wa.me/?text=${encodeURIComponent(`📍 ${title} — ${location}\nhttps://maps.google.com/?q=${lat},${lng}`)}`
      : null;

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
        <div className='property-actions'>
          {available && (
            <button type='button' className='book-now-btn' onClick={() => onBookNow({ id, title, location, price })}>
              Book Now
            </button>
          )}
          {whatsappLocationUrl && (
            <a
              href={whatsappLocationUrl}
              target='_blank'
              rel='noopener noreferrer'
              className='whatsapp-location-btn'
              aria-label={`View ${title} location on WhatsApp`}
            >
              <svg viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'>
                <path d='M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z' />
              </svg>
              View on WhatsApp
            </a>
          )}
        </div>
      </div>
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
