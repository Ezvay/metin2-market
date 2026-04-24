const mysql = require('mysql2/promise');
const { createTables } = require('./db-schema');

let pool = null;

function getPool() {
  if (pool) return pool;
  
  // Support both DATABASE_URL format and individual vars
  if (process.env.DATABASE_URL) {
    pool = mysql.createPool(process.env.DATABASE_URL + '?waitForConnections=true&connectionLimit=5&connectTimeout=10000');
  } else {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: process.env.MYSQL_PORT || 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 5,
      connectTimeout: 10000,
    });
  }
  return pool;
}

// Synchronous-style wrappers (async under the hood)
// These return promises but routes await them via middleware
let _syncRun, _syncGet, _syncAll, _syncInsert;

function run(sql, params = []) {
  const p = getPool();
  return p.execute(sql.replace(/\?/g, '?'), params).then(() => {}).catch(e => { throw e; });
}

async function get(sql, params = []) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows[0] || null;
}

async function all(sql, params = []) {
  const p = getPool();
  const [rows] = await p.execute(sql, params);
  return rows;
}

async function runInsert(sql, params = []) {
  const p = getPool();
  const [result] = await p.execute(sql, params);
  return { lastInsertRowid: result.insertId };
}

async function init() {
  const p = getPool();
  // Test connection
  try {
    const conn = await p.getConnection();
    conn.release();
    console.log('✅ MySQL connected');
  } catch (e) {
    console.error('❌ MySQL connection failed:', e.message);
    throw e;
  }

  // Wrap for createTables (expects sync-like object)
  const dbObj = {
    run: async (sql, params=[]) => { await p.execute(sql, params || []); },
    get: async (sql, params=[]) => { const [rows] = await p.execute(sql, params||[]); return rows[0]||null; },
    all: async (sql, params=[]) => { const [rows] = await p.execute(sql, params||[]); return rows; },
  };
  await createTables(dbObj, 'mysql');
  console.log('✅ MySQL schema ready');
}

module.exports = { init, run, get, all, runInsert };
