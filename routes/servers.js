const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

// GET all active servers
router.get('/', (req, res) => {
  res.json(db.all("SELECT * FROM servers WHERE is_active=1 ORDER BY id ASC"));
});

// GET categories for a server
router.get('/:slug/categories', (req, res) => {
  const srv = db.get('SELECT * FROM servers WHERE slug=?', [req.params.slug]);
  if (!srv) return res.status(404).json({ error: 'Serwer nie istnieje' });
  res.json(db.all('SELECT * FROM categories WHERE server_id=? ORDER BY id', [srv.id]));
});

// ADMIN: add server
router.post('/', auth, requireRole('admin'), (req, res) => {
  const { name, slug, description, rates, website } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'Nazwa i slug wymagane' });
  try {
    const r = db.runInsert('INSERT INTO servers (name,slug,description,rates,website) VALUES (?,?,?,?,?)',
      [name, slug, description||null, rates||null, website||null]);
    res.json({ id: r.lastInsertRowid, message: 'Serwer dodany' });
  } catch (e) {
    if (String(e).includes('UNIQUE')) return res.status(409).json({ error: 'Slug już istnieje' });
    res.status(500).json({ error: e.message });
  }
});

// ADMIN: toggle server active
router.patch('/:id/toggle', auth, requireRole('admin'), (req, res) => {
  const srv = db.get('SELECT * FROM servers WHERE id=?', [req.params.id]);
  if (!srv) return res.status(404).json({ error: 'Nie znaleziono' });
  db.run('UPDATE servers SET is_active=? WHERE id=?', [srv.is_active ? 0 : 1, req.params.id]);
  res.json({ message: srv.is_active ? 'Serwer ukryty' : 'Serwer aktywny' });
});

// ADMIN: add category to server
router.post('/:slug/categories', auth, requireRole('admin'), (req, res) => {
  const srv = db.get('SELECT * FROM servers WHERE slug=?', [req.params.slug]);
  if (!srv) return res.status(404).json({ error: 'Serwer nie istnieje' });
  const { name, slug, icon } = req.body;
  if (!name || !slug) return res.status(400).json({ error: 'Nazwa i slug wymagane' });
  try {
    db.runInsert('INSERT INTO categories (server_id,name,slug,icon) VALUES (?,?,?,?)', [srv.id, name, slug, icon||'📦']);
    res.json({ message: 'Kategoria dodana' });
  } catch (e) { res.status(409).json({ error: 'Slug już istnieje dla tego serwera' }); }
});

module.exports = router;
