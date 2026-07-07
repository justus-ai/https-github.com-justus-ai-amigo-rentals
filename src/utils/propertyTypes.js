export const KNOWN_PROPERTY_TYPES = ['Bungalow', 'Apartment', 'Maisonette'];

const normalizedTypeMap = {
  bungalow: 'Bungalow',
  apartment: 'Apartment',
  cottage: 'Maisonette',
  maisonette: 'Maisonette',
};

const findTypeByIncludes = (value) => {
  if (!value) {
    return '';
  }

  if (value.includes('apartment')) {
    return 'Apartment';
  }

  if (value.includes('cottage')) {
    return 'Maisonette';
  }

  if (value.includes('maisonette')) {
    return 'Maisonette';
  }

  if (value.includes('bungalow') || value.includes('house') || value.includes('villa')) {
    return 'Bungalow';
  }

  return 'Bungalow';
};

export const normalizePropertyType = (rawType) => {
  const value = String(rawType || '').trim().toLowerCase();
  if (!value) {
    return '';
  }

  return normalizedTypeMap[value] || findTypeByIncludes(value);
};

export const groupPropertiesByKnownType = (properties = []) => {
  const grouped = KNOWN_PROPERTY_TYPES.reduce((acc, type) => {
    acc[type] = [];
    return acc;
  }, {});

  for (const property of properties) {
    const normalizedType = normalizePropertyType(property?.type);
    if (!normalizedType) {
      continue;
    }

    grouped[normalizedType].push({
      ...property,
      type: normalizedType,
    });
  }

  return grouped;
};