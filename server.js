const express = require('express');
const AWS = require('aws-sdk');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const Stripe = require('stripe');
const rateLimit = require('express-rate-limit');
const Database = require('better-sqlite3');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));
app.use(express.json({ limit: '50mb' }));
app.use(
  cors({
    origin: corsOrigins.length ? corsOrigins : true,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 300,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const enquiryRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many enquiries submitted. Please try again later.' },
});

const defaultDbPath = path.join(__dirname, 'data', 'amigo-rentals.db');
const configuredDbPath = String(process.env.DB_PATH || defaultDbPath).trim();
const dbPath = path.isAbsolute(configuredDbPath)
  ? configuredDbPath
  : path.join(__dirname, configuredDbPath);
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    username TEXT PRIMARY KEY,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'admin',
    created_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    FOREIGN KEY(username) REFERENCES admins(username)
  );

  CREATE TABLE IF NOT EXISTS site_content (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    brand_name TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    contact_email TEXT NOT NULL,
    page_title TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS properties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    location TEXT,
    price REAL NOT NULL DEFAULT 0,
    bedrooms INTEGER NOT NULL DEFAULT 0,
    bathrooms INTEGER NOT NULL DEFAULT 0,
    area REAL NOT NULL DEFAULT 0,
    image TEXT,
    images TEXT,
    description TEXT,
    available INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    check_in_date TEXT,
    check_out_date TEXT,
    notes TEXT,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    status TEXT NOT NULL DEFAULT 'pending_payment',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(property_id) REFERENCES properties(id)
  );

  CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    external_id TEXT,
    status TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'KES',
    metadata TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    FOREIGN KEY(booking_id) REFERENCES bookings(id)
  );

  CREATE TABLE IF NOT EXISTS enquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    property_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT,
    check_in_date TEXT,
    check_out_date TEXT,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    created_at INTEGER NOT NULL,
    FOREIGN KEY(property_id) REFERENCES properties(id)
  );
