const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.db');

let db = null;
let saveTimer = null;

function scheduleWrite() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) { console.error('DB write error:', e.message); }
  }, 500);
}

function run(sql, params = []) {
  db.run(sql, params);
  scheduleWrite();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = [];
  stmt.bind(params);
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function runInsert(sql, params = []) {
  db.run(sql, params);
  const row = get('SELECT last_insert_rowid() as id');
  scheduleWrite();
  return { lastInsertRowid: row ? row.id : null };
}

async function init() {
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    db = new SQL.Database(fs.readFileSync(DB_PATH));
    console.log('DB loaded from file');
  } else {
    db = new SQL.Database();
    console.log('DB created fresh');
  }

  db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, avatar TEXT, is_admin INTEGER DEFAULT 0, rating REAL DEFAULT 0, total_sales INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS servers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, rates TEXT, description TEXT, logo TEXT, created_at DATETIME DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, icon TEXT, parent_id INTEGER DEFAULT NULL)`);
  db.run(`CREATE TABLE IF NOT EXISTS offers (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, description TEXT, price REAL NOT NULL, currency TEXT DEFAULT 'PLN', category_id INTEGER, server_id INTEGER, seller_id INTEGER NOT NULL, images TEXT DEFAULT '[]', status TEXT DEFAULT 'active', views INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now')))`);
  db.run(`CREATE TABLE IF NOT EXISTS reviews (id INTEGER PRIMARY KEY AUTOINCREMENT, offer_id INTEGER, buyer_id INTEGER NOT NULL, seller_id INTEGER NOT NULL, rating INTEGER NOT NULL, comment TEXT, created_at DATETIME DEFAULT (datetime('now')))`);

  const catCount = get('SELECT COUNT(*) as c FROM categories');
  if (!catCount || catCount.c == 0) {
    [['Broń','bron','⚔️'],['Zbroja','zbroja','🛡️'],['Hełmy','helmy','⛑️'],['Buty','buty','👟'],['Biżuteria','bizuteria','💍'],['Kamienie','kamienie','💎'],['Smocze Kamienie','smocze-kamienie','🐉'],['Yang','yang','💰'],['Konta','konta','👤'],['Usługi','uslugi','🔧'],['Inne','inne','📦']].forEach(([n,s,i]) => db.run('INSERT OR IGNORE INTO categories (name,slug,icon) VALUES (?,?,?)',[n,s,i]));
  }

  const srvCount = get('SELECT COUNT(*) as c FROM servers');
  if (!srvCount || srvCount.c == 0) {
    [['MegaMT2','megamt2','1000x'],['DarkMT2','darkmt2','500x'],['LegacyMT2','legacymt2','100x'],['HeroMT2','heromt2','2500x'],['ClassicMT2','classicmt2','50x']].forEach(([n,s,r]) => db.run('INSERT OR IGNORE INTO servers (name,slug,rates) VALUES (?,?,?)',[n,s,r]));
  }

  scheduleWrite();
  console.log('Database initialized');
}

module.exports = { init, run, get, all, runInsert };
