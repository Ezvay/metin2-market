const router = require('express').Router();
const db = require('../db');
router.get('/', (req, res) => res.json(db.all('SELECT * FROM servers ORDER BY name')));
module.exports = router;
