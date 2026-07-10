import React, { useMemo, useState } from 'react';
import './PropertyImage.css';

const PropertyImage = ({ image, fallbackImage, alt, isInteractive = true, children, onClick = () => {} }) => {
  const resolvedFallback = fallbackImage || '/images/property-placeholder-generic.svg';
  const [currentSource, setCurrentSource] = useState(image || resolvedFallback);

  const canInteract = isInteractive && typeof onClick === 'function';
  const className = useMemo(
    () => `property-image ${canInteract ? 'is-interactive' : 'is-static'}`,
    [canInteract]
  );

  const handleImageError = () => {
    setCurrentSource(resolvedFallback);
  };

  const handleActivate = () => {
    if (!canInteract) {
      return;
    }

    onClick();
  };

  return (
    <div
      className={className}
      onClick={handleActivate}
      role={canInteract ? 'button' : 'img'}
      aria-label={canInteract ? alt : undefined}
      tabIndex={canInteract ? 0 : -1}
      onKeyDown={(event) => {
        if (canInteract && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <img src={currentSource} alt={alt} onError={handleImageError} loading='lazy' />
      {children}
    </div>
  );
};

export default PropertyImage;