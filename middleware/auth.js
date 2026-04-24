const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'metin2market_secret_change_in_prod';

module.exports = function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Brak autoryzacji' });
  }
  try {
    const token = auth.split(' ')[1];
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Nieprawidłowy token' });
  }
};
