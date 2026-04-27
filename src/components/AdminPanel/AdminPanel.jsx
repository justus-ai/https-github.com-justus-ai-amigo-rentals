import React, { useMemo, useState } from 'react';
import './AdminPanel.css';

const EMPTY_PROPERTY = {
  type: '',
  title: '',
  location: '',
  price: '',
  bedrooms: '',
  bathrooms: '',
  area: '',
  image: '',
  description: '',
  available: true,
};

const normalizeNumber = (value) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
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
  onDeleteAdmin,
  onExit,
  onLogout,
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_PROPERTY);
  const [message, setMessage] = useState('');
  const [siteForm, setSiteForm] = useState(siteContent);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');

  const selectedProperty = useMemo(
    () => properties.find((property) => property.id === selectedId),
    [properties, selectedId]
  );

  const applyPropertyToForm = (property) => {
    if (!property) {
      setSelectedId(null);
      setForm(EMPTY_PROPERTY);
      return;
    }

    setSelectedId(property.id);
    setForm({
      type: property.type ?? '',
      title: property.title ?? '',
      location: property.location ?? '',
      price: property.price ?? '',
      bedrooms: property.bedrooms ?? '',
      bathrooms: property.bathrooms ?? '',
      area: property.area ?? '',
      image: property.image ?? '',
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

  const toPropertyPayload = () => ({
    ...form,
    price: normalizeNumber(form.price),
    bedrooms: normalizeNumber(form.bedrooms),
    bathrooms: normalizeNumber(form.bathrooms),
    area: normalizeNumber(form.area),
  });

  const handleCreate = () => {
    if (!form.title.trim() || !form.type.trim()) {
      setMessage('Type and title are required before adding a property.');
      return;
    }

    onCreateProperty(toPropertyPayload());
    setForm(EMPTY_PROPERTY);
    setSelectedId(null);
    setMessage('Property created.');
  };

  const handleUpdate = () => {
    if (!selectedProperty) {
      setMessage('Pick a property from the list to update.');
      return;
    }

    onUpdateProperty(selectedProperty.id, toPropertyPayload());
    setMessage('Property updated.');
  };

  const handleDelete = () => {
    if (!selectedProperty) {
      setMessage('Pick a property from the list to delete.');
      return;
    }

    onDeleteProperty(selectedProperty.id);
    setForm(EMPTY_PROPERTY);
    setSelectedId(null);
    setMessage('Property deleted.');
  };

  const handleSaveSiteContent = (event) => {
    event.preventDefault();
    onSaveSiteContent(siteForm);
    setMessage('Website details updated.');
  };

  const handleAddAdminSubmit = (event) => {
    event.preventDefault();
    const result = onAddAdmin(newAdminUsername, newAdminPassword);
    setMessage(result.message);
    if (result.ok) {
      setNewAdminUsername('');
      setNewAdminPassword('');
    }
  };

  const handleDeleteAdminClick = (username) => {
    const result = onDeleteAdmin(username);
    setMessage(result.message);
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

      {message && <p className='admin-panel-message'>{message}</p>}

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
            <div className='form-grid'>
              <label>
                Type
                <input value={form.type} onChange={(event) => handleChange('type', event.target.value)} />
              </label>
              <label>
                Title
                <input value={form.title} onChange={(event) => handleChange('title', event.target.value)} />
              </label>
              <label>
                Location
                <input value={form.location} onChange={(event) => handleChange('location', event.target.value)} />
              </label>
              <label>
                Price
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
                Area (m2)
                <input type='number' value={form.area} onChange={(event) => handleChange('area', event.target.value)} />
              </label>
              <label>
                Image Path
                <input value={form.image} onChange={(event) => handleChange('image', event.target.value)} />
              </label>
              <label className='checkbox-row'>
                <input
                  type='checkbox'
                  checked={form.available}
                  onChange={(event) => handleChange('available', event.target.checked)}
                />
                Available
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
        </div>
      </div>
    </section>
  );
};

export default AdminPanel;
