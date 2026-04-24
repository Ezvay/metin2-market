const router = require('express').Router();
const db = require('../db');
const auth = require('../middleware/auth');
const { sendNewMessageEmail } = require('../emails');

// GET inbox - list of conversations
router.get('/inbox', auth, (req, res) => {
  const convs = db.all(`
    SELECT
      CASE WHEN m.from_id=? THEN m.to_id ELSE m.from_id END as other_id,
      u.username as other_username,
      u.avatar as other_avatar,
      MAX(m.id) as last_msg_id,
      m.body as last_body,
      m.created_at as last_time,
      SUM(CASE WHEN m.to_id=? AND m.is_read=0 THEN 1 ELSE 0 END) as unread
    FROM messages m
    JOIN users u ON u.id = CASE WHEN m.from_id=? THEN m.to_id ELSE m.from_id END
    WHERE m.from_id=? OR m.to_id=?
    GROUP BY other_id ORDER BY last_msg_id DESC
  `, [req.user.id, req.user.id, req.user.id, req.user.id, req.user.id]);
  res.json(convs);
});

// GET unread count
router.get('/unread', auth, (req, res) => {
  const r = db.get('SELECT COUNT(*) as c FROM messages WHERE to_id=? AND is_read=0', [req.user.id]);
  res.json({ count: r?.c || 0 });
});

// GET conversation with user
router.get('/conversation/:userId', auth, (req, res) => {
  const otherId = Number(req.params.userId);
  const msgs = db.all(`
    SELECT m.*, u.username as from_username
    FROM messages m JOIN users u ON m.from_id=u.id
    WHERE (m.from_id=? AND m.to_id=?) OR (m.from_id=? AND m.to_id=?)
    ORDER BY m.id ASC LIMIT 100
  `, [req.user.id, otherId, otherId, req.user.id]);

  // Mark as read
  db.run('UPDATE messages SET is_read=1 WHERE to_id=? AND from_id=?', [req.user.id, otherId]);

  const other = db.get('SELECT id,username,avatar FROM users WHERE id=?', [otherId]);
  res.json({ messages: msgs, other });
});

// POST send message
router.post('/send', auth, async (req, res) => {
  const { to_id, body, offer_id } = req.body;
  if (!to_id || !body?.trim()) return res.status(400).json({ error: 'Nieprawidłowe dane' });
  if (to_id === req.user.id) return res.status(400).json({ error: 'Nie możesz pisać do siebie' });

  const recipient = db.get('SELECT * FROM users WHERE id=?', [to_id]);
  if (!recipient) return res.status(404).json({ error: 'Użytkownik nie istnieje' });

  db.runInsert('INSERT INTO messages (from_id,to_id,body,offer_id) VALUES (?,?,?,?)',
    [req.user.id, to_id, body.trim(), offer_id || null]);

  // Check if first message in this conversation (don't spam emails)
  const prevCount = db.get('SELECT COUNT(*) as c FROM messages WHERE from_id=? AND to_id=?',
    [req.user.id, to_id]);
  if (prevCount?.c <= 1) {
    const offer = offer_id ? db.get('SELECT title FROM offers WHERE id=?', [offer_id]) : null;
    const sender = db.get('SELECT username FROM users WHERE id=?', [req.user.id]);
    await sendNewMessageEmail(recipient.email, recipient.username, sender.username, offer?.title);
  }

  res.json({ message: 'Wysłano' });
});

module.exports = router;
