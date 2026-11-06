import jwt from 'jsonwebtoken';
import { db, hasId } from '../database/connection.js';

export const authenticate = async (req, res, next) => {
  // Read the login token sent with the request.
  const [scheme, token] = (req.headers.authorization || '').split(' ');
  if (scheme !== 'Bearer' || !token)
    return res.status(401).json({ message: 'Authentication required' });
  let decoded;
  try {
    // Reject a changed or expired login token.
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
  try {
    if (!hasId(decoded.id)) return res.status(401).json({ message: 'Invalid or expired token' });
    // Read the latest user role so permission changes take effect immediately.
    const [rows] = await db().execute('SELECT id,username,role FROM users WHERE id=?', [
      decoded.id
    ]);
    if (!rows.length) return res.status(401).json({ message: 'Account no longer exists' });
    if (rows[0].role === 'member') {
      const [members] = await db().execute(
        'SELECT id FROM members WHERE user_id=? AND deleted_at IS NULL LIMIT 1', [rows[0].id]
      );
      if (!members.length) return res.status(401).json({ message: 'Member account is no longer available' });
    }
    req.user = { id: String(rows[0].id), username: rows[0].username, role: rows[0].role };
    next();
  } catch (error) {
    next(error);
  }
};

// Allow only the listed roles. For example, authorize('admin') blocks staff.
export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role))
      return res.status(403).json({ message: 'Forbidden: Insufficient privileges' });
    next();
  };
