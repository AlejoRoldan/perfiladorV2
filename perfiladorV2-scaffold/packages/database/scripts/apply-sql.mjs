import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import dotenv from 'dotenv';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(scriptDir, '..');
const projectRoot = path.resolve(packageRoot, '../..');

dotenv.config({ path: path.join(projectRoot, '.env') });
dotenv.config();

const { Client } = pg;
const mode = process.argv[2] || 'all';
const root = packageRoot;

const groups = {
  migrate: [path.join(root, 'migrations')],
  seed: [path.join(root, 'seeds')],
  all: [path.join(root, 'migrations'), path.join(root, 'seeds')]
};

if (!groups[mode]) {
  console.error(`Unknown mode "${mode}". Use one of: ${Object.keys(groups).join(', ')}`);
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

async function sqlFilesFor(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
    .map(entry => path.join(dir, entry.name))
    .sort();
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocalDatabaseUrl(process.env.DATABASE_URL)
    ? false
    : true
});

function isLocalDatabaseUrl(databaseUrl) {
  try {
    const { hostname } = new URL(databaseUrl);
    return ['localhost', '127.0.0.1', 'db'].includes(hostname);
  } catch {
    return false;
  }
}

try {
  await client.connect();

  for (const dir of groups[mode]) {
    const files = await sqlFilesFor(dir);
    for (const file of files) {
      const sql = await fs.readFile(file, 'utf8');
      console.log(`Applying ${path.relative(process.cwd(), file)}...`);
      await client.query(sql);
    }
  }

  console.log(`Database ${mode} completed.`);
} catch (err) {
  console.error(`Database ${mode} failed:`, err.message);
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
