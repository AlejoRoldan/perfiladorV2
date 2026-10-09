import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function source(name) {
  return readFileSync(join(here, name), 'utf8');
}

test('code quality profiler prompt uses canonical taxonomy keys', () => {
  const text = source('code-quality-profiler.ts');

  for (const key of [
    'CLEAN_ARCHITECTURE',
    'SQL_OPTIMIZATION_CONCURRENCY',
    'TESTING_STRATEGY',
    'OWASP_INPUT_VALIDATION',
    'API_CONTRACTS'
  ]) {
    assert.match(text, new RegExp(key));
  }

  for (const legacyKey of ['CONCURRENCY_ASYNC', 'TESTING_RESILIENCE', 'CODE_SIMPLICITY']) {
    assert.equal(text.includes(legacyKey), false);
  }
});

test('reviewer dynamics prompt lists canonical taxonomy keys', () => {
  const text = source('reviewer-dynamics.ts');
  const promptStart = text.indexOf('REGLA ESTRICTA DE TAXONOM');
  assert.notEqual(promptStart, -1);
  const promptText = text.slice(promptStart);

  for (const key of [
    'CODE_REVIEW_RIGOR',
    'SQL_OPTIMIZATION_CONCURRENCY',
    'CLEAN_ARCHITECTURE',
    'SYSTEM_DESIGN_SCALABILITY',
    'OWASP_INPUT_VALIDATION',
    'TESTING_STRATEGY',
    'OBSERVABILITY_INCIDENTS',
    'API_CONTRACTS'
  ]) {
    assert.match(promptText, new RegExp(key));
  }

  for (const legacyKey of ['CODE_REVIEW_PEDAGOGY', 'CONCURRENCY_ASYNC', 'TESTING_STRATEGIES']) {
    assert.equal(promptText.includes(legacyKey), false);
  }
});

test('curriculum and synthesis prompts avoid direct participant email disclosure', () => {
  const curriculum = source('curriculum-builder.ts');
  const synthesis = source('skill-synthesizer.ts');

  assert.match(curriculum, /SecretSanitizer/);
  assert.match(curriculum, /ID interno: \$\{dev\.id\}/);
  assert.equal(curriculum.includes('Correo: ${dev.email}'), false);
  assert.match(synthesis, /Colaborador interno: \$\{dev\.id\}/);
  assert.equal(synthesis.includes('Desarrollador: ${dev.email}'), false);
});
