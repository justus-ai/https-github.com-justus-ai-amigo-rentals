const MAX_PROPERTY_IMAGES = 6;

const cleanImage = (value) => String(value || '').trim();

const MEDIA_EXTENSION_PATTERN = /\.([a-z0-9]+)(?:$|[?#])/i;
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'webm', 'm4v', '3gp', '3gpp', 'ogg', 'ogv']);

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
  return firstImage || media[0] || '';
};

export { MAX_PROPERTY_IMAGES };