`);

const propertyColumns = db.prepare('PRAGMA table_info(properties)').all();
if (!propertyColumns.some((column) => column.name === 'images')) {
  db.prepare('ALTER TABLE properties ADD COLUMN images TEXT').run();
}

const defaultSiteContent = {
  brand_name: 'Amigo Rentals',
  contact_phone: '0790443776',
  contact_email: 'info@amigorentals.com',
  page_title: 'Rental Properties',
};

const seedSiteContent = db.prepare(
  `
    INSERT OR IGNORE INTO site_content (id, brand_name, contact_phone, contact_email, page_title)
    VALUES (1, @brand_name, @contact_phone, @contact_email, @page_title)
  `
);
seedSiteContent.run(defaultSiteContent);

const propertyCount = db.prepare('SELECT COUNT(*) AS count FROM properties').get().count;
if (propertyCount === 0) {
  const seedProperties = [
    {
      type: 'Apartment',
      title: 'Modern Apartment',
      location: 'Downtown',
      price: 120000,
      bedrooms: 2,
      bathrooms: 1,
      area: 85,
      image: 'https://amigo-rentals-images.s3.amazonaws.com/blueapartment1.jpg',
      images: JSON.stringify(['https://amigo-rentals-images.s3.amazonaws.com/blueapartment1.jpg']),
      description: 'A beautiful modern apartment in the city center.',
      available: 1,
    },
    {
      type: 'Maisonette',
      title: 'Cozy Maisonette',
      location: 'Suburbs',
      price: 90000,
      bedrooms: 3,
      bathrooms: 2,
      area: 110,
      image: 'https://amigo-rentals-images.s3.amazonaws.com/cottage1.jpg',
      images: JSON.stringify(['https://amigo-rentals-images.s3.amazonaws.com/cottage1.jpg']),
      description: 'A cozy maisonette with a garden.',
      available: 1,
    },
  ];

  const insertProperty = db.prepare(`
    INSERT INTO properties (type, title, location, price, bedrooms, bathrooms, area, image, images, description, available, created_at, updated_at)
    VALUES (@type, @title, @location, @price, @bedrooms, @bathrooms, @area, @image, @images, @description, @available, @created_at, @updated_at)
  `);

  const now = Date.now();
  const insertMany = db.transaction((rows) => {
    for (const row of rows) {
      insertProperty.run({ ...row, created_at: now, updated_at: now });
    }
  });
  insertMany(seedProperties);
}

db.prepare("UPDATE properties SET type = 'Maisonette' WHERE lower(type) = 'cottage'").run();
db.prepare("UPDATE properties SET title = REPLACE(title, 'Cottage', 'Maisonette') WHERE title LIKE '%Cottage%'").run();
db.prepare("UPDATE properties SET title = REPLACE(title, 'cottage', 'maisonette') WHERE title LIKE '%cottage%'").run();
db.prepare("UPDATE properties SET description = REPLACE(description, 'Cottage', 'Maisonette') WHERE description LIKE '%Cottage%'").run();
db.prepare("UPDATE properties SET description = REPLACE(description, 'cottage', 'maisonette') WHERE description LIKE '%cottage%'").run();
db.prepare("UPDATE properties SET image = REPLACE(image, 'http://localhost:5000/uploads/', '/uploads/') WHERE image LIKE 'http://localhost:5000/uploads/%'").run();
db.prepare("UPDATE properties SET images = REPLACE(images, 'http://localhost:5000/uploads/', '/uploads/') WHERE images LIKE '%http://localhost:5000/uploads/%'").run();

const adminCount = db.prepare('SELECT COUNT(*) AS count FROM admins').get().count;
if (adminCount === 0) {
  const legacyUsername = process.env.ADMIN_USERNAME || '';
  const legacyPassword = process.env.ADMIN_PASSWORD || '';
  const username = (process.env.ADMIN_INITIAL_USERNAME || legacyUsername || 'justus').trim().toLowerCase();
  const password = process.env.ADMIN_INITIAL_PASSWORD || legacyPassword || 'Unbeatable12345';

  if ((!process.env.ADMIN_INITIAL_USERNAME && legacyUsername) || (!process.env.ADMIN_INITIAL_PASSWORD && legacyPassword)) {
    console.warn('Using legacy ADMIN_USERNAME/ADMIN_PASSWORD env vars. Prefer ADMIN_INITIAL_USERNAME/ADMIN_INITIAL_PASSWORD.');
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    'INSERT INTO admins (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)'
  ).run(username, passwordHash, 'superadmin', Date.now());
  console.log(`Seeded initial admin user: ${username}`);
}

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1',
});

const s3 = new AWS.S3();
const BUCKET = process.env.AWS_S3_BUCKET || 'amigo-rentals-images';
const useLegacyObjectAcl = String(process.env.AWS_S3_USE_OBJECT_ACL || '').toLowerCase() === 'true';
const hasS3Credentials = Boolean(process.env.AWS_ACCESS_KEY_ID) && Boolean(process.env.AWS_SECRET_ACCESS_KEY);
const localUploadsDir = path.join(__dirname, 'data', 'uploads');

if (!fs.existsSync(localUploadsDir)) {
  fs.mkdirSync(localUploadsDir, { recursive: true });
}

const allowedMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'video/3gpp',
  'video/ogg',
]);
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripePublishableKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const appBaseUrl = process.env.APP_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
const stripeClient = stripeSecretKey ? new Stripe(stripeSecretKey) : null;
const smtpHost = process.env.SMTP_HOST || '';
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.SMTP_USER || '';
const smtpPass = process.env.SMTP_PASS || '';
const smtpFrom = process.env.SMTP_FROM || 'no-reply@amigorentals.com';
const supportNotificationEmail = process.env.SUPPORT_NOTIFICATION_EMAIL || '';

const mpesaEnv = (process.env.MPESA_ENV || 'sandbox').toLowerCase();
const mpesaConsumerKey = process.env.MPESA_CONSUMER_KEY || '';
const mpesaConsumerSecret = process.env.MPESA_CONSUMER_SECRET || '';
const mpesaShortcode = process.env.MPESA_SHORTCODE || '';
const mpesaPasskey = process.env.MPESA_PASSKEY || '';
const mpesaCallbackUrl = process.env.MPESA_CALLBACK_URL || `${appBaseUrl}/api/payments/mpesa/callback`;

const mpesaBaseUrl =
  mpesaEnv === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';

const isMpesaConfigured =
  Boolean(mpesaConsumerKey) &&
  Boolean(mpesaConsumerSecret) &&
  Boolean(mpesaShortcode) &&
  Boolean(mpesaPasskey);

const isSmtpConfigured = Boolean(smtpHost) && Boolean(smtpUser) && Boolean(smtpPass);
const mailTransport = isSmtpConfigured
  ? nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    })
  : null;

const readMissingEnv = (keys) => keys.filter((key) => !String(process.env[key] || '').trim());

const preflightSections = {
  core: ['PORT', 'APP_BASE_URL', 'CORS_ORIGINS'],
  stripe: ['STRIPE_SECRET_KEY', 'VITE_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'],
  mpesa: ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_SHORTCODE', 'MPESA_PASSKEY', 'MPESA_CALLBACK_URL'],
  smtp: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SUPPORT_NOTIFICATION_EMAIL'],
};

const preflightReport = Object.fromEntries(
  Object.entries(preflightSections).map(([name, keys]) => [name, readMissingEnv(keys)])
);

const hasCriticalMissing = preflightReport.core.length > 0;
const hasAnyMissing = Object.values(preflightReport).some((values) => values.length > 0);

if (hasAnyMissing) {
  console.warn('Configuration preflight report:', preflightReport);
}

if (process.env.NODE_ENV === 'production' && hasCriticalMissing) {
  console.error('Missing critical production environment values:', preflightReport.core.join(', '));
  process.exit(1);
}

const sanitizeFilename = (value) => String(value || '').replace(/[^a-zA-Z0-9._-]/g, '_');
const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
const isLikelyEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));

const parseJsonObject = (value) => {
  try {
    const parsed = JSON.parse(value || '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Ignore malformed metadata and return empty object.
  }

  return {};
};

const normalizeMpesaPhone = (phone) => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith('0') && digits.length === 10) {
    return `254${digits.slice(1)}`;
  }

  return digits;
};

const BOOKING_STATUS = {
  pendingPayment: 'pending_payment',
  awaitingMpesa: 'awaiting_mpesa',
  confirmed: 'confirmed',
  paymentFailed: 'payment_failed',
  refunded: 'refunded',
  cancelled: 'cancelled',
};

const canTransitionBookingStatus = (currentStatus, nextStatus) => {
  const allowedTransitions = {
    [BOOKING_STATUS.pendingPayment]: [
      BOOKING_STATUS.awaitingMpesa,
      BOOKING_STATUS.confirmed,
      BOOKING_STATUS.paymentFailed,
      BOOKING_STATUS.cancelled,
    ],
    [BOOKING_STATUS.awaitingMpesa]: [
      BOOKING_STATUS.confirmed,
      BOOKING_STATUS.paymentFailed,
      BOOKING_STATUS.cancelled,
    ],
    [BOOKING_STATUS.confirmed]: [BOOKING_STATUS.refunded],
    [BOOKING_STATUS.paymentFailed]: [BOOKING_STATUS.pendingPayment, BOOKING_STATUS.cancelled],
    [BOOKING_STATUS.refunded]: [],
    [BOOKING_STATUS.cancelled]: [],
  };

  return (allowedTransitions[currentStatus] || []).includes(nextStatus);
};

const updateBookingStatus = (bookingId, nextStatus) => {
  const booking = db.prepare('SELECT id, status FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return { ok: false, error: 'Booking not found.' };
  }

  if (booking.status === nextStatus) {
    return { ok: true, unchanged: true };
  }

  if (!canTransitionBookingStatus(booking.status, nextStatus)) {
    return {
      ok: false,
      error: `Invalid status transition from ${booking.status} to ${nextStatus}.`,
    };
  }

  db.prepare('UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, Date.now(), bookingId);
  queueBookingStatusEmail(bookingId, nextStatus);
  return { ok: true, unchanged: false };
};

const sendEmail = async ({ to, subject, text }) => {
  if (!to) {
    return;
  }

  if (!mailTransport) {
    console.log(`[email:simulated] to=${to} subject=${subject} text=${text}`);
    return;
  }

  await mailTransport.sendMail({
    from: smtpFrom,
    to,
    subject,
    text,
  });
};

const queueBookingStatusEmail = (bookingId, status) => {
  const booking = db
    .prepare(
      `
        SELECT b.id, b.full_name, b.email, b.amount, b.currency, b.status,
               p.title AS property_title, p.location AS property_location
        FROM bookings b
        JOIN properties p ON p.id = b.property_id
        WHERE b.id = ?
      `
    )
    .get(bookingId);

  if (!booking) {
    return;
  }

  const statusLabel = status.replace(/_/g, ' ');
  const customerSubject = `Booking ${booking.id} update: ${statusLabel}`;
  const customerText = `Hello ${booking.full_name},\n\nYour booking for ${booking.property_title} is now ${statusLabel}.\nAmount: ${booking.currency} ${booking.amount}.\n\nIf you need help, contact support.`;
  sendEmail({ to: booking.email, subject: customerSubject, text: customerText }).catch((error) => {
    console.error('Customer email error:', error.message);
  });

  if (supportNotificationEmail) {
    const supportSubject = `Booking ${booking.id} status changed to ${statusLabel}`;
    const supportText = `Booking ${booking.id} for ${booking.property_title} (${booking.property_location}) is now ${statusLabel}.`;
    sendEmail({ to: supportNotificationEmail, subject: supportSubject, text: supportText }).catch((error) => {
      console.error('Support email error:', error.message);
    });
  }
};

const sendBookingCreatedEmail = (bookingId) => {
  const booking = db
    .prepare(
      `
        SELECT b.id, b.full_name, b.email, b.amount, b.currency,
               p.title AS property_title, p.location AS property_location,
               b.check_in_date, b.check_out_date
        FROM bookings b
        JOIN properties p ON p.id = b.property_id
        WHERE b.id = ?
      `
    )
    .get(bookingId);

  if (!booking) {
    return;
  }

  const customerText = `Hello ${booking.full_name},\n\nYour booking request for ${booking.property_title} in ${booking.property_location} has been created.\nCheck-in: ${booking.check_in_date}\nCheck-out: ${booking.check_out_date}\nAmount due: ${booking.currency} ${booking.amount}.\n\nPlease complete payment to confirm your booking.`;

  sendEmail({
    to: booking.email,
    subject: `Booking ${booking.id} created`,
    text: customerText,
  }).catch((error) => {
    console.error('Booking created email error:', error.message);
  });
};

const sendEnquiryCreatedEmail = (enquiryId) => {
  const enquiry = db
    .prepare(
      `
        SELECT e.id, e.full_name, e.email, e.phone_number, e.check_in_date, e.check_out_date, e.message,
               p.title AS property_title, p.location AS property_location
        FROM enquiries e
        JOIN properties p ON p.id = e.property_id
        WHERE e.id = ?
      `
    )
    .get(enquiryId);

  if (!enquiry) {
    return;
  }

  const customerText = `Hello ${enquiry.full_name},\n\nWe received your enquiry for ${enquiry.property_title} in ${enquiry.property_location}.\nPreferred check-in: ${enquiry.check_in_date || 'Not provided'}\nPreferred check-out: ${enquiry.check_out_date || 'Not provided'}\n\nOur team will reach out shortly.`;
  sendEmail({
    to: enquiry.email,
    subject: `Enquiry received for ${enquiry.property_title}`,
    text: customerText,
  }).catch((error) => {
    console.error('Enquiry customer email error:', error.message);
  });

  if (supportNotificationEmail) {
    const supportText = `New enquiry #${enquiry.id}\nProperty: ${enquiry.property_title} (${enquiry.property_location})\nName: ${enquiry.full_name}\nEmail: ${enquiry.email}\nPhone: ${enquiry.phone_number || 'Not provided'}\nCheck-in: ${enquiry.check_in_date || 'Not provided'}\nCheck-out: ${enquiry.check_out_date || 'Not provided'}\nMessage: ${enquiry.message || 'None'}`;
    sendEmail({
      to: supportNotificationEmail,
      subject: `New property enquiry #${enquiry.id}`,
      text: supportText,
    }).catch((error) => {
      console.error('Enquiry support email error:', error.message);
    });
  }
};

