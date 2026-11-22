# Dual-Admin Approval & SUPER_ADMIN / ADMIN Role System

**Cricket Federation of Virudhunagar District (CFVD)**  
*Document Version: 1.0 (Production Security Architecture)*

---

## 1. Architectural Overview

The CFVD administrative governance framework enforces a high-security, multi-party authorization model for all administrative promotions and demotions.

```
       ┌────────────────────────┐
       │   SUPER_ADMIN (Env)    │  <-- Permanent, indestructible, immune to removal
       └───────────┬────────────┘
                   │
    ┌──────────────┴──────────────┐
    │     ADMIN (Dual-Governed)   │  <-- Created/Removed only via 2-Admin OTP Protocol
    └──────────────┬──────────────┘
                   │
    ┌──────────────┴──────────────┐
    │ COACH / SCORER / UMPIRE ... │  <-- Standard operational roles
    └─────────────────────────────┘
```

### Role Model
1. **`SUPER_ADMIN`**:
   - Seeded once from environment variables (`SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_PASSWORD`).
   - Immune to deletion, demotion, suspension, or modification through any API or UI.
   - Can approve OTPs for any request.
2. **`ADMIN`**:
   - Holds full operational permissions across the admin console.
   - Can only be granted or revoked via the Dual-Admin cryptographic approval flow.
   - Cannot demote themselves or approve their own requests.
3. **`USER` / Operational Roles**:
   - Cannot access administrative endpoints. Elevated to ADMIN only when both active admins and the candidate verify independent cryptographic codes.

---

## 2. Core Security & Isolation Invariants

1. **Target-Only Mutation (Zero Collateral Invalidation)**:
   - Role updates are applied strictly by unique document ID:
     ```js
     User.findOneAndUpdate(
       { id: targetId, role: expectedCurrentRole },
       { $set: { role: newRole, role_changed_at: new Date() }, $inc: { token_version: 1 } },
       { returnDocument: 'after' }
     )
     ```
   - Only the target user's `token_version` (`tv`) increments.
   - Non-target admins remain logged in with untouched sessions.

2. **Real-Time Token Version Validation**:
   - `authMiddleware.requireAdminAuth` re-reads the user's `token_version` from the database on every admin request.
   - Any token carrying a mismatched `tv` is rejected immediately with `401 Unauthorized`.

3. **Minimum Active Admin Threshold (Removal Protection)**:
   - Revoking an admin requires `active_admins >= 3` (ensuring 2 independent admins authorize the revocation and at least 2 admins remain active afterwards).

4. **Cryptographic Dual OTP Integrity**:
   - Two independent 6-digit codes generated using `crypto.randomInt(100000, 1000000)`.
   - Stored exclusively as HMAC-SHA256 hashes (`crypto.createHmac('sha256', OTP_SECRET)`).
   - Plaintext OTPs are **NEVER** returned in any API response or error payload.
   - Constant-time comparison (`crypto.timingSafeEqual`) prevents side-channel timing attacks.
   - 10-minute validity window with automatic TTL index cleanup.
   - Maximum 5 failed attempts per request before the session is marked `LOCKED`.
   - 30-second cooldown and maximum 3 resends per request.

5. **Production Dev Bypass Safeguards**:
   - All development bypasses are strictly guarded:
     `process.env.NODE_ENV !== 'production' && process.env.DEV_ADMIN_BYPASS === 'true'`
   - Bypasses are entirely inoperative in production environments.

---

## 3. Data Model: `AdminRequest`

Defined in `backend/config/db.js`:

| Field | Type | Description |
|---|---|---|
| `id` | String | Unique request ID (e.g., `REQ-PROMOTE-1794...`) |
| `type` | Enum | `'PROMOTE'` or `'REMOVE'` |
| `target_user_id` | String | ID of the target user |
| `target_email` | String | Email of the target candidate or admin |
| `requested_by_id` | String | Admin ID who initiated the request |
| `approver1_id`, `approver2_id` | String | IDs of the 2 selected approving admins |
| `approver1_otp_hash`, `approver2_otp_hash` | String | HMAC-SHA256 hashes of the dual approval codes |
| `candidate_otp_hash` | String | HMAC-SHA256 hash of candidate code (Promote step 3) |
| `attempts` | Number | Failed attempt counter (max 5) |
| `resend_count` | Number | Resend counter (max 3, cooldown 30s) |
| `status` | Enum | `'PENDING'`, `'APPROVED'`, `'EXECUTING'`, `'COMPLETED'`, `'REJECTED'`, `'LOCKED'`, `'EXPIRED'` |
| `expires_at` | Date | Expiry timestamp (TTL index) |

