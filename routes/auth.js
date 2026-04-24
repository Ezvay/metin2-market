const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDb } = require('../db');

const SECRET = process.env.JWT_SECRET || 'metin2market_secret_change_in_prod';

router.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ error: 'Wypełnij wszystkie pola' });

  const db = getDb();
  const hash = bcrypt.hashSync(password, 10);
  try {
    const stmt = db.prepare('INSERT INTO users (username, email, password) VALUES (?, ?, ?)');
    const result = stmt.run(username, email, hash);
    const token = jwt.sign({ id: result.lastInsertRowid, username }, SECRET, { expiresIn: '7d' });
    res.json({ token, username, id: result.lastInsertRowid });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: 'Login lub email już istnieje' });
    res.status(500).json({ error: 'Błąd serwera' });
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const db = getDb();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Nieprawidłowe dane logowania' });

  const token = jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username, id: user.id });
});

router.get('/me', require('../middleware/auth'), (req, res) => {
  const db = getDb();
  const user = db.prepare('SELECT id, username, email, avatar, total_sales, rating, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json(user);
});

module.exports = router;