const hasBookingDateConflict = (propertyId, checkInDate, checkOutDate) => {
  const conflict = db
    .prepare(
      `
        SELECT id
        FROM bookings
        WHERE property_id = ?
          AND status IN (?, ?, ?)
          AND check_in_date IS NOT NULL
          AND check_out_date IS NOT NULL
          AND NOT (check_out_date <= ? OR check_in_date >= ?)
        LIMIT 1
      `
    )
    .get(
      propertyId,
      BOOKING_STATUS.pendingPayment,
      BOOKING_STATUS.awaitingMpesa,
      BOOKING_STATUS.confirmed,
      checkInDate,
      checkOutDate
    );

  return Boolean(conflict);
};

const getMpesaAccessToken = async () => {
  const token = Buffer.from(`${mpesaConsumerKey}:${mpesaConsumerSecret}`).toString('base64');
  const response = await fetch(`${mpesaBaseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: {
      Authorization: `Basic ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error('Unable to authenticate M-Pesa credentials.');
  }

  const payload = await response.json();
  if (!payload.access_token) {
    throw new Error('M-Pesa access token missing.');
  }

  return payload.access_token;
};

const normalizePropertyInput = (input = {}) => {
  let imageCandidates = [];

  if (Array.isArray(input.images)) {
    imageCandidates = input.images;
  } else if (typeof input.images === 'string') {
    try {
      const parsed = JSON.parse(input.images || '[]');
      imageCandidates = Array.isArray(parsed) ? parsed : [];
    } catch {
      imageCandidates = [];
    }
  }

  const normalizedImages = imageCandidates
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .slice(0, 6);

  if (!normalizedImages.length && input.image) {
    normalizedImages.push(String(input.image).trim());
  }

  return {
    type: String(input.type || '').trim(),
    title: String(input.title || '').trim(),
    location: String(input.location || '').trim(),
    price: asNumber(input.price),
    bedrooms: asNumber(input.bedrooms),
    bathrooms: asNumber(input.bathrooms),
    area: asNumber(input.area),
    image: normalizedImages[0] || '',
    images: JSON.stringify(normalizedImages),
    description: String(input.description || '').trim(),
    available: input.available ? 1 : 0,
  };
};

const formatProperty = (row) => {
  let parsedImages = [];
  try {
    const decoded = JSON.parse(String(row.images || '[]'));
    if (Array.isArray(decoded)) {
      parsedImages = decoded.map((value) => String(value || '').trim()).filter(Boolean);
    }
  } catch {
    parsedImages = [];
  }

  if (!parsedImages.length && row.image) {
    parsedImages = [String(row.image).trim()];
  }

  return {
    ...row,
    image: parsedImages[0] || '',
    images: parsedImages,
    available: Boolean(row.available),
  };
};

const unauthorized = (res) => res.status(401).json({ error: 'Unauthorized' });

