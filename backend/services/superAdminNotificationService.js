/**
 * backend/services/superAdminNotificationService.js
 * Automatically records Admin mutations (add, edit, delete, approve, reject, etc.)
 * into MongoDB so Super Admin sees them in the header notification bell.
 */

const db = require('../config/db');
const socketService = require('./socketService');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function inferResource(url = '') {
  const lower = url.toLowerCase();
  if (lower.includes('/tournament')) return 'Tournament';
  if (lower.includes('/schedule') || lower.includes('/match')) return 'Match Schedule';
  if (lower.includes('/team')) return 'Team';
  if (lower.includes('/player')) return 'Player';
  if (lower.includes('/scorer')) return 'Scorer';
  if (lower.includes('/umpire')) return 'Umpire';
  if (lower.includes('/user')) return 'User';
  if (lower.includes('/news')) return 'News';
  if (lower.includes('/content')) return 'Content';
  if (lower.includes('/master-setting')) return 'Master Setting';
  if (lower.includes('/cricket-law')) return 'Cricket Law';
  if (lower.includes('/official')) return 'Official';
  if (lower.includes('/venue')) return 'Venue';
  if (lower.includes('/registration')) return 'Registration';
  if (lower.includes('/notification')) return 'Notification';
  if (lower.includes('/setting')) return 'Settings';
  return 'System';
}

function inferAction(method, url = '') {
  const lower = url.toLowerCase();
  if (lower.includes('approve')) return 'APPROVE';
  if (lower.includes('reject')) return 'REJECT';
  if (lower.includes('restore')) return 'RESTORE';
  if (lower.includes('delete') || method === 'DELETE') return 'DELETE';
  if (lower.includes('status') || lower.includes('postpone') || lower.includes('cancel')) return 'STATUS_CHANGE';
  if (method === 'POST') return 'ADD';
  if (method === 'PUT' || method === 'PATCH') return 'EDIT';
  return method;
}

function extractTargetName(req) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  return (
    body.name ||
    body.title ||
    body.tournamentName ||
    body.tournament_name ||
    body.teamName ||
    body.team_name ||
    body.label ||
    body.setting_label ||
    body.email ||
    body.targetEmail ||
    req.params?.id ||
    req.params?.teamId ||
    req.params?.regId ||
    req.params?.matchId ||
    ''
  );
}

function formatActionLabel(action) {
  switch (action) {
    case 'ADD':
      return 'Added';
    case 'EDIT':
      return 'Updated';
    case 'DELETE':
      return 'Deleted';
    case 'APPROVE':
      return 'Approved';
    case 'REJECT':
      return 'Rejected';
    case 'RESTORE':
      return 'Restored';
    case 'STATUS_CHANGE':
      return 'Changed Status of';
    default:
      return 'Modified';
  }
}

async function recordAdminMutation(req, adminUser) {
  try {
    if (!adminUser) return null;
    if (adminUser.is_super_admin || adminUser.role === 'SUPER_ADMIN') {
      return null;
    }

    const url = req.originalUrl || req.url || '';
    if (url.includes('/super-admin-notifications') || url.includes('/login')) {
      return null;
    }

    const method = (req.method || '').toUpperCase();
    if (!MUTATING_METHODS.has(method)) return null;

    await db.initDb();
    const Model = db.models.SuperAdminNotification;
    if (!Model) return null;

    const action = inferAction(method, url);
    const resource = inferResource(url);
    const targetName = extractTargetName(req);
    const targetId =
      req.params?.id ||
      req.params?.teamId ||
      req.params?.regId ||
      req.params?.matchId ||
      req.body?.id ||
      req.body?.targetId ||
      null;

    let adminName = adminUser.name || 'Admin';
    let adminEmail = adminUser.email || '';
    let adminPhone = adminUser.mobile || adminUser.phone || '';

    if (!adminPhone && (adminUser.id || adminEmail) && db.models.User) {
      const dbAdmin = await db.models.User.findOne({
        $or: [
          ...(adminUser.id ? [{ id: adminUser.id }] : []),
          ...(adminEmail ? [{ email: adminEmail.toLowerCase() }] : [])
        ]
      })
        .select('name email mobile')
        .lean();
      if (dbAdmin) {
        adminName = dbAdmin.name || adminName;
        adminEmail = dbAdmin.email || adminEmail;
        adminPhone = dbAdmin.mobile || '';
      }
    }

    const actionVerb = formatActionLabel(action);
    const targetSuffix = targetName ? ` (${String(targetName).slice(0, 80)})` : '';
    const title = `${resource} ${actionVerb}`;
    const message = `${adminName} ${actionVerb.toLowerCase()} ${resource.toLowerCase()}${targetSuffix}.`;

    const id = `SANOTIF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

    const doc = await Model.create({
      id,
      action,
      method,
      resource,
      title,
      message,
      endpoint: url.split('?')[0],
      admin_id: adminUser.id || null,
      admin_name: adminName,
      admin_email: adminEmail,
      admin_phone: adminPhone,
      target_id: targetId ? String(targetId) : null,
      target_name: targetName ? String(targetName) : null,
      details: {
        status: req.body?.status || undefined,
        reason: req.body?.reason || req.body?.rejectionReason || undefined
      },
      status: 'UNREAD',
      created_at: new Date()
    });

    const saved = doc.toObject();
    socketService.broadcastSuperAdminNotification(saved);
    return saved;
  } catch (err) {
    console.warn('[SuperAdminNotification] Failed to record admin mutation:', err?.message || err);
    return null;
  }
}

function attachSuperAdminNotificationHook(req, res, adminUser) {
  if (!req || !res || req._saNotifHooked) return;
  const method = (req.method || '').toUpperCase();
  if (!MUTATING_METHODS.has(method)) return;
  if (!adminUser || adminUser.is_super_admin || adminUser.role === 'SUPER_ADMIN') return;

  req._saNotifHooked = true;
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      setImmediate(() => {
        recordAdminMutation(req, adminUser);
      });
    }
  });
}

module.exports = {
  recordAdminMutation,
  attachSuperAdminNotificationHook
};
