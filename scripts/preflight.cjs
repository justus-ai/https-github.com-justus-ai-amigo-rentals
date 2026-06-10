#!/usr/bin/env node

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const strict = process.argv.includes('--strict');
const mode = modeArg ? modeArg.replace('--mode=', '') : (process.env.NODE_ENV || 'development');

const requiredAlways = [
  'PORT',
  'APP_BASE_URL',
  'CORS_ORIGINS',
  'ADMIN_INITIAL_USERNAME',
  'ADMIN_INITIAL_PASSWORD',
];

const requiredStripe = [
  'STRIPE_SECRET_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
];

const requiredMpesa = [
  'MPESA_CONSUMER_KEY',
  'MPESA_CONSUMER_SECRET',
  'MPESA_SHORTCODE',
  'MPESA_PASSKEY',
  'MPESA_CALLBACK_URL',
];

const requiredSmtp = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'SUPPORT_NOTIFICATION_EMAIL',
];

const readMissing = (keys) => keys.filter((key) => !String(process.env[key] || '').trim());

const sections = [
  { name: 'core', keys: requiredAlways },
  { name: 'stripe', keys: requiredStripe },
  { name: 'mpesa', keys: requiredMpesa },
  { name: 'smtp', keys: requiredSmtp },
];

const report = sections.map((section) => ({
  name: section.name,
  missing: readMissing(section.keys),
}));

const hasMissing = report.some((section) => section.missing.length > 0);

console.log(`Preflight mode: ${mode}`);
for (const section of report) {
  if (section.missing.length === 0) {
    console.log(`- ${section.name}: ok`);
  } else {
    console.log(`- ${section.name}: missing ${section.missing.join(', ')}`);
  }
}

const shouldFail = strict || mode === 'production';
if (hasMissing && shouldFail) {
  console.error('Preflight failed: missing required configuration values.');
  process.exit(1);
}

if (hasMissing) {
  console.warn('Preflight warning: missing values found, but failing is disabled in non-production mode.');
}
