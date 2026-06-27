#!/usr/bin/env node
/* eslint-disable no-console */
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const usernameArg = process.argv[2];
const passwordArg = process.argv[3];

const username = String(usernameArg || '').trim().toLowerCase();
const password = String(passwordArg || '');

if (!username || !password) {
  console.error('Usage: node scripts/reset-admin-password.cjs <username> <new-password>');
  process.exit(1);
}

const dbPath = path.join(__dirname, '..', 'data', 'amigo-rentals.db');
const db = new Database(dbPath);

const admin = db.prepare('SELECT username FROM admins WHERE username = ?').get(username);
if (!admin) {
  console.error(`Admin user not found: ${username}`);
  process.exit(1);
}

const passwordHash = bcrypt.hashSync(password, 10);
const result = db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(passwordHash, username);

if (result.changes !== 1) {
  console.error('Password update failed.');
  process.exit(1);
}

console.log(`Password reset for admin: ${username}`);
