import React, { useEffect, useMemo, useState } from 'react';
import S3ImageUploader from './S3ImageUploader';
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
  reconciliationItems,
  onRefreshReconciliation,
  onRefundBooking,
  onExit,
  onLogout,
}) => {
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY_PROPERTY);
  const [message, setMessage] = useState('');
  const [siteForm, setSiteForm] = useState(siteContent);
  const [newAdminUsername, setNewAdminUsername] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [refundReason, setRefundReason] = useState('Requested by customer');

  useEffect(() => {
    Promise.resolve(onRefreshReconciliation()).catch(() => {
      // Ignore initial refresh failures and let manual refresh handle retries.
    });
  }, []);

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

  const handleCreate = async () => {
    if (!form.title.trim() || !form.type.trim()) {
      setMessage('Type and title are required before adding a property.');
      return;
    }

    try {
      await Promise.resolve(onCreateProperty(toPropertyPayload()));
      setForm(EMPTY_PROPERTY);
      setSelectedId(null);
      setMessage('Property created.');
    } catch (error) {
      setMessage(error.message || 'Unable to create property.');
    }
  };

  const handleUpdate = async () => {
    if (!selectedProperty) {
      setMessage('Pick a property from the list to update.');
      return;
    }

    try {
      await Promise.resolve(onUpdateProperty(selectedProperty.id, toPropertyPayload()));
      setMessage('Property updated.');
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
    const result = await Promise.resolve(onAddAdmin(newAdminUsername, newAdminPassword));
    setMessage(result.message);
    if (result.ok) {
      setNewAdminUsername('');
      setNewAdminPassword('');
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
                Price (KES)
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
                Image
                <S3ImageUploader onUpload={(url) => handleChange('image', url)} />
                {form.image && (
                  <div style={{ marginTop: 8 }}>
                    <img src={form.image} alt="Preview" style={{ maxWidth: 200, maxHeight: 120, border: '1px solid #ccc' }} />
                    <div style={{ fontSize: 12, color: '#555' }}>{form.image}</div>
                  </div>
                )}
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
        </div>
      </div>
    </section>
  );
};

export default AdminPanel;
