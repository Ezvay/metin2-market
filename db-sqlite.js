const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { createTables } = require('./db-schema');

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

function run(sql, params = []) { db.run(sql, params); scheduleWrite(); return Promise.resolve(); }

function get(sql, params = []) {
  const stmt = db.prepare(sql); stmt.bind(params);
  if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return Promise.resolve(r); }
  stmt.free(); return Promise.resolve(null);
}

function all(sql, params = []) {
  const stmt = db.prepare(sql); const rows = []; stmt.bind(params);
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free(); return Promise.resolve(rows);
}

function runInsert(sql, params = []) {
  db.run(sql, params);
  const stmt = db.prepare('SELECT last_insert_rowid() as id');
  stmt.step(); const r = stmt.getAsObject(); stmt.free();
  scheduleWrite();
  return Promise.resolve({ lastInsertRowid: r ? r.id : null });
}

async function init() {
  const SQL = await initSqlJs();
  db = fs.existsSync(DB_PATH) ? new SQL.Database(fs.readFileSync(DB_PATH)) : new SQL.Database();
  // Wrap sync SQLite for shared schema creator
  const dbObj = {
    run: (sql, params=[]) => { db.run(sql, params||[]); return Promise.resolve(); },
    get: (sql, params=[]) => {
      const stmt = db.prepare(sql); stmt.bind(params||[]);
      if (stmt.step()) { const r = stmt.getAsObject(); stmt.free(); return Promise.resolve(r); }
      stmt.free(); return Promise.resolve(null);
    },
    all: (sql, params=[]) => {
      const stmt = db.prepare(sql); const rows = []; stmt.bind(params||[]);
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free(); return Promise.resolve(rows);
    },
  };
  await createTables(dbObj, 'sqlite');
  scheduleWrite();
  console.log('✅ SQLite ready:', DB_PATH);
}

module.exports = { init, run, get, all, runInsert };
