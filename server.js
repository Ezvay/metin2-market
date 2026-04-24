require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

// Init DB
const db = require('./db');
db.init();

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/servers', require('./routes/servers'));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Metin2Market running on port ${PORT}`);
});
