require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/', rateLimit({ windowMs: 15*60*1000, max: 300 }));

const db = require('./db');
const { reviewsRouter } = require('./routes/tutor');

db.init().then(() => {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/offers', require('./routes/offers'));
  app.use('/api/categories', require('./routes/categories'));
  app.use('/api/servers', require('./routes/servers'));
  app.use('/api/messages', require('./routes/messages'));
  app.use('/api/tutor', require('./routes/tutor'));
  app.use('/api/reviews', reviewsRouter);
  app.use('/api/admin', require('./routes/admin'));

  app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
  app.listen(PORT, () => console.log(`🐉 MT2Market on :${PORT}`));
}).catch(e => { console.error('DB init failed:', e); process.exit(1); });
