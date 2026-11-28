#!/usr/bin/env node
/**
 * scripts/check-route-auth.js
 * Audits actual Express route definitions in backend/routes/*.js to verify
 * every mutating route (POST/PUT/PATCH/DELETE) either has authentication
 * middleware (route-level or prior router.use) or is in the explicit public allowlist.
 */
const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, '../backend/routes');
const routeFiles = fs.readdirSync(routesDir).filter(f => f.endsWith('.js')).sort();

const AUTH_MIDDLEWARE_RE = /\b(requireAdminAuth|requireScorerAuth|requirePlayerAuth|requireTeamAuth|requireUmpireAuth|requireContentAuth|requireDualAdminAuth|verifyToken|verifyMatchPermission|authenticate)\b/;

const allowedPublicPrefixes = [
  '/send-registration-otp',
  '/verify-registration-otp',
  '/check-registration-exists',
  '/check-team-exists',
  '/check-player-email',
  '/forgot-password/',
  '/login',
  '/admin/login',
  '/super-admin/login',
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
  '/verify-email',
  '/send-otp',
  '/auth/',
  '/verify-qr'
];

const violations = [];
let totalMutating = 0;

for (const file of routeFiles) {
  const fullPath = path.join(routesDir, file);
  const src = fs.readFileSync(fullPath, 'utf8');
  const lines = src.split('\n');

  let routerAuthActive = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect file-level router.use(require*Auth)
    if (/router\.use\s*\(/.test(line) && AUTH_MIDDLEWARE_RE.test(line)) {
      routerAuthActive = true;
    }

    const routeMatch = line.match(/router\.(post|put|patch|delete)\s*\(\s*(['"`\[])([^'"`\]]+)/i);
    if (!routeMatch) continue;

    totalMutating++;
    const method = routeMatch[1].toUpperCase();
    const routePath = routeMatch[3];
    // Inspect up to 4 lines of the route declaration for inline middleware
    const declSnippet = lines.slice(i, Math.min(i + 4, lines.length)).join(' ');
    const hasAuth = routerAuthActive || AUTH_MIDDLEWARE_RE.test(declSnippet);

    if (!hasAuth) {
      const ok = allowedPublicPrefixes.some(p => routePath === p || routePath.startsWith(p));
      if (!ok) {
        violations.push(`${file}:${i + 1} ${method} ${routePath}`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error('❌ Unprotected public mutating routes found in backend/routes/*.js:');
  violations.forEach(v => console.error(`  - ${v}`));
  process.exit(1);
}

console.log(`check-route-auth: PASS (${totalMutating} mutating routes scanned across ${routeFiles.length} route files; all public routes allowlisted)`);
