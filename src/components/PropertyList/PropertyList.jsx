import React from 'react';
import './PropertyList.css';
import Property from './Property/Property';


const PropertyList = ({ properties }) => {
    return (
        <div className='property-list'>
        
            {properties.map((property) => (
                <Property 
                key={property.id} 
                {...property}
                 />
            ))}
            </div>
    );
};

export default PropertyList;
