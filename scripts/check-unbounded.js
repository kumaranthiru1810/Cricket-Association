#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const whitelist = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'unbounded-whitelist.json'), 'utf8')
);
const allowedFiles = new Set(whitelist.files || []);
const findings = [];

for (const dir of ['backend/routes', 'backend/controllers', 'backend/services']) {
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.js')) {
        const normalized = full.replace(/\\/g, '/');
        if (allowedFiles.has(normalized)) continue;
        const lines = fs.readFileSync(full, 'utf8').split('\n');
        lines.forEach((l, i) => {
          if (
            /\.find\(\s*(\{\s*\})?\s*\)/.test(l) &&
            !l.includes('.limit(') &&
            !lines.slice(i, i + 4).join(' ').includes('.limit(')
          ) {
            findings.push(`${normalized}:${i + 1}`);
          }
        });
      }
    }
  };
  walk(dir);
}

if (findings.length > 0) {
  console.error('Unbounded .find()/.find({}) without .limit():', findings);
  process.exit(1);
}
console.log('check-unbounded: PASS (0 unwhitelisted unbounded queries)');

