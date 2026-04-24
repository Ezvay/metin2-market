const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const requireRole = require('../middleware/requireRole');

const adminOrTutor = requireRole('admin', 'tutor');
const adminOnly = requireRole('admin');

// ===== STATS =====
router.get('/stats', auth, adminOrTutor, (req, res) => {
  res.json({
    users: db.get('SELECT COUNT(*) as c FROM users')?.c || 0,
    offers: db.get("SELECT COUNT(*) as c FROM offers WHERE status='active'")?.c || 0,
    offers_total: db.get('SELECT COUNT(*) as c FROM offers')?.c || 0,
    banned: db.get('SELECT COUNT(*) as c FROM users WHERE is_banned=1')?.c || 0,
    tutor_requests: db.get('SELECT COUNT(*) as c FROM tutor_requests')?.c || 0,
    tutor_pending: db.get("SELECT COUNT(*) as c FROM tutor_requests WHERE status='pending'")?.c || 0,
    messages: db.get('SELECT COUNT(*) as c FROM messages')?.c || 0,
    servers: db.get('SELECT COUNT(*) as c FROM servers')?.c || 0,
  });
});

// ===== USERS =====
router.get('/users', auth, adminOrTutor, (req, res) => {
  const { search, page = 1, limit = 20 } = req.query;
  const offset = (Number(page)-1)*Number(limit);
  let where = ''; let params = [];
  if (search) { where = 'WHERE username LIKE ? OR email LIKE ?'; params = ['%'+search+'%','%'+search+'%']; }
  const users = db.all(`SELECT id,username,email,role,is_verified,is_banned,ban_reason,rating,total_sales,created_at FROM users ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, Number(limit), offset]);
  const total = db.get(`SELECT COUNT(*) as c FROM users ${where}`, params);
  res.json({ users, total: total?.c||0 });
});

router.get('/users/:id', auth, adminOrTutor, (req, res) => {
  const u = db.get('SELECT id,username,email,role,is_verified,is_banned,ban_reason,rating,rating_count,total_sales,bio,discord,created_at FROM users WHERE id=?', [req.params.id]);
  if (!u) return res.status(404).json({ error: 'Nie znaleziono' });
  const offers = db.all("SELECT o.*,s.name as server_name FROM offers o LEFT JOIN servers s ON o.server_id=s.id WHERE o.seller_id=? ORDER BY o.id DESC LIMIT 20", [req.params.id]);
  const banLog = db.all('SELECT b.*,a.username as admin_name FROM ban_log b JOIN users a ON b.admin_id=a.id WHERE b.user_id=? ORDER BY b.id DESC', [req.params.id]);
  res.json({ ...u, offers, banLog });
});

// BAN/UNBAN
router.post('/users/:id/ban', auth, adminOnly, (req, res) => {
  const { reason } = req.body;
  const target = db.get('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Nie znaleziono' });
  if (target.role === 'admin') return res.status(403).json({ error: 'Nie można zbanować admina' });
  db.run('UPDATE users SET is_banned=1, ban_reason=? WHERE id=?', [reason||'naruszenie regulaminu', req.params.id]);
  db.runInsert('INSERT INTO ban_log (user_id,admin_id,action,reason) VALUES (?,?,?,?)',
    [req.params.id, req.user.id, 'ban', reason||null]);
  res.json({ message: `Użytkownik ${target.username} zablokowany` });
});

router.post('/users/:id/unban', auth, adminOnly, (req, res) => {
  const target = db.get('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Nie znaleziono' });
  db.run('UPDATE users SET is_banned=0, ban_reason=NULL WHERE id=?', [req.params.id]);
  db.runInsert('INSERT INTO ban_log (user_id,admin_id,action) VALUES (?,?,?)',
    [req.params.id, req.user.id, 'unban']);
  res.json({ message: `Użytkownik ${target.username} odblokowany` });
});

// CHANGE ROLE
router.post('/users/:id/role', auth, adminOnly, (req, res) => {
  const { role } = req.body;
  if (!['user','tutor','admin'].includes(role)) return res.status(400).json({ error: 'Nieprawidłowa rola' });
  const target = db.get('SELECT * FROM users WHERE id=?', [req.params.id]);
  if (!target) return res.status(404).json({ error: 'Nie znaleziono' });
  db.run('UPDATE users SET role=? WHERE id=?', [role, req.params.id]);
  db.runInsert('INSERT INTO ban_log (user_id,admin_id,action,reason) VALUES (?,?,?,?)',
    [req.params.id, req.user.id, 'role_change', `Zmieniono na: ${role}`]);
  res.json({ message: `Rola zmieniona na ${role}` });
});

// DELETE offer (admin/tutor)
router.delete('/offers/:id', auth, adminOrTutor, (req, res) => {
  const offer = db.get('SELECT * FROM offers WHERE id=?', [req.params.id]);
  if (!offer) return res.status(404).json({ error: 'Nie znaleziono' });
  db.run("UPDATE offers SET status='deleted' WHERE id=?", [req.params.id]);
  res.json({ message: 'Ogłoszenie usunięte' });
});

// GET all offers (admin)
router.get('/offers', auth, adminOrTutor, (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;
  const offset = (Number(page)-1)*Number(limit);
  const where = []; const params = [];
  if (status) { where.push('o.status=?'); params.push(status); }
  if (search) { where.push('o.title LIKE ?'); params.push('%'+search+'%'); }
  const ws = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const offers = db.all(`
    SELECT o.*, u.username as seller_name, s.name as server_name
    FROM offers o JOIN users u ON o.seller_id=u.id LEFT JOIN servers s ON o.server_id=s.id
    ${ws} ORDER BY o.id DESC LIMIT ? OFFSET ?
  `, [...params, Number(limit), offset]);
  const total = db.get(`SELECT COUNT(*) as c FROM offers o ${ws}`, params);
  res.json({ offers, total: total?.c||0 });
});

// ===== TUTOR REQUESTS =====
router.get('/tutor-requests', auth, adminOrTutor, (req, res) => {
  const { status } = req.query;
  let where = ''; let params = [];
  if (status) { where = 'WHERE t.status=?'; params = [status]; }
  const requests = db.all(`
    SELECT t.*, o.title as offer_title, b.username as buyer_name, s.username as seller_name,
           CASE WHEN t.tutor_id IS NOT NULL THEN tu.username ELSE NULL END as tutor_name
    FROM tutor_requests t
    JOIN offers o ON t.offer_id=o.id
    JOIN users b ON t.buyer_id=b.id
    JOIN users s ON t.seller_id=s.id
    LEFT JOIN users tu ON t.tutor_id=tu.id
    ${where} ORDER BY t.id DESC
  `, params);
  res.json(requests);
});

router.post('/tutor-requests/:id/assign', auth, requireRole('admin','tutor'), (req, res) => {
  const req_ = db.get('SELECT * FROM tutor_requests WHERE id=?', [req.params.id]);
  if (!req_) return res.status(404).json({ error: 'Nie znaleziono' });
  db.run("UPDATE tutor_requests SET tutor_id=?, status='in_progress' WHERE id=?", [req.user.id, req.params.id]);
  res.json({ message: 'Przejąłeś zlecenie TuTora' });
});

router.post('/tutor-requests/:id/complete', auth, requireRole('admin','tutor'), (req, res) => {
  const { notes } = req.body;
  db.run("UPDATE tutor_requests SET status='completed', notes=? WHERE id=?", [notes||null, req.params.id]);
  res.json({ message: 'Zlecenie zakończone' });
});

router.post('/tutor-requests/:id/cancel', auth, requireRole('admin','tutor'), (req, res) => {
  db.run("UPDATE tutor_requests SET status='cancelled' WHERE id=?", [req.params.id]);
  res.json({ message: 'Zlecenie anulowane' });
});

// Send message as admin/tutor (to buyer or seller in tutor request)
router.post('/tutor-requests/:id/message', auth, adminOrTutor, async (req, res) => {
  const { to_id, body } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: 'Wpisz treść wiadomości' });
  db.runInsert('INSERT INTO messages (from_id,to_id,body) VALUES (?,?,?)', [req.user.id, to_id, body.trim()]);
  res.json({ message: 'Wysłano' });
});

// ===== SERVERS =====
router.get('/servers', auth, adminOnly, (req, res) => {
  res.json(db.all('SELECT * FROM servers ORDER BY id'));
});

module.exports = router;
