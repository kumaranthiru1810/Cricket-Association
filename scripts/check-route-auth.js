#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const matrixPath = path.join(__dirname, '../docs/ROUTE_AUTH_MATRIX.md');
if (!fs.existsSync(matrixPath)) {
  console.error('Missing docs/ROUTE_AUTH_MATRIX.md');
  process.exit(1);
}

const allowedPublicPrefixes = [
  '/send-registration-otp',
  '/verify-registration-otp',
  '/check-registration-exists',
  '/check-team-exists',
  '/forgot-password/',
  '/login',
  '/admin/login',
  '/logout',
  '/request-otp',
  '/verify-otp',
  '/team/request-otp',
  '/team/verify-otp',
  '/player/request-otp',
  '/player/verify-otp',
  '/player/find-team',
  '/register',
  '/contact',
  '/verify-email'
];

const lines = fs.readFileSync(matrixPath, 'utf8').split('\n');
const violations = [];
for (const line of lines) {
  if (!line.startsWith('| ') || line.startsWith('| File') || line.startsWith('|---')) continue;
  const parts = line.split('|').map(s => s.trim()).filter(Boolean);
  if (parts.length < 4) continue;
  const [file, method, routePath, auth] = parts;
  if (method !== 'GET' && auth === 'PUBLIC') {
    const ok = allowedPublicPrefixes.some(p => routePath === p || routePath.startsWith(p));
    if (!ok) violations.push(`${file} ${method} ${routePath}`);
  }
}

if (violations.length > 0) {
  console.error('Unexpected public mutating routes:', violations);
  process.exit(1);
}
console.log('check-route-auth: PASS (all public mutating routes are in allowlist)');

