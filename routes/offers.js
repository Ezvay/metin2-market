const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage (then upload to Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Tylko pliki graficzne'));
    cb(null, true);
  }
});

function uploadToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: 'projekthard', transformation: [{ width: 1200, height: 900, crop: 'limit', quality: 'auto' }] },
      (err, result) => err ? reject(err) : resolve(result.secure_url)
    );
    stream.end(buffer);
  });
}

// GET offers with filters
router.get('/', (req, res) => {
  const { category, type, sort = 'newest', page = 1, limit = 12, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const where = ["o.status='active'"]; const params = [];
  if (category) { where.push('c.slug=?'); params.push(category); }
  if (type) { where.push('o.type=?'); params.push(type); }
  if (search) { where.push('o.title LIKE ?'); params.push('%' + search + '%'); }

  const ws = 'WHERE ' + where.join(' AND ');
  const orderMap = { newest: 'o.id DESC', cheapest: 'o.price ASC', expensive: 'o.price DESC', popular: 'o.views DESC', ending: 'o.auction_end ASC' };
  const order = orderMap[sort] || 'o.id DESC';

  const offers = db.all(`
    SELECT o.*, u.username as seller_name, u.rating as seller_rating,
           c.name as category_name, c.slug as category_slug,
           (SELECT COUNT(*) FROM bids b WHERE b.offer_id=o.id) as bid_count
    FROM offers o
    JOIN users u ON o.seller_id=u.id
    LEFT JOIN categories c ON o.category_id=c.id
    ${ws} ORDER BY ${order} LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);

  const total = db.get(`SELECT COUNT(*) as c FROM offers o LEFT JOIN categories c ON o.category_id=c.id ${ws}`, params);
  res.json({ offers, total: total?.c || 0, page: Number(page), pages: Math.ceil((total?.c || 0) / Number(limit)) });
});

// GET single offer
router.get('/:id', (req, res) => {
  db.run('UPDATE offers SET views=views+1 WHERE id=?', [req.params.id]);
  const offer = db.get(`
    SELECT o.*, u.username as seller_name, u.rating as seller_rating, u.total_sales, u.avatar as seller_avatar,
           u.created_at as seller_since, c.name as category_name, c.slug as category_slug
    FROM offers o JOIN users u ON o.seller_id=u.id
    LEFT JOIN categories c ON o.category_id=c.id WHERE o.id=?
  `, [req.params.id]);
  if (!offer) return res.status(404).json({ error: 'Ogłoszenie nie istnieje' });

  const bids = db.all(`
    SELECT b.*, u.username FROM bids b JOIN users u ON b.user_id=u.id
    WHERE b.offer_id=? ORDER BY b.amount DESC LIMIT 20
  `, [req.params.id]);

  res.json({ ...offer, bids });
});

// POST create offer (with image upload)
router.post('/', auth, upload.array('images', 5), async (req, res) => {
  try {
    const { title, description, category_id, type, price, auction_start, auction_end } = req.body;
    if (!title) return res.status(400).json({ error: 'Tytuł jest wymagany' });
    if (type === 'buy_now' && !price) return res.status(400).json({ error: 'Podaj cenę' });
    if (type === 'auction' && !auction_start) return res.status(400).json({ error: 'Podaj cenę startową' });
    if (type === 'auction' && !auction_end) return res.status(400).json({ error: 'Podaj czas zakończenia aukcji' });

    // Upload images
    let imageUrls = [];
    if (req.files && req.files.length > 0) {
      imageUrls = await Promise.all(req.files.map(f => uploadToCloudinary(f.buffer)));
    }

    const auctionEndTs = type === 'auction' ? Math.floor(new Date(auction_end).getTime() / 1000) : null;

    const result = db.runInsert(`
      INSERT INTO offers (title,description,category_id,seller_id,images,type,price,auction_start,auction_current,auction_end)
      VALUES (?,?,?,?,?,?,?,?,?,?)
    `, [
      title, description || '', category_id || null, req.user.id,
      JSON.stringify(imageUrls),
      type || 'buy_now',
      type === 'buy_now' ? Number(price) : null,
      type === 'auction' ? Number(auction_start) : null,
      type === 'auction' ? Number(auction_start) : null,
      auctionEndTs
    ]);

    res.json({ id: result.lastInsertRowid, message: 'Ogłoszenie dodane!' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Błąd podczas dodawania: ' + e.message });
  }
});

// POST place bid
router.post('/:id/bid', auth, (req, res) => {
  const { amount } = req.body;
  const offer = db.get('SELECT * FROM offers WHERE id=? AND type=? AND status=?', [req.params.id, 'auction', 'active']);
  if (!offer) return res.status(404).json({ error: 'Aukcja nie istnieje lub zakończyła się' });
  if (offer.seller_id === req.user.id) return res.status(400).json({ error: 'Nie możesz licytować własnej aukcji' });

  const now = Math.floor(Date.now() / 1000);
  if (offer.auction_end && now > offer.auction_end) return res.status(400).json({ error: 'Aukcja już się zakończyła' });

  const minBid = (offer.auction_current || offer.auction_start) + 0.01;
  if (Number(amount) < minBid) return res.status(400).json({ error: `Minimalna oferta: ${minBid.toFixed(2)} PLN` });

  db.runInsert('INSERT INTO bids (offer_id,user_id,amount) VALUES (?,?,?)', [req.params.id, req.user.id, Number(amount)]);
  db.run('UPDATE offers SET auction_current=?, auction_winner_id=? WHERE id=?', [Number(amount), req.user.id, req.params.id]);

  res.json({ message: 'Oferta złożona!', current: Number(amount) });
});

// DELETE offer
router.delete('/:id', auth, (req, res) => {
  const offer = db.get('SELECT * FROM offers WHERE id=?', [req.params.id]);
  if (!offer) return res.status(404).json({ error: 'Nie znaleziono' });
  if (offer.seller_id !== req.user.id) return res.status(403).json({ error: 'Brak uprawnień' });
  db.run("UPDATE offers SET status='deleted' WHERE id=?", [req.params.id]);
  res.json({ message: 'Ogłoszenie usunięte' });
});

// GET my offers
router.get('/my/list', auth, (req, res) => {
  const offers = db.all(`
    SELECT o.*, c.name as category_name,
           (SELECT COUNT(*) FROM bids b WHERE b.offer_id=o.id) as bid_count
    FROM offers o LEFT JOIN categories c ON o.category_id=c.id
    WHERE o.seller_id=? AND o.status != 'deleted' ORDER BY o.id DESC
  `, [req.user.id]);
  res.json(offers);
});

module.exports = router;
