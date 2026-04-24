const router = require('express').Router();
const db = require('../db');
// GET all categories (optionally filter by server_id)
router.get('/', (req, res) => {
  const { server_id } = req.query;
  if (server_id) return res.json(db.all('SELECT * FROM categories WHERE server_id=? ORDER BY id', [server_id]));
  res.json(db.all('SELECT c.*,s.name as server_name FROM categories c LEFT JOIN servers s ON c.server_id=s.id ORDER BY c.server_id,c.id'));
});
module.exports = router;
