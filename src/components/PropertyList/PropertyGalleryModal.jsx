import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ChevronLeft, ChevronRight, X, Grid3X3, Image as ImageIcon, Video,
  Share2, Copy, Mail, Phone, ArrowLeft,
} from 'lucide-react';
import { detectMediaType, getPropertyImages } from '../../utils/propertyImages';
import { formatKES } from '../../utils/currency';
import './PropertyGalleryModal.css';

const SWIPE_THRESHOLD = 45;

const buildAbsolutePropertyUrl = (property, listingMode, buildPropertyUrl) => {
  if (!buildPropertyUrl || typeof window === 'undefined') {
    return undefined;
  }

  return new URL(buildPropertyUrl(property, listingMode), window.location.origin).toString();
};

const toPositiveNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const getPropertyPriceItems = (property) => {
  const rent = toPositiveNumber(property?.price);
  const purchase = toPositiveNumber(property?.purchasePrice);
  const priceItems = [];

  if (rent) {
    priceItems.push({ label: 'Rent', text: `Rent: ${formatKES(rent)}` });
  }

  if (purchase) {
    priceItems.push({ label: 'Purchase', text: `Purchase: ${formatKES(purchase)}` });
  }

  return priceItems.length ? priceItems : [{ label: 'Price', text: 'Contact for price' }];
};

