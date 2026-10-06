import assert from 'node:assert/strict';
import test from 'node:test';

process.env.ADMIN_IMPORT_TOKEN = 'test-admin-token';
process.env.PILOT_IMPORT_ORG_SLUG = 'itti';

const {
  HttpError,
  assertAdminImportAuthorized,
  parseCollaboratorCsv,
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
