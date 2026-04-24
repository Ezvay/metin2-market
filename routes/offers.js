const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Tylko obrazy'));
    cb(null, true);
  }
});

function uploadToCloudinary(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: folder || 'mt2market', transformation: [{ width: 1200, height: 900, crop: 'limit', quality: 'auto' }] },
      (err, result) => err ? reject(err) : resolve(result.secure_url)
    );
    stream.end(buffer);
  });
}

router.get('/', async (req, res) => {
  const { category, server, server_id, type, sort = 'newest', page = 1, limit = 12, search } = req.query;
  const offset = (Number(page) - 1) * Number(limit);
  const where = ["o.status='active'"]; const params = [];
  if (category) { where.push('c.slug=?'); params.push(category); }
  if (server) { where.push('s.slug=?'); params.push(server); }
  if (server_id) { where.push('o.server_id=?'); params.push(server_id); }
  if (type) { where.push('o.type=?'); params.push(type); }
  if (search) { where.push('o.title LIKE ?'); params.push('%'+search+'%'); }
  const ws = 'WHERE ' + where.join(' AND ');
  const orderMap = { newest:'o.id DESC', cheapest:'o.price ASC', expensive:'o.price DESC', popular:'o.views DESC', ending:'o.auction_end ASC' };
  const order = orderMap[sort] || 'o.id DESC';
  const offers = await db.all(`
    SELECT o.*, u.username as seller_name, u.rating as seller_rating,
           c.name as category_name, c.slug as category_slug,
           s.name as server_name, s.slug as server_slug,
           (SELECT COUNT(*) FROM bids b WHERE b.offer_id=o.id) as bid_count
    FROM offers o JOIN users u ON o.seller_id=u.id
    LEFT JOIN categories c ON o.category_id=c.id
    LEFT JOIN servers s ON o.server_id=s.id
    ${ws} ORDER BY ${order} LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);
  const total = await db.get(`SELECT COUNT(*) as c FROM offers o LEFT JOIN categories c ON o.category_id=c.id LEFT JOIN servers s ON o.server_id=s.id ${ws}`, params);
  res.json({ offers, total: total?.c || 0, page: Number(page), pages: Math.ceil((total?.c||0)/Number(limit)) });
});

router.get('/my/list', auth, async (req, res) => {
  const offers = await db.all(`
    SELECT o.*, c.name as category_name, c.slug as category_slug, s.name as server_name,
           (SELECT COUNT(*) FROM bids b WHERE b.offer_id=o.id) as bid_count
    FROM offers o LEFT JOIN categories c ON o.category_id=c.id LEFT JOIN servers s ON o.server_id=s.id
    WHERE o.seller_id=? AND o.status!='deleted' ORDER BY o.id DESC
  `, [req.user.id]);
  res.json(offers);
});

router.get('/:id', async (req, res) => {
  await db.run('UPDATE offers SET views=views+1 WHERE id=?', [req.params.id]);
  const offer = await db.get(`
    SELECT o.*, u.username as seller_name, u.rating as seller_rating, u.total_sales, u.avatar as seller_avatar, u.role as seller_role,
           u.created_at as seller_since, c.name as category_name, c.slug as category_slug,
           s.name as server_name, s.slug as server_slug
    FROM offers o JOIN users u ON o.seller_id=u.id
    LEFT JOIN categories c ON o.category_id=c.id LEFT JOIN servers s ON o.server_id=s.id
    WHERE o.id=?
  `, [req.params.id]);
  if (!offer) return res.status(404).json({ error: 'Ogłoszenie nie istnieje' });
  const bids = await db.all('SELECT b.*, u.username FROM bids b JOIN users u ON b.user_id=u.id WHERE b.offer_id=? ORDER BY b.amount DESC LIMIT 20', [req.params.id]);
  res.json({ ...offer, bids });
});

router.post('/', auth, upload.array('images', 5), async (req, res) => {
  // Check ban
  const user = await db.get('SELECT role,is_banned FROM users WHERE id=?', [req.user.id]);
  if (user?.is_banned) return res.status(403).json({ error: 'Konto zablokowane' });

  try {
    const { title, description, category_id, server_id, type, price, auction_start, auction_end } = req.body;
    if (!title) return res.status(400).json({ error: 'Tytuł wymagany' });
    if (!server_id) return res.status(400).json({ error: 'Wybierz serwer' });
    if (type === 'buy_now' && !price) return res.status(400).json({ error: 'Podaj cenę' });
    if (type === 'auction' && (!auction_start || !auction_end)) return res.status(400).json({ error: 'Podaj cenę startową i czas zakończenia' });
    if (type === 'both' && (!auction_start || !auction_end || !price)) return res.status(400).json({ error: 'Podaj cenę startową, czas zakończenia i cenę Kup Teraz' });

    // Get server slug for cloudinary folder
    const srv = await db.get('SELECT slug FROM servers WHERE id=?', [server_id]);
    let imageUrls = [];
    if (req.files?.length) {
      imageUrls = await Promise.all(req.files.map(f => uploadToCloudinary(f.buffer, srv?.slug || 'mt2market')));
    }

    const auctionEndTs = type === 'auction' ? Math.floor(new Date(auction_end).getTime()/1000) : null;
    const result = await db.runInsert(`
      INSERT INTO offers (title,description,category_id,server_id,seller_id,images,type,price,auction_start,auction_current,auction_end)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
    `, [title, description||'', category_id||null, server_id, req.user.id, JSON.stringify(imageUrls),
        type||'buy_now',
        (type==='buy_now' || type==='both') ? Number(price) : null,
        (type==='auction' || type==='both') ? Number(auction_start) : null,
        (type==='auction' || type==='both') ? Number(auction_start) : null,
        auctionEndTs]);
    res.json({ id: result.lastInsertRowid, message: 'Ogłoszenie dodane!' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/bid', auth, async (req, res) => {
  const user = await db.get('SELECT is_banned FROM users WHERE id=?', [req.user.id]);
  if (user?.is_banned) return res.status(403).json({ error: 'Konto zablokowane' });
  const { amount } = req.body;
  const offer = await db.get("SELECT * FROM offers WHERE id=? AND type='auction' AND status='active'", [req.params.id]);
  if (!offer) return res.status(404).json({ error: 'Aukcja nie istnieje' });
  if (offer.seller_id === req.user.id) return res.status(400).json({ error: 'Nie możesz licytować własnej aukcji' });
  if (offer.auction_end && Math.floor(Date.now()/1000) > offer.auction_end) return res.status(400).json({ error: 'Aukcja zakończona' });
  const minBid = (offer.auction_current || offer.auction_start) + 0.01;
  if (Number(amount) < minBid) return res.status(400).json({ error: `Minimalna oferta: ${minBid.toFixed(2)} PLN` });
  await db.runInsert('INSERT INTO bids (offer_id,user_id,amount) VALUES (?,?,?)', [req.params.id, req.user.id, Number(amount)]);
  await db.run('UPDATE offers SET auction_current=?, auction_winner_id=? WHERE id=?', [Number(amount), req.user.id, req.params.id]);
  res.json({ message: 'Oferta złożona!', current: Number(amount) });
});

router.delete('/:id', auth, async (req, res) => {
  const offer = await db.get('SELECT * FROM offers WHERE id=?', [req.params.id]);
  if (!offer) return res.status(404).json({ error: 'Nie znaleziono' });
  const user = await db.get('SELECT role FROM users WHERE id=?', [req.user.id]);
  if (offer.seller_id !== req.user.id && !['admin','tutor'].includes(user?.role))
    return res.status(403).json({ error: 'Brak uprawnień' });
  await db.run("UPDATE offers SET status='deleted' WHERE id=?", [req.params.id]);
  res.json({ message: 'Usunięto' });
});

module.exports = router;

// PATCH mark as sold (seller or admin/tutor)
router.patch('/:id/sold', auth, async (req, res) => {
  const offer = await db.get('SELECT * FROM offers WHERE id=?', [req.params.id]);
  if (!offer) return res.status(404).json({ error: 'Nie znaleziono' });
  const user = await db.get('SELECT role FROM users WHERE id=?', [req.user.id]);
  if (offer.seller_id !== req.user.id && !['admin','tutor'].includes(user?.role))
    return res.status(403).json({ error: 'Brak uprawnień' });
  if (offer.status === 'sold') return res.status(400).json({ error: 'Ogłoszenie już jest sprzedane' });
  await db.run("UPDATE offers SET status='sold' WHERE id=?", [req.params.id]);
  res.json({ message: 'Ogłoszenie oznaczone jako sprzedane' });
});

// PATCH reactivate (seller or admin)
router.patch('/:id/reactivate', auth, async (req, res) => {
  const offer = await db.get('SELECT * FROM offers WHERE id=?', [req.params.id]);
  if (!offer) return res.status(404).json({ error: 'Nie znaleziono' });
  const user = await db.get('SELECT role FROM users WHERE id=?', [req.user.id]);
  if (offer.seller_id !== req.user.id && !['admin','tutor'].includes(user?.role))
    return res.status(403).json({ error: 'Brak uprawnień' });
  await db.run("UPDATE offers SET status='active' WHERE id=?", [req.params.id]);
  res.json({ message: 'Ogłoszenie reaktywowane' });
});
