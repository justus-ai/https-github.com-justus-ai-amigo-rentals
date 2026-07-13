import React, { useEffect, useMemo, useState } from 'react';
import './PropertyList.css';
import Property from './Property/Property';
import PropertyGalleryModal from './PropertyGalleryModal';
import { formatKES } from '../../utils/currency';

const LISTING_MODE = {
    BUY: 'buy',
    RENT: 'rent',
};

const LISTING_TABS = [
    { value: LISTING_MODE.RENT, label: 'Rent', primary: true },
    { value: LISTING_MODE.BUY, label: 'Buy' },
];

const hasKeyword = (value, pattern) => pattern.test(String(value || '').toLowerCase());

const inferListingModes = (property) => {
    const haystack = [property?.title, property?.description].join(' ').toLowerCase();
    const salePattern = /\b(for sale|sale|sell|selling|buy|purchase|own)\b/;
    const rentPattern = /\b(for rent|to let|rent|rental|lease|letting|let)\b/;
    const mixedPattern = /\b(rent(?:al)?\s*(?:\/|and|&|or)\s*sale|sale\s*(?:\/|and|&|or)\s*rent(?:al)?)\b/;
    const hasSale = hasKeyword(haystack, salePattern);
    const hasRent = hasKeyword(haystack, rentPattern);

    if (hasKeyword(haystack, mixedPattern)) {
        return [LISTING_MODE.BUY, LISTING_MODE.RENT];
    }

    if (hasSale && hasRent) {
        return [LISTING_MODE.BUY, LISTING_MODE.RENT];
    }

    if (hasSale) {
        return [LISTING_MODE.BUY];
    }

    if (hasRent) {
        return [LISTING_MODE.RENT];
    }

    // Default to rent so older listings without explicit wording remain visible.
    return [LISTING_MODE.RENT];
};

const normalizeLabel = (value, fallback = 'N/A') => {
    const trimmed = String(value || '').trim();
    return trimmed || fallback;
};

const toPositiveNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const formatBedroomOption = (value) => {
    if (!Number.isFinite(value) || value <= 0) {
        return 'Any';
    }

    return `${value}+`;
};

