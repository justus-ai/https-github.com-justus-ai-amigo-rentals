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

const normalizeOptionKey = (value) => String(value || '').trim().toLowerCase();

const toTitleCase = (value) => String(value || '')
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const hasUppercase = (value) => /[A-Z]/.test(String(value || ''));

const buildNormalizedOptions = (properties, getter, fallback, formatLabel = (label) => label) => {
    const optionsMap = new Map();

    properties.forEach((property) => {
        const rawLabel = normalizeLabel(getter(property), fallback);
        const label = formatLabel(rawLabel);
        const key = normalizeOptionKey(label);
        const existing = optionsMap.get(key);

        // Prefer a label variant that already has intended capitalization.
        if (!existing || (!hasUppercase(existing) && hasUppercase(label))) {
            optionsMap.set(key, label);
        }
    });

    return Array.from(optionsMap.entries())
        .map(([value, label]) => ({ value, label }))
        .sort((left, right) => left.label.localeCompare(right.label, undefined, { sensitivity: 'base' }));
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

const hasOptions = (options) => Array.isArray(options) && options.length > 0;

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
        return buildNormalizedOptions(modeMatchedProperties, (property) => property.type, 'Unspecified');
    }, [modeMatchedProperties]);

    const locationOptions = useMemo(() => {
        return buildNormalizedOptions(
            modeMatchedProperties,
            (property) => property.location,
            'Unknown',
            (label) => toTitleCase(label)
        );
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
        const canFilterRentPrice = listingMode === LISTING_MODE.RENT && hasOptions(rentPriceOptions);
        const canFilterPurchasePrice = listingMode === LISTING_MODE.BUY && hasOptions(purchasePriceOptions);
        const canFilterFloorSize = hasOptions(floorSizeOptions);
        const canFilterLandSize = hasOptions(landSizeOptions);
        const canFilterBedrooms = hasOptions(bedroomOptions);
        const canFilterBathrooms = hasOptions(bathroomOptions);
        const minRent = canFilterRentPrice ? toPositiveNumber(minRentPrice) : null;
        const maxRent = canFilterRentPrice ? toPositiveNumber(maxRentPrice) : null;
        const minPurchase = canFilterPurchasePrice ? toPositiveNumber(minPurchasePrice) : null;
        const maxPurchase = canFilterPurchasePrice ? toPositiveNumber(maxPurchasePrice) : null;
        const minFloor = canFilterFloorSize ? toPositiveNumber(minFloorSize) : null;
        const maxFloor = canFilterFloorSize ? toPositiveNumber(maxFloorSize) : null;
        const minLand = canFilterLandSize ? toPositiveNumber(minLandSize) : null;
        const maxLand = canFilterLandSize ? toPositiveNumber(maxLandSize) : null;
        const minBeds = canFilterBedrooms ? toPositiveNumber(minBedrooms) : null;
        const minBaths = canFilterBathrooms ? toPositiveNumber(minBathrooms) : null;

        return modeMatchedProperties.filter((property) => {
            const type = normalizeLabel(property.type, 'Unspecified');
            const location = normalizeLabel(property.location, 'Unknown');
            const typeKey = normalizeOptionKey(type);
            const locationKey = normalizeOptionKey(location);
            const rentPrice = toPositiveNumber(property.price) || 0;
            const purchasePrice = toPositiveNumber(property.purchasePrice) || 0;
            const floorSize = toPositiveNumber(property.area) || 0;
            const landSize = toPositiveNumber(property.landSize) || 0;
            const bedrooms = toPositiveNumber(property.bedrooms) || 0;
            const bathrooms = toPositiveNumber(property.bathrooms) || 0;

            if (selectedType !== 'all' && typeKey !== selectedType) {
                return false;
            }

            if (selectedLocation !== 'all' && locationKey !== selectedLocation) {
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
        listingMode,
        rentPriceOptions,
        purchasePriceOptions,
        floorSizeOptions,
        landSizeOptions,
        bedroomOptions,
        bathroomOptions,
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
        if (!typeOptions.some((option) => option.value === selectedType)) {
            setSelectedType('all');
        }
    }, [typeOptions, selectedType]);

    useEffect(() => {
        if (!locationOptions.some((option) => option.value === selectedLocation)) {
            setSelectedLocation('all');
        }
    }, [locationOptions, selectedLocation]);

    useEffect(() => {
        if (listingMode === LISTING_MODE.RENT) {
            setMinPurchasePrice('');
            setMaxPurchasePrice('');
        }

        if (listingMode === LISTING_MODE.BUY) {
            setMinRentPrice('');
            setMaxRentPrice('');
        }
    }, [listingMode]);

    useEffect(() => {
        if (!hasOptions(floorSizeOptions)) {
            setMinFloorSize('');
            setMaxFloorSize('');
        }

        if (!hasOptions(landSizeOptions)) {
            setMinLandSize('');
            setMaxLandSize('');
        }

        if (!hasOptions(bedroomOptions)) {
            setMinBedrooms('');
        }

        if (!hasOptions(bathroomOptions)) {
            setMinBathrooms('');
        }
    }, [floorSizeOptions, landSizeOptions, bedroomOptions, bathroomOptions]);

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

    const activeFilterControls = [
        {
            key: 'type',
            label: 'Property Type',
            value: selectedType,
            onChange: setSelectedType,
            allLabel: 'All Types',
            options: typeOptions,
        },
        {
            key: 'location',
            label: 'Location',
            value: selectedLocation,
            onChange: setSelectedLocation,
            allLabel: 'All Locations',
            options: locationOptions,
        },
        ...(listingMode === LISTING_MODE.RENT && hasOptions(rentPriceOptions) ? [
            {
                key: 'min-rent',
                label: 'Min Rent Price',
                value: minRentPrice,
                onChange: setMinRentPrice,
                options: rentPriceOptions.map((price) => ({ value: price, label: formatKES(price) })),
            },
            {
                key: 'max-rent',
                label: 'Max Rent Price',
                value: maxRentPrice,
                onChange: setMaxRentPrice,
                options: rentPriceOptions.map((price) => ({ value: price, label: formatKES(price) })),
            },
        ] : []),
        ...(listingMode === LISTING_MODE.BUY && hasOptions(purchasePriceOptions) ? [
            {
                key: 'min-purchase',
                label: 'Min Purchase Price',
                value: minPurchasePrice,
                onChange: setMinPurchasePrice,
                options: purchasePriceOptions.map((price) => ({ value: price, label: formatKES(price) })),
            },
            {
                key: 'max-purchase',
                label: 'Max Purchase Price',
                value: maxPurchasePrice,
                onChange: setMaxPurchasePrice,
                options: purchasePriceOptions.map((price) => ({ value: price, label: formatKES(price) })),
            },
        ] : []),
        ...(hasOptions(floorSizeOptions) ? [
            {
                key: 'min-floor',
                label: 'Min Floor Size (m²)',
                value: minFloorSize,
                onChange: setMinFloorSize,
                options: floorSizeOptions.map((size) => ({ value: size, label: `${size} m²` })),
            },
            {
                key: 'max-floor',
                label: 'Max Floor Size (m²)',
                value: maxFloorSize,
                onChange: setMaxFloorSize,
                options: floorSizeOptions.map((size) => ({ value: size, label: `${size} m²` })),
            },
        ] : []),
        ...(hasOptions(landSizeOptions) ? [
            {
                key: 'min-land',
                label: 'Min Land Size (m²)',
                value: minLandSize,
                onChange: setMinLandSize,
                options: landSizeOptions.map((size) => ({ value: size, label: `${size} m²` })),
            },
            {
                key: 'max-land',
                label: 'Max Land Size (m²)',
                value: maxLandSize,
                onChange: setMaxLandSize,
                options: landSizeOptions.map((size) => ({ value: size, label: `${size} m²` })),
            },
        ] : []),
        ...(hasOptions(bedroomOptions) ? [
            {
                key: 'bedrooms',
                label: 'Bedrooms',
                value: minBedrooms,
                onChange: setMinBedrooms,
                options: bedroomOptions.map((value) => ({ value, label: formatBedroomOption(value) })),
            },
        ] : []),
        ...(hasOptions(bathroomOptions) ? [
            {
                key: 'bathrooms',
                label: 'Bathrooms',
                value: minBathrooms,
                onChange: setMinBathrooms,
                options: bathroomOptions.map((value) => ({ value, label: formatBedroomOption(value) })),
            },
        ] : []),
    ];

    const renderFilterControls = (isPanel = false) => (
        <div className={`property-filter-grid ${isPanel ? 'in-panel' : ''}`}>
            {activeFilterControls.map((control) => (
            <label>
                {control.label}
                <select value={control.value} onChange={(event) => control.onChange(event.target.value)}>
                    <option value={control.allLabel ? 'all' : ''}>{control.allLabel || 'Any'}</option>
                    {control.options.map((option) => (
                        <option key={`${control.key}-${option.value}`} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </label>
            ))}
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
