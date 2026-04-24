const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
let db;

function getDb() {
  if (!db) db = new Database(DB_PATH);
  return db;
}

function init() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      avatar TEXT DEFAULT NULL,
      is_admin INTEGER DEFAULT 0,
      rating REAL DEFAULT 0,
      total_sales INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      rates TEXT,
      description TEXT,
      logo TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      icon TEXT,
      parent_id INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      currency TEXT DEFAULT 'PLN',
      category_id INTEGER,
      server_id INTEGER,
      seller_id INTEGER NOT NULL,
      images TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      views INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seller_id) REFERENCES users(id),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (server_id) REFERENCES servers(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      offer_id INTEGER,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id)
    );
  `);

  // Seed categories
  const catCount = db.prepare('SELECT COUNT(*) as c FROM categories').get();
  if (catCount.c === 0) {
    const insertCat = db.prepare('INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)');
    [
      ['Broń', 'bron', '⚔️'],
      ['Zbroja', 'zbroja', '🛡️'],
      ['Hełmy', 'helmy', '⛑️'],
      ['Buty', 'buty', '👟'],
      ['Biżuteria', 'bizuteria', '💍'],
      ['Kamienie', 'kamienie', '💎'],
      ['Smocze Kamienie', 'smocze-kamienie', '🐉'],
      ['Yang', 'yang', '💰'],
      ['Konta', 'konta', '👤'],
      ['Usługi', 'uslugi', '🔧'],
      ['Inne', 'inne', '📦'],
    ].forEach(([name, slug, icon]) => insertCat.run(name, slug, icon));
  }

  // Seed servers
  const srvCount = db.prepare('SELECT COUNT(*) as c FROM servers').get();
  if (srvCount.c === 0) {
    const insertSrv = db.prepare('INSERT INTO servers (name, slug, rates) VALUES (?, ?, ?)');
    [
      ['MegaMT2', 'megamt2', '1000x'],
      ['DarkMT2', 'darkmt2', '500x'],
      ['LegacyMT2', 'legacymt2', '100x'],
      ['HeroMT2', 'heromt2', '2500x'],
      ['ClassicMT2', 'classicmt2', '50x'],
    ].forEach(([name, slug, rates]) => insertSrv.run(name, slug, rates));
  }

  console.log('Database initialized');
}

module.exports = { getDb, init };
