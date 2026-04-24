const router = require('express').Router();
const { getDb } = require('../db');
const auth = require('../middleware/auth');

// GET all offers with filters
router.get('/', (req, res) => {
  const db = getDb();
  const { category, server, search, sort = 'newest', page = 1, limit = 12 } = req.query;
  const offset = (page - 1) * limit;

  let where = ["o.status = 'active'"];
  let params = [];

  if (category) { where.push('c.slug = ?'); params.push(category); }
  if (server) { where.push('s.slug = ?'); params.push(server); }
  if (search) { where.push('o.title LIKE ?'); params.push(`%${search}%`); }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const orderMap = { newest: 'o.created_at DESC', cheapest: 'o.price ASC', expensive: 'o.price DESC', popular: 'o.views DESC' };
  const orderStr = orderMap[sort] || 'o.created_at DESC';

  const offers = db.prepare(`
    SELECT o.*, u.username as seller_name, u.rating as seller_rating,
           c.name as category_name, c.slug as category_slug,
           s.name as server_name, s.slug as server_slug
    FROM offers o
    JOIN users u ON o.seller_id = u.id
    LEFT JOIN categories c ON o.category_id = c.id
    LEFT JOIN servers s ON o.server_id = s.id
    ${whereStr}
    ORDER BY ${orderStr}
    LIMIT ? OFFSET ?
  `).all(...params, Number(limit), Number(offset));

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM offers o
    LEFT JOIN categories c ON o.category_id = c.id
    LEFT JOIN servers s ON o.server_id = s.id
    ${whereStr}
  `).get(...params);

  res.json({ offers, total: total.count, page: Number(page), pages: Math.ceil(total.count / limit) });
});

// GET single offer
router.get('/:id', (req, res) => {
  const db = getDb();
  db.prepare('UPDATE offers SET views = views + 1 WHERE id = ?').run(req.params.id);
  const offer = db.prepare(`
    SELECT o.*, u.username as seller_name, u.rating as seller_rating, u.total_sales,
           u.created_at as seller_since, c.name as category_name, s.name as server_name
    FROM offers o
    JOIN users u ON o.seller_id = u.id
    LEFT JOIN categories c ON o.category_id = c.id
    LEFT JOIN servers s ON o.server_id = s.id
    WHERE o.id = ?
  `).get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Ogłoszenie nie istnieje' });
  res.json(offer);
});

// POST create offer
router.post('/', auth, (req, res) => {
  const { title, description, price, category_id, server_id, images } = req.body;
  if (!title || !price) return res.status(400).json({ error: 'Tytuł i cena są wymagane' });

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO offers (title, description, price, category_id, server_id, seller_id, images) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(title, description, price, category_id, server_id, req.user.id, JSON.stringify(images || []));

  res.json({ id: result.lastInsertRowid, message: 'Ogłoszenie dodane!' });
});

// DELETE offer
router.delete('/:id', auth, (req, res) => {
  const db = getDb();
  const offer = db.prepare('SELECT * FROM offers WHERE id = ?').get(req.params.id);
  if (!offer) return res.status(404).json({ error: 'Nie znaleziono' });
  if (offer.seller_id !== req.user.id) return res.status(403).json({ error: 'Brak uprawnień' });
  db.prepare('UPDATE offers SET status = ? WHERE id = ?').run('deleted', req.params.id);
  res.json({ message: 'Usunięto' });
});

module.exports = router;
