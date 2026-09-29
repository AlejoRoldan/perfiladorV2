import { describe, it, expect } from 'vitest';
import { SecretSanitizer } from './sanitizer';

describe('SecretSanitizer', () => {
  it('redacta cadenas de conexión postgres y llaves de Gemini', () => {
    const code = `
      const dbUrl = "postgresql://postgres:secret123@db.itti.corp:5432/perfilador";
      const key = "AIzaSyD-73928172938192839182938192839";
    `;

    const result = SecretSanitizer.sanitize(code);
    expect(result.hasRedactions).toBe(true);
    expect(result.sanitized).toContain('[REDACTED_DB_CONNECTION_STRING]');
    expect(result.sanitized).toContain('[REDACTED_GOOGLE_API_KEY]');
expect(result.sanitized.includes('secret123')).toBe(false);  });

  it('redacta tokens de GitHub y OpenAI en diffs de git', () => {
    const diff = `
      + const ghToken = "ghp_1234567890abcdefghijklmnopqrstuvwxyZ";
      + const openAi = "sk-proj-abcde12345678901234567890_test";
    `;

    const result = SecretSanitizer.sanitize(diff);
    expect(result.sanitized).toContain('[REDACTED_GITHUB_TOKEN]');
    expect(result.sanitized).toContain('[REDACTED_OPENAI_API_KEY]');
  });

  it('no altera código normal sin secretos ni URLs públicas legítimas', () => {
    const cleanCode = `
      import express from 'express';
      // Ver documentación en https://github.com/AlejoRoldan/perfiladorV2
      const PORT = 3000;
      export const add = (a: number, b: number) => a + b;
    `;

    const result = SecretSanitizer.sanitize(cleanCode);
    expect(result.hasRedactions).toBe(false);
    expect(result.redactedCount).toBe(0);
    expect(result.sanitized).toBe(cleanCode);
  });
});