const requireAuth = (req, res, next) => {
  const authorization = req.get('Authorization') || '';
  if (!authorization.startsWith('Bearer ')) {
    return unauthorized(res);
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    return unauthorized(res);
  }

  const session = db
    .prepare('SELECT token, username, expires_at FROM sessions WHERE token = ?')
    .get(token);

  if (!session || session.expires_at <= Date.now()) {
    return unauthorized(res);
  }

  const admin = db.prepare('SELECT username, role FROM admins WHERE username = ?').get(session.username);
  if (!admin) {
    return unauthorized(res);
  }

  req.auth = {
    token,
    username: admin.username,
    role: admin.role,
  };

  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (req.auth?.role !== 'superadmin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/ready', (_req, res) => {
  let dbOk = true;
  try {
    db.prepare('SELECT 1 AS ok').get();
  } catch {
    dbOk = false;
  }

  const ready = dbOk && !hasCriticalMissing;
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    dbOk,
    missingCoreEnv: preflightReport.core,
    providers: {
      stripeEnabled: Boolean(stripeClient && stripePublishableKey),
      mpesaEnabled: isMpesaConfigured,
      smtpEnabled: isSmtpConfigured,
    },
  });
});

app.get('/api/properties', (_req, res) => {
  const rows = db
    .prepare('SELECT id, type, title, location, price, bedrooms, bathrooms, area, image, images, description, available FROM properties ORDER BY id DESC')
    .all();
  res.json({ properties: rows.map(formatProperty) });
});

app.get('/api/properties/:id/availability', (req, res) => {
  const propertyId = Number(req.params.id);
  if (!Number.isFinite(propertyId)) {
    return res.status(400).json({ error: 'Invalid property id.' });
  }

  const property = db.prepare('SELECT id, available FROM properties WHERE id = ?').get(propertyId);
  if (!property) {
    return res.status(404).json({ error: 'Property not found.' });
  }

  const blockedRanges = db
    .prepare(
      `
        SELECT check_in_date, check_out_date, status
        FROM bookings
        WHERE property_id = ?
          AND status IN (?, ?, ?)
          AND check_in_date IS NOT NULL
          AND check_out_date IS NOT NULL
        ORDER BY check_in_date ASC
        LIMIT 24
      `
    )
    .all(
      propertyId,
      BOOKING_STATUS.pendingPayment,
      BOOKING_STATUS.awaitingMpesa,
      BOOKING_STATUS.confirmed
    );

  const checkInDate = String(req.query?.checkInDate || '').trim();
  const checkOutDate = String(req.query?.checkOutDate || '').trim();
  let isRequestedRangeAvailable = null;

  if (checkInDate || checkOutDate) {
    if (!isIsoDate(checkInDate) || !isIsoDate(checkOutDate)) {
      return res.status(400).json({ error: 'Dates must use YYYY-MM-DD format.' });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({ error: 'Check-out date must be after check-in date.' });
    }

    isRequestedRangeAvailable = !hasBookingDateConflict(propertyId, checkInDate, checkOutDate);
  }

  return res.json({
    propertyId,
    propertyAvailable: Boolean(property.available),
    blockedRanges,
    isRequestedRangeAvailable,
  });
});

app.post('/api/properties', requireAuth, (req, res) => {
  const property = normalizePropertyInput(req.body);
  if (!property.type || !property.title) {
    return res.status(400).json({ error: 'Type and title are required.' });
  }

  const now = Date.now();
  const insertResult = db
    .prepare(
      `
        INSERT INTO properties (type, title, location, price, bedrooms, bathrooms, area, image, images, description, available, created_at, updated_at)
        VALUES (@type, @title, @location, @price, @bedrooms, @bathrooms, @area, @image, @images, @description, @available, @created_at, @updated_at)
      `
    )
    .run({ ...property, created_at: now, updated_at: now });

  const created = db
    .prepare('SELECT id, type, title, location, price, bedrooms, bathrooms, area, image, images, description, available FROM properties WHERE id = ?')
    .get(insertResult.lastInsertRowid);
  res.status(201).json({ property: formatProperty(created) });
});

app.put('/api/properties/:id', requireAuth, (req, res) => {
  const propertyId = Number(req.params.id);
  if (!Number.isFinite(propertyId)) {
    return res.status(400).json({ error: 'Invalid property id.' });
  }

  const existing = db.prepare('SELECT id FROM properties WHERE id = ?').get(propertyId);
  if (!existing) {
    return res.status(404).json({ error: 'Property not found.' });
  }

  const property = normalizePropertyInput(req.body);
  if (!property.type || !property.title) {
    return res.status(400).json({ error: 'Type and title are required.' });
  }

  db.prepare(
    `
      UPDATE properties
      SET type=@type, title=@title, location=@location, price=@price, bedrooms=@bedrooms, bathrooms=@bathrooms,
          area=@area, image=@image, images=@images, description=@description, available=@available, updated_at=@updated_at
      WHERE id=@id
    `
  ).run({ ...property, updated_at: Date.now(), id: propertyId });

  const updated = db
    .prepare('SELECT id, type, title, location, price, bedrooms, bathrooms, area, image, images, description, available FROM properties WHERE id = ?')
    .get(propertyId);
  res.json({ property: formatProperty(updated) });
});

app.delete('/api/properties/:id', requireAuth, (req, res) => {
  const propertyId = Number(req.params.id);
  if (!Number.isFinite(propertyId)) {
    return res.status(400).json({ error: 'Invalid property id.' });
  }

  const deletion = db.prepare('DELETE FROM properties WHERE id = ?').run(propertyId);
  if (!deletion.changes) {
    return res.status(404).json({ error: 'Property not found.' });
  }

  res.json({ ok: true });
});

app.get('/api/site-content', (_req, res) => {
  const row = db.prepare('SELECT brand_name, contact_phone, contact_email, page_title FROM site_content WHERE id = 1').get();
  res.json({
    siteContent: {
      brandName: row?.brand_name || defaultSiteContent.brand_name,
      contactPhone: row?.contact_phone || defaultSiteContent.contact_phone,
      contactEmail: row?.contact_email || defaultSiteContent.contact_email,
      pageTitle: row?.page_title || defaultSiteContent.page_title,
    },
  });
});

app.put('/api/site-content', requireAuth, (req, res) => {
  const body = req.body || {};
  const next = {
    brand_name: String(body.brandName || '').trim() || defaultSiteContent.brand_name,
    contact_phone: String(body.contactPhone || '').trim() || defaultSiteContent.contact_phone,
    contact_email: String(body.contactEmail || '').trim() || defaultSiteContent.contact_email,
    page_title: String(body.pageTitle || '').trim() || defaultSiteContent.page_title,
  };

  db.prepare(
    `
      UPDATE site_content
      SET brand_name=@brand_name, contact_phone=@contact_phone, contact_email=@contact_email, page_title=@page_title
      WHERE id=1
    `
  ).run(next);

  res.json({
    siteContent: {
      brandName: next.brand_name,
      contactPhone: next.contact_phone,
      contactEmail: next.contact_email,
      pageTitle: next.page_title,
    },
  });
});

