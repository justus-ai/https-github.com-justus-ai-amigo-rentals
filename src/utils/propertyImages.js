const MAX_PROPERTY_IMAGES = 6;

const cleanImage = (value) => String(value || '').trim();

const MEDIA_EXTENSION_PATTERN = /\.([a-z0-9]+)(?:$|[?#])/i;
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'm4v', '3gp', '3gpp', 'ogg', 'ogv']);

const PROPERTY_FALLBACK_IMAGES = {
  apartment: '/images/property-placeholder-apartment.svg',
  maisonette: '/images/property-placeholder-maisonette.svg',
  bungalow: '/images/property-placeholder-bungalow.svg',
  default: '/images/property-placeholder-generic.svg',
};

const normalizePropertyType = (rawType = '') => {
  const value = cleanImage(rawType).toLowerCase();
  if (!value) {
    return 'default';
  }

  if (value.includes('apartment') || value.includes('flat')) {
    return 'apartment';
  }

  if (value.includes('maisonette') || value.includes('cottage') || value.includes('townhouse')) {
    return 'maisonette';
  }

  if (value.includes('bungalow') || value.includes('house') || value.includes('villa')) {
    return 'bungalow';
  }

  return 'default';
};

export const detectMediaType = (value = '') => {
  const candidate = cleanImage(value).toLowerCase();
  if (!candidate) {
    return 'image';
  }

  if (candidate.startsWith('data:video/')) {
    return 'video';
  }

  if (candidate.startsWith('data:image/')) {
    return 'image';
  }

  const extensionMatch = candidate.match(MEDIA_EXTENSION_PATTERN);
  const extension = extensionMatch?.[1] || '';
  if (VIDEO_EXTENSIONS.has(extension)) {
    return 'video';
  }

  return 'image';
};

export const isVideoMedia = (value = '') => detectMediaType(value) === 'video';

export const getFallbackPropertyImage = (property = {}) => {
  const typeKey = normalizePropertyType(property?.type);
  return PROPERTY_FALLBACK_IMAGES[typeKey] || PROPERTY_FALLBACK_IMAGES.default;
};

export const isFallbackPropertyImage = (value = '') =>
  Object.values(PROPERTY_FALLBACK_IMAGES).includes(cleanImage(value));

export const getPropertyImages = (property = {}, max = MAX_PROPERTY_IMAGES) => {
  const merged = [];

  if (Array.isArray(property.images)) {
    merged.push(...property.images);
  }

  if (property.image) {
    merged.push(property.image);
  }

  const unique = [];
  for (const raw of merged) {
    const value = cleanImage(raw);
    if (!value || unique.includes(value)) {
      continue;
    }

    unique.push(value);
    if (unique.length >= max) {
      break;
    }
  }

  return unique;
};

export const getPrimaryPropertyImage = (property = {}) => {
  const media = getPropertyImages(property);
  const firstImage = media.find((item) => !isVideoMedia(item));
  return firstImage || media[0] || getFallbackPropertyImage(property);
};

export { MAX_PROPERTY_IMAGES };
