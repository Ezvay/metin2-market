const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../emails');
const auth = require('../middleware/auth');

const SECRET = process.env.JWT_SECRET || 'metin2market_secret';
const makeToken = () => crypto.randomBytes(32).toString('hex');
const signJwt = (user) => jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET, { expiresIn: '7d' });

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Wypełnij wszystkie pola' });
  if (password.length < 6) return res.status(400).json({ error: 'Hasło min. 6 znaków' });
  const hash = bcrypt.hashSync(password, 10);
  const token = makeToken();
  try {
    db.runInsert('INSERT INTO users (username,email,password,verify_token) VALUES (?,?,?,?)',
      [username.trim(), email.toLowerCase().trim(), hash, token]);
    await sendVerificationEmail(email, username, token);
    res.json({ message: 'Konto utworzone! Sprawdź email aby aktywować konto.' });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'Login lub email już istnieje' });
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.get('/verify', (req, res) => {
  const { token } = req.query;
  const user = db.get('SELECT * FROM users WHERE verify_token=?', [token]);
  if (!user) return res.status(400).json({ error: 'Nieprawidłowy lub wygasły token' });
  db.run('UPDATE users SET is_verified=1, verify_token=NULL WHERE id=?', [user.id]);
  res.json({ message: 'Konto potwierdzone! Możesz się zalogować.' });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.get('SELECT * FROM users WHERE email=?', [email?.toLowerCase().trim()]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
  if (!user.is_verified) return res.status(403).json({ error: 'Konto nie zostało potwierdzone. Sprawdź email.' });
  if (user.is_banned) return res.status(403).json({ error: `Konto zablokowane. Powód: ${user.ban_reason || 'naruszenie regulaminu'}` });
  res.json({ token: signJwt(user), username: user.username, id: user.id, role: user.role });
});

router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = db.get('SELECT * FROM users WHERE email=?', [email?.toLowerCase().trim()]);
  if (!user) return res.json({ message: 'Jeśli konto istnieje, wysłaliśmy email.' });
  const token = makeToken();
  db.run('UPDATE users SET reset_token=?, reset_token_expires=? WHERE id=?', [token, Date.now() + 3600000, user.id]);
  await sendPasswordResetEmail(user.email, user.username, token);
  res.json({ message: 'Link do resetu hasła wysłany!' });
});

router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Hasło min. 6 znaków' });
  const user = db.get('SELECT * FROM users WHERE reset_token=?', [token]);
  if (!user || Date.now() > user.reset_token_expires)
    return res.status(400).json({ error: 'Token wygasł lub jest nieprawidłowy' });
  db.run('UPDATE users SET password=?, reset_token=NULL, reset_token_expires=NULL WHERE id=?',
    [bcrypt.hashSync(password, 10), user.id]);
  res.json({ message: 'Hasło zmienione!' });
});

router.get('/me', auth, (req, res) => {
  const u = db.get('SELECT id,username,email,avatar,role,rating,rating_count,total_sales,bio,discord,created_at FROM users WHERE id=?', [req.user.id]);
  res.json(u);
});

router.put('/me', auth, (req, res) => {
  const { bio, discord } = req.body;
  db.run('UPDATE users SET bio=?, discord=? WHERE id=?', [bio||null, discord||null, req.user.id]);
  res.json({ message: 'Profil zaktualizowany' });
});

router.get('/user/:id', (req, res) => {
  const u = db.get('SELECT id,username,avatar,role,rating,rating_count,total_sales,bio,discord,created_at FROM users WHERE id=?', [req.params.id]);
  if (!u) return res.status(404).json({ error: 'Użytkownik nie istnieje' });
  const offers = db.all("SELECT o.*,c.name as category_name,s.name as server_name FROM offers o LEFT JOIN categories c ON o.category_id=c.id LEFT JOIN servers s ON o.server_id=s.id WHERE o.seller_id=? AND o.status='active' ORDER BY o.id DESC LIMIT 6", [u.id]);
  const reviews = db.all('SELECT r.*,u.username as reviewer_name FROM reviews r JOIN users u ON r.reviewer_id=u.id WHERE r.reviewed_id=? ORDER BY r.id DESC LIMIT 10', [u.id]);
  res.json({ ...u, offers, reviews });
});

module.exports = router;
