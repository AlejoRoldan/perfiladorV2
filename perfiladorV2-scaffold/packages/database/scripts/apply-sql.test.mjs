import assert from 'node:assert/strict';
import test from 'node:test';

import {
  checksumSql,
  isLocalDatabaseUrl,
  ledgerDdl,
  migrationIdFor,
  migrationKindFor,
  resolveSslConfig
} from './apply-sql.mjs';

test('detects local database URLs for TLS policy', () => {
  assert.equal(isLocalDatabaseUrl('postgresql://postgres:postgres@localhost:5432/app'), true);
  assert.equal(isLocalDatabaseUrl('postgresql://postgres:postgres@127.0.0.1:5432/app'), true);
  assert.equal(isLocalDatabaseUrl('postgresql://postgres:postgres@db:5432/app'), true);
  assert.equal(isLocalDatabaseUrl('postgresql://postgres:postgres@example.supabase.com:5432/app'), false);
});

test('uses verified TLS by default for remote databases', () => {
  const remoteUrl = 'postgresql://postgres:secret@example.supabase.com:5432/postgres';
  assert.equal(resolveSslConfig(remoteUrl, {}), true);
  assert.equal(resolveSslConfig(remoteUrl, { DB_SSL_MODE: 'verify' }), true);
  assert.deepEqual(resolveSslConfig(remoteUrl, { DB_SSL_MODE: 'no-verify' }), { rejectUnauthorized: false });
  assert.equal(resolveSslConfig(remoteUrl, { DB_SSL_MODE: 'disable' }), false);
});

test('disables TLS only for local database URLs by default', () => {
  assert.equal(resolveSslConfig('postgresql://postgres:postgres@localhost:5432/app', {}), false);
});

test('computes stable SQL checksums and migration identities', () => {
  assert.equal(checksumSql('SELECT 1;'), checksumSql('SELECT 1;'));
  assert.notEqual(checksumSql('SELECT 1;'), checksumSql('SELECT 2;'));
  assert.equal(migrationIdFor('/repo/packages/database/migrations/001_initial_schema.sql'), '001_initial_schema.sql');
  assert.equal(migrationKindFor('/repo/packages/database/migrations/001_initial_schema.sql'), 'migration');
  assert.equal(migrationKindFor('/repo/packages/database/seeds/001_base_taxonomy.sql'), 'seed');
});

test('ledger DDL creates schema_migrations with checksum tracking', () => {
  const ddl = ledgerDdl();
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS schema_migrations/);
  assert.match(ddl, /checksum_sha256 text NOT NULL/);
  assert.match(ddl, /kind text NOT NULL/);
});
