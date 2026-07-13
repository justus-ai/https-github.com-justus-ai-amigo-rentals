import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Bath, Bed, CheckCircle2, Copy,
  Home, Image as ImageIcon, Mail, Maximize, MapPin,
  Phone, Share2, Video,
} from 'lucide-react';
import { formatKES } from '../../utils/currency';
import { detectMediaType, getPropertyImages } from '../../utils/propertyImages';
import PropertyGalleryModal from '../PropertyList/PropertyGalleryModal';
import './PropertyDetailPage.css';

/* ── Social-meta helpers ───────────────────────────────────────── */
const setMetaTag = (attr, attrValue, content) => {
  let el = document.querySelector(`meta[${attr}="${attrValue}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, attrValue);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const applyOGMeta = (property) => {
  const title = `${property.title} | Amigo Rentals`;
  const desc =
    property.description ||
    `${property.bedrooms ?? ''} bed ${property.type ?? ''} in ${property.location ?? ''}`.trim();
  const image =
    property.image ||
    (Array.isArray(property.images) && property.images[0]) ||
    '';
  const url = window.location.href;

  document.title = title;
  setMetaTag('property', 'og:title', title);
  setMetaTag('property', 'og:description', desc);
  setMetaTag('property', 'og:image', image);
  setMetaTag('property', 'og:url', url);
  setMetaTag('property', 'og:type', 'website');
  setMetaTag('name', 'description', desc);
  setMetaTag('name', 'twitter:card', 'summary_large_image');
  setMetaTag('name', 'twitter:title', title);
  setMetaTag('name', 'twitter:description', desc);
  setMetaTag('name', 'twitter:image', image);
};

/* ── Share popover ─────────────────────────────────────────────── */
const SharePopover = ({ property, onClose }) => {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      // Clipboard API not available in this browser
      console.error('Failed to copy:', e.message);
    }
  };

  const primaryImage =
    property.image ||
    (Array.isArray(property.images) && property.images[0]) ||
    '';

  return (
    <div className='pdp-share-backdrop' role='presentation' onClick={onClose}>
      <div className='pdp-share-card' role='dialog' aria-modal='true' aria-label='Share property' onClick={(e) => e.stopPropagation()}>
        <div className='pdp-share-header'>
          <h3>Share this property</h3>
          <button type='button' className='pdp-icon-btn' onClick={onClose} aria-label='Close'>✕</button>
        </div>

        {primaryImage && (
          <div className='pdp-share-preview'>
            <img src={primaryImage} alt={property.title} />
            <div>
              <strong>{formatKES(property.price)}</strong>
              <span>
                {property.bedrooms ? `${property.bedrooms} Bedroom ` : ''}
                {property.type}
                {property.location ? ` in ${property.location}` : ''}
              </span>
            </div>
          </div>
        )}

        <ul className='pdp-share-list'>
          <li>
            <button type='button' onClick={copy}>
              <Copy size={17} /> {copied ? 'Copied!' : 'Copy link to property'}
            </button>
          </li>
          <li>
            <a href={`mailto:?subject=${encodeURIComponent(property.title)}&body=${encodeURIComponent(url)}`}>
              <Mail size={17} /> Email
            </a>
          </li>
          <li>
            <a href={`https://wa.me/?text=${encodeURIComponent(property.title + ' – ' + url)}`} target='_blank' rel='noopener noreferrer'>
              <span className='pdp-share-icon pdp-share-wa'>✓</span> WhatsApp
            </a>
          </li>
          <li>
            <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`} target='_blank' rel='noopener noreferrer'>
              <span className='pdp-share-icon pdp-share-fb'>f</span> Facebook
            </a>
          </li>
          <li>
            <a href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(property.title)}`} target='_blank' rel='noopener noreferrer'>
              <span className='pdp-share-icon pdp-share-tw'>
                <svg xmlns='http://www.w3.org/2000/svg' width='11' height='11' viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'><path d='M18.244 2H21.58l-7.29 8.328L23 22h-6.81l-5.34-6.985L4.74 22H1.4l7.795-8.909L1 2h6.984l4.828 6.367L18.244 2Zm-1.17 18h1.848L6.98 3.894H5.01L17.074 20Z'/></svg>
              </span> X
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
};

