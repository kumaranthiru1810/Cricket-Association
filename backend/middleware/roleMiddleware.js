/**
 * middleware/roleMiddleware.js
 * Role-Based Access Control (RBAC) middleware supporting ADMIN, SCORER, PLAYER, USER
 */

/**
 * Middleware factory to restrict access to specified roles
 * @param {string[]} allowedRoles
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: Authentication required.'
      });
    }

    const userRole = (req.user.role || '').toUpperCase();
    const upperAllowed = allowedRoles.map(r => r.toUpperCase());

    if (!upperAllowed.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Insufficient role permission.',
        details: `Role '${userRole}' is not authorized to access this resource.`
      });
    }

    next();
  };
}

module.exports = {
  requireRole,
  requireAdmin: requireRole('ADMIN'),
  requireScorer: requireRole('SCORER', 'ADMIN'),
  requirePlayer: requireRole('PLAYER', 'ADMIN'),
  requireUmpire: requireRole('UMPIRE', 'ADMIN')
};
