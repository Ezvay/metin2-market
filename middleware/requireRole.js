const db = require('../db');

module.exports = function requireRole(...roles) {
  return async (req, res, next) => {
    try {
      const user = await db.get('SELECT role, is_banned FROM users WHERE id=?', [req.user.id]);
      if (!user) return res.status(401).json({ error: 'Brak użytkownika' });
      if (user.is_banned) return res.status(403).json({ error: 'Konto zablokowane' });
      if (!roles.includes(user.role)) return res.status(403).json({ error: 'Brak uprawnień' });
      req.user.role = user.role;
      next();
    } catch(e) { res.status(500).json({ error: e.message }); }
  };
};
