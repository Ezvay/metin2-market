const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'metin2market_secret';

module.exports = function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Brak autoryzacji' });
  try {
    req.user = jwt.verify(h.split(' ')[1], SECRET);
    next();
  } catch { res.status(401).json({ error: 'Nieprawidłowy token' }); }
};
