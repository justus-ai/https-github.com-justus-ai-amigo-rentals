import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { detectMediaType, getPropertyImages } from '../../utils/propertyImages';
import './PropertyGalleryModal.css';

const SWIPE_THRESHOLD = 45;

const PropertyGalleryModal = ({ property, onClose }) => {
  const images = useMemo(() => getPropertyImages(property), [property]);
  const mediaItems = useMemo(
    () => images.map((url) => ({ url, type: detectMediaType(url) })),
    [images]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);

  const goPrevious = () => {
    if (images.length <= 1) {
      return;
    }
    setActiveIndex((previous) => (previous - 1 + images.length) % images.length);
  };

  const goNext = () => {
    if (images.length <= 1) {
      return;
    }
    setActiveIndex((previous) => (previous + 1) % images.length);
  };

  useEffect(() => {
    setActiveIndex(0);
  }, [property?.id]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevious();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [images.length, onClose]);

  if (!property || mediaItems.length === 0) {
    return null;
  }

  const activeMedia = mediaItems[activeIndex] || mediaItems[0];

  const handleTouchStart = (event) => {
    setTouchStartX(event.touches[0]?.clientX ?? null);
  };

  const handleTouchEnd = (event) => {
    if (touchStartX === null) {
      return;
    }

    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
    const delta = touchEndX - touchStartX;

    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      if (delta > 0) {
        goPrevious();
      } else {
        goNext();
      }
    }

    setTouchStartX(null);
  };

  return (
    <div className='property-gallery-backdrop' role='presentation' onClick={onClose}>
      <div className='property-gallery-modal' role='dialog' aria-modal='true' aria-label={`Gallery for ${property.title}`} onClick={(event) => event.stopPropagation()}>
        <button type='button' className='property-gallery-close' onClick={onClose} aria-label='Close gallery'>
          <X size={18} />
        </button>

        <div className='property-gallery-frame' onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {activeMedia.type === 'video' ? (
            <video
              src={activeMedia.url}
              controls
              autoPlay
              muted
              playsInline
              preload='metadata'
              aria-label={`${property.title} video ${activeIndex + 1}`}
            />
          ) : (
            <img src={activeMedia.url} alt={`${property.title} image ${activeIndex + 1}`} />
          )}

          {mediaItems.length > 1 && (
            <>
              <button
                type='button'
                className='property-gallery-nav left'
                onClick={goPrevious}
                aria-label='Previous image'
              >
                <ChevronLeft size={20} />
              </button>
              <button
                type='button'
                className='property-gallery-nav right'
                onClick={goNext}
                aria-label='Next image'
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}
        </div>

        <div className='property-gallery-meta'>
          <h3>{property.title}</h3>
          <p>{property.location}</p>
          <span>
            {activeIndex + 1} / {images.length}
          </span>
        </div>

        {mediaItems.length > 1 && (
          <div className='property-gallery-thumbs'>
            {mediaItems.map((media, index) => (
              <button
                key={`${media.url}-${index}`}
                type='button'
                className={index === activeIndex ? 'is-active' : ''}
                onClick={() => setActiveIndex(index)}
                aria-label={`View image ${index + 1}`}
              >
                {media.type === 'video' ? (
                  <video src={media.url} muted playsInline preload='metadata' aria-hidden='true' />
                ) : (
                  <img src={media.url} alt='' aria-hidden='true' />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyGalleryModal;
