const router = require('express').Router();
const { getDb } = require('../db');

router.get('/', (req, res) => {
  const db = getDb();
  res.json(db.prepare('SELECT * FROM servers ORDER BY name').all());
});

module.exports = router;
