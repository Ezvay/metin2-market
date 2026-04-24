const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('../db');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../emails');
const auth = require('../middleware/auth');

const SECRET = process.env.JWT_SECRET || 'metin2market_secret';

function makeToken() { return crypto.randomBytes(32).toString('hex'); }
function signJwt(user) {
  return jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
}

// REGISTER
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) return res.status(400).json({ error: 'Wypełnij wszystkie pola' });
  if (password.length < 6) return res.status(400).json({ error: 'Hasło musi mieć min. 6 znaków' });

  const hash = bcrypt.hashSync(password, 10);
  const token = makeToken();
  try {
    const result = db.runInsert(
      'INSERT INTO users (username,email,password,verify_token) VALUES (?,?,?,?)',
      [username.trim(), email.toLowerCase().trim(), hash, token]
    );
    await sendVerificationEmail(email, username, token);
    res.json({ message: 'Konto utworzone! Sprawdź email, aby aktywować konto.' });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'Login lub email już istnieje' });
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

// VERIFY EMAIL
router.get('/verify', (req, res) => {
  const { token } = req.query;
  const user = db.get('SELECT * FROM users WHERE verify_token = ?', [token]);
  if (!user) return res.status(400).json({ error: 'Nieprawidłowy lub wygasły token' });
  db.run('UPDATE users SET is_verified=1, verify_token=NULL WHERE id=?', [user.id]);
  res.json({ message: 'Konto potwierdzone! Możesz się teraz zalogować.' });
});

// LOGIN
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.get('SELECT * FROM users WHERE email=?', [email?.toLowerCase().trim()]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });
  if (!user.is_verified)
    return res.status(403).json({ error: 'Konto nie jest potwierdzone. Sprawdź email.' });

  res.json({ token: signJwt(user), username: user.username, id: user.id });
});

// FORGOT PASSWORD
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = db.get('SELECT * FROM users WHERE email=?', [email?.toLowerCase().trim()]);
  if (!user) return res.json({ message: 'Jeśli konto istnieje, wysłaliśmy email z instrukcjami.' });

  const token = makeToken();
  const expires = Date.now() + 3600000; // 1h
  db.run('UPDATE users SET reset_token=?, reset_token_expires=? WHERE id=?', [token, expires, user.id]);
  await sendPasswordResetEmail(user.email, user.username, token);
  res.json({ message: 'Email z linkiem do resetu hasła został wysłany.' });
});

// RESET PASSWORD
router.post('/reset-password', (req, res) => {
  const { token, password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Hasło musi mieć min. 6 znaków' });

  const user = db.get('SELECT * FROM users WHERE reset_token=?', [token]);
  if (!user || !user.reset_token_expires || Date.now() > user.reset_token_expires)
    return res.status(400).json({ error: 'Token wygasł lub jest nieprawidłowy' });

  const hash = bcrypt.hashSync(password, 10);
  db.run('UPDATE users SET password=?, reset_token=NULL, reset_token_expires=NULL WHERE id=?', [hash, user.id]);
  res.json({ message: 'Hasło zostało zmienione. Możesz się zalogować.' });
});

// GET ME
router.get('/me', auth, (req, res) => {
  const user = db.get(
    'SELECT id,username,email,avatar,rating,rating_count,total_sales,bio,discord,created_at FROM users WHERE id=?',
    [req.user.id]
  );
  res.json(user);
});

// UPDATE PROFILE
router.put('/me', auth, (req, res) => {
  const { bio, discord } = req.body;
  db.run('UPDATE users SET bio=?, discord=? WHERE id=?', [bio || null, discord || null, req.user.id]);
  res.json({ message: 'Profil zaktualizowany' });
});

// GET USER PUBLIC PROFILE
router.get('/user/:id', (req, res) => {
  const user = db.get(
    'SELECT id,username,avatar,rating,rating_count,total_sales,bio,discord,created_at FROM users WHERE id=?',
    [req.params.id]
  );
  if (!user) return res.status(404).json({ error: 'Użytkownik nie istnieje' });
  const offers = db.all("SELECT * FROM offers WHERE seller_id=? AND status='active' ORDER BY id DESC LIMIT 6", [user.id]);
  const reviews = db.all(`
    SELECT r.*, u.username as reviewer_name FROM reviews r
    JOIN users u ON r.reviewer_id=u.id
    WHERE r.reviewed_id=? ORDER BY r.id DESC LIMIT 10
  `, [user.id]);
  res.json({ ...user, offers, reviews });
});

module.exports = router;
