#!/usr/bin/env node

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const strict = process.argv.includes('--strict');
const mode = modeArg ? modeArg.replace('--mode=', '') : (process.env.NODE_ENV || 'development');

const requiredAlways = [
  'PORT',
  'APP_BASE_URL',
  'CORS_ORIGINS',
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
const hasAnyEnv = (keys) => keys.some((key) => String(process.env[key] || '').trim());
const hasAllEnv = (keys) => keys.every((key) => String(process.env[key] || '').trim());

const coreMissing = readMissing(requiredAlways);
if (!hasAnyEnv(['ADMIN_INITIAL_USERNAME', 'ADMIN_USERNAME'])) {
  coreMissing.push('ADMIN_INITIAL_USERNAME (or ADMIN_USERNAME)');
}
if (!hasAnyEnv(['ADMIN_INITIAL_PASSWORD', 'ADMIN_PASSWORD'])) {
  coreMissing.push('ADMIN_INITIAL_PASSWORD (or ADMIN_PASSWORD)');
}

const sections = [
  { name: 'core', missing: coreMissing, required: true },
  { name: 'stripe', keys: requiredStripe, optional: true },
  { name: 'mpesa', keys: requiredMpesa, optional: true },
  { name: 'smtp', keys: requiredSmtp, optional: true },
];

const report = sections.map((section) => ({
  name: section.name,
  required: Boolean(section.required),
  missing: section.missing || readMissing(section.keys),
  configured: section.keys ? hasAllEnv(section.keys) : section.missing.length === 0,
  partiallyConfigured: section.optional ? hasAnyEnv(section.keys) && !hasAllEnv(section.keys) : false,
}));

const hasMissing = report.some((section) => section.missing.length > 0);
const hasCriticalMissing = report.some((section) => section.required && section.missing.length > 0);
const hasPartialOptionalConfig = report.some((section) => section.partiallyConfigured);

console.log(`Preflight mode: ${mode}`);
for (const section of report) {
  if (section.missing.length === 0) {
    console.log(`- ${section.name}: ok`);
  } else if (section.partiallyConfigured) {
    console.log(`- ${section.name}: partially configured, missing ${section.missing.join(', ')}`);
  } else {
    console.log(`- ${section.name}: missing ${section.missing.join(', ')}`);
  }
}

const shouldFail = strict || mode === 'production';
if ((hasCriticalMissing || hasPartialOptionalConfig) && shouldFail) {
  console.error('Preflight failed: missing required configuration values.');
  process.exit(1);
}

if (hasMissing) {
  console.warn('Preflight warning: optional integrations are not configured; related features will be disabled.');
}
