import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

const packageDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(packageDir, '../../..');

dotenv.config({ path: resolve(projectRoot, '.env') });
dotenv.config();

export function resolveDatabaseUrl(env = process.env) {
  if (!env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required for @perfilador/database.');
  }

  return env.DATABASE_URL;
}

export function isLocalDatabaseUrl(databaseUrl: string) {
  const { hostname } = new URL(databaseUrl);
  return ['localhost', '127.0.0.1', 'db'].includes(hostname);
}

export function createDatabasePool(connectionString = resolveDatabaseUrl()) {
  return new pg.Pool({
    connectionString,
    ssl: isLocalDatabaseUrl(connectionString) ? false : true
  });
}

type DrizzleLikeDb = {
  select: (...args: unknown[]) => any;
  insert: (...args: unknown[]) => any;
};

export const pool = createDatabasePool();
export const db = drizzle(pool, { schema }) as DrizzleLikeDb;
