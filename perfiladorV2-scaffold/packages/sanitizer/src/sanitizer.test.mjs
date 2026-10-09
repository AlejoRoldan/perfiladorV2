import assert from 'node:assert/strict';
import test from 'node:test';

import sanitizerModule from '../dist/sanitizer.js';

const { SecretSanitizer } = sanitizerModule;

test('redacts postgres connection strings and Gemini keys', () => {
  const code = `
    const dbUrl = "postgresql://postgres:secret123@db.itti.corp:5432/perfilador";
    const key = "AIzaSyD-73928172938192839182938192839";
  `;

  const result = SecretSanitizer.sanitize(code);
  assert.equal(result.hasRedactions, true);
  assert.match(result.sanitized, /\[REDACTED_DB_CONNECTION_STRING\]/);
  assert.match(result.sanitized, /\[REDACTED_GOOGLE_API_KEY\]/);
  assert.equal(result.sanitized.includes('secret123'), false);
});

test('redacts GitHub and OpenAI tokens in diffs', () => {
  const diff = `
    + const ghToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyZ";
    + const openAi = "sk-proj-abcde12345678901234567890_test";
  `;

  const result = SecretSanitizer.sanitize(diff);
  assert.match(result.sanitized, /\[REDACTED_(GITHUB_TOKEN|SECRET)\]/);
  assert.match(result.sanitized, /\[REDACTED_OPENAI_API_KEY\]/);
  assert.equal(result.sanitized.includes('ghp_'), false);
});

test('redacts JSON secrets, unquoted env secrets, and Supabase secret keys', () => {
  const payload = `
    DATABASE_URL=postgresql://postgres:dbpassword@db.example.com:6543/postgres
    ADMIN_IMPORT_TOKEN=plainsecretvalue
    const config = { "password": "json-password-value", "api_key": "sb_secret_abcdefghijklmnopqrstuvwxyz123456" };
  `;

  const result = SecretSanitizer.sanitize(payload);

  assert.equal(result.hasRedactions, true);
  assert.match(result.sanitized, /\[REDACTED_DB_CONNECTION_STRING\]/);
  assert.match(result.sanitized, /ADMIN_IMPORT_TOKEN=\[REDACTED_SECRET\]/);
  assert.match(result.sanitized, /"password": "\[REDACTED_SECRET\]"/);
  assert.match(result.sanitized, /\[REDACTED_(SUPABASE_SECRET_KEY|SECRET)\]/);
  assert.equal(result.sanitized.includes('dbpassword'), false);
  assert.equal(result.sanitized.includes('plainsecretvalue'), false);
  assert.equal(result.sanitized.includes('json-password-value'), false);
  assert.equal(result.sanitized.includes('sb_secret_'), false);
});

test('does not alter normal code without secrets', () => {
  const cleanCode = `
    import express from 'express';
    // Ver documentacion en https://github.com/AlejoRoldan/perfiladorV2
    const PORT = 3000;
    export const add = (a, b) => a + b;
  `;

  const result = SecretSanitizer.sanitize(cleanCode);
  assert.equal(result.hasRedactions, false);
  assert.equal(result.redactedCount, 0);
  assert.equal(result.sanitized, cleanCode);
});
