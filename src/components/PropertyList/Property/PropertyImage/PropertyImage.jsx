import './PropertyImage.css';

const PropertyImage = ({ image, children, onClick = () => {} }) => {
  return (
    <div
      className='property-image'
      style={{ backgroundImage: `url(${image})` }}
      onClick={onClick}
      role='button'
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </div>
  );
};

export default PropertyImage;