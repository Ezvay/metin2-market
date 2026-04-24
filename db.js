const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');
let db = null;
let saveTimer = null;

function scheduleWrite() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.writeFileSync(DB_PATH, Buffer.from(db.export())); }
    catch (e) { console.error('DB write error:', e.message); }
  }, 500);
}

function run(sql, params = []) { db.run(sql, params); scheduleWrite(); }

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return r; }
  stmt.free(); return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = []; stmt.bind(params);
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free(); return rows;
}

function runInsert(sql, params = []) {
  db.run(sql, params);
  const r = get('SELECT last_insert_rowid() as id');
  scheduleWrite();
  return { lastInsertRowid: r ? r.id : null };
}

async function init() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH)
    ? new SQL.Database(fs.readFileSync(DB_PATH))
    : new SQL.Database();

  // USERS — role: 'user' | 'tutor' | 'admin'
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar TEXT DEFAULT NULL,
    role TEXT DEFAULT 'user',
    is_verified INTEGER DEFAULT 0,
    is_banned INTEGER DEFAULT 0,
    ban_reason TEXT DEFAULT NULL,
    verify_token TEXT DEFAULT NULL,
    reset_token TEXT DEFAULT NULL,
    reset_token_expires INTEGER DEFAULT NULL,
    rating REAL DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    bio TEXT DEFAULT NULL,
    discord TEXT DEFAULT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);

  // SERVERS
  db.run(`CREATE TABLE IF NOT EXISTS servers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    rates TEXT,
    logo TEXT,
    website TEXT,
    is_active INTEGER DEFAULT 1,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);

  // CATEGORIES — powiązane z serwerem
  db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    server_id INTEGER DEFAULT NULL,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    icon TEXT,
    UNIQUE(server_id, slug)
  )`);

  // OFFERS
  db.run(`CREATE TABLE IF NOT EXISTS offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    category_id INTEGER,
    server_id INTEGER,
    seller_id INTEGER NOT NULL,
    images TEXT DEFAULT '[]',
    type TEXT DEFAULT 'buy_now',
    price REAL,
    auction_start REAL DEFAULT NULL,
    auction_current REAL DEFAULT NULL,
    auction_end INTEGER DEFAULT NULL,
    auction_winner_id INTEGER DEFAULT NULL,
    status TEXT DEFAULT 'active',
    views INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (seller_id) REFERENCES users(id),
    FOREIGN KEY (category_id) REFERENCES categories(id),
    FOREIGN KEY (server_id) REFERENCES servers(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (offer_id) REFERENCES offers(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_id INTEGER NOT NULL,
    to_id INTEGER NOT NULL,
    offer_id INTEGER DEFAULT NULL,
    body TEXT NOT NULL,
    is_read INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (from_id) REFERENCES users(id),
    FOREIGN KEY (to_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tutor_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id INTEGER NOT NULL,
    buyer_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    tutor_id INTEGER DEFAULT NULL,
    status TEXT DEFAULT 'pending',
    paid INTEGER DEFAULT 0,
    payment_method TEXT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (offer_id) REFERENCES offers(id),
    FOREIGN KEY (buyer_id) REFERENCES users(id),
    FOREIGN KEY (seller_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    offer_id INTEGER,
    reviewer_id INTEGER NOT NULL,
    reviewed_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now')),
    FOREIGN KEY (reviewer_id) REFERENCES users(id),
    FOREIGN KEY (reviewed_id) REFERENCES users(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS ban_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    admin_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    reason TEXT,
    created_at INTEGER DEFAULT (strftime('%s','now'))
  )`);

  // ---- SEED SERVERS ----
  const srvCount = get('SELECT COUNT(*) as c FROM servers');
  if (!srvCount || srvCount.c == 0) {
    db.run(`INSERT OR IGNORE INTO servers (name, slug, description, rates, is_active)
      VALUES ('Projekt Hard', 'projekt-hard', 'Oficjalny serwer Projekt Hard', 'x100', 1)`);
  }

  // ---- SEED CATEGORIES dla Projekt Hard ----
  const catCount = get('SELECT COUNT(*) as c FROM categories');
  if (!catCount || catCount.c == 0) {
    const srv = get("SELECT id FROM servers WHERE slug='projekt-hard'");
    const sid = srv ? srv.id : 1;
    [
      ['Postać', 'postac', '🧙'],
      ['Broń', 'bron', '⚔️'],
      ['Zbroja', 'zbroja', '🛡️'],
      ['Hełm', 'helm', '⛑️'],
      ['Buty', 'buty', '👟'],
      ['Tarcza', 'tarcza', '🔰'],
      ['Kolczyki', 'kolczyki', '💎'],
      ['Bransoletka', 'bransoletka', '📿'],
      ['Naszyjnik', 'naszyjnik', '🔮'],
    ].forEach(([n, s, i]) =>
      db.run('INSERT OR IGNORE INTO categories (server_id,name,slug,icon) VALUES (?,?,?,?)', [sid, n, s, i])
    );
  }

  scheduleWrite();
  console.log('✅ Database ready');
}

module.exports = { init, run, get, all, runInsert };