/* ── Contact sidebar ───────────────────────────────────────────── */
const ContactSidebar = ({ property, siteContent = {} }) => {
  const brandName = siteContent.brandName || 'Amigo Rentals';
  const contactPhone = siteContent.contactPhone || '0790443776';
  const initials = brandName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const e164Phone = contactPhone.replace(/\D/g, '').replace(/^0/, '254');

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: "I'm interested in this property, please get in touch.",
  });
  const [sent, setSent] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const whatsappText = `Hi, I'm interested in ${property.title} (${formatKES(property.price)}) – ${window.location.href}`;

  const change = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  return (
    <aside className='pdp-sidebar'>
      <div className='pdp-sidebar-agent'>
        <div className='pdp-agent-row'>
          <div className='pdp-agent-avatar' aria-label='Agent'>{initials}</div>
          <div className='pdp-agent-info'>
            <strong>Contact Agent</strong>
            <span>{brandName}</span>
          </div>
        </div>

        <a
          className='pdp-show-phone'
          href={`tel:+${e164Phone}`}
          onClick={(e) => { e.preventDefault(); setShowPhone(true); }}
        >
          <Phone size={15} />
          {showPhone ? `+${e164Phone}` : 'Show contact number'}
        </a>

        <a
          className='pdp-whatsapp-btn'
          href={`https://wa.me/${e164Phone}?text=${encodeURIComponent(whatsappText)}`}
          target='_blank'
          rel='noopener noreferrer'
        >
          <span className='pdp-wa-dot' aria-hidden='true' />
          Chat on WhatsApp
        </a>
      </div>

      {sent ? (
        <p className='pdp-sent-msg'>Message sent! We will contact you shortly.</p>
      ) : (
        <form className='pdp-contact-form' onSubmit={submit}>
          <input type='text' placeholder='Your name' value={form.name} onChange={change('name')} required autoComplete='name' />
          <input type='email' placeholder='Your email' value={form.email} onChange={change('email')} required autoComplete='email' />
          <input type='tel' placeholder='Your mobile number' value={form.phone} onChange={change('phone')} autoComplete='tel' />
          <textarea rows={4} value={form.message} onChange={change('message')} aria-label='Message' />
          <button type='submit' className='pdp-send-btn'>Send Message</button>
          <p className='pdp-terms'>
            By submitting this form, you accept our Terms &amp; Conditions and Privacy Policy.
          </p>
        </form>
      )}
    </aside>
  );
};

/* ── Feature row helper ────────────────────────────────────────── */
const FeatureRow = ({ label, value }) => (
  <div className='pdp-feature-row'>
    <span className='pdp-feature-label'>{label}</span>
    <span className='pdp-feature-dots' aria-hidden='true' />
    <strong className='pdp-feature-value'>{value}</strong>
  </div>
);

const FeatureCheck = ({ label, available = true }) => (
  <div className={`pdp-feature-check ${available ? '' : 'pdp-feature-check--na'}`}>
    <CheckCircle2 size={16} />
    <span>{label}</span>
  </div>
);

/* ── Detail table row ──────────────────────────────────────────── */
const DetailRow = ({ label, value }) =>
  value ? (
    <tr>
      <td>{label}</td>
      <td><strong>{value}</strong></td>
    </tr>
  ) : null;

