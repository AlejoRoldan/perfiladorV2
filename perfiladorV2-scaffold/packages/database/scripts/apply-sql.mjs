import fs from 'fs/promises';
import path from 'path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const { Client } = pg;
const mode = process.argv[2] || 'all';
const root = path.resolve('packages/database');

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
  ssl: process.env.DATABASE_URL.includes('localhost')
    ? false
    : { rejectUnauthorized: false }
});

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
