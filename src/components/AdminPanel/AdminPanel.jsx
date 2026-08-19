import React, { useEffect, useMemo, useRef, useState } from 'react';
import S3ImageUploader from './S3ImageUploader';
import './AdminPanel.css';
import { KNOWN_PROPERTY_TYPES, normalizePropertyType } from '../../utils/propertyTypes';
import { detectMediaType } from '../../utils/propertyImages';

const MAX_PROPERTY_MEDIA = 6;

const EMPTY_PROPERTY = {
  type: '',
  title: '',
  location: '',
  lat: '',
  lng: '',
  price: '',
  bedrooms: '',
  bathrooms: '',
  area: '',
  images: [],
  description: '',
  available: true,
};

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const FOLLOW_UP_HOURS = 12;
const SOUND_PRESETS = {
  quiet: { label: 'Quiet', peakGain: 0.018, wave: 'sine' },
  market: { label: 'Market', peakGain: 0.03, wave: 'triangle' },
  loud: { label: 'Loud Office', peakGain: 0.055, wave: 'triangle' },
};

const EMBEDDED_MEDIA_PATTERN = /^data:/i;

const formatDateTime = (value) => {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleString('en-KE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

const isToday = (timestamp) => {
  if (!timestamp) {
    return false;
  }

  const date = new Date(timestamp);
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
};

const needsFollowUp = (item) => {
  if (!item || item.status === 'closed' || !item.created_at) {
    return false;
  }

  const ageMs = Date.now() - Number(item.created_at);
  return ageMs > FOLLOW_UP_HOURS * 60 * 60 * 1000;
};

const getResponseSlaLevel = (item) => {
  if (!item || item.status === 'closed' || !item.created_at) {
    return 'closed';
  }

  const ageMs = Date.now() - Number(item.created_at);
  if (ageMs >= 24 * 60 * 60 * 1000) {
    return 'critical';
  }

  if (ageMs >= FOLLOW_UP_HOURS * 60 * 60 * 1000) {
    return 'warning';
  }

  return 'healthy';
};

const formatRelativeAge = (value) => {
  if (!value) {
    return '-';
  }

  const ageMs = Math.max(0, Date.now() - Number(value));
  const minutes = Math.floor(ageMs / (60 * 1000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const playBrandChime = (preset = 'market') => {
  if (typeof window === 'undefined') {
    return;
  }

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) {
    return;
  }

  try {
    const context = new AudioCtx();
    const now = context.currentTime;
    const config = SOUND_PRESETS[preset] || SOUND_PRESETS.market;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(config.peakGain, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    gain.connect(context.destination);

    const notes = [
      { frequency: 659.25, start: 0, duration: 0.11 },
      { frequency: 783.99, start: 0.12, duration: 0.11 },
      { frequency: 987.77, start: 0.25, duration: 0.13 },
    ];

    for (const note of notes) {
      const oscillator = context.createOscillator();
      oscillator.type = config.wave;
      oscillator.frequency.setValueAtTime(note.frequency, now + note.start);
      oscillator.connect(gain);
      oscillator.start(now + note.start);
      oscillator.stop(now + note.start + note.duration);
    }

    window.setTimeout(() => {
      context.close().catch(() => {
        // Ignore close errors.
      });
    }, 550);
  } catch {
    // Autoplay policies can block audio until user interaction.
  }
};

const AdminPanel = ({
  properties,
  siteContent,
  admins,
  currentAdmin,
  onSaveSiteContent,
  onCreateProperty,
  onUpdateProperty,
  onDeleteProperty,
  onAddAdmin,
  onChangeOwnPassword,
  onDeleteAdmin,
  reconciliationItems,
  onRefreshReconciliation,
  onRefundBooking,
  enquiryItems,
  onRefreshEnquiries,
  onUpdateEnquiryStatus,
  onExit,
  onLogout,
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_PROPERTY);
  const [notice, setNotice] = useState(null);
  const [siteForm, setSiteForm] = useState(siteContent);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminPasswordConfirm, setNewAdminPasswordConfirm] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [nextPasswordConfirm, setNextPasswordConfirm] = useState('');
  const [refundReason, setRefundReason] = useState('Requested by customer');
  const [enquiryQuery, setEnquiryQuery] = useState('');
  const [enquiryStatusFilter, setEnquiryStatusFilter] = useState('all');
  const [enquiryQuickFilter, setEnquiryQuickFilter] = useState('all');
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState(true);
  const [soundPreset, setSoundPreset] = useState('market');
  const [lastRefreshAt, setLastRefreshAt] = useState(Date.now());
  const [newSinceLastRefresh, setNewSinceLastRefresh] = useState(0);
  const knownEnquiryIdsRef = useRef(new Set());
  const hasInitializedEnquiriesRef = useRef(false);

  useEffect(() => {
    Promise.resolve(onRefreshReconciliation()).catch(() => {
      // Ignore initial refresh failures and let manual refresh handle retries.
    });

    Promise.resolve(onRefreshEnquiries()).catch(() => {
      // Ignore initial enquiry refresh failures and allow manual retry.
    });

    setLastRefreshAt(Date.now());
  }, []);

  useEffect(() => {
    if (!hasInitializedEnquiriesRef.current) {
      knownEnquiryIdsRef.current = new Set(enquiryItems.map((item) => item.id));
      hasInitializedEnquiriesRef.current = true;
      return;
    }

    const knownIds = knownEnquiryIdsRef.current;
    let freshCount = 0;

    for (const item of enquiryItems) {
      if (!knownIds.has(item.id)) {
        freshCount += 1;
      }
    }

    if (freshCount > 0) {
      setNewSinceLastRefresh((previous) => previous + freshCount);
      if (soundAlertsEnabled) {
        playBrandChime(soundPreset);
      }
    }

    knownEnquiryIdsRef.current = new Set(enquiryItems.map((item) => item.id));
  }, [enquiryItems, soundAlertsEnabled, soundPreset]);

  useEffect(() => {
    if (!autoRefreshEnabled) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      Promise.resolve(onRefreshEnquiries())
        .then(() => {
          setLastRefreshAt(Date.now());
        })
        .catch(() => {
          // Skip toast-like messaging for background refresh failures.
        });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [autoRefreshEnabled, onRefreshEnquiries]);

  const pushNotice = (text, type = 'success') => {
    const message = String(text || '').trim();
    if (!message) {
      return;
    }

    setNotice({
      id: Date.now() + Math.random(),
      text: message,
      type,
    });
  };

  const setMessage = (text, explicitType) => {
    const message = String(text || '').trim();
    if (!message) {
      return;
    }

    const isError =
      explicitType === 'error' ||
      /unable|error|failed|required|must|too large|does not match|pick a property|only\s+\d+|cannot/i.test(message);

    pushNotice(message, isError ? 'error' : 'success');
  };

  useEffect(() => {
    if (!notice?.id) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setNotice(null);
    }, 7000);

    return () => window.clearTimeout(timeoutId);
  }, [notice?.id]);

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedId),
    [properties, selectedId]
  );

  const enquiryMetrics = useMemo(() => {
    const metrics = {
      total: enquiryItems.length,
      new: 0,
      contacted: 0,
      closed: 0,
      followUp: 0,
      today: 0,
      critical: 0,
    };

    for (const item of enquiryItems) {
      if (item.status === 'new') {
        metrics.new += 1;
      } else if (item.status === 'contacted') {
        metrics.contacted += 1;
      } else if (item.status === 'closed') {
        metrics.closed += 1;
      }

      if (isToday(item.created_at)) {
        metrics.today += 1;
      }

      if (needsFollowUp(item)) {
        metrics.followUp += 1;
      }

      if (getResponseSlaLevel(item) === 'critical') {
        metrics.critical += 1;
      }
    }

    return metrics;
  }, [enquiryItems]);

  const filteredEnquiries = useMemo(() => {
    const normalizedQuery = enquiryQuery.trim().toLowerCase();

    return enquiryItems.filter((item) => {
      if (enquiryStatusFilter !== 'all' && item.status !== enquiryStatusFilter) {
        return false;
      }

      if (enquiryQuickFilter === 'new' && item.status !== 'new') {
        return false;
      }

      if (enquiryQuickFilter === 'followup' && !needsFollowUp(item)) {
        return false;
      }

      if (enquiryQuickFilter === 'today' && !isToday(item.created_at)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchHaystack = [
        item.property_title,
        item.property_location,
        item.full_name,
        item.email,
        item.phone_number,
        item.message,
      ]
        .join(' ')
        .toLowerCase();

      return searchHaystack.includes(normalizedQuery);
    });
  }, [enquiryItems, enquiryQuery, enquiryStatusFilter, enquiryQuickFilter]);

  const applyPropertyToForm = (property) => {
    if (!property) {
      setSelectedId(null);
      setForm(EMPTY_PROPERTY);
      return;
    }

    setSelectedId(property.id);
    const images = Array.isArray(property.images)
      ? property.images.filter((value) => typeof value === 'string' && value.trim())
      : (property.image ? [property.image] : []);
    const limitedImages = Array.from(new Set(images)).slice(0, MAX_PROPERTY_MEDIA);

    setForm({
      type: normalizePropertyType(property.type) || '',
      title: property.title ?? '',
      location: property.location ?? '',
      lat: property.lat ?? '',
      lng: property.lng ?? '',
      price: property.price ?? '',
      bedrooms: property.bedrooms ?? '',
      bathrooms: property.bathrooms ?? '',
      area: property.area ?? '',
      images: limitedImages,
      description: property.description ?? '',
      available: property.available ?? true,
    });
  };

  const handleChange = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const toPropertyPayload = () => {
    const rawImages = (Array.isArray(form.images) ? form.images : [])
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .slice(0, MAX_PROPERTY_MEDIA);

    const images = rawImages.filter((value) => !EMBEDDED_MEDIA_PATTERN.test(value));
    const removedEmbeddedMediaCount = rawImages.length - images.length;

    return {
      payload: {
        ...form,
        type: normalizePropertyType(form.type),
        images,
        image: images[0] || '',
        price: normalizeNumber(form.price),
        bedrooms: normalizeNumber(form.bedrooms),
        bathrooms: normalizeNumber(form.bathrooms),
        area: normalizeNumber(form.area),
      },
      sanitizedImages: images,
      removedEmbeddedMediaCount,
    };
  };

  const moveMedia = (fromIndex, toIndex) => {
    const media = Array.isArray(form.images) ? [...form.images] : [];
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= media.length ||
      toIndex >= media.length ||
      fromIndex === toIndex
    ) {
      return;
    }

    const [item] = media.splice(fromIndex, 1);
    media.splice(toIndex, 0, item);
    handleChange('images', media);
  };

  const setPrimaryMedia = (index) => {
    if (index <= 0) {
      return;
    }

    moveMedia(index, 0);
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.type.trim()) {
      setMessage('Type and title are required before adding a property.');
      return;
    }

    try {
      const { payload, sanitizedImages, removedEmbeddedMediaCount } = toPropertyPayload();
      if (removedEmbeddedMediaCount > 0) {
        handleChange('images', sanitizedImages);
      }

      await Promise.resolve(onCreateProperty(payload));
      setForm(EMPTY_PROPERTY);
      setSelectedId(null);
      setMessage(
        removedEmbeddedMediaCount > 0
          ? `Property created. Removed ${removedEmbeddedMediaCount} embedded media item(s). Re-upload them to restore.`
          : 'Property created.'
      );
    } catch (error) {
      setMessage(error.message || 'Unable to create property.');
    }
  };

  const handleUpdate = async () => {
    if (!selectedProperty) {
      setMessage('Pick a property from the list to update.');
      return;
    }

    if (!form.title.trim() || !form.type.trim()) {
      setMessage('Type and title are required before saving a property.');
      return;
    }

    try {
      const { payload, sanitizedImages, removedEmbeddedMediaCount } = toPropertyPayload();
      if (removedEmbeddedMediaCount > 0) {
        handleChange('images', sanitizedImages);
      }

      await Promise.resolve(onUpdateProperty(selectedProperty.id, payload));
      setMessage(
        removedEmbeddedMediaCount > 0
          ? `Property updated. Removed ${removedEmbeddedMediaCount} embedded media item(s). Re-upload them to restore.`
          : 'Property updated.'
      );
    } catch (error) {
      setMessage(error.message || 'Unable to update property.');
    }
  };

  const handleDelete = async () => {
    if (!selectedProperty) {
      setMessage('Pick a property from the list to delete.');
      return;
    }

    try {
      await Promise.resolve(onDeleteProperty(selectedProperty.id));
      setForm(EMPTY_PROPERTY);
      setSelectedId(null);
      setMessage('Property deleted.');
    } catch (error) {
      setMessage(error.message || 'Unable to delete property.');
    }
  };

  const handleSaveSiteContent = async (event) => {
    event.preventDefault();
    try {
      await Promise.resolve(onSaveSiteContent(siteForm));
      setMessage('Website details updated.');
    } catch (error) {
      setMessage(error.message || 'Unable to update website details.');
    }
  };

  const handleAddAdminSubmit = async (event) => {
    event.preventDefault();

    if (newAdminPassword.length < 8) {
      setMessage('New admin password must be at least 8 characters long.');
      return;
    }

    if (newAdminPassword !== newAdminPasswordConfirm) {
      setMessage('New admin password confirmation does not match.');
      return;
    }

    const result = await Promise.resolve(onAddAdmin(newAdminUsername, newAdminPassword));
    setMessage(result.message);
    if (result.ok) {
      setNewAdminUsername('');
      setNewAdminPassword('');
      setNewAdminPasswordConfirm('');
    }
  };

  const handlePasswordChangeSubmit = async (event) => {
    event.preventDefault();

    if (nextPassword.length < 8) {
      setMessage('Your new password must be at least 8 characters long.');
      return;
    }

    if (nextPassword !== nextPasswordConfirm) {
      setMessage('New password confirmation does not match.');
      return;
    }

    const result = await Promise.resolve(onChangeOwnPassword(currentPassword, nextPassword));
    setMessage(result.message);

    if (result.ok) {
      setCurrentPassword('');
      setNextPassword('');
      setNextPasswordConfirm('');
    }
  };

  const handleDeleteAdminClick = async (username) => {
    const result = await Promise.resolve(onDeleteAdmin(username));
    setMessage(result.message);
  };

  const handleRefreshReconciliation = async () => {
    try {
      await Promise.resolve(onRefreshReconciliation());
      setMessage('Reconciliation data refreshed.');
    } catch (error) {
      setMessage(error.message || 'Unable to refresh reconciliation data.');
    }
  };

  const handleRefund = async (bookingId) => {
    try {
      const result = await Promise.resolve(onRefundBooking(bookingId, refundReason));
      setMessage(result.message || 'Refund request processed.');
    } catch (error) {
      setMessage(error.message || 'Unable to process refund.');
    }
  };

  const handleRefreshEnquiries = async () => {
    try {
      await Promise.resolve(onRefreshEnquiries());
      setLastRefreshAt(Date.now());
      setNewSinceLastRefresh(0);
      setMessage('Enquiries refreshed.');
    } catch (error) {
      setMessage(error.message || 'Unable to refresh enquiries.');
    }
  };

  const handleEnquiryStatusUpdate = async (enquiryId, status) => {
    try {
      await Promise.resolve(onUpdateEnquiryStatus(enquiryId, status));
      setLastRefreshAt(Date.now());
      setMessage(`Enquiry #${enquiryId} marked as ${status}.`);
    } catch (error) {
      setMessage(error.message || 'Unable to update enquiry status.');
    }
  };

  const canManageAdmins = currentAdmin === 'justus';

  return (
    <section className='admin-panel'>
      <div className='admin-panel-header'>
        <h2>Admin Control Center</h2>
        <div className='admin-panel-actions'>
          <button type='button' onClick={onExit}>View Website</button>
          <button type='button' className='secondary' onClick={onLogout}>Log Out</button>
        </div>
      </div>

      {notice && (
        <div
          className={`admin-toast ${notice.type === 'error' ? 'is-error' : 'is-success'}`}
          role='status'
          aria-live='polite'
        >
          <button
            type='button'
            className='admin-toast-close'
            onClick={() => setNotice(null)}
            aria-label='Close notification'
          >
            ×
          </button>
          <p>{notice.text}</p>
        </div>
      )}

      <div className='admin-grid'>
        <aside className='admin-list'>
          <h3>Properties</h3>
          <button
            type='button'
            className='new-property'
            onClick={() => applyPropertyToForm(null)}
          >
            + New Property
          </button>
          <ul>
            {properties.map((property) => (
              <li key={property.id}>
                <button
                  type='button'
                  className={property.id === selectedId ? 'is-selected' : ''}
                  onClick={() => applyPropertyToForm(property)}
                >
                  {property.title}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className='admin-editors'>
          <form
            className='admin-form'
            onSubmit={(event) => {
              event.preventDefault();
              handleUpdate();
            }}
          >
            <h3>Property Editor</h3>
            <p className='note'>Fields marked with <span className='required-mark' aria-hidden='true'>*</span> are required.</p>
            <div className='form-grid'>
              <label>
                <span className='label-title'>
                  Type <span className='required-mark' aria-hidden='true'>*</span>
                </span>
                <select
                  value={form.type}
                  onChange={(event) => handleChange('type', event.target.value)}
                  required
                >
                  <option value=''>Select property type</option>
                  {KNOWN_PROPERTY_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className='label-title'>
                  Title <span className='required-mark' aria-hidden='true'>*</span>
                </span>
                <input
                  value={form.title}
                  onChange={(event) => handleChange('title', event.target.value)}
                  required
                />
              </label>
              <label>
                Location
                <input value={form.location} onChange={(event) => handleChange('location', event.target.value)} />
              </label>
              <label>
                Latitude
                <input type='number' step='any' placeholder='e.g. -1.2864' value={form.lat} onChange={(event) => handleChange('lat', event.target.value)} />
              </label>
              <label>
                Longitude
                <input type='number' step='any' placeholder='e.g. 36.8172' value={form.lng} onChange={(event) => handleChange('lng', event.target.value)} />
              </label>
              <label>
                Rent Price (KES)
                <input type='number' value={form.price} onChange={(event) => handleChange('price', event.target.value)} />
              </label>
              <label>
                Bedrooms
                <input type='number' value={form.bedrooms} onChange={(event) => handleChange('bedrooms', event.target.value)} />
              </label>
              <label>
                Bathrooms
                <input type='number' value={form.bathrooms} onChange={(event) => handleChange('bathrooms', event.target.value)} />
              </label>
              <label>
                Floor Size (m²)
                <input type='number' value={form.area} onChange={(event) => handleChange('area', event.target.value)} />
              </label>
              <label>
                Images & Motion Photos
                <S3ImageUploader
                  multiple
                  previewUrls={form.images}
                  maxFiles={MAX_PROPERTY_MEDIA}
                  currentCount={form.images.length}
                  onLimitReached={(limitMessage) => setMessage(limitMessage)}
                  onUpload={(urls) => {
                    const next = Array.isArray(urls) ? urls : [urls];
                    const availableSlots = Math.max(0, MAX_PROPERTY_MEDIA - form.images.length);
                    const merged = Array.from(new Set([...(form.images || []), ...next.filter(Boolean)]));
                    handleChange(
                      'images',
                      merged.slice(0, MAX_PROPERTY_MEDIA)
                    );

                    if (next.length > availableSlots) {
                      setMessage(`Only ${MAX_PROPERTY_MEDIA} media files are allowed. Extra files were skipped.`);
                    }
                  }}
                />
                <p className='admin-media-count'>
                  {form.images.length} / {MAX_PROPERTY_MEDIA} selected. The first item is used as the cover.
                </p>
                {form.images.length > 0 && (
                  <div className='admin-media-grid'>
                    {form.images.map((url, index) => (
                      <div className='admin-media-card' key={`${url}-${index}`}>
                        <div className='admin-media-thumb'>
                          {detectMediaType(url) === 'video' ? (
                            <video src={url} muted controls playsInline preload='metadata' />
                          ) : (
                            <img src={url} alt={`Selected media ${index + 1}`} />
                          )}
                          <span className='admin-media-badge'>
                            {index === 0 ? 'Cover' : `Media ${index + 1}`}
                          </span>
                        </div>
                        <div className='admin-media-controls'>
                          <button
                            type='button'
                            className='secondary'
                            onClick={() => setPrimaryMedia(index)}
                            disabled={index === 0}
                          >
                            Set Cover
                          </button>
                          <button
                            type='button'
                            className='secondary'
                            onClick={() => moveMedia(index, index - 1)}
                            disabled={index === 0}
                          >
                            Left
                          </button>
                          <button
                            type='button'
                            className='secondary'
                            onClick={() => moveMedia(index, index + 1)}
                            disabled={index === form.images.length - 1}
                          >
                            Right
                          </button>
                          <button
                            type='button'
                            className='danger'
                            onClick={() => handleChange('images', form.images.filter((_, i) => i !== index))}
                          >
                            Remove
                          </button>
                        </div>
                        <p className='admin-media-url'>{url}</p>
                      </div>
                    ))}
                  </div>
                )}
              </label>
              <label className='checkbox-row'>
                Available
                <input
                  type='checkbox'
                  checked={form.available}
                  onChange={(event) => handleChange('available', event.target.checked)}
                />
              </label>
            </div>
            <label>
              Description
              <textarea
                rows='4'
                value={form.description}
                onChange={(event) => handleChange('description', event.target.value)}
              />
            </label>
            <div className='editor-actions'>
              <button type='button' onClick={handleCreate}>Add Property</button>
              <button type='submit' className='secondary'>Save Changes</button>
              <button type='button' className='danger' onClick={handleDelete}>Delete Property</button>
            </div>
          </form>

          <form className='admin-form' onSubmit={handleSaveSiteContent}>
            <h3>Website Details</h3>
            <div className='form-grid'>
              <label>
                Brand Name
                <input
                  value={siteForm.brandName}
                  onChange={(event) => setSiteForm((prev) => ({ ...prev, brandName: event.target.value }))}
                />
              </label>
              <label>
                Contact Number
                <input
                  value={siteForm.contactPhone}
                  onChange={(event) => setSiteForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
                />
              </label>
              <label>
                Contact Email
                <input
                  value={siteForm.contactEmail}
                  onChange={(event) => setSiteForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
                />
              </label>
              <label>
                Page Title
                <input
                  value={siteForm.pageTitle}
                  onChange={(event) => setSiteForm((prev) => ({ ...prev, pageTitle: event.target.value }))}
                />
              </label>
            </div>
            <div className='editor-actions'>
              <button type='submit'>Save Website Details</button>
            </div>
          </form>

          <section className='admin-form'>
            <h3>Admin Accounts</h3>
            {!canManageAdmins && (
              <p className='note'>Only super user justus can manage admin accounts.</p>
            )}
            <p className='note'>Usernames are saved in lowercase. Passwords are stored exactly as typed, including spaces.</p>

            <form className='form-grid' onSubmit={handleAddAdminSubmit}>
              <label>
                New Admin Username
                <input
                  value={newAdminUsername}
                  onChange={(event) => setNewAdminUsername(event.target.value)}
                  disabled={!canManageAdmins}
                />
              </label>
              <label>
                New Admin Password
                <input
                  type='password'
                  value={newAdminPassword}
                  onChange={(event) => setNewAdminPassword(event.target.value)}
                  disabled={!canManageAdmins}
                />
              </label>
              <label>
                Confirm Admin Password
                <input
                  type='password'
                  value={newAdminPasswordConfirm}
                  onChange={(event) => setNewAdminPasswordConfirm(event.target.value)}
                  disabled={!canManageAdmins}
                />
              </label>
              <div className='editor-actions'>
                <button type='submit' disabled={!canManageAdmins}>Add Admin</button>
              </div>
            </form>

            <ul className='admin-accounts'>
              {Object.keys(admins)
                .sort()
                .map((username) => (
                  <li key={username}>
                    <span>{username}</span>
                    <button
                      type='button'
                      className='danger'
                      onClick={() => handleDeleteAdminClick(username)}
                      disabled={!canManageAdmins || username === 'justus'}
                    >
                      Remove
                    </button>
                  </li>
                ))}
            </ul>
          </section>

          <section className='admin-form'>
            <h3>Change Your Password</h3>
            <p className='note'>Use this after the first login so you always know the exact password stored for your account.</p>

            <form className='form-grid' onSubmit={handlePasswordChangeSubmit}>
              <label>
                Current Password
                <input
                  type='password'
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                />
              </label>
              <label>
                New Password
                <input
                  type='password'
                  value={nextPassword}
                  onChange={(event) => setNextPassword(event.target.value)}
                />
              </label>
              <label>
                Confirm New Password
                <input
                  type='password'
                  value={nextPasswordConfirm}
                  onChange={(event) => setNextPasswordConfirm(event.target.value)}
                />
              </label>
              <div className='editor-actions'>
                <button type='submit'>Update Password</button>
              </div>
            </form>
          </section>

          <section className='admin-form'>
            <div className='reconciliation-head'>
              <h3>Bookings and Payments</h3>
              <button type='button' onClick={handleRefreshReconciliation}>Refresh</button>
            </div>

            <label>
              Refund Reason
              <input
                value={refundReason}
                onChange={(event) => setRefundReason(event.target.value)}
                placeholder='Reason for refund'
              />
            </label>

            <div className='reconciliation-table-wrap'>
              <table className='reconciliation-table'>
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Property</th>
                    <th>Dates</th>
                    <th>Amount</th>
                    <th>Booking Status</th>
                    <th>Payment</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliationItems.length === 0 && (
                    <tr>
                      <td colSpan='7'>No booking/payment records found.</td>
                    </tr>
                  )}
                  {reconciliationItems.map((item) => (
                    <tr key={item.booking_id}>
                      <td>#{item.booking_id}<br />{item.full_name}</td>
                      <td>{item.property_title}<br />{item.property_location}</td>
                      <td>{item.check_in_date || '-'} to {item.check_out_date || '-'}</td>
                      <td>{item.currency} {Math.round(item.amount || 0)}</td>
                      <td>{item.booking_status}</td>
                      <td>{item.payment_provider || '-'} / {item.payment_status || '-'}</td>
                      <td>
                        <button
                          type='button'
                          className='danger'
                          disabled={item.booking_status !== 'confirmed'}
                          onClick={() => handleRefund(item.booking_id)}
                        >
                          Refund
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className='admin-form'>
            <div className='reconciliation-head'>
              <h3>Customer Enquiries</h3>
              <button type='button' onClick={handleRefreshEnquiries}>Refresh</button>
            </div>

            <div className='enquiry-toolbar'>
              <label>
                Search
                <input
                  value={enquiryQuery}
                  onChange={(event) => setEnquiryQuery(event.target.value)}
                  placeholder='Search by guest, email, phone, property, or message'
                />
              </label>
              <label>
                Status
                <select
                  value={enquiryStatusFilter}
                  onChange={(event) => setEnquiryStatusFilter(event.target.value)}
                >
                  <option value='all'>All</option>
                  <option value='new'>New</option>
                  <option value='contacted'>Contacted</option>
                  <option value='closed'>Closed</option>
                </select>
              </label>
            </div>

            <div className='enquiry-metrics'>
              <span className='metric-pill'>Total: {enquiryMetrics.total}</span>
              <span className='metric-pill metric-new'>New: {enquiryMetrics.new}</span>
              <span className='metric-pill metric-contacted'>Contacted: {enquiryMetrics.contacted}</span>
              <span className='metric-pill metric-closed'>Closed: {enquiryMetrics.closed}</span>
              <span className='metric-pill metric-followup'>Needs Follow-up: {enquiryMetrics.followUp}</span>
              <span className='metric-pill metric-critical'>Critical: {enquiryMetrics.critical}</span>
              <span className='metric-pill metric-today'>Today: {enquiryMetrics.today}</span>
              <span className='metric-pill'>Showing: {filteredEnquiries.length}</span>
            </div>

            <div className='enquiry-refresh-bar'>
              <p>
                Last sync: {formatDateTime(lastRefreshAt)}
                {newSinceLastRefresh > 0 ? ` | New since last manual refresh: ${newSinceLastRefresh}` : ''}
              </p>
              <div className='enquiry-refresh-controls'>
                <label className='checkbox-row'>
                  <input
                    type='checkbox'
                    checked={autoRefreshEnabled}
                    onChange={(event) => setAutoRefreshEnabled(event.target.checked)}
                  />
                  Auto-refresh every 60s
                </label>
                <label className='checkbox-row'>
                  <input
                    type='checkbox'
                    checked={soundAlertsEnabled}
                    onChange={(event) => setSoundAlertsEnabled(event.target.checked)}
                  />
                  Market chime alerts
                </label>
                {soundAlertsEnabled && (
                  <div className='sound-preset-controls'>
                    {Object.entries(SOUND_PRESETS).map(([key, config]) => (
                      <button
                        key={key}
                        type='button'
                        className={soundPreset === key ? 'is-active' : ''}
                        onClick={() => setSoundPreset(key)}
                      >
                        {config.label}
                      </button>
                    ))}
                    <button
                      type='button'
                      className='preview'
                      onClick={() => playBrandChime(soundPreset)}
                    >
                      Preview
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className='enquiry-quick-filters'>
              <button
                type='button'
                className={enquiryQuickFilter === 'all' ? 'is-active' : ''}
                onClick={() => setEnquiryQuickFilter('all')}
              >
                All
              </button>
              <button
                type='button'
                className={enquiryQuickFilter === 'new' ? 'is-active' : ''}
                onClick={() => setEnquiryQuickFilter('new')}
              >
                New Only
              </button>
              <button
                type='button'
                className={enquiryQuickFilter === 'followup' ? 'is-active' : ''}
                onClick={() => setEnquiryQuickFilter('followup')}
              >
                Needs Follow-up
              </button>
              <button
                type='button'
                className={enquiryQuickFilter === 'today' ? 'is-active' : ''}
                onClick={() => setEnquiryQuickFilter('today')}
              >
                Received Today
              </button>
            </div>

            <div className='reconciliation-table-wrap'>
              <table className='reconciliation-table'>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Received</th>
                    <th>Response Age</th>
                    <th>Property</th>
                    <th>Guest</th>
                    <th>Dates</th>
                    <th>Message</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEnquiries.length === 0 && (
                    <tr>
                      <td colSpan='9'>No enquiries match the current filters.</td>
                    </tr>
                  )}
                  {filteredEnquiries.map((item) => (
                    <tr key={item.id}>
                      <td>#{item.id}</td>
                      <td>{formatDateTime(item.created_at)}</td>
                      <td>
                        <span className={`sla-badge sla-${getResponseSlaLevel(item)}`}>
                          {formatRelativeAge(item.created_at)}
                        </span>
                      </td>
                      <td>{item.property_title}<br />{item.property_location}</td>
                      <td>{item.full_name}<br />{item.email}<br />{item.phone_number || '-'}</td>
                      <td>{item.check_in_date || '-'} to {item.check_out_date || '-'}</td>
                      <td>{item.message || '-'}</td>
                      <td>
                        <span className={`enquiry-status enquiry-${item.status}`}>
                          {item.status}
                        </span>
                        {needsFollowUp(item) && <span className='enquiry-sla-warning'>Overdue</span>}
                      </td>
                      <td>
                        <div className='enquiry-actions'>
                          <button
                            type='button'
                            onClick={() => handleEnquiryStatusUpdate(item.id, 'contacted')}
                            disabled={item.status === 'contacted'}
                          >
                            Mark Contacted
                          </button>
                          <button
                            type='button'
                            className='secondary'
                            onClick={() => handleEnquiryStatusUpdate(item.id, 'closed')}
                            disabled={item.status === 'closed'}
                          >
                            Close
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
};

export default AdminPanel;
