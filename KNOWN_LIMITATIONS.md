# Known Limitations

The following verification items could not be executed in the current local environment and should be run in CI or on the target Linux host with internet/tooling access:

1. **`npm audit fix` / `npm audit --omit=dev --audit-level=high`**:
   - Offline/DNS limitation (`getaddrinfo EAI_AGAIN registry.npmjs.org`) prevented reaching the npm registry from this environment. Earlier cached audit showed 2 high vulnerabilities (`body-parser`, `mongoose`) in `backend/` with `npm audit fix` available. Run `cd backend && npm audit fix && npm audit --omit=dev --audit-level=high` once online.
2. **Playwright Responsive & Cross-Browser Suite (`scripts/responsive-check.js`) & Lighthouse CI**:
   - `playwright` and `lighthouse` packages are not installed locally and could not be downloaded offline. Run via CI (`.github/workflows/ci.yml`) or after installing `playwright` and `@lhci/cli`.
3. **`docker compose -f docker-compose.prod.yml config` CLI validation**:
   - `docker` binary is present without the `compose` v2 CLI plugin (`unknown shorthand flag: 'f'`), so Compose YAML validation should be run on the target Ubuntu server after installing `docker-compose-plugin`.
4. **MongoDB Single-Node Replica Set Transactions (`--replSet rs0`)**:
   - The local development `mongodb` container runs as a standalone instance without `--replSet rs0`; the scoring engine uses its compensating rollback fallback locally and requires `--replSet rs0` initialization in production.