app.post('/api/auth/login', (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const admin = db.prepare('SELECT username, password_hash, role FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return unauthorized(res);
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;

  db.prepare('INSERT INTO sessions (token, username, expires_at) VALUES (?, ?, ?)').run(token, username, expiresAt);

  res.json({
    token,
    user: {
      username: admin.username,
      role: admin.role,
    },
  });
});

app.get('/api/auth/session', requireAuth, (req, res) => {
  res.json({
    user: {
      username: req.auth.username,
      role: req.auth.role,
    },
  });
});

app.post('/api/auth/logout', requireAuth, (req, res) => {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(req.auth.token);
  res.json({ ok: true });
});

app.get('/api/admins', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT username FROM admins ORDER BY username ASC').all();
  res.json({ admins: rows.map((row) => row.username) });
});

app.post('/api/admins', requireAuth, requireSuperAdmin, (req, res) => {
  const username = String(req.body?.username || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const existing = db.prepare('SELECT username FROM admins WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'That admin already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO admins (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)').run(
    username,
    passwordHash,
    'admin',
    Date.now()
  );

  res.status(201).json({ ok: true });
});

app.put('/api/admins/password', requireAuth, (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const nextPassword = String(req.body?.newPassword || '');

  if (!currentPassword || !nextPassword) {
    return res.status(400).json({ error: 'Current password and new password are required.' });
  }

  if (nextPassword.length < 8) {
    return res.status(400).json({ error: 'New password must be at least 8 characters long.' });
  }

  const admin = db
    .prepare('SELECT username, password_hash FROM admins WHERE username = ?')
    .get(req.auth.username);
  if (!admin || !bcrypt.compareSync(currentPassword, admin.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect.' });
  }

  const passwordHash = bcrypt.hashSync(nextPassword, 10);
  db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(passwordHash, req.auth.username);
  db.prepare('DELETE FROM sessions WHERE username = ? AND token != ?').run(req.auth.username, req.auth.token);

  return res.json({ ok: true, message: 'Password updated successfully.' });
});

app.delete('/api/admins/:username', requireAuth, requireSuperAdmin, (req, res) => {
  const username = String(req.params.username || '').trim().toLowerCase();
  if (!username) {
    return res.status(400).json({ error: 'Username is required.' });
  }

  if (username === req.auth.username) {
    return res.status(400).json({ error: 'You cannot remove your own admin account.' });
  }

  const deletion = db.prepare('DELETE FROM admins WHERE username = ?').run(username);
  db.prepare('DELETE FROM sessions WHERE username = ?').run(username);

  if (!deletion.changes) {
    return res.status(404).json({ error: 'Admin account not found.' });
  }

  res.json({ ok: true });
});

app.get('/api/payments/config', (_req, res) => {
  res.json({
    stripeEnabled: Boolean(stripeClient && stripePublishableKey),
    stripePublishableKey,
    mpesaEnabled: isMpesaConfigured,
  });
});

app.post('/api/enquiries', enquiryRateLimiter, (req, res) => {
  const propertyId = Number(req.body?.propertyId);
  const fullName = String(req.body?.fullName || '').trim();
  const email = String(req.body?.email || '').trim();
  const phoneNumber = String(req.body?.phoneNumber || '').trim();
  const checkInDate = String(req.body?.checkInDate || '').trim();
  const checkOutDate = String(req.body?.checkOutDate || '').trim();
  const message = String(req.body?.message || '').trim();
  const website = String(req.body?.website || '').trim();

  if (!Number.isFinite(propertyId)) {
    return res.status(400).json({ error: 'Property is required.' });
  }

  if (!fullName || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  if (!isLikelyEmail(email)) {
    return res.status(400).json({ error: 'Please provide a valid email address.' });
  }

  if (website) {
    return res.status(400).json({ error: 'Spam check failed.' });
  }

  if (message.length > 2000) {
    return res.status(400).json({ error: 'Message is too long.' });
  }

  if ((checkInDate && !isIsoDate(checkInDate)) || (checkOutDate && !isIsoDate(checkOutDate))) {
    return res.status(400).json({ error: 'Dates must use YYYY-MM-DD format.' });
  }

  if (checkInDate && checkOutDate && checkOutDate <= checkInDate) {
    return res.status(400).json({ error: 'Check-out date must be after check-in date.' });
  }

  const property = db.prepare('SELECT id, title FROM properties WHERE id = ?').get(propertyId);
  if (!property) {
    return res.status(404).json({ error: 'Property not found.' });
  }

  const now = Date.now();
  const insertResult = db
    .prepare(
      `
        INSERT INTO enquiries (property_id, full_name, email, phone_number, check_in_date, check_out_date, message, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)
      `
    )
    .run(propertyId, fullName, email, phoneNumber, checkInDate || null, checkOutDate || null, message, now);

  sendEnquiryCreatedEmail(insertResult.lastInsertRowid);

  return res.status(201).json({
    enquiry: {
      id: insertResult.lastInsertRowid,
      propertyId,
      status: 'new',
    },
  });
});

app.get('/api/admin/enquiries', requireAuth, (_req, res) => {
  const enquiries = db
    .prepare(
      `
        SELECT e.id, e.property_id, e.full_name, e.email, e.phone_number, e.check_in_date, e.check_out_date,
               e.message, e.status, e.created_at,
               p.title AS property_title, p.location AS property_location
        FROM enquiries e
        JOIN properties p ON p.id = e.property_id
        ORDER BY e.created_at DESC
        LIMIT 200
      `
    )
    .all();

  return res.json({ enquiries });
});

app.put('/api/admin/enquiries/:id/status', requireAuth, (req, res) => {
  const enquiryId = Number(req.params.id);
  const nextStatus = String(req.body?.status || '').trim().toLowerCase();
  const allowedStatuses = new Set(['new', 'contacted', 'closed']);

  if (!Number.isFinite(enquiryId)) {
    return res.status(400).json({ error: 'Invalid enquiry id.' });
  }

  if (!allowedStatuses.has(nextStatus)) {
    return res.status(400).json({ error: 'Invalid enquiry status.' });
  }

  const updateResult = db
    .prepare('UPDATE enquiries SET status = ? WHERE id = ?')
    .run(nextStatus, enquiryId);

  if (!updateResult.changes) {
    return res.status(404).json({ error: 'Enquiry not found.' });
  }

  return res.json({ ok: true, enquiryId, status: nextStatus });
});

app.post('/api/bookings', (req, res) => {
  const propertyId = Number(req.body?.propertyId);
  const fullName = String(req.body?.fullName || '').trim();
  const email = String(req.body?.email || '').trim();
  const phoneNumber = String(req.body?.phoneNumber || '').trim();
  const checkInDate = String(req.body?.checkInDate || '').trim();
  const checkOutDate = String(req.body?.checkOutDate || '').trim();
  const notes = String(req.body?.notes || '').trim();

  if (!Number.isFinite(propertyId)) {
    return res.status(400).json({ error: 'Property is required.' });
  }

  if (!fullName || !email || !phoneNumber) {
    return res.status(400).json({ error: 'Name, email, and phone are required.' });
  }

  if (!checkInDate || !checkOutDate) {
    return res.status(400).json({ error: 'Check-in and check-out dates are required.' });
  }

  if (!isIsoDate(checkInDate) || !isIsoDate(checkOutDate)) {
    return res.status(400).json({ error: 'Dates must use YYYY-MM-DD format.' });
  }

  if (checkOutDate <= checkInDate) {
    return res.status(400).json({ error: 'Check-out date must be after check-in date.' });
  }

  const property = db
    .prepare('SELECT id, price, available FROM properties WHERE id = ?')
    .get(propertyId);

  if (!property) {
    return res.status(404).json({ error: 'Property not found.' });
  }

  if (!property.available) {
    return res.status(400).json({ error: 'This property is currently unavailable.' });
  }

  if (hasBookingDateConflict(propertyId, checkInDate, checkOutDate)) {
    return res.status(409).json({ error: 'Selected dates are no longer available for this property.' });
  }

  const now = Date.now();
  const amount = asNumber(property.price);

  const insertResult = db
    .prepare(
      `
        INSERT INTO bookings (property_id, full_name, email, phone_number, check_in_date, check_out_date, notes, amount, currency, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'KES', ?, ?, ?)
      `
    )
    .run(propertyId, fullName, email, phoneNumber, checkInDate, checkOutDate, notes, amount, BOOKING_STATUS.pendingPayment, now, now);

  const booking = db
    .prepare('SELECT id, property_id, amount, currency, status FROM bookings WHERE id = ?')
    .get(insertResult.lastInsertRowid);

  sendBookingCreatedEmail(booking.id);

  res.status(201).json({ booking });
});

app.get('/api/bookings/:id', requireAuth, (req, res) => {
  const bookingId = Number(req.params.id);
  if (!Number.isFinite(bookingId)) {
    return res.status(400).json({ error: 'Invalid booking id.' });
  }

  const booking = db
    .prepare(
      `
        SELECT id, property_id, full_name, email, phone_number, check_in_date, check_out_date,
               notes, amount, currency, status, created_at
        FROM bookings
        WHERE id = ?
      `
    )
    .get(bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  res.json({ booking });
});

app.post('/api/payments/stripe/checkout-session', async (req, res) => {
  const bookingId = Number(req.body?.bookingId);
  if (!Number.isFinite(bookingId)) {
    return res.status(400).json({ error: 'Booking id is required.' });
  }

  if (!stripeClient || !stripePublishableKey) {
    return res.status(400).json({ error: 'Stripe is not configured.' });
  }

  const booking = db
    .prepare(
      `
        SELECT b.id, b.amount, b.currency, b.status, p.title
        FROM bookings b
        JOIN properties p ON p.id = b.property_id
        WHERE b.id = ?
      `
    )
    .get(bookingId);

  if (!booking) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  if (booking.status === BOOKING_STATUS.confirmed) {
    return res.status(400).json({ error: 'Booking is already paid.' });
  }

  if (booking.status === BOOKING_STATUS.cancelled) {
    return res.status(400).json({ error: 'Booking is cancelled and cannot be paid.' });
  }

  try {
    const session = await stripeClient.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'kes',
            unit_amount: Math.round(asNumber(booking.amount) * 100),
            product_data: {
              name: booking.title || `Booking #${booking.id}`,
            },
          },
        },
      ],
      metadata: {
        bookingId: String(booking.id),
      },
      success_url: `${appBaseUrl}/#/payment-result?status=success&bookingId=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/#/payment-result?status=cancel&bookingId=${booking.id}`,
    });

    const now = Date.now();
    db.prepare(
      `
        INSERT INTO payments (booking_id, provider, external_id, status, amount, currency, metadata, created_at, updated_at)
        VALUES (?, 'stripe', ?, 'pending', ?, 'KES', ?, ?, ?)
      `
    ).run(booking.id, session.id, booking.amount, JSON.stringify({ checkoutSession: session.id }), now, now);

    res.json({ sessionId: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to create Stripe checkout session.' });
  }
});

app.post('/api/payments/stripe/verify-session', async (req, res) => {
  const bookingId = Number(req.body?.bookingId);
  const sessionId = String(req.body?.sessionId || '').trim();

  if (!Number.isFinite(bookingId) || !sessionId) {
    return res.status(400).json({ error: 'Booking id and session id are required.' });
  }

  if (!stripeClient) {
    return res.status(400).json({ error: 'Stripe is not configured.' });
  }

  try {
    const session = await stripeClient.checkout.sessions.retrieve(sessionId);
    const sessionBookingId = Number(session.metadata?.bookingId || 0);

    if (!Number.isFinite(sessionBookingId) || sessionBookingId <= 0) {
      return res.status(409).json({ error: 'Stripe session is missing booking metadata.' });
    }

    if (sessionBookingId !== bookingId) {
      return res.status(409).json({ error: 'Stripe session does not match this booking.' });
    }

    const paymentRecord = db
      .prepare(
        `
          SELECT id, status
          FROM payments
          WHERE booking_id = ? AND provider = 'stripe' AND external_id = ?
          LIMIT 1
        `
      )
      .get(bookingId, sessionId);

    if (!paymentRecord) {
      return res.status(404).json({ error: 'No Stripe payment record found for this booking session.' });
    }

    if (session.payment_status !== 'paid') {
      return res.json({ verified: false, status: session.payment_status });
    }

    const now = Date.now();
    const transition = updateBookingStatus(bookingId, BOOKING_STATUS.confirmed);
    if (!transition.ok) {
      return res.status(409).json({ error: transition.error });
    }

    db.prepare(
      `
        UPDATE payments
        SET status = 'paid', updated_at = ?
        WHERE booking_id = ? AND provider = 'stripe' AND external_id = ?
      `
    ).run(now, bookingId, sessionId);

    res.json({ verified: true });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to verify Stripe payment.' });
  }
});

app.post('/api/payments/stripe/webhook', (req, res) => {
  if (!stripeClient || !stripeWebhookSecret) {
    return res.status(400).send('Stripe webhook not configured');
  }

  const signature = req.headers['stripe-signature'];
  if (!signature) {
    return res.status(400).send('Missing stripe signature');
  }

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  const onCheckoutSessionCompleted = (session) => {
    const bookingId = Number(session.metadata?.bookingId || 0);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return;
    }

    const now = Date.now();
    updateBookingStatus(bookingId, BOOKING_STATUS.confirmed);
    db.prepare(
      `
        UPDATE payments
        SET status = 'paid', updated_at = ?
        WHERE booking_id = ? AND provider = 'stripe' AND external_id = ?
      `
    ).run(now, bookingId, session.id);
  };

  const onCheckoutSessionFailed = (session) => {
    const bookingId = Number(session.metadata?.bookingId || 0);
    if (!Number.isFinite(bookingId) || bookingId <= 0) {
      return;
    }

    const now = Date.now();
    updateBookingStatus(bookingId, BOOKING_STATUS.paymentFailed);
    db.prepare(
      `
        UPDATE payments
        SET status = 'failed', updated_at = ?
        WHERE booking_id = ? AND provider = 'stripe' AND external_id = ?
      `
    ).run(now, bookingId, session.id);
  };

  if (event.type === 'checkout.session.completed') {
    onCheckoutSessionCompleted(event.data.object);
  }

  if (event.type === 'checkout.session.expired' || event.type === 'checkout.session.async_payment_failed') {
    onCheckoutSessionFailed(event.data.object);
  }

  res.json({ received: true });
});

