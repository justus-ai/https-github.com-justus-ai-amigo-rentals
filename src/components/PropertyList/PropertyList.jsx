import React from 'react';
import './PropertyList.css';
import Property from './Property/Property';


const PropertyList = ({ properties, onBookProperty = () => {} }) => {
    return (
        <div className='property-list'>
        
            {properties.map((property) => (
                <Property 
                key={property.id} 
                {...property}
                onBookNow={onBookProperty}
                 />
            ))}
            </div>
    );
};

export default PropertyList;
