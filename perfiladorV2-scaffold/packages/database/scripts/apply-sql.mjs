import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const projectRoot = path.resolve(packageRoot, '../..');

dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config();

const { Client } = pg;
const root = packageRoot;

const groups = {
  migrate: [path.join(root, 'migrations')],
  seed: [path.join(root, 'seeds')],
  all: [path.join(root, 'migrations'), path.join(root, 'seeds')]
};

export function isLocalDatabaseUrl(databaseUrl) {
  try {
    const { hostname } = new URL(databaseUrl);
    return ['localhost', '127.0.0.1', 'db'].includes(hostname);
  } catch {
    return false;
  }
}

export function resolveSslConfig(databaseUrl, env = process.env) {
  if (isLocalDatabaseUrl(databaseUrl)) return false;

  const mode = String(env.DB_SSL_MODE || 'verify').trim().toLowerCase();
  if (mode === 'disable') return false;
  if (mode === 'no-verify') return { rejectUnauthorized: false };
  return true;
}

export function checksumSql(sql) {
  return crypto.createHash('sha256').update(sql).digest('hex');
}

export function migrationIdFor(file) {
  return path.basename(file);
}

export function migrationKindFor(file) {
  const normalized = file.replaceAll('\\', '/');
  return normalized.includes('/seeds/') ? 'seed' : 'migration';
}

export function ledgerDdl() {
  return `
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      kind text NOT NULL CHECK (kind IN ('migration', 'seed')),
      checksum_sha256 text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;
}

export async function sqlFilesFor(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .map(entry => path.join(dir, entry.name))
    .sort();
}

async function ensureLedger(client) {
  await client.query(ledgerDdl());
}

async function getLedgerRow(client, id) {
  const result = await client.query('SELECT id, kind, checksum_sha256 FROM schema_migrations WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function applySqlFile(client, file) {
  const sql = await fs.readFile(file, 'utf8');
  const id = migrationIdFor(file);
  const kind = migrationKindFor(file);
  const checksum = checksumSql(sql);
  const existing = await getLedgerRow(client, id);

  if (existing) {
    if (existing.checksum_sha256 !== checksum || existing.kind !== kind) {
      throw new Error(`Migration drift detected for ${id}. Create a new SQL file instead of editing an applied one.`);
    }
    console.log(`Skipping ${id}; already applied.`);
    return 'skipped';
  }

  console.log(`Applying ${path.relative(process.cwd(), file)}...`);
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      'INSERT INTO schema_migrations (id, kind, checksum_sha256) VALUES ($1, $2, $3)',
      [id, kind, checksum]
    );
    await client.query('COMMIT');
    return 'applied';
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

export async function applySqlMode(mode, env = process.env) {
  if (!groups[mode]) {
    throw new Error(`Unknown mode "${mode}". Use one of: ${Object.keys(groups).join(', ')}`);
  }

  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required.');
  }

  const client = new Client({
    connectionString: env.DATABASE_URL,
    ssl: resolveSslConfig(env.DATABASE_URL, env)
  });

  try {
    await client.connect();
    await ensureLedger(client);

    for (const dir of groups[mode]) {
      const files = await sqlFilesFor(dir);
      for (const file of files) {
        await applySqlFile(client, file);
      }
    }
  } finally {
    await client.end().catch(() => {});
  }
}

async function main() {
  const mode = process.argv[2] || 'all';
  try {
    await applySqlMode(mode);
    console.log(`Database ${mode} completed.`);
  } catch (err) {
    console.error(`Database ${mode} failed:`, err.message);
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
