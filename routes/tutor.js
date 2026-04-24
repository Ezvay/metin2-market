const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { sendTutorRequestEmail } = require('../emails');

// POST request tutor
router.post('/request', auth, async (req, res) => {
  const { offer_id, payment_method } = req.body;
  if (!offer_id || !payment_method) return res.status(400).json({ error: 'Brak danych' });
  if (!['blik', 'revolut'].includes(payment_method)) return res.status(400).json({ error: 'Nieprawidłowa metoda płatności' });

  const offer = await db.get('SELECT * FROM offers WHERE id=? AND status=?', [offer_id, 'active']);
  if (!offer) return res.status(404).json({ error: 'Ogłoszenie nie istnieje' });
  if (offer.seller_id === req.user.id) return res.status(400).json({ error: 'Nie możesz zamawiać TuTora dla własnego ogłoszenia' });

  const existing = await db.get("SELECT * FROM tutor_requests WHERE offer_id=? AND buyer_id=? AND status='pending'", [offer_id, req.user.id]);
  if (existing) return res.status(409).json({ error: 'Już złożyłeś prośbę o TuTora dla tego ogłoszenia' });

  await db.runInsert('INSERT INTO tutor_requests (offer_id,buyer_id,seller_id,payment_method) VALUES (?,?,?,?)',
    [offer_id, req.user.id, offer.seller_id, payment_method]);

  const seller = await db.get('SELECT * FROM users WHERE id=?', [offer.seller_id]);
  const buyer = await db.get('SELECT username FROM users WHERE id=?', [req.user.id]);
  await sendTutorRequestEmail(seller.email, seller.username, buyer.username, offer.title);

  res.json({ message: 'Prośba o TuTora wysłana! Skontaktujemy się z obydwiema stronami.', price: 20 });
});

// GET my tutor requests
router.get('/my', auth, async (req, res) => {
  const sent = await db.all(`
    SELECT t.*, o.title as offer_title, u.username as seller_name
    FROM tutor_requests t JOIN offers o ON t.offer_id=o.id
    JOIN users u ON t.seller_id=u.id WHERE t.buyer_id=? ORDER BY t.id DESC
  `, [req.user.id]);
  const received = await db.all(`
    SELECT t.*, o.title as offer_title, u.username as buyer_name
    FROM tutor_requests t JOIN offers o ON t.offer_id=o.id
    JOIN users u ON t.buyer_id=u.id WHERE t.seller_id=? ORDER BY t.id DESC
  `, [req.user.id]);
  res.json({ sent, received });
});

module.exports = router;

// ===== REVIEWS =====
const reviewsRouter = require('express').Router();

reviewsRouter.post('/', auth, async (req, res) => {
  const { offer_id, reviewed_id, rating, comment } = req.body;
  if (!reviewed_id || !rating || rating < 1 || rating > 5)
    return res.status(400).json({ error: 'Nieprawidłowe dane' });

  const existing = await db.get('SELECT * FROM reviews WHERE reviewer_id=? AND offer_id=?', [req.user.id, offer_id]);
  if (existing) return res.status(409).json({ error: 'Już wystawiłeś opinię dla tej transakcji' });

  await db.runInsert('INSERT INTO reviews (offer_id,reviewer_id,reviewed_id,rating,comment) VALUES (?,?,?,?,?)',
    [offer_id || null, req.user.id, reviewed_id, rating, comment || null]);

  // Update user rating
  const stats = await db.get('SELECT AVG(rating) as avg, COUNT(*) as cnt FROM reviews WHERE reviewed_id=?', [reviewed_id]);
  await db.run('UPDATE users SET rating=?, rating_count=? WHERE id=?', [stats.avg, stats.cnt, reviewed_id]);

  res.json({ message: 'Opinia dodana!' });
});

reviewsRouter.get('/user/:id', async (req, res) => {
  const reviews = await db.all(`
    SELECT r.*, u.username as reviewer_name FROM reviews r
    JOIN users u ON r.reviewer_id=u.id WHERE r.reviewed_id=? ORDER BY r.id DESC
  `, [req.params.id]);
  res.json(reviews);
});

module.exports.reviewsRouter = reviewsRouter;
