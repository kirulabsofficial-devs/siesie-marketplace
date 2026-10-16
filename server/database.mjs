import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function openDatabase(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  const version = db.prepare('PRAGMA user_version').get().user_version;
  if (version > 1) throw new Error('Database is newer than this application.');
  if (version === 0) {
    db.exec(`BEGIN IMMEDIATE;
      CREATE TABLE users (
        id TEXT PRIMARY KEY, role TEXT NOT NULL CHECK(role IN ('customer','worker','admin')),
        name TEXT NOT NULL, phone TEXT UNIQUE NOT NULL, area TEXT NOT NULL,
        verified INTEGER NOT NULL DEFAULT 0, services TEXT NOT NULL DEFAULT '[]',
        joined_at TEXT NOT NULL
      );
      CREATE TABLE sessions (
        token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
      );
      CREATE INDEX sessions_expiry ON sessions(expires_at);
      CREATE TABLE job_memberships (
        customer_id TEXT NOT NULL REFERENCES users(id), worker_id TEXT NOT NULL REFERENCES users(id),
        PRIMARY KEY(customer_id, worker_id)
      );
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES users(id),
        worker_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL,
        UNIQUE(customer_id, worker_id)
      );
      CREATE INDEX conversations_worker ON conversations(worker_id);
      CREATE TABLE messages (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL,
        conversation_id TEXT NOT NULL REFERENCES conversations(id), sender_id TEXT NOT NULL REFERENCES users(id),
        body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 2000), created_at TEXT NOT NULL,
        client_id TEXT NOT NULL, UNIQUE(conversation_id, sender_id, client_id)
      );
      CREATE INDEX messages_conversation ON messages(conversation_id, sequence);
      CREATE TABLE read_cursors (
        conversation_id TEXT NOT NULL REFERENCES conversations(id), user_id TEXT NOT NULL REFERENCES users(id),
        sequence INTEGER NOT NULL DEFAULT 0, read_at TEXT NOT NULL,
        PRIMARY KEY(conversation_id, user_id)
      );
      PRAGMA user_version = 1;
      COMMIT;`);
  }
  // Only minimal test identities and booking relationships enter the messaging DB.
  // Identity documents, addresses and payment data remain in the existing local demo.
  const seed = JSON.parse(readFileSync(new URL('./seed.json', import.meta.url), 'utf8'));
  db.exec('BEGIN IMMEDIATE');
  try {
    const insert = db.prepare('INSERT OR IGNORE INTO users VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const u of seed.users) insert.run(u.id, u.role, u.name, u.phone, u.area, u.verified ? 1 : 0, JSON.stringify(u.services || []), u.joinedAt);
    const job = db.prepare('INSERT OR IGNORE INTO job_memberships VALUES (?, ?)');
    for (const j of seed.memberships) job.run(j.customerId, j.workerId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return db;
}