/* ── Main component ────────────────────────────────────────────── */
const PropertyDetailPage = ({ property, siteContent, onBookNow = () => {} }) => {
  const [showGallery, setShowGallery] = useState(false);
  const [showShare, setShowShare] = useState(false);

  const images = useMemo(() => getPropertyImages(property), [property]);
  const mediaItems = useMemo(
    () => images.map((url) => ({ url, type: detectMediaType(url) })),
    [images]
  );
  const photoCount = mediaItems.filter((m) => m.type === 'image').length;
  const hasVideo = mediaItems.some((m) => m.type === 'video');

  useEffect(() => {
    if (property) {
      applyOGMeta(property);
    }
    return () => {
      document.title = 'Amigo Rentals';
    };
  }, [property]);

  if (!property) {
    return (
      <div className='pdp-not-found'>
        <h2>Property not found</h2>
        <a href='#/home' className='pdp-back-link'>← Back to listings</a>
      </div>
    );
  }

  const {
    id,
    title,
    location,
    price,
    type,
    bedrooms,
    bathrooms,
    area,
    description,
    available = true,
    features = {},
  } = property;

  const listingRef = `AMG-${String(id).padStart(5, '0')}`;
  const listingDate = new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' });

  /* hero images: first up to 3 */
  const heroMain = mediaItems[0];
  const heroSecond = mediaItems[1];
  const heroThird = mediaItems[2];

  /* gallery preview: up to 6 */
  const galleryPreview = mediaItems.slice(0, 6);

  return (
    <div className='pdp-root'>
      {/* ── Top nav bar ── */}
      <div className='pdp-topbar'>
        <a href='#/home' className='pdp-topbar-back' aria-label='Back to listings'>
          <ArrowLeft size={18} />
          <span>Back</span>
        </a>
        <div className='pdp-topbar-actions'>
          <button type='button' className='pdp-topbar-btn' onClick={() => setShowShare(true)}>
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>

      {/* ── Hero image grid ── */}
      <div className='pdp-hero'>
        <div className='pdp-hero-main' onClick={() => setShowGallery(true)} role='button' tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setShowGallery(true)} aria-label='View photo gallery'>
          {heroMain ? (
            heroMain.type === 'video' ? (
              <video src={heroMain.url} muted playsInline preload='metadata' />
            ) : (
              <img src={heroMain.url} alt={`${title} – main photo`} />
            )
          ) : (
            <div className='pdp-hero-placeholder'><Home size={48} /></div>
          )}
        </div>

        {(heroSecond || heroThird) && (
          <div className='pdp-hero-side'>
            {heroSecond && (
              <div className='pdp-hero-side-item' onClick={() => setShowGallery(true)} role='button' tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setShowGallery(true)} aria-label='View gallery'>
                {heroSecond.type === 'video' ? (
                  <video src={heroSecond.url} muted playsInline preload='metadata' />
                ) : (
                  <img src={heroSecond.url} alt={`${title} – photo 2`} />
                )}
              </div>
            )}
            {heroThird && (
              <div className='pdp-hero-side-item' onClick={() => setShowGallery(true)} role='button' tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setShowGallery(true)} aria-label='View gallery'>
                {heroThird.type === 'video' ? (
                  <video src={heroThird.url} muted playsInline preload='metadata' />
                ) : (
                  <img src={heroThird.url} alt={`${title} – photo 3`} />
                )}
              </div>
            )}
          </div>
        )}

        {/* Hero bottom bar */}
        <div className='pdp-hero-bar'>
          {photoCount > 0 && (
            <button type='button' className='pdp-hero-media-btn' onClick={() => setShowGallery(true)}>
              <ImageIcon size={15} />
              Photos {photoCount}
            </button>
          )}
          {hasVideo && (
            <button type='button' className='pdp-hero-media-btn' onClick={() => setShowGallery(true)}>
              <Video size={15} />
              Video
            </button>
          )}
          <div className='pdp-hero-bar-right'>
            <button type='button' className='pdp-hero-action-btn' onClick={() => setShowShare(true)}>
              <Share2 size={15} /> Share
            </button>
          </div>
        </div>
      </div>

      {/* ── Body: main + sidebar ── */}
      <div className='pdp-body'>
        <div className='pdp-main'>
          {/* Price & title */}
          <section className='pdp-intro'>
            <div className='pdp-price-row'>
              <h1 className='pdp-price'>{formatKES(price)}<span className='pdp-price-period'> / month</span></h1>
              {!available && <span className='pdp-occupied-badge'>Occupied</span>}
            </div>
            <h2 className='pdp-title'>
              {bedrooms ? `${bedrooms} Bedroom ` : ''}{type}
              {title !== type ? ` – ${title}` : ''}
            </h2>
            {location && (
              <p className='pdp-location'>
                <MapPin size={15} />
                {location}
              </p>
            )}

            {/* Stats bar */}
            <div className='pdp-stats'>
              {bedrooms && (
                <div className='pdp-stat'>
                  <Bed size={18} />
                  <span>{bedrooms}</span>
                  <label>Beds</label>
                </div>
              )}
              {bathrooms && (
                <div className='pdp-stat'>
                  <Bath size={18} />
                  <span>{bathrooms}</span>
                  <label>Baths</label>
                </div>
              )}
              {area && (
                <div className='pdp-stat'>
                  <Maximize size={18} />
                  <span>{area} m²</span>
                  <label>Floor size</label>
                </div>
              )}
            </div>

            {available && (
              <button
                type='button'
                className='pdp-book-btn'
                onClick={() => onBookNow({ id, title, location, price })}
              >
                Book Now
              </button>
            )}
          </section>

          {/* Description */}
          {description && (
            <section className='pdp-section'>
              <h3 className='pdp-section-title'>About this property</h3>
              <p className='pdp-description'>{description}</p>
            </section>
          )}

          {/* Property details */}
          <section className='pdp-section'>
            <h3 className='pdp-section-title'>Property details</h3>
            <table className='pdp-details-table'>
              <tbody>
                <DetailRow label='Listing number' value={listingRef} />
                <DetailRow label='Property type' value={type} />
                <DetailRow label='Listed' value={listingDate} />
                <DetailRow label='Floor size' value={area ? `${area} m²` : null} />
                <DetailRow label='Location' value={location} />
                <DetailRow label='Status' value={available ? 'Available' : 'Occupied'} />
              </tbody>
            </table>
          </section>

          {/* Property features */}
          <section className='pdp-section'>
            <h3 className='pdp-section-title'>Property features</h3>
            <div className='pdp-features-grid'>
              <div className='pdp-features-col'>
                {bedrooms && <FeatureRow label='Bedrooms' value={bedrooms} />}
                {bathrooms && <FeatureRow label='Bathrooms' value={bathrooms} />}
                {area && <FeatureRow label='Floor size' value={`${area} m²`} />}
              </div>
              <div className='pdp-features-col'>
                {features.pool !== undefined ? (
                  <FeatureCheck label='Pool' available={!!features.pool} />
                ) : null}
                {features.garden !== undefined ? (
                  <FeatureCheck label='Garden' available={!!features.garden} />
                ) : null}
                {features.parking !== undefined ? (
                  <FeatureCheck label='Parking' available={!!features.parking} />
                ) : null}
                {features.petFriendly !== undefined ? (
                  <FeatureCheck label='Pet friendly' available={!!features.petFriendly} />
                ) : null}
              </div>
            </div>
          </section>

          {/* Photo gallery strip */}
          {galleryPreview.length > 0 && (
            <section className='pdp-section'>
              <div className='pdp-gallery-header'>
                <h3 className='pdp-section-title'>Photo gallery</h3>
                <button type='button' className='pdp-view-all' onClick={() => setShowGallery(true)}>
                  View All
                </button>
              </div>
              <div className='pdp-gallery-grid'>
                {galleryPreview.map((media, index) => (
                  <button
                    key={`${media.url}-${index}`}
                    type='button'
                    className='pdp-gallery-thumb'
                    onClick={() => setShowGallery(true)}
                    aria-label={`View image ${index + 1}`}
                  >
                    {media.type === 'video' ? (
                      <video src={media.url} muted playsInline preload='metadata' aria-hidden='true' />
                    ) : (
                      <img src={media.url} alt={`${title} ${index + 1}`} />
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* ── Sidebar ── */}
        <ContactSidebar property={property} siteContent={siteContent} />
      </div>

      {/* ── Full-screen gallery ── */}
      {showGallery && (
        <PropertyGalleryModal property={property} onClose={() => setShowGallery(false)} />
      )}

      {/* ── Share modal ── */}
      {showShare && (
        <SharePopover property={property} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
};

export default PropertyDetailPage;