/* ── Share modal ─────────────────────────────────────────── */
const ShareModal = ({ property, onClose, url: propUrl }) => {
  const [copied, setCopied] = useState(false);
  const url = propUrl || window.location.href;
  const priceItems = getPropertyPriceItems(property);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Clipboard API not available in this browser
      console.error('Failed to copy:', e.message);
    }
  };

  const primaryImage = property.image || (property.images && property.images[0]);

  return (
    <div className='pgm-dialog-backdrop' role='presentation' onClick={onClose}>
      <div className='pgm-share-modal' role='dialog' aria-modal='true' aria-label='Share property' onClick={(e) => e.stopPropagation()}>
        <div className='pgm-dialog-header'>
          <h3>Share this property</h3>
          <button type='button' className='pgm-dialog-close' onClick={onClose} aria-label='Close'><X size={18} /></button>
        </div>

        {primaryImage && (
          <div className='pgm-share-preview'>
            <img src={primaryImage} alt={property.title} />
            <div>
              <div className='pgm-share-price-stack'>
                {priceItems.map((item) => (
                  <strong key={item.label}>{item.text}</strong>
                ))}
              </div>
              <span>{property.bedrooms ? `${property.bedrooms} Bedroom ` : ''}{property.type}{property.location ? ` in ${property.location}` : ''}</span>
            </div>
          </div>
        )}

        <ul className='pgm-share-list'>
          <li>
            <button type='button' onClick={copyLink}>
              <Copy size={18} />
              {copied ? 'Copied!' : 'Copy link to property'}
            </button>
          </li>
          <li>
            <a href={`mailto:?subject=${encodeURIComponent(property.title)}&body=${encodeURIComponent(url)}`}>
              <Mail size={18} /> Email
            </a>
          </li>
          <li>
            <a href={`https://wa.me/?text=${encodeURIComponent(property.title + ' – ' + url)}`} target='_blank' rel='noopener noreferrer'>
              <span className='pgm-share-icon pgm-share-whatsapp'>&#x2714;</span> WhatsApp
            </a>
          </li>
          <li>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target='_blank' rel='noopener noreferrer'>
              <span className='pgm-share-icon pgm-share-facebook'>f</span> Facebook
            </a>
          </li>
          <li>
            <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(property.title)}`} target='_blank' rel='noopener noreferrer'>
              <span className='pgm-share-icon pgm-share-twitter'>
                <svg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'><path d='M18.244 2H21.58l-7.29 8.328L23 22h-6.81l-5.34-6.985L4.74 22H1.4l7.795-8.909L1 2h6.984l4.828 6.367L18.244 2Zm-1.17 18h1.848L6.98 3.894H5.01L17.074 20Z'/></svg>
              </span> X
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

/* ── Contact Agent modal ─────────────────────────────────── */
const ContactAgentModal = ({ onClose }) => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: "I'm interested in this property, please get in touch.",
  });
  const [sent, setSent] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <div className='pgm-dialog-backdrop' role='presentation' onClick={onClose}>
      <div className='pgm-contact-modal' role='dialog' aria-modal='true' aria-label='Contact agent' onClick={(e) => e.stopPropagation()}>
        <div className='pgm-dialog-header'>
          <h3>Contact Agent</h3>
          <button type='button' className='pgm-dialog-close' onClick={onClose} aria-label='Close'><X size={18} /></button>
        </div>

        {sent ? (
          <p className='pgm-contact-sent'>Message sent! The agent will contact you shortly.</p>
        ) : (
          <form onSubmit={handleSubmit} className='pgm-contact-form'>
            <div className='pgm-contact-layout'>
              <div className='pgm-agent-info'>
                <div className='pgm-agent-avatar' aria-label='Agent avatar'>AR</div>
                <strong>Amigo Rentals</strong>
                <button
                  type='button'
                  className='pgm-show-number'
                  onClick={() => setShowPhone(true)}
                >
                  <Phone size={14} />
                  {showPhone ? '+254 700 000 000' : 'Show number'}
                </button>
              </div>

              <div className='pgm-contact-fields'>
                <div className='pgm-input-wrap'>
                  <input
                    type='text'
                    placeholder='Your name'
                    value={form.name}
                    onChange={handleChange('name')}
                    required
                    autoComplete='name'
                  />
                </div>
                <div className='pgm-input-wrap'>
                  <input
                    type='email'
                    placeholder='Your email'
                    value={form.email}
                    onChange={handleChange('email')}
                    required
                    autoComplete='email'
                  />
                </div>
                <div className='pgm-input-wrap'>
                  <input
                    type='tel'
                    placeholder='Your mobile number'
                    value={form.phone}
                    onChange={handleChange('phone')}
                    autoComplete='tel'
                  />
                </div>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={handleChange('message')}
                  aria-label='Message'
                />
              </div>
            </div>

            <button type='submit' className='pgm-send-btn'>Send Message</button>
            <p className='pgm-contact-terms'>
              By submitting this form, you accept our Terms &amp; Conditions and Privacy Policy.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};

/* ── Main gallery modal ──────────────────────────────────── */
const PropertyGalleryModal = ({ property, onClose, buildPropertyUrl, listingMode }) => {
  const images = useMemo(() => (property ? getPropertyImages(property) : []), [property]);
  const mediaItems = useMemo(
    () => images.map((url) => ({ url, type: detectMediaType(url) })),
    [images]
  );

  const [activeIndex, setActiveIndex] = useState(0);
  const [viewMode, setViewMode] = useState('single'); // 'single' | 'grid'
  const [showShare, setShowShare] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);

  const hasVideos = mediaItems.some((m) => m.type === 'video');

  const goPrevious = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((prev) => (prev - 1 + images.length) % images.length);
  }, [images.length]);

  const goNext = useCallback(() => {
    if (images.length <= 1) return;
    setActiveIndex((prev) => (prev + 1) % images.length);
  }, [images.length]);

  useEffect(() => { setActiveIndex(0); }, [property?.id]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (showShare) { setShowShare(false); return; }
        if (showContact) { setShowContact(false); return; }
        onClose();
      }
      if (e.key === 'ArrowLeft' && viewMode === 'single' && !showShare && !showContact) {
        e.preventDefault();
        goPrevious();
      }
      if (e.key === 'ArrowRight' && viewMode === 'single' && !showShare && !showContact) {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [images.length, onClose, goPrevious, goNext, viewMode, showShare, showContact]);

  if (!property || mediaItems.length === 0) return null;

  const activeMedia = mediaItems[activeIndex] || mediaItems[0];

  const handleTouchStart = (e) => setTouchStartX(e.touches[0]?.clientX ?? null);
  const handleTouchEnd = (e) => {
    if (touchStartX === null) return;
    const delta = (e.changedTouches[0]?.clientX ?? touchStartX) - touchStartX;
    if (Math.abs(delta) >= SWIPE_THRESHOLD) { delta > 0 ? goPrevious() : goNext(); }
    setTouchStartX(null);
  };

  const bedrooms = property.bedrooms || '';
  const propType = property.type || '';
  const subtitle = [
    bedrooms ? `${bedrooms} Bedroom` : '',
    propType,
    property.location ? `in ${property.location}` : '',
  ].filter(Boolean).join(' ');
  const priceItems = getPropertyPriceItems(property);

  return (
    <div className='pgm-backdrop' role='dialog' aria-modal='true' aria-label={`Gallery for ${property.title}`}>

      {/* ── Header ── */}
      <header className='pgm-header'>
        <div className='pgm-header-left'>
          <button type='button' className='pgm-icon-btn' onClick={onClose} aria-label='Close gallery'>
            <ArrowLeft size={20} />
          </button>
          <div className='pgm-title-block'>
            <span className='pgm-header-price'>{priceItems.map((item) => item.text).join(' · ')}</span>
            <span className='pgm-header-subtitle'>{subtitle}</span>
          </div>
        </div>

        <div className='pgm-header-center'>
          <button
            type='button'
            className={`pgm-view-btn ${viewMode === 'grid' ? 'pgm-view-btn--active' : ''}`}
            onClick={() => setViewMode('grid')}
            aria-label='Grid view'
            aria-pressed={viewMode === 'grid'}
          >
            <Grid3X3 size={18} />
          </button>
          <button
            type='button'
            className={`pgm-view-btn ${viewMode === 'single' ? 'pgm-view-btn--active' : ''}`}
            onClick={() => setViewMode('single')}
            aria-label='Photo view'
            aria-pressed={viewMode === 'single'}
          >
            <ImageIcon size={18} />
          </button>
          {hasVideos && (
            <button
              type='button'
              className='pgm-view-btn'
              onClick={() => {
                const firstVideo = mediaItems.findIndex((m) => m.type === 'video');
                if (firstVideo !== -1) { setActiveIndex(firstVideo); setViewMode('single'); }
              }}
              aria-label='Video view'
            >
              <Video size={18} />
            </button>
          )}
        </div>

        <div className='pgm-header-right'>
          <button
            type='button'
            className='pgm-contact-btn'
            onClick={() => setShowContact(true)}
          >
            Contact Agent
          </button>
          <button
            type='button'
            className='pgm-icon-btn'
            onClick={() => setShowShare(true)}
            aria-label='Share property'
          >
            <Share2 size={18} />
          </button>
          <button type='button' className='pgm-icon-btn pgm-icon-btn--desktop-close' onClick={onClose} aria-label='Close'>
            <X size={18} />
          </button>
        </div>
      </header>

      {/* ── Grid view ── */}
      {viewMode === 'grid' && (
        <div className='pgm-grid-view'>
          {mediaItems.map((media, index) => (
            <button
              key={`${media.url}-${index}`}
              type='button'
              className='pgm-grid-item'
              onClick={() => { setActiveIndex(index); setViewMode('single'); }}
              aria-label={`View image ${index + 1}`}
            >
              {media.type === 'video' ? (
                <video src={media.url} muted playsInline preload='metadata' aria-hidden='true' />
              ) : (
                <img src={media.url} alt={`${property.title} ${index + 1}`} />
              )}
            </button>
          ))}
        </div>
      )}

      {/* ── Single image view ── */}
      {viewMode === 'single' && (
        <div className='pgm-single-view' onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {activeMedia.type === 'video' ? (
            <video
              src={activeMedia.url}
              controls
              autoPlay
              muted
              playsInline
              preload='metadata'
              aria-label={`${property.title} video ${activeIndex + 1}`}
            />
          ) : (
            <img src={activeMedia.url} alt={`${property.title} image ${activeIndex + 1}`} />
          )}

          {mediaItems.length > 1 && (
            <>
              <button
                type='button'
                className='pgm-nav pgm-nav--left'
                onClick={goPrevious}
                aria-label='Previous image'
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type='button'
                className='pgm-nav pgm-nav--right'
                onClick={goNext}
                aria-label='Next image'
              >
                <ChevronRight size={26} />
              </button>
              <span className='pgm-counter' aria-live='polite'>
                {activeIndex + 1} / {mediaItems.length}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Overlay modals ── */}
      {showShare && <ShareModal property={property} onClose={() => setShowShare(false)} url={buildAbsolutePropertyUrl(property, listingMode, buildPropertyUrl)} />}
      {showContact && <ContactAgentModal property={property} onClose={() => setShowContact(false)} />}
    </div>
  );
};

export default PropertyGalleryModal;
