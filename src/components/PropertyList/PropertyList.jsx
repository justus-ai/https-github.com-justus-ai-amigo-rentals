import React from 'react';
import './PropertyList.css';
import Property from './Property/Property';
import { KNOWN_PROPERTY_TYPES, groupPropertiesByKnownType } from '../../utils/propertyTypes';


const PropertyList = ({ properties, onBookProperty = () => {} }) => {
    const groupedProperties = groupPropertiesByKnownType(properties);

    return (
        <div className='property-list'>

            {KNOWN_PROPERTY_TYPES.map((type) => {
                const items = groupedProperties[type] || [];
                if (items.length === 0) {
                    return null;
                }

                return (
                    <section key={type} className='property-group'>
                        <h2 className='property-group-title'>{type}</h2>
                        <div className='property-group-cards'>
                            {items.map((property) => (
                                <Property
                                    key={property.id}
                                    {...property}
                                    onBookNow={onBookProperty}
                                />
                            ))}
                        </div>
                    </section>
                );
            })}
        </div>
    );
};

export default PropertyList;
