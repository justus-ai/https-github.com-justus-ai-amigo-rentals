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

const getPriceForMode = (property, mode) => {
    if (mode === LISTING_MODE.BUY) {
        return toPositiveNumber(property?.purchasePrice);
    }

    return toPositiveNumber(property?.price);
};

const inferListingModes = (property) => {
    const hasBuyPrice = toPositiveNumber(property?.purchasePrice);
    const hasRentPrice = toPositiveNumber(property?.price);
    const modes = [];

    if (hasRentPrice) {
        modes.push(LISTING_MODE.RENT);
    }

    if (hasBuyPrice) {
        modes.push(LISTING_MODE.BUY);
    }

    if (modes.length) {
        return modes;
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

const PropertyList = ({ properties, onBookProperty = () => {}, buildPropertyUrl = (p, mode) => `/property/${mode === 'buy' ? 'for-sale' : 'for-rent'}/${p.id}` }) => {
    const [activeProperty, setActiveProperty] = useState(null);
    const [listingMode, setListingMode] = useState(LISTING_MODE.RENT);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedType, setSelectedType] = useState('all');
    const [selectedLocation, setSelectedLocation] = useState('all');
    const [minRentPrice, setMinRentPrice] = useState('');
    const [maxRentPrice, setMaxRentPrice] = useState('');
    const [minPurchasePrice, setMinPurchasePrice] = useState('');
    const [maxPurchasePrice, setMaxPurchasePrice] = useState('');
    const [minFloorSize, setMinFloorSize] = useState('');
    const [maxFloorSize, setMaxFloorSize] = useState('');
    const [minLandSize, setMinLandSize] = useState('');
    const [maxLandSize, setMaxLandSize] = useState('');
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

    const rentPriceOptions = useMemo(() => {
        const values = new Set();
        modeMatchedProperties.forEach((property) => {
            const value = toPositiveNumber(property.price);
            if (value) {
                values.add(value);
            }
        });

        return Array.from(values).sort((a, b) => a - b);
    }, [modeMatchedProperties]);

    const purchasePriceOptions = useMemo(() => {
        const values = new Set();
        modeMatchedProperties.forEach((property) => {
            const value = toPositiveNumber(property.purchasePrice);
            if (value) {
                values.add(value);
            }
        });

        return Array.from(values).sort((a, b) => a - b);
    }, [modeMatchedProperties]);

    const floorSizeOptions = useMemo(() => {
        const values = new Set();
        modeMatchedProperties.forEach((property) => {
            const value = toPositiveNumber(property.area);
            if (value) {
                values.add(value);
            }
        });

        return Array.from(values).sort((a, b) => a - b);
    }, [modeMatchedProperties]);

    const landSizeOptions = useMemo(() => {
        const values = new Set();
        modeMatchedProperties.forEach((property) => {
            const value = toPositiveNumber(property.landSize);
            if (value) {
                values.add(value);
            }
        });

        return Array.from(values).sort((a, b) => a - b);
    }, [modeMatchedProperties]);

    const filteredProperties = useMemo(() => {
        const query = searchTerm.trim().toLowerCase();
        const minRent = toPositiveNumber(minRentPrice);
        const maxRent = toPositiveNumber(maxRentPrice);
        const minPurchase = toPositiveNumber(minPurchasePrice);
        const maxPurchase = toPositiveNumber(maxPurchasePrice);
        const minFloor = toPositiveNumber(minFloorSize);
        const maxFloor = toPositiveNumber(maxFloorSize);
        const minLand = toPositiveNumber(minLandSize);
        const maxLand = toPositiveNumber(maxLandSize);
        const minBeds = toPositiveNumber(minBedrooms);
        const minBaths = toPositiveNumber(minBathrooms);

        return modeMatchedProperties.filter((property) => {
            const type = normalizeLabel(property.type, 'Unspecified');
            const location = normalizeLabel(property.location, 'Unknown');
            const rentPrice = toPositiveNumber(property.price) || 0;
            const purchasePrice = toPositiveNumber(property.purchasePrice) || 0;
            const floorSize = toPositiveNumber(property.area) || 0;
            const landSize = toPositiveNumber(property.landSize) || 0;
            const bedrooms = toPositiveNumber(property.bedrooms) || 0;
            const bathrooms = toPositiveNumber(property.bathrooms) || 0;

            if (selectedType !== 'all' && type !== selectedType) {
                return false;
            }

            if (selectedLocation !== 'all' && location !== selectedLocation) {
                return false;
            }

            if (minRent && rentPrice < minRent) {
                return false;
            }

            if (maxRent && rentPrice > maxRent) {
                return false;
            }

            if (minPurchase && purchasePrice < minPurchase) {
                return false;
            }

            if (maxPurchase && purchasePrice > maxPurchase) {
                return false;
            }

            if (minFloor && floorSize < minFloor) {
                return false;
            }

            if (maxFloor && floorSize > maxFloor) {
                return false;
            }

            if (minLand && landSize < minLand) {
                return false;
            }

            if (maxLand && landSize > maxLand) {
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
        minRentPrice,
        maxRentPrice,
        minPurchasePrice,
        maxPurchasePrice,
        minFloorSize,
        maxFloorSize,
        minLandSize,
        maxLandSize,
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
        setMinRentPrice('');
        setMaxRentPrice('');
        setMinPurchasePrice('');
        setMaxPurchasePrice('');
        setMinFloorSize('');
        setMaxFloorSize('');
        setMinLandSize('');
        setMaxLandSize('');
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
                Min Rent Price
                <select value={minRentPrice} onChange={(event) => setMinRentPrice(event.target.value)}>
                    <option value=''>Any</option>
                    {rentPriceOptions.map((price) => (
                        <option key={`min-rent-${price}`} value={price}>{formatKES(price)}</option>
                    ))}
                </select>
            </label>

            <label>
                Max Rent Price
                <select value={maxRentPrice} onChange={(event) => setMaxRentPrice(event.target.value)}>
                    <option value=''>Any</option>
                    {rentPriceOptions.map((price) => (
                        <option key={`max-rent-${price}`} value={price}>{formatKES(price)}</option>
                    ))}
                </select>
            </label>

            <label>
                Min Purchase Price
                <select value={minPurchasePrice} onChange={(event) => setMinPurchasePrice(event.target.value)}>
                    <option value=''>Any</option>
                    {purchasePriceOptions.map((price) => (
                        <option key={`min-purchase-${price}`} value={price}>{formatKES(price)}</option>
                    ))}
                </select>
            </label>

            <label>
                Max Purchase Price
                <select value={maxPurchasePrice} onChange={(event) => setMaxPurchasePrice(event.target.value)}>
                    <option value=''>Any</option>
                    {purchasePriceOptions.map((price) => (
                        <option key={`max-purchase-${price}`} value={price}>{formatKES(price)}</option>
                    ))}
                </select>
            </label>

            <label>
                Min Floor Size (m²)
                <select value={minFloorSize} onChange={(event) => setMinFloorSize(event.target.value)}>
                    <option value=''>Any</option>
                    {floorSizeOptions.map((size) => (
                        <option key={`min-floor-${size}`} value={size}>{size} m²</option>
                    ))}
                </select>
            </label>

            <label>
                Max Floor Size (m²)
                <select value={maxFloorSize} onChange={(event) => setMaxFloorSize(event.target.value)}>
                    <option value=''>Any</option>
                    {floorSizeOptions.map((size) => (
                        <option key={`max-floor-${size}`} value={size}>{size} m²</option>
                    ))}
                </select>
            </label>

            <label>
                Min Land Size (m²)
                <select value={minLandSize} onChange={(event) => setMinLandSize(event.target.value)}>
                    <option value=''>Any</option>
                    {landSizeOptions.map((size) => (
                        <option key={`min-land-${size}`} value={size}>{size} m²</option>
                    ))}
                </select>
            </label>

            <label>
                Max Land Size (m²)
                <select value={maxLandSize} onChange={(event) => setMaxLandSize(event.target.value)}>
                    <option value=''>Any</option>
                    {landSizeOptions.map((size) => (
                        <option key={`max-land-${size}`} value={size}>{size} m²</option>
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
                    buildPropertyUrl={buildPropertyUrl}
                    listingMode={listingMode}
                />
            )}
        </div>
    );
};

export default PropertyList;
