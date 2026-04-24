const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');

router.get('/', (req, res) => {
  const { category, server, search, sort = 'newest', page = 1, limit = 12 } = req.query;
  const offset = (Number(page) - 1) * Number(limit);

  let where = ["o.status = 'active'"];
  let params = [];

  if (category) { where.push('c.slug = ?'); params.push(category); }
  if (server)   { where.push('s.slug = ?'); params.push(server); }
  if (search)   { where.push('o.title LIKE ?'); params.push('%' + search + '%'); }

  const whereStr = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const orderMap = { newest: 'o.id DESC', cheapest: 'o.price ASC', expensive: 'o.price DESC', popular: 'o.views DESC' };
  const orderStr = orderMap[sort] || 'o.id DESC';

  const offers = db.all(`
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
  `, [...params, Number(limit), offset]);

  const totalRow = db.get(`
    SELECT COUNT(*) as count FROM offers o
    LEFT JOIN categories c ON o.category_id = c.id
    LEFT JOIN servers s ON o.server_id = s.id
    ${whereStr}
  `, params);

  res.json({ offers, total: totalRow ? totalRow.count : 0, page: Number(page), pages: Math.ceil((totalRow ? totalRow.count : 0) / Number(limit)) });
});

router.get('/:id', (req, res) => {
  db.run('UPDATE offers SET views = views + 1 WHERE id = ?', [req.params.id]);
  const offer = db.get(`
    SELECT o.*, u.username as seller_name, u.rating as seller_rating, u.total_sales,
           u.created_at as seller_since, c.name as category_name, s.name as server_name
    FROM offers o
    JOIN users u ON o.seller_id = u.id
    LEFT JOIN categories c ON o.category_id = c.id
    LEFT JOIN servers s ON o.server_id = s.id
    WHERE o.id = ?
  `, [req.params.id]);
  if (!offer) return res.status(404).json({ error: 'Ogłoszenie nie istnieje' });
  res.json(offer);
});

router.post('/', auth, (req, res) => {
  const { title, description, price, category_id, server_id, images } = req.body;
  if (!title || !price) return res.status(400).json({ error: 'Tytuł i cena są wymagane' });

  const result = db.runInsert(
    'INSERT INTO offers (title,description,price,category_id,server_id,seller_id,images) VALUES (?,?,?,?,?,?,?)',
    [title, description || '', price, category_id || null, server_id || null, req.user.id, JSON.stringify(images || [])]
  );
  res.json({ id: result.lastInsertRowid, message: 'Ogłoszenie dodane!' });
});

router.delete('/:id', auth, (req, res) => {
  const offer = db.get('SELECT * FROM offers WHERE id=?', [req.params.id]);
  if (!offer) return res.status(404).json({ error: 'Nie znaleziono' });
  if (offer.seller_id !== req.user.id) return res.status(403).json({ error: 'Brak uprawnień' });
  db.run("UPDATE offers SET status='deleted' WHERE id=?", [req.params.id]);
  res.json({ message: 'Usunięto' });
});

module.exports = router;
