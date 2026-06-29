#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const usernameArg = process.argv[2];
const passwordArg = process.argv[3];
const roleArg = process.argv[4] || 'admin';

const username = String(usernameArg || '').trim().toLowerCase();
const password = String(passwordArg || '');
const role = String(roleArg || 'admin').trim().toLowerCase();
const allowedRoles = new Set(['admin', 'superadmin']);

if (!username || !password) {
  console.error('Usage: node scripts/ensure-admin.cjs <username> <password> [admin|superadmin]');
  process.exit(1);
}

if (!allowedRoles.has(role)) {
  console.error('Role must be one of: admin, superadmin');
  process.exit(1);
}

const defaultDbPath = path.join(__dirname, '..', 'data', 'amigo-rentals.db');
const configuredDbPath = String(process.env.DB_PATH || defaultDbPath).trim();
const dbPath = path.isAbsolute(configuredDbPath)
  ? configuredDbPath
  : path.join(__dirname, '..', configuredDbPath);

const db = new Database(dbPath);
const passwordHash = bcrypt.hashSync(password, 10);
const now = Date.now();

const existing = db.prepare('SELECT username FROM admins WHERE username = ?').get(username);
if (existing) {
  db.prepare('UPDATE admins SET password_hash = ?, role = ? WHERE username = ?').run(passwordHash, role, username);
  console.log(`Updated admin: ${username} (${role})`);
  process.exit(0);
}

db.prepare('INSERT INTO admins (username, password_hash, role, created_at) VALUES (?, ?, ?, ?)').run(
  username,
  passwordHash,
  role,
  now
);

console.log(`Created admin: ${username} (${role})`);
