const router = require('express').Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const { server_id } = req.query;
    if (server_id) {
      return res.json(await db.all('SELECT * FROM categories WHERE server_id=? ORDER BY id', [server_id]));
    }
    res.json(await db.all('SELECT c.*,s.name as server_name FROM categories c LEFT JOIN servers s ON c.server_id=s.id ORDER BY c.server_id,c.id'));
  } catch(e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