*Unique Partial Index*: Only one active request (`PENDING`, `APPROVED`, `EXECUTING`) allowed per target user at a time.

---

## 4. REST API Reference (`/api/admin/access`)

All endpoints require `requireAdminAuth` and are rate-limited via `authRateLimiter`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/access/admins` | Active administrators list (`active_count`, `min_required: 3`, `is_current_user`) |
| `GET` | `/api/admin/access/candidates?email=` | Exact-match lookup for registered users |
| `POST` | `/api/admin/access/promote/request` | Initiates promotion; dispatches dual OTPs to 2 approving admins |
| `POST` | `/api/admin/access/requests/:id/verify` | Verifies dual OTPs (`{ otp1, otp2 }`). Max 5 attempts |
| `POST` | `/api/admin/access/requests/:id/resend` | Resends dual OTPs (30s cooldown, max 3) |
| `POST` | `/api/admin/access/promote/:id/candidate-verify` | Step 3: Verifies candidate code (`{ code }`) & completes promotion |
| `POST` | `/api/admin/access/remove/request` | Initiates revocation (`{ targetAdminId }`); enforces >= 3 admins rule |
| `POST` | `/api/admin/access/remove/:id/verify` | Verifies dual OTPs (`{ otp1, otp2 }`) & downgrades target admin to `USER` |
| `GET` | `/api/admin/access/requests` | List of pending and historical requests |
| `GET` | `/api/admin/access/audit` | Comprehensive security audit log |

---

## 5. Frontend Components (`mobile_frontend/src/admin`)

- **`AccessControlModal.tsx`**: Responsive modal matching reference designs:
  - Top tab switcher: `Promote Admin` / `Remove Admin`
  - Step pills: `1. Candidate` -> `2. Dual Approval` -> `3. Verify & Grant`
  - Countdown timer (`Valid for: mm:ss`) and 30s resend cooldown.
  - Numbered inputs for Admin 1 & Admin 2 masked emails.
  - 3-Admin minimum rule guard for removal with radio list disabling current user and SUPER_ADMIN.
- **`AccessControlPage.tsx`**:
  - Stat cards: Active Admins, Removal Threshold (3 Required), Pending Requests, Super Admin.
  - Interactive tabs: Active Administrators, Access Requests, Security Audit Trail.
  - "🔐 Launch Access Control" primary action button.
- **`AdminSidebar.tsx` & `AdminDashboardScreen.tsx`**:
  - Registered under "Access Control" navigation item (available to ADMIN / SUPER_ADMIN).
- **`UsersPage.tsx`**:
  - Removed `ADMIN` and `SUPER_ADMIN` from manual role editing chips.
  - Displays protective banner and directs users to the Access Control panel.

---

## 6. Manual Verification & Testing Guide

### Running Automated Security Tests
```bash
cd backend
npm run test:access
# Or full security suite:
npm run test:security
```

### Manual Promotion Walkthrough
1. Log into Admin Panel at `http://localhost:8081`.
2. Navigate to **Access Control** in the left sidebar.
3. Click **"Launch Access Control"**.
4. In **Promote Admin (Step 1)**: Enter a registered candidate email (e.g., `user@cfvd.org`).
5. Click **"Request Dual Admin Approval"**.
6. Check the recipient inboxes for Admin 1 and Admin 2 (or Ethereal SMTP test links in dev console).
7. In **Step 2 (Dual Approval)**: Enter both 6-digit codes within 10 minutes. Click **"Verify Dual Codes & Continue"**.
8. In **Step 3 (Verify & Grant)**: Enter the confirmation code sent to the candidate. Click **"Finalize & Grant"**.
9. The candidate's role immediately updates to `ADMIN`.

### Manual Revocation Walkthrough
1. Ensure the system has at least 3 active administrators.
2. In **Access Control**, click **"Launch Access Control"** and select **Remove Admin**.
3. Select an administrator to remove (current user and Super Admin are safely disabled).
4. Click **"Proceed to Dual Approval"**.
5. Both approving admins enter their verification codes.
6. The target administrator is demoted to `USER`, and their active session token is immediately revoked.
