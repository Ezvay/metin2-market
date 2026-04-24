const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

// Support both SQLite (default) and MySQL (if DATABASE_URL is set)
const USE_MYSQL = !!process.env.DATABASE_URL || !!process.env.MYSQL_HOST;

if (USE_MYSQL) {
  module.exports = require('./db-mysql');
} else {
  module.exports = require('./db-sqlite');
}
