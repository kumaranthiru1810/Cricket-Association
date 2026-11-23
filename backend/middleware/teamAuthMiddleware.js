/**
 * teamAuthMiddleware.js
 *
 * JWT-based authentication middleware for Team-protected endpoints.
 */

const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'cricket_super_secret_jwt_2026';

function requireTeamAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else if (req.cookies && (req.cookies.auth_token || req.cookies.token || req.cookies.teamAuthToken)) {
    token = req.cookies.auth_token || req.cookies.token || req.cookies.teamAuthToken;
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: No token provided.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'TEAM') {
      return res.status(403).json({ error: 'Access Denied: TEAM role required.' });
    }
    req.teamUser = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
  }
}

module.exports = { requireTeamAuth };
