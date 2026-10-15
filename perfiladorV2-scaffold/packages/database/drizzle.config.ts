import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDir = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(configDir, '../../.env') });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for drizzle-kit.');
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
