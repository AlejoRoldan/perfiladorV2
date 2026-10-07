import assert from 'node:assert/strict';
import test from 'node:test';

import {
  challengeVerdictSchema,
  parseJsonWithSchema,
  posFinalEvaluationSchema,
  posStartResponseSchema
} from './ai-contracts.mjs';

test('challenge verdict rejects boolean-like strings instead of coercing them', () => {
  assert.throws(
    () => parseJsonWithSchema(JSON.stringify({
      passed: 'false',
      score: 4,
      feedback: 'Good reasoning',
      verifiedCompetencies: ['TESTING_STRATEGY']
    }), challengeVerdictSchema, 'challenge verdict'),
    /passed: Expected a boolean/
  );
});

test('challenge verdict rejects non-numeric scores instead of coercing them', () => {
  assert.throws(
    () => parseJsonWithSchema(JSON.stringify({
      passed: true,
      score: true,
      feedback: 'Good reasoning',
      verifiedCompetencies: ['TESTING_STRATEGY']
    }), challengeVerdictSchema, 'challenge verdict'),
    /score: Expected a numeric value/
  );

  assert.throws(
    () => parseJsonWithSchema(JSON.stringify({
      passed: true,
      score: '4.5',
      feedback: 'Good reasoning',
      verifiedCompetencies: ['TESTING_STRATEGY']
    }), challengeVerdictSchema, 'challenge verdict'),
    /score: Expected a numeric value/
  );
});

test('Proof of Skills final evaluation rejects unknown skill keys', () => {
  assert.throws(
    () => parseJsonWithSchema(JSON.stringify({
      summary: 'Solid answer',
      skillEvaluations: [
        { skillKey: 'CONCURRENCY_ASYNC', score: 4.2, feedback: 'Detailed trade-offs' }
      ]
    }), posFinalEvaluationSchema, 'PoS final evaluation'),
    /Unknown canonical skill key/
  );
});

test('AI schemas reject unexpected fields and return sanitized contract shape', () => {
  assert.throws(
    () => parseJsonWithSchema(JSON.stringify({
      welcomeMessage: 'Hola',
      extra: 'not allowed'
    }), posStartResponseSchema, 'PoS start'),
    /extra: Unexpected field/
  );

  const verdict = parseJsonWithSchema(JSON.stringify({
    summary: 'Solid answer',
    skillEvaluations: [
      { skillKey: 'testing_strategy', score: 4.2, feedback: 'Detailed trade-offs' }
    ]
  }), posFinalEvaluationSchema, 'PoS final evaluation');

  assert.deepEqual(verdict, {
    summary: 'Solid answer',
    skillEvaluations: [
      { skillKey: 'TESTING_STRATEGY', score: 4.2, feedback: 'Detailed trade-offs' }
    ]
  });
});
