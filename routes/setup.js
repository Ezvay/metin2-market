const router = require('express').Router();
const db = require('../db');

// One-time setup endpoint - set admin/tutor by email
// Usage: /api/setup?secret=YOUR_SETUP_SECRET&email=EMAIL&role=admin
router.get('/', async (req, res) => {
  const { secret, email, role } = req.query;

  // Must match SETUP_SECRET env variable
  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) return res.status(403).json({ error: 'SETUP_SECRET nie jest ustawiony w zmiennych środowiskowych' });
  if (secret !== setupSecret) return res.status(403).json({ error: 'Nieprawidłowy sekret' });
  if (!email) return res.status(400).json({ error: 'Podaj email' });
  if (!['admin', 'tutor'].includes(role)) return res.status(400).json({ error: 'Rola musi być: admin lub tutor' });

  const user = await db.get('SELECT * FROM users WHERE email=?', [email.toLowerCase().trim()]);
  if (!user) return res.status(404).json({ error: `Nie znaleziono użytkownika: ${email}` });

  await db.run('UPDATE users SET role=?, is_verified=1 WHERE id=?', [role, user.id]);

  const updated = await db.get('SELECT id, username, email, role FROM users WHERE id=?', [user.id]);
  res.json({
    success: true,
    message: `✅ Gotowe! ${updated.username} ma teraz rolę: ${updated.role}`,
    user: updated
  });
});

module.exports = router;
