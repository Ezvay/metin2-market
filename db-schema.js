// Shared schema creation - works for both SQLite and MySQL (with slight differences)
async function createTables(db, dialect = 'sqlite') {
  const ts = dialect === 'mysql' ? 'BIGINT DEFAULT (UNIX_TIMESTAMP())' : "INTEGER DEFAULT (strftime('%s','now'))";
  const ai = dialect === 'mysql' ? 'AUTO_INCREMENT' : 'AUTOINCREMENT';
  const unique_both = dialect === 'mysql' ? 'UNIQUE KEY cat_srv_slug (server_id, slug)' : 'UNIQUE(server_id, slug)';

  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY ${ai},
      username VARCHAR(64) UNIQUE NOT NULL,
      email VARCHAR(128) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      avatar TEXT DEFAULT NULL,
      role VARCHAR(16) DEFAULT 'user',
      is_verified TINYINT DEFAULT 0,
      is_banned TINYINT DEFAULT 0,
      ban_reason TEXT DEFAULT NULL,
      verify_token VARCHAR(128) DEFAULT NULL,
      reset_token VARCHAR(128) DEFAULT NULL,
      reset_token_expires BIGINT DEFAULT NULL,
      rating FLOAT DEFAULT 0,
      rating_count INTEGER DEFAULT 0,
      total_sales INTEGER DEFAULT 0,
      bio TEXT DEFAULT NULL,
      discord VARCHAR(64) DEFAULT NULL,
      created_at ${ts}
    )`,
    `CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY ${ai},
      name VARCHAR(64) NOT NULL,
      slug VARCHAR(64) UNIQUE NOT NULL,
      description TEXT,
      rates VARCHAR(32),
      logo TEXT,
      website TEXT,
      is_active TINYINT DEFAULT 1,
      created_at ${ts}
    )`,
    `CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY ${ai},
      server_id INTEGER DEFAULT NULL,
      name VARCHAR(64) NOT NULL,
      slug VARCHAR(64) NOT NULL,
      icon VARCHAR(8)
    )`,
    `CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY ${ai},
      title VARCHAR(255) NOT NULL,
      description TEXT,
      category_id INTEGER,
      server_id INTEGER,
      seller_id INTEGER NOT NULL,
      images TEXT DEFAULT '[]',
      type VARCHAR(16) DEFAULT 'buy_now',
      price FLOAT,
      auction_start FLOAT DEFAULT NULL,
      auction_current FLOAT DEFAULT NULL,
      auction_end BIGINT DEFAULT NULL,
      auction_winner_id INTEGER DEFAULT NULL,
      status VARCHAR(16) DEFAULT 'active',
      views INTEGER DEFAULT 0,
      created_at ${ts}
    )`,
    `CREATE TABLE IF NOT EXISTS bids (
      id INTEGER PRIMARY KEY ${ai},
      offer_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      amount FLOAT NOT NULL,
      created_at ${ts}
    )`,
    `CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY ${ai},
      from_id INTEGER NOT NULL,
      to_id INTEGER NOT NULL,
      offer_id INTEGER DEFAULT NULL,
      body TEXT NOT NULL,
      is_read TINYINT DEFAULT 0,
      created_at ${ts}
    )`,
    `CREATE TABLE IF NOT EXISTS tutor_requests (
      id INTEGER PRIMARY KEY ${ai},
      offer_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      tutor_id INTEGER DEFAULT NULL,
      status VARCHAR(16) DEFAULT 'pending',
      paid TINYINT DEFAULT 0,
      payment_method VARCHAR(16) DEFAULT NULL,
      notes TEXT DEFAULT NULL,
      created_at ${ts}
    )`,
    `CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY ${ai},
      offer_id INTEGER,
      reviewer_id INTEGER NOT NULL,
      reviewed_id INTEGER NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at ${ts}
    )`,
    `CREATE TABLE IF NOT EXISTS ban_log (
      id INTEGER PRIMARY KEY ${ai},
      user_id INTEGER NOT NULL,
      admin_id INTEGER NOT NULL,
      action VARCHAR(32) NOT NULL,
      reason TEXT,
      created_at ${ts}
    )`,
  ];

  for (const sql of tables) {
    await db.run(sql);
  }

  // Seed servers
  const srvCount = await db.get('SELECT COUNT(*) as c FROM servers');
  if (!srvCount || srvCount.c == 0) {
    await db.run("INSERT INTO servers (name,slug,description,rates,is_active) VALUES ('Projekt Hard','projekt-hard','Oficjalny serwer Projekt Hard','x100',1)");
  }

  // Seed categories
  const catCount = await db.get('SELECT COUNT(*) as c FROM categories');
  if (!catCount || catCount.c == 0) {
    const srv = await db.get("SELECT id FROM servers WHERE slug='projekt-hard'");
    const sid = srv ? srv.id : 1;
    const cats = [
      ['Postać','postac','🧙'],['Broń','bron','⚔️'],['Zbroja','zbroja','🛡️'],
      ['Hełm','helm','⛑️'],['Buty','buty','👟'],['Tarcza','tarcza','🔰'],
      ['Kolczyki','kolczyki','💎'],['Bransoletka','bransoletka','📿'],['Naszyjnik','naszyjnik','🔮'],
    ];
    for (const [n,s,i] of cats) {
      await db.run('INSERT INTO categories (server_id,name,slug,icon) VALUES (?,?,?,?)', [sid,n,s,i]);
    }
  }
}

module.exports = { createTables };
