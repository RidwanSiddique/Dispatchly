const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'dispatchly_dev_secret_CHANGE_IN_PRODUCTION';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const COOKIE_NAME = 'dispatchly_token';

/**
 * Require a valid JWT cookie. Attaches req.user = { userId, email, name, role, department }.
 */
const requireAuth = (req, res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.clearCookie(COOKIE_NAME);
    return res.status(401).json({ error: 'Session expired — please log in again' });
  }
};

/**
 * Require one of the given roles (admin always passes).
 * Must be used after requireAuth.
 *
 * Usage: requireRole('admin', 'manager')
 */
const requireRole =
  (...roles) =>
  (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.role === 'admin') return next(); // admin bypasses all role checks
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    next();
  };

module.exports = { requireAuth, requireRole, JWT_SECRET, JWT_EXPIRES_IN, COOKIE_NAME };