app.post('/api/payments/mpesa/stk-push', async (req, res) => {
  const bookingId = Number(req.body?.bookingId);
  const phoneNumber = normalizeMpesaPhone(req.body?.phoneNumber);

  if (!Number.isFinite(bookingId) || !phoneNumber) {
    return res.status(400).json({ error: 'Booking id and phone number are required.' });
  }

  const booking = db.prepare('SELECT id, amount, status FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  if (booking.status === BOOKING_STATUS.confirmed) {
    return res.status(400).json({ error: 'Booking is already paid.' });
  }

  if (booking.status === BOOKING_STATUS.cancelled) {
    return res.status(400).json({ error: 'Booking is cancelled and cannot be paid.' });
  }

  const transitionToAwaiting = updateBookingStatus(bookingId, BOOKING_STATUS.awaitingMpesa);
  if (!transitionToAwaiting.ok) {
    return res.status(409).json({ error: transitionToAwaiting.error });
  }

  const now = Date.now();

  if (!isMpesaConfigured) {
    const checkoutRequestId = `SIMULATED-${bookingId}-${now}`;
    db.prepare(
      `
        INSERT INTO payments (booking_id, provider, external_id, status, amount, currency, metadata, created_at, updated_at)
        VALUES (?, 'mpesa', ?, 'pending', ?, 'KES', ?, ?, ?)
      `
    ).run(bookingId, checkoutRequestId, booking.amount, JSON.stringify({ simulated: true }), now, now);

    return res.json({
      checkoutRequestId,
      message: 'M-Pesa not configured yet. Simulated request created.',
      simulated: true,
    });
  }

  try {
    const accessToken = await getMpesaAccessToken();
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const password = Buffer.from(`${mpesaShortcode}${mpesaPasskey}${timestamp}`).toString('base64');

    const response = await fetch(`${mpesaBaseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        BusinessShortCode: mpesaShortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.max(1, Math.round(asNumber(booking.amount))),
        PartyA: phoneNumber,
        PartyB: mpesaShortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: mpesaCallbackUrl,
        AccountReference: `BOOKING-${bookingId}`,
        TransactionDesc: `Booking ${bookingId}`,
      }),
    });

    const payload = await response.json();
    if (!response.ok || payload.ResponseCode !== '0') {
      return res.status(500).json({ error: payload.errorMessage || payload.ResponseDescription || 'M-Pesa request failed.' });
    }

    db.prepare(
      `
        INSERT INTO payments (booking_id, provider, external_id, status, amount, currency, metadata, created_at, updated_at)
        VALUES (?, 'mpesa', ?, 'pending', ?, 'KES', ?, ?, ?)
      `
    ).run(
      bookingId,
      payload.CheckoutRequestID,
      booking.amount,
      JSON.stringify({ merchantRequestId: payload.MerchantRequestID }),
      now,
      now
    );

    res.json({
      checkoutRequestId: payload.CheckoutRequestID,
      message: payload.CustomerMessage || 'M-Pesa prompt sent to customer phone.',
      simulated: false,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Unable to initiate M-Pesa request.' });
  }
});

app.post('/api/payments/mpesa/callback', (req, res) => {
  const callback = req.body?.Body?.stkCallback;
  const checkoutRequestId = callback?.CheckoutRequestID;
  const resultCode = Number(callback?.ResultCode);

  if (!checkoutRequestId) {
    return res.json({ ok: true });
  }

  const payment = db.prepare('SELECT booking_id FROM payments WHERE external_id = ?').get(checkoutRequestId);
  if (!payment) {
    return res.json({ ok: true });
  }

  const now = Date.now();
  if (resultCode === 0) {
    db.prepare('UPDATE payments SET status = ?, updated_at = ? WHERE external_id = ?').run('paid', now, checkoutRequestId);
    updateBookingStatus(payment.booking_id, BOOKING_STATUS.confirmed);
  } else {
    db.prepare('UPDATE payments SET status = ?, updated_at = ? WHERE external_id = ?').run('failed', now, checkoutRequestId);
    updateBookingStatus(payment.booking_id, BOOKING_STATUS.paymentFailed);
  }

  res.json({ ok: true });
});

app.get('/api/admin/reconciliation', requireAuth, (req, res) => {
  const items = db
    .prepare(
      `
        SELECT
          b.id AS booking_id,
          b.status AS booking_status,
          b.full_name,
          b.email,
          b.phone_number,
          b.check_in_date,
          b.check_out_date,
          b.amount,
          b.currency,
          b.created_at,
          p.title AS property_title,
          p.location AS property_location,
          py.provider AS payment_provider,
          py.status AS payment_status,
          py.external_id AS payment_reference,
          py.updated_at AS payment_updated_at
        FROM bookings b
        JOIN properties p ON p.id = b.property_id
        LEFT JOIN payments py ON py.id = (
          SELECT p2.id
          FROM payments p2
          WHERE p2.booking_id = b.id
          ORDER BY p2.created_at DESC
          LIMIT 1
        )
        ORDER BY b.created_at DESC
        LIMIT 400
      `
    )
    .all();

  res.json({ items });
});

app.post('/api/payments/refund', requireAuth, async (req, res) => {
  const bookingId = Number(req.body?.bookingId);
  const reason = String(req.body?.reason || '').trim();

  if (!Number.isFinite(bookingId)) {
    return res.status(400).json({ error: 'Booking id is required.' });
  }

  const booking = db.prepare('SELECT id, status FROM bookings WHERE id = ?').get(bookingId);
  if (!booking) {
    return res.status(404).json({ error: 'Booking not found.' });
  }

  if (booking.status !== BOOKING_STATUS.confirmed) {
    return res.status(400).json({ error: 'Only confirmed bookings can be refunded.' });
  }

  const payment = db
    .prepare(
      `
        SELECT id, provider, external_id, status, amount, metadata
        FROM payments
        WHERE booking_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `
    )
    .get(bookingId);

  if (!payment) {
    return res.status(404).json({ error: 'No payment record found for this booking.' });
  }

  if (payment.status === 'refunded') {
    return res.status(400).json({ error: 'Payment is already refunded.' });
  }

  const now = Date.now();

  if (payment.provider === 'stripe') {
    if (!stripeClient) {
      return res.status(400).json({ error: 'Stripe is not configured.' });
    }

    try {
      const session = await stripeClient.checkout.sessions.retrieve(payment.external_id, {
        expand: ['payment_intent'],
      });

      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;

      if (!paymentIntentId) {
        return res.status(400).json({ error: 'Stripe payment intent not found for this booking.' });
      }

      const refund = await stripeClient.refunds.create({
        payment_intent: paymentIntentId,
        reason: 'requested_by_customer',
        metadata: {
          bookingId: String(bookingId),
          admin: req.auth.username,
          reason,
        },
      });

      db.prepare(
        `
          UPDATE payments
          SET status = 'refunded', metadata = ?, updated_at = ?
          WHERE id = ?
        `
      ).run(
        JSON.stringify({
          ...parseJsonObject(payment.metadata),
          refundId: refund.id,
          refundReason: reason,
        }),
        now,
        payment.id
      );

      const transition = updateBookingStatus(bookingId, BOOKING_STATUS.refunded);
      if (!transition.ok) {
        return res.status(409).json({ error: transition.error });
      }

      return res.json({ ok: true, provider: 'stripe', refundId: refund.id });
    } catch (error) {
      return res.status(500).json({ error: error.message || 'Unable to process Stripe refund.' });
    }
  }

  if (payment.provider === 'mpesa') {
    if (isMpesaConfigured) {
      db.prepare(
        `
          UPDATE payments
          SET status = 'refund_requested', metadata = ?, updated_at = ?
          WHERE id = ?
        `
      ).run(
        JSON.stringify({
          ...parseJsonObject(payment.metadata),
          refundRequestedBy: req.auth.username,
          refundReason: reason,
          manualActionRequired: true,
        }),
        now,
        payment.id
      );

      return res.json({
        ok: true,
        provider: 'mpesa',
        manual: true,
        message: 'M-Pesa refund request logged. Complete reversal in your M-Pesa business portal or reversal API workflow.',
      });
    }

    db.prepare(
      `
        UPDATE payments
        SET status = 'refunded', metadata = ?, updated_at = ?
        WHERE id = ?
      `
    ).run(
      JSON.stringify({
        ...parseJsonObject(payment.metadata),
        simulatedRefund: true,
        refundReason: reason,
      }),
      now,
      payment.id
    );

    const transition = updateBookingStatus(bookingId, BOOKING_STATUS.refunded);
    if (!transition.ok) {
      return res.status(409).json({ error: transition.error });
    }

    return res.json({ ok: true, provider: 'mpesa', simulated: true });
  }

  return res.status(400).json({ error: 'Unsupported payment provider for refunds.' });
});

app.get('/sign-s3', requireAuth, (req, res) => {
  const { filename, filetype } = req.query;
  if (!filename || !filetype) {
    return res.status(400).json({ error: 'Missing filename or filetype' });
  }

  if (!allowedMimeTypes.has(filetype)) {
    return res.status(400).json({ error: 'Unsupported filetype' });
  }

  const safeFilename = sanitizeFilename(filename);
  if (!safeFilename) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  if (!hasS3Credentials) {
    const uniqueFilename = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeFilename}`;
    const uploadUrl = `/uploads/${encodeURIComponent(uniqueFilename)}`;
    return res.json({ url: uploadUrl, publicUrl: uploadUrl });
  }

  const s3Key = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}-${safeFilename}`;
  const region = process.env.AWS_REGION || 'us-east-1';
  const publicUrl = `https://${BUCKET}.s3.${region}.amazonaws.com/${s3Key}`;

  const params = {
    Bucket: BUCKET,
    Key: s3Key,
    Expires: 300, // 5 minutes — only needed for the upload itself
    ContentType: filetype,
  };

  // New S3 buckets often use bucket-owner-enforced mode where ACL headers are rejected.
  // Keep ACL optional for legacy buckets that still require object-level ACLs.
  if (useLegacyObjectAcl) {
    params.ACL = 'public-read';
  }

  s3.getSignedUrl('putObject', params, (err, url) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ url, publicUrl });
  });
});

app.put('/uploads/:filename', requireAuth, express.raw({ type: '*/*', limit: '55mb' }), (req, res) => {
  const filetypeHeader = String(req.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!allowedMimeTypes.has(filetypeHeader)) {
    return res.status(400).json({ error: 'Unsupported filetype' });
  }

  const safeFilename = sanitizeFilename(req.params.filename);
  if (!safeFilename) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const payload = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(req.body || '');

  if (!payload.length) {
    return res.status(400).json({ error: 'Missing upload body' });
  }

  try {
    fs.writeFileSync(path.join(localUploadsDir, safeFilename), payload);
    return res.status(200).end();
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Unable to persist upload locally.' });
  }
});

app.use('/uploads', express.static(localUploadsDir));

app.use((error, _req, res, next) => {
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Request payload is too large. Remove oversized embedded media and re-upload as hosted files.',
    });
  }

  return next(error);
});

const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));

  app.get(/^(?!\/api\/|\/api$|\/sign-s3|\/health).*/, (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