const PropertyList = ({ properties, onBookProperty = () => {}, buildPropertyUrl = (p, mode) => `#/property/${mode === 'buy' ? 'for-sale' : 'for-rent'}/${p.id}` }) => {
    const [activeProperty, setActiveProperty] = useState(null);
    const [listingMode, setListingMode] = useState(LISTING_MODE.RENT);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [selectedLocation, setSelectedLocation] = useState('all');
    const [minPrice, setMinPrice] = useState('');
    const [maxPrice, setMaxPrice] = useState('');
    const [minBedrooms, setMinBedrooms] = useState('');
    const [minBathrooms, setMinBathrooms] = useState('');
    const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
    const [isMobileViewport, setIsMobileViewport] = useState(() =>
        typeof window !== 'undefined' ? window.matchMedia('(max-width: 900px)').matches : false
    );

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const media = window.matchMedia('(max-width: 900px)');
        const updateViewport = () => setIsMobileViewport(media.matches);
        updateViewport();
        media.addEventListener('change', updateViewport);
        return () => media.removeEventListener('change', updateViewport);
    }, []);

    const baseProperties = Array.isArray(properties) ? properties : [];

    const modeMatchedProperties = useMemo(
        () =>
            baseProperties.filter((property) =>
                inferListingModes(property).includes(listingMode)
            ),
        [baseProperties, listingMode]
    );

    const typeOptions = useMemo(() => {
        const values = new Set();
        modeMatchedProperties.forEach((property) => values.add(normalizeLabel(property.type, 'Unspecified')));
        return Array.from(values).sort((a, b) => a.localeCompare(b));
    }, [modeMatchedProperties]);

    const locationOptions = useMemo(() => {
        const values = new Set();
        modeMatchedProperties.forEach((property) => values.add(normalizeLabel(property.location, 'Unknown')));
        return Array.from(values).sort((a, b) => a.localeCompare(b));
    }, [modeMatchedProperties]);

    const bedroomOptions = useMemo(() => {
        const values = new Set();
        modeMatchedProperties.forEach((property) => {
            const value = toPositiveNumber(property.bedrooms);
            if (value) {
                values.add(value);
            }
        });

        return Array.from(values).sort((a, b) => a - b);
    }, [modeMatchedProperties]);

    const bathroomOptions = useMemo(() => {
        const values = new Set();
        modeMatchedProperties.forEach((property) => {
            const value = toPositiveNumber(property.bathrooms);
            if (value) {
                values.add(value);
            }
        });

        return Array.from(values).sort((a, b) => a - b);
    }, [modeMatchedProperties]);

    const priceOptions = useMemo(() => {
        const values = new Set();
        modeMatchedProperties.forEach((property) => {
            const value = toPositiveNumber(property.price);
            if (value) {
                values.add(value);
            }
        });

        return Array.from(values).sort((a, b) => a - b);
    }, [modeMatchedProperties]);

    const filteredProperties = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const min = toPositiveNumber(minPrice);
        const max = toPositiveNumber(maxPrice);
        const minBeds = toPositiveNumber(minBedrooms);
        const minBaths = toPositiveNumber(minBathrooms);

        return modeMatchedProperties.filter((property) => {
            const type = normalizeLabel(property.type, 'Unspecified');
            const location = normalizeLabel(property.location, 'Unknown');
            const price = toPositiveNumber(property.price) || 0;
            const bedrooms = toPositiveNumber(property.bedrooms) || 0;
            const bathrooms = toPositiveNumber(property.bathrooms) || 0;

            if (selectedType !== 'all' && type !== selectedType) {
                return false;
            }

            if (selectedLocation !== 'all' && location !== selectedLocation) {
                return false;
            }

            if (min && price < min) {
                return false;
            }

            if (max && price > max) {
                return false;
            }

            if (minBeds && bedrooms < minBeds) {
                return false;
            }

            if (minBaths && bathrooms < minBaths) {
                return false;
            }

            if (!query) {
                return true;
            }

            const searchable = [property?.title, location, type, property?.description]
                .join(' ')
                .toLowerCase();
            return searchable.includes(query);
        });
    }, [
        modeMatchedProperties,
        searchTerm,
        selectedType,
        selectedLocation,
        minPrice,
        maxPrice,
        minBedrooms,
        minBathrooms,
    ]);

    const groupedFilteredProperties = useMemo(() => {
        const groups = new Map();

        filteredProperties.forEach((property) => {
            const key = normalizeLabel(property.type, 'Unspecified');
            if (!groups.has(key)) {
                groups.set(key, []);
            }

            groups.get(key).push(property);
        });

        return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right));
    }, [filteredProperties]);

    useEffect(() => {
        if (!typeOptions.includes(selectedType)) {
            setSelectedType('all');
        }
    }, [typeOptions, selectedType]);

    useEffect(() => {
        if (!locationOptions.includes(selectedLocation)) {
            setSelectedLocation('all');
        }
    }, [locationOptions, selectedLocation]);

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedType('all');
        setSelectedLocation('all');
        setMinPrice('');
        setMaxPrice('');
        setMinBedrooms('');
        setMinBathrooms('');
    };

    const filterPanelClassName = `property-filter-panel ${isFilterPanelOpen ? 'open' : ''}`;

    const renderFilterControls = (isPanel = false) => (
        <div className={`property-filter-grid ${isPanel ? 'in-panel' : ''}`}>
            <label>
                Property Type
                <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)}>
                    <option value='all'>All Types</option>
                    {typeOptions.map((type) => (
                        <option key={type} value={type}>{type}</option>
                    ))}
                </select>
            </label>

            <label>
                Location
                <select value={selectedLocation} onChange={(event) => setSelectedLocation(event.target.value)}>
                    <option value='all'>All Locations</option>
                    {locationOptions.map((location) => (
                        <option key={location} value={location}>{location}</option>
                    ))}
                </select>
            </label>

            <label>
                Min Price
                <select value={minPrice} onChange={(event) => setMinPrice(event.target.value)}>
                    <option value=''>Any</option>
                    {priceOptions.map((price) => (
                        <option key={`min-${price}`} value={price}>{formatKES(price)}</option>
                    ))}
                </select>
            </label>

            <label>
                Max Price
                <select value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)}>
                    <option value=''>Any</option>
                    {priceOptions.map((price) => (
                        <option key={`max-${price}`} value={price}>{formatKES(price)}</option>
                    ))}
                </select>
            </label>

            <label>
                Bedrooms
                <select value={minBedrooms} onChange={(event) => setMinBedrooms(event.target.value)}>
                    <option value=''>Any</option>
                    {bedroomOptions.map((value) => (
                        <option key={`beds-${value}`} value={value}>{formatBedroomOption(value)}</option>
                    ))}
                </select>
            </label>

            <label>
                Bathrooms
                <select value={minBathrooms} onChange={(event) => setMinBathrooms(event.target.value)}>
                    <option value=''>Any</option>
                    {bathroomOptions.map((value) => (
                        <option key={`baths-${value}`} value={value}>{formatBedroomOption(value)}</option>
                    ))}
                </select>
            </label>
        </div>
    );

    return (
        <div className='property-list'>
            <section className='property-filter-shell'>
                <div className='property-filter-tabs' role='tablist' aria-label='Listing mode'>
                    {LISTING_TABS.map((tab) => (
                        <button
                            key={tab.value}
                            type='button'
                            role='tab'
                            aria-selected={listingMode === tab.value}
                            className={`${listingMode === tab.value ? 'active' : ''} ${tab.primary ? 'is-primary-tab' : ''}`.trim()}
                            onClick={() => setListingMode(tab.value)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className='property-filter-search-row'>
                    <input
                        type='search'
                        value={searchTerm}
                        onChange={(event) => setSearchTerm(event.target.value)}
                        placeholder='Search by location, title, or type'
                        aria-label='Search properties'
                    />
                    <button type='button' className='ghost-btn' onClick={() => setIsFilterPanelOpen(true)}>
                        Filters
                    </button>
                    <button type='button' className='primary-btn'>
                        Search {filteredProperties.length} Properties
                    </button>
                </div>

                {!isMobileViewport && renderFilterControls()}

                <div className='property-filter-meta'>
                    <span>
                        Showing {filteredProperties.length} of {modeMatchedProperties.length} properties
                    </span>
                    <button type='button' className='link-btn' onClick={clearFilters}>Clear Filters</button>
                </div>
            </section>

            <div className={filterPanelClassName} aria-hidden={!isFilterPanelOpen}>
                <div
                    className='property-filter-backdrop'
                    onClick={() => setIsFilterPanelOpen(false)}
                    role='presentation'
                />
                <section className='property-filter-dialog' aria-label='Filters'>
                    <header>
                        <h3>Filters</h3>
                        <button type='button' onClick={() => setIsFilterPanelOpen(false)} aria-label='Close filters'>
                            ×
                        </button>
                    </header>

                    <div className='property-filter-dialog-search'>
                        <input
                            type='search'
                            value={searchTerm}
                            onChange={(event) => setSearchTerm(event.target.value)}
                            placeholder='Search properties'
                            aria-label='Search properties in filter panel'
                        />
                    </div>

                    {renderFilterControls(true)}

                    <footer>
                        <button type='button' className='link-btn' onClick={clearFilters}>Clear All</button>
                        <button type='button' className='primary-btn' onClick={() => setIsFilterPanelOpen(false)}>
                            Search {filteredProperties.length} Properties
                        </button>
                    </footer>
                </section>
            </div>

            {groupedFilteredProperties.length === 0 && (
                <section className='property-empty-state'>
                    <h2>No properties found</h2>
                    <p>Try adjusting your filters to see more results.</p>
                </section>
            )}

            {groupedFilteredProperties.map(([type, items]) => (
                <section key={type} className='property-group'>
                    <h2 className='property-group-title'>{type}</h2>
                    <div className='property-group-cards'>
                        {items.map((property) => (
                            <Property
                                key={property.id}
                                {...property}
                                onBookNow={onBookProperty}
                                onOpenGallery={() => setActiveProperty(property)}
                                listingMode={listingMode}
                                buildPropertyUrl={buildPropertyUrl}
                            />
                        ))}
                    </div>
                </section>
            ))}

            {activeProperty && (
                <PropertyGalleryModal
                    property={activeProperty}
                    onClose={() => setActiveProperty(null)}
                />
            )}
        </div>
    );
};

export default PropertyList;
