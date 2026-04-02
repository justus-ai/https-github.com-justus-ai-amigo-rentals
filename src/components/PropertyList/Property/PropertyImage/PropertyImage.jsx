import './PropertyImage.css';

const PropertyImage = ({ image, children }) => {
  return (
    <div
      className='property-image'
      style={{ backgroundImage: `url(${image})` }}
    >
      {children}
    </div>
  );
};

export default PropertyImage;