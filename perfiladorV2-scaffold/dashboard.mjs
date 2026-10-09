import http from 'http';
import crypto from 'crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { URL, pathToFileURL } from 'url';
import {
  parseJsonWithSchema,
  posChatResponseSchema,
  posFinalEvaluationSchema,
  posStartResponseSchema
} from './packages/schemas/src/ai-contracts.mjs';

dotenv.config();

const PORT = Number(process.env.DASHBOARD_PORT || 3005);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const SCHEMA_VERSION = '2026-09-29.pos.v1';
const RUBRIC_VERSION = '2026-09-29.base-taxonomy.v1';
const MAX_REQUEST_BODY_BYTES = Number(process.env.MAX_REQUEST_BODY_BYTES || 256_000);
const ALLOWED_TRACKS = new Set(['BACKEND_NODE', 'FRONTEND_REACT', 'FULLSTACK']);
const ALLOWED_SENIORITIES = new Set(['JUNIOR_1', 'JUNIOR_2', 'MID_1', 'MID_2', 'SENIOR_1']);

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
});
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const query = (text, params) => pool.query(text, params);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const normalizeText = value => String(value ?? '').trim();
const normalizeEmail = value => normalizeText(value).toLowerCase();
const normalizeOrgSlug = value => normalizeText(value).toLowerCase();
const PILOT_IMPORT_ORG_SLUG = normalizeOrgSlug(process.env.PILOT_IMPORT_ORG_SLUG || 'itti');
const ADMIN_IMPORT_TOKEN = normalizeText(process.env.ADMIN_IMPORT_TOKEN || '');
const LLM_REDACTION_RULES = Object.freeze([
  {
    name: 'PRIVATE_KEY',
    pattern: /-----BEGIN[ A-Z_-]*PRIVATE KEY-----[\s\S]*?-----END[ A-Z_-]*PRIVATE KEY-----/gi,
    replacement: '[REDACTED_PRIVATE_KEY]'
  },
  {
    name: 'DATABASE_CONNECTION_STRING',
    pattern: /(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|mssql):\/\/[^\s"'`]+/gi,
    replacement: '[REDACTED_DB_CONNECTION_STRING]'
  },
  {
    name: 'GOOGLE_API_KEY',
    pattern: /AIzaSy[0-9A-Za-z_-]{30,40}/g,
    replacement: '[REDACTED_GOOGLE_API_KEY]'
  },
  {
    name: 'OPENAI_API_KEY',
    pattern: /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
    replacement: '[REDACTED_OPENAI_API_KEY]'
  },
  {
    name: 'SUPABASE_SECRET_KEY',
    pattern: /sb_secret_[A-Za-z0-9_-]{20,}/g,
    replacement: '[REDACTED_SUPABASE_SECRET_KEY]'
  },
  {
    name: 'JWT_TOKEN',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    replacement: '[REDACTED_JWT_TOKEN]'
  },
  {
    name: 'BEARER_AUTH',
    pattern: /Bearer\s+[A-Za-z0-9_\-\.+=]{20,}/gi,
    replacement: 'Bearer [REDACTED_BEARER_TOKEN]'
  },
  {
    name: 'JSON_ASSIGNED_SECRET',
    pattern: /(["'])(api[_-]?key|secret|password|passwd|auth[_-]?token|access[_-]?token|private[_-]?key)(["']\s*:\s*["'])([^"']{8,})(["'])/gi,
    replacement: '$1$2$3[REDACTED_SECRET]$5'
  },
  {
    name: 'ENV_ASSIGNED_SECRET',
    pattern: /(^|[\s;])([A-Z0-9_]*(?:API[_-]?KEY|SECRET|PASSWORD|PASSWD|TOKEN|PRIVATE[_-]?KEY)[A-Z0-9_]*)(\s*=\s*)(["']?)([^\s"'`;]{8,})(["']?)/gim,
    replacement: '$1$2$3$4[REDACTED_SECRET]$6'
  },
  {
    name: 'EMAIL_ADDRESS',
    pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    replacement: '[REDACTED_EMAIL]'
  }
]);
const escapeHtml = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;');

class HttpError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
  }
}

function getBearerToken(req) {
  const authorization = normalizeText(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? normalizeText(match[1]) : '';
}

function applyReplacement(template, args) {
  if (typeof template === 'function') return template(...args);
  if (!String(template).includes('$')) return template;
  let output = template;
  for (let i = 1; i <= 6; i++) {
    output = output.replaceAll(`$${i}`, args[i] || '');
  }
  return output;
}

function sanitizeLlmText(value) {
  let sanitized = String(value ?? '');
  let redactedCount = 0;
  for (const rule of LLM_REDACTION_RULES) {
    sanitized = sanitized.replace(rule.pattern, (...args) => {
      redactedCount++;
      return applyReplacement(rule.replacement, args);
    });
  }
  return { sanitized, hasRedactions: redactedCount > 0, redactedCount };
}

function sanitizeLlmHistory(history) {
  return normalizeHistory(history).map(item => ({
    role: item.role,
    message: sanitizeLlmText(item.message).sanitized
  }));
}

function createParticipantPromptLabel(dev) {
  const hash = crypto
    .createHash('sha256')
    .update(normalizeText(dev?.id || dev?.email || 'unknown'))
    .digest('hex')
    .slice(0, 10);
  return `colaborador-${hash}`;
}

function assertAdminImportAuthorized(req) {
  if (!ADMIN_IMPORT_TOKEN) {
    throw new HttpError('Importacion admin no configurada: falta ADMIN_IMPORT_TOKEN', 503);
  }

  const headerToken = normalizeText(req.headers['x-admin-token']);
  const bearerToken = getBearerToken(req);
  if (headerToken !== ADMIN_IMPORT_TOKEN && bearerToken !== ADMIN_IMPORT_TOKEN) {
    throw new HttpError('No autorizado para importar colaboradores', 403);
  }
}

function isJsonContentType(headers = {}) {
  const contentType = normalizeText(headers['content-type'] || headers['Content-Type']).toLowerCase();
  return contentType === 'application/json' || contentType.startsWith('application/json;');
}

function getRequestOrigin(req) {
  const host = normalizeText(req.headers.host).toLowerCase();
  const proto = normalizeText(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim().toLowerCase() || 'http';
  return `${proto}://${host}`;
}

function assertAllowedPostOrigin(req) {
  const origin = normalizeText(req.headers.origin);
  if (!origin) return;

  const expectedOrigin = getRequestOrigin(req);
  if (origin.toLowerCase() !== expectedOrigin) {
    throw new HttpError('Origen no autorizado para esta accion', 403);
  }
}

function getDeclaredContentLength(headers = {}) {
  const rawLength = normalizeText(headers['content-length'] || headers['Content-Length']);
  if (!rawLength) return null;
  const declared = Number(rawLength);
  return Number.isFinite(declared) && declared >= 0 ? declared : null;
}

function assertPostRequestAllowed(req) {
  if (!isJsonContentType(req.headers)) {
    throw new HttpError('Content-Type debe ser application/json', 415);
  }
  assertAllowedPostOrigin(req);

  const declaredLength = getDeclaredContentLength(req.headers);
  if (declaredLength !== null && declaredLength > MAX_REQUEST_BODY_BYTES) {
    throw new HttpError('Solicitud demasiado grande', 413);
  }
}

function csvEscape(value) {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }
  return text;
}

function rowsToCsv(headers, rows) {
  return [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(','))
  ].join('\r\n') + '\r\n';
}

function normalizeHistory(history) {
  return Array.isArray(history)
    ? history.map(item => ({
      role: normalizeText(item?.role),
      message: normalizeText(item?.message)
    })).filter(item => item.role && item.message)
    : [];
}

function createProofOfSkillsExternalRef(devId, history, now = new Date()) {
  const normalizedHistory = normalizeHistory(history);
  const timestamp = now.toISOString().replace(/[-:.]/g, '').replace('T', '-').replace('Z', '');
  const evidenceHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ devId: normalizeText(devId), history: normalizedHistory }))
    .digest('hex')
    .slice(0, 16);
  return `POS-${timestamp}-${evidenceHash}`;
}

function calculateEvidenceConfidence(history, skillEvaluationCount) {
  const normalizedHistory = normalizeHistory(history);
  const distinctSkillCount = Array.isArray(skillEvaluationCount)
    ? new Set(skillEvaluationCount.map(item => normalizeText(item?.skillKey).toUpperCase()).filter(Boolean)).size
    : Number(skillEvaluationCount || 0);
  const userTurns = normalizedHistory.filter(item => item.role === 'user').length;
  const userTextLength = normalizedHistory
    .filter(item => item.role === 'user')
    .reduce((total, item) => total + item.message.length, 0);

  const turnScore = Math.min(userTurns, 4) * 0.07;
  const depthScore = Math.min(userTextLength / 1200, 1) * 0.14;
  const breadthScore = Math.min(distinctSkillCount, 4) * 0.04;
  const confidence = 0.5 + turnScore + depthScore + breadthScore;
  return Number(Math.min(0.95, Math.max(0.55, confidence)).toFixed(2));
}

async function askGemini(prompt, schema, label) {
  const safePrompt = sanitizeLlmText(prompt).sanitized;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: safePrompt,
        config: { responseMimeType: 'application/json' }
      });
      return parseJsonWithSchema(res.text, schema, label);
    } catch (err) {
      console.error(`[Gemini ${label} attempt ${attempt}]`, err.message);
      if (attempt === 3) throw err;
      await sleep(1500 * attempt);
    }
  }
}

async function getDeveloper(devId = null) {
  if (devId && String(devId).trim()) {
    const byId = await query(`
      SELECT d.id, d.email, d.current_seniority, d.target_seniority, d.tech_track,
             o.name AS org_name, o.slug AS org_slug
      FROM developers d
      JOIN organizations o ON d.org_id = o.id
      WHERE d.id = $1
    `, [String(devId).trim()]);
    if (byId.rows[0]) return byId.rows[0];
  }

  const latest = await query(`
    SELECT d.id, d.email, d.current_seniority, d.target_seniority, d.tech_track,
           o.name AS org_name, o.slug AS org_slug
    FROM developers d
    JOIN organizations o ON d.org_id = o.id
    ORDER BY d.created_at DESC
    LIMIT 1
  `);
  return latest.rows[0] || null;
}

async function getDashboardData(devId = null) {
  const dev = await getDeveloper(devId);

  const [allDevsRes, cohortStatsRes] = await Promise.all([
    query(`
      SELECT d.id, d.email, d.current_seniority, d.target_seniority, d.tech_track,
             o.name AS org_name, o.slug AS org_slug
      FROM developers d
      JOIN organizations o ON d.org_id = o.id
      ORDER BY o.name ASC, d.email ASC
    `),
    query(`
      SELECT
        o.slug AS org_slug,
        o.name AS org_name,
        COUNT(DISTINCT d.id)::int AS total_developers,
        COUNT(DISTINCT es.id)::int AS completed_sessions,
        COUNT(DISTINCT lm.id) FILTER (WHERE lm.status = 'ASSIGNED')::int AS assigned_modules,
        COUNT(DISTINCT lm.id) FILTER (WHERE lm.status = 'COMPLETED')::int AS completed_modules
      FROM organizations o
      LEFT JOIN developers d ON d.org_id = o.id
      LEFT JOIN evaluation_signals es ON es.developer_id = d.id AND es.source_type = 'CONVERSATIONAL_PROOF_OF_SKILL'
      LEFT JOIN learning_modules lm ON lm.developer_id = d.id
      GROUP BY o.slug, o.name
      ORDER BY o.name ASC
    `)
  ]);

  if (!dev) {
    return { dev: null, skills: [], modules: [], allDevs: allDevsRes.rows, cohortStats: cohortStatsRes.rows };
  }

  const [skillsRes, modulesRes] = await Promise.all([
    query(`
      SELECT st.skill_key, st.display_name,
             COALESCE(dsm.current_score, 1.0) AS current_score,
             COALESCE(sb.required_score, 3.5) AS required_score,
             COALESCE(dsm.gap_vs_target, -2.5) AS gap_vs_target
      FROM skill_taxonomy st
      LEFT JOIN developer_skill_matrix dsm ON st.skill_key = dsm.skill_key AND dsm.developer_id = $1
      LEFT JOIN seniority_benchmarks sb ON st.skill_key = sb.skill_key AND sb.seniority_level = $2 AND sb.track = $3
      ORDER BY st.domain ASC, st.display_name ASC
    `, [dev.id, dev.target_seniority, dev.tech_track]),
    query(`
      SELECT id, title, skill_key, content_blocks, interactive_challenge, status, completed_at
      FROM learning_modules
      WHERE developer_id = $1
      ORDER BY created_at DESC
    `, [dev.id])
  ]);

  return { dev, skills: skillsRes.rows, modules: modulesRes.rows, allDevs: allDevsRes.rows, cohortStats: cohortStatsRes.rows };
}

function validateDeveloperInput({ email, orgSlug, currentSeniority, targetSeniority, techTrack }) {
  const input = {
    email: normalizeEmail(email),
    orgSlug: normalizeOrgSlug(orgSlug || 'itti'),
    currentSeniority: normalizeText(currentSeniority || 'JUNIOR_2').toUpperCase(),
    targetSeniority: normalizeText(targetSeniority || 'MID_2').toUpperCase(),
    techTrack: normalizeText(techTrack || 'BACKEND_NODE').toUpperCase()
  };

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Correo invalido');
  if (!ALLOWED_SENIORITIES.has(input.currentSeniority)) throw new Error(`Nivel actual invalido: ${input.currentSeniority}`);
  if (!ALLOWED_SENIORITIES.has(input.targetSeniority)) throw new Error(`Meta invalida: ${input.targetSeniority}`);
  if (!ALLOWED_TRACKS.has(input.techTrack)) throw new Error(`Track invalido: ${input.techTrack}`);
  return input;
}

function parseCsvLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCollaboratorCsv(csvText, defaultOrgSlug = 'itti') {
  const forcedOrgSlug = normalizeOrgSlug(defaultOrgSlug);
  const lines = String(csvText ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const first = parseCsvLine(lines[0]).map(cell => cell.toLowerCase());
  const hasHeader = first.includes('email');
  const headers = hasHeader ? first : ['email', 'current_seniority', 'target_seniority', 'tech_track'];
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line, index) => {
    const cells = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((header, i) => [header, cells[i] ?? '']));
    return {
      rowNumber: index + (hasHeader ? 2 : 1),
      email: row.email,
      orgSlug: forcedOrgSlug,
      sourceOrgSlug: row.org_slug || row.organization || '',
      currentSeniority: row.current_seniority || row.currentSeniority,
      targetSeniority: row.target_seniority || row.targetSeniority,
      techTrack: row.tech_track || row.techTrack
    };
  });
}

async function registerDeveloper(input) {
  const devInput = validateDeveloperInput(input);
  const orgRes = await query('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [devInput.orgSlug]);
  if (!orgRes.rows.length) throw new Error(`Organizacion no encontrada: ${devInput.orgSlug}`);

  const existingDevRes = await query(`
    SELECT d.id, d.email, d.org_id, o.slug AS org_slug
    FROM developers d
    JOIN organizations o ON d.org_id = o.id
    WHERE d.email = $1
    LIMIT 1
  `, [devInput.email]);
  const existingDev = existingDevRes.rows[0];
  if (existingDev && existingDev.org_slug !== devInput.orgSlug) {
    throw new Error(`El correo ya existe en la organizacion ${existingDev.org_slug}; no se puede mover entre organizaciones`);
  }

  const devRes = await query(`
    INSERT INTO developers (org_id, email, github_username, current_seniority, target_seniority, tech_track)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (email) DO UPDATE
    SET current_seniority = EXCLUDED.current_seniority,
        target_seniority = EXCLUDED.target_seniority,
        tech_track = EXCLUDED.tech_track,
        updated_at = now()
    WHERE developers.org_id = EXCLUDED.org_id
    RETURNING id, email, current_seniority, target_seniority, tech_track
  `, [
    orgRes.rows[0].id,
    devInput.email,
    devInput.email.split('@')[0],
    devInput.currentSeniority,
    devInput.targetSeniority,
    devInput.techTrack
  ]);
  if (!devRes.rows.length) {
    throw new Error('El correo ya existe en otra organizacion; no se puede mover entre organizaciones');
  }

  const dev = devRes.rows[0];
  const skillsRes = await query('SELECT skill_key FROM skill_taxonomy');

  for (const s of skillsRes.rows) {
    const bench = await query(`
      SELECT required_score
      FROM seniority_benchmarks
      WHERE track = $1 AND seniority_level = $2 AND skill_key = $3
    `, [dev.tech_track, dev.target_seniority, s.skill_key]);
    const required = Number(bench.rows[0]?.required_score || 3.5);

    await query(`
      INSERT INTO developer_skill_matrix (developer_id, skill_key, current_score, confidence_score, last_signal_at, gap_vs_target)
      VALUES ($1, $2, 1.0, 0.5, now(), $3)
      ON CONFLICT (developer_id, skill_key) DO UPDATE
      SET gap_vs_target = developer_skill_matrix.current_score - $4,
          updated_at = now()
    `, [dev.id, s.skill_key, 1.0 - required, required]);
  }

  return dev;
}

async function importCollaborators({ csvText }) {
  const rows = parseCollaboratorCsv(csvText, PILOT_IMPORT_ORG_SLUG);
  if (!rows.length) throw new Error('El CSV no contiene filas para importar');
  if (rows.length > 100) throw new Error('Maximo 100 colaboradores por importacion');

  const imported = [];
  const errors = [];
  const seen = new Set();

  for (const row of rows) {
    try {
      const email = normalizeEmail(row.email);
      if (seen.has(email)) {
        errors.push({ row: row.rowNumber, email, error: 'Correo duplicado en el CSV' });
        continue;
      }
      seen.add(email);
      if (row.sourceOrgSlug && normalizeOrgSlug(row.sourceOrgSlug) !== PILOT_IMPORT_ORG_SLUG) {
        errors.push({
          row: row.rowNumber,
          email,
          error: `org_slug no permitido para piloto Itti: ${row.sourceOrgSlug}`
        });
        continue;
      }
      const dev = await registerDeveloper(row);
      imported.push({ row: row.rowNumber, id: dev.id, email: dev.email });
    } catch (err) {
      errors.push({ row: row.rowNumber, email: row.email || '', error: err.message });
    }
  }

  return { success: errors.length === 0, importedCount: imported.length, errorCount: errors.length, imported, errors };
}

async function buildIttiPilotReportRows() {
  const result = await query(`
    WITH skill_summary AS (
      SELECT
        dsm.developer_id,
        COUNT(*)::int AS skill_count,
        ROUND(AVG(dsm.current_score)::numeric, 2) AS avg_score,
        ROUND(AVG(dsm.gap_vs_target)::numeric, 2) AS avg_gap,
        MIN(dsm.gap_vs_target) AS worst_gap
      FROM developer_skill_matrix dsm
      WHERE dsm.confidence_score > 0.5
      GROUP BY dsm.developer_id
    ),
    pos_summary AS (
      SELECT
        es.developer_id,
        COUNT(*)::int AS pos_sessions,
        MAX(es.created_at) AS last_pos_at,
        (ARRAY_AGG(es.external_ref ORDER BY es.created_at DESC))[1] AS last_external_ref
      FROM evaluation_signals es
      WHERE es.source_type = 'CONVERSATIONAL_PROOF_OF_SKILL'
      GROUP BY es.developer_id
    ),
    module_summary AS (
      SELECT
        lm.developer_id,
        COUNT(*) FILTER (WHERE lm.status = 'ASSIGNED')::int AS assigned_modules,
        COUNT(*) FILTER (WHERE lm.status = 'IN_PROGRESS')::int AS in_progress_modules,
        COUNT(*) FILTER (WHERE lm.status = 'COMPLETED')::int AS completed_modules
      FROM learning_modules lm
      GROUP BY lm.developer_id
    )
    SELECT
      d.email,
      d.current_seniority,
      d.target_seniority,
      d.tech_track,
      CASE WHEN COALESCE(ps.pos_sessions, 0) > 0 THEN 'COMPLETED' ELSE 'PENDING' END AS pos_status,
      COALESCE(ps.pos_sessions, 0)::int AS pos_sessions,
      COALESCE(ps.last_external_ref, '') AS last_external_ref,
      COALESCE(to_char(ps.last_pos_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), '') AS last_pos_at,
      COALESCE(ss.skill_count, 0)::int AS evaluated_skills,
      COALESCE(ss.avg_score, 0)::numeric AS avg_score,
      COALESCE(ss.avg_gap, 0)::numeric AS avg_gap,
      COALESCE(ss.worst_gap, 0)::numeric AS worst_gap,
      COALESCE(ms.assigned_modules, 0)::int AS assigned_modules,
      COALESCE(ms.in_progress_modules, 0)::int AS in_progress_modules,
      COALESCE(ms.completed_modules, 0)::int AS completed_modules
    FROM developers d
    JOIN organizations o ON o.id = d.org_id
    LEFT JOIN skill_summary ss ON ss.developer_id = d.id
    LEFT JOIN pos_summary ps ON ps.developer_id = d.id
    LEFT JOIN module_summary ms ON ms.developer_id = d.id
    WHERE o.slug = $1
    ORDER BY d.email ASC
  `, [PILOT_IMPORT_ORG_SLUG]);

  return result.rows;
}

async function buildIttiPilotReportCsv() {
  const headers = [
    'email',
    'current_seniority',
    'target_seniority',
    'tech_track',
    'pos_status',
    'pos_sessions',
    'last_external_ref',
    'last_pos_at',
    'evaluated_skills',
    'avg_score',
    'avg_gap',
    'worst_gap',
    'assigned_modules',
    'in_progress_modules',
    'completed_modules'
  ];
  const rows = await buildIttiPilotReportRows();
  return rowsToCsv(headers, rows);
}

async function startPoS(devId) {
  const dev = await getDeveloper(devId);
  if (!dev) throw new Error('No hay colaborador seleccionado');
  const participantLabel = createParticipantPromptLabel(dev);

  const prompt = `
Eres el Staff Principal Architect de una organizacion piloto.
Inicia una sesion de Proof of Skills con ${participantLabel}.
Perfil: nivel actual ${dev.current_seniority}, meta ${dev.target_seniority}, track ${dev.tech_track}.
Plantea una primera pregunta desafiante sobre un caso real de ingenieria: concurrencia, ACID, microservicios, resiliencia u observabilidad.
Responde solo JSON:
{ "welcomeMessage": "Saludo profesional y caso practico inicial" }`;

  return askGemini(prompt, posStartResponseSchema, 'PoS start');
}

async function chatPoS(devId, history, userResponse) {
  const dev = await getDeveloper(devId);
  if (!dev) throw new Error('No hay colaborador seleccionado');
  const participantLabel = createParticipantPromptLabel(dev);
  const safeHistory = sanitizeLlmHistory(history);
  const safeUserResponse = sanitizeLlmText(userResponse).sanitized;

  const prompt = `
Eres el Staff Principal Architect de una organizacion piloto evaluando a ${participantLabel}.
Track: ${dev.tech_track}. Meta: ${dev.target_seniority}.

Historial:
${JSON.stringify(safeHistory, null, 2)}

Ultima respuesta:
"${safeUserResponse}"

Evalua fortalezas y vacios tecnicos. Plantea una pregunta de seguimiento sobre trade-offs, escalabilidad, seguridad u operacion.
Responde solo JSON:
{ "interviewerReply": "Comentario tecnico y pregunta de seguimiento" }`;

  return askGemini(prompt, posChatResponseSchema, 'PoS chat');
}

async function finishPoS(devId, history) {
  const dev = await getDeveloper(devId);
  if (!dev) throw new Error('No hay colaborador seleccionado');
  const participantLabel = createParticipantPromptLabel(dev);
  const safeHistory = sanitizeLlmHistory(history);

  const rubrics = await query('SELECT skill_key, display_name, rubric_levels FROM skill_taxonomy');
  const prompt = `
Evalua esta transcripcion tecnica de Proof of Skills para ${participantLabel}.
Meta: ${dev.target_seniority}. Track: ${dev.tech_track}.

Transcripcion:
${JSON.stringify(safeHistory, null, 2)}

Rubricas:
${JSON.stringify(rubrics.rows, null, 2)}

Califica de 1.0 a 5.0 solamente las habilidades demostradas.
Responde solo JSON:
{
  "summary": "Resumen ejecutivo del desempeno",
  "skillEvaluations": [
    { "skillKey": "CLEAN_ARCHITECTURE", "score": 4.5, "feedback": "Justificacion" }
  ]
}`;

  const verdict = await askGemini(prompt, posFinalEvaluationSchema, 'PoS final evaluation');
  const externalRef = createProofOfSkillsExternalRef(dev.id, history);
  const confidenceScore = calculateEvidenceConfidence(history, verdict.skillEvaluations);
  const audit = {
    turns: history.length,
    userTurns: normalizeHistory(history).filter(item => item.role === 'user').length,
    model: GEMINI_MODEL,
    promptFamily: 'proof-of-skills-interview',
    schemaVersion: SCHEMA_VERSION,
    rubricVersion: RUBRIC_VERSION,
    externalRef,
    confidenceScore
  };

  await query(`
    INSERT INTO evaluation_signals (developer_id, source_type, external_ref, diff_summary, raw_evaluations)
    VALUES ($1, 'CONVERSATIONAL_PROOF_OF_SKILL', $2, $3, $4)
  `, [dev.id, externalRef, JSON.stringify(audit), JSON.stringify({ ...verdict, audit })]);

  for (const item of verdict.skillEvaluations) {
    const bench = await query(`
      SELECT required_score
      FROM seniority_benchmarks
      WHERE track = $1 AND seniority_level = $2 AND skill_key = $3
    `, [dev.tech_track, dev.target_seniority, item.skillKey]);
    const required = Number(bench.rows[0]?.required_score || 3.5);
    const gap = Number(item.score) - required;

    await query(`
      INSERT INTO developer_skill_matrix (developer_id, skill_key, current_score, confidence_score, last_signal_at, gap_vs_target)
      VALUES ($1, $2, $3, $4, now(), $5)
      ON CONFLICT (developer_id, skill_key) DO UPDATE
      SET current_score = EXCLUDED.current_score,
          confidence_score = EXCLUDED.confidence_score,
          last_signal_at = now(),
          gap_vs_target = EXCLUDED.gap_vs_target,
          updated_at = now()
    `, [dev.id, item.skillKey, item.score, confidenceScore, gap]);
  }

  return { ...verdict, audit };
}

function renderRadarSvg(skills) {
  const size = 360;
  const center = 180;
  const maxR = 100;
  const n = skills.length || 5;
  const pt = (score, i, r = null) => {
    const angle = (Math.PI * 2 / n) * i - Math.PI / 2;
    const radius = r !== null ? r : (Math.min(5, Math.max(0, score)) / 5) * maxR;
    return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
  };

  let grid = '';
  let labels = '';
  let dots = '';
  for (let l = 1; l <= 5; l++) {
    const pts = skills.map((_, i) => `${pt(l, i).x.toFixed(1)},${pt(l, i).y.toFixed(1)}`).join(' ');
    grid += `<polygon points="${pts}" fill="none" stroke="rgba(51,65,85,0.4)" stroke-width="1"/>`;
    grid += `<text x="${center + 4}" y="${center - (l / 5 * maxR) + 3}" fill="#64748b" font-size="8">${l}</text>`;
  }

  skills.forEach((s, i) => {
    const p = pt(5, i);
    grid += `<line x1="${center}" y1="${center}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="rgba(51,65,85,0.5)" stroke-width="1"/>`;
    const lp = pt(5, i, maxR + 22);
    const anchor = Math.abs(lp.x - center) < 15 ? 'middle' : (lp.x > center ? 'start' : 'end');
    const label = escapeHtml(s.display_name).split(' ').slice(0, 2).join(' ');
    labels += `<text x="${lp.x.toFixed(1)}" y="${lp.y.toFixed(1)}" fill="#94a3b8" font-size="9" font-weight="600" text-anchor="${anchor}">${label}</text>`;
    const cp = pt(Number(s.current_score), i);
    dots += `<circle cx="${cp.x.toFixed(1)}" cy="${cp.y.toFixed(1)}" r="4" fill="#10b981" stroke="#047857" stroke-width="1.5"/>`;
  });

  const targetPts = skills.map((s, i) => `${pt(Number(s.required_score), i).x.toFixed(1)},${pt(Number(s.required_score), i).y.toFixed(1)}`).join(' ');
  const currentPts = skills.map((s, i) => `${pt(Number(s.current_score), i).x.toFixed(1)},${pt(Number(s.current_score), i).y.toFixed(1)}`).join(' ');

  return `
    <svg viewBox="0 0 ${size} ${size}" class="w-full max-w-[340px] aspect-square overflow-visible">
      ${grid} ${labels}
      <polygon points="${targetPts}" fill="rgba(245,158,11,0.08)" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,4"/>
      <polygon points="${currentPts}" fill="rgba(16,185,129,0.35)" stroke="#10b981" stroke-width="2.5"/>
      ${dots}
    </svg>`;
}

function renderHTML({ dev, skills, modules, allDevs, cohortStats }) {
  const radarSvg = renderRadarSvg(skills);
  const orgName = escapeHtml(dev?.org_name || 'Portal');
  const selectedDevId = dev?.id || '';
  const ittiStats = cohortStats.find(stat => stat.org_slug === 'itti') || {};
  const currentModulesCount = modules.length;

  return `<!DOCTYPE html>
<html lang="es" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TechProfiler - ${orgName}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>body { font-family: 'Inter', sans-serif; }</style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
  <header class="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
    <div class="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="h-10 w-10 bg-emerald-500 rounded-lg flex items-center justify-center font-bold text-slate-950 text-xl shadow-lg shadow-emerald-500/20">TP</div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-base font-bold text-white">TechProfiler & L&D</h1>
            <span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono border border-slate-700">Grupo Vazquez</span>
          </div>
          <p class="text-xs text-emerald-400 font-medium">${dev ? orgName : 'Portal de Evaluacion'}</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-1.5">
          <span class="text-xs text-slate-400">Colaborador:</span>
          <select id="userSelector" onchange="window.location.href='/?devId='+encodeURIComponent(this.value)" class="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer">
            ${allDevs.map(d => `<option value="${escapeHtml(d.id)}" ${d.id === dev?.id ? 'selected' : ''} class="bg-slate-900 text-white">${escapeHtml(d.email.split('@')[0])} (${escapeHtml(d.org_name)})</option>`).join('')}
          </select>
        </div>
        <button onclick="document.getElementById('regModal').classList.remove('hidden')" class="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-3.5 py-2 rounded-xl transition">
          + Registrar Colaborador
        </button>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-6 py-8 space-y-6">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <div class="inline-flex items-center gap-2 text-xs font-semibold uppercase text-slate-400 mb-1">
          <span class="text-emerald-400 font-bold">${orgName}</span><span>|</span><span>Track: ${escapeHtml(dev?.tech_track || '-')}</span>
        </div>
        <h2 class="text-2xl font-bold text-white">${escapeHtml(dev?.email || 'Sin colaborador registrado')}</h2>
      </div>
      <div class="flex items-center gap-4">
        <div class="bg-slate-950/60 border border-slate-800 px-4 py-2.5 rounded-xl text-center">
          <span class="block text-[10px] text-slate-400 uppercase">Nivel Actual</span>
          <span class="text-sm font-bold text-amber-400">${escapeHtml(dev?.current_seniority || '-')}</span>
        </div>
        <span class="text-slate-600 text-lg">-></span>
        <div class="bg-slate-950/60 border border-emerald-500/30 px-4 py-2.5 rounded-xl text-center">
          <span class="block text-[10px] text-emerald-400 uppercase">Meta</span>
          <span class="text-sm font-bold text-emerald-400">${escapeHtml(dev?.target_seniority || '-')}</span>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-3 border-b border-slate-800 pb-3">
      <button onclick="switchTab('radar')" id="tab-btn-radar" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">Tech Radar</button>
      <button onclick="switchTab('pos')" id="tab-btn-pos" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent">Proof of Skills</button>
      <button onclick="switchTab('courses')" id="tab-btn-courses" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent">Capsulas L&D (${currentModulesCount})</button>
      <button onclick="switchTab('admin')" id="tab-btn-admin" class="tab-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent">Piloto Itti (${escapeHtml(ittiStats.total_developers || 0)})</button>
    </div>

    <div id="view-radar" class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      <div class="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col items-center">
        <div class="w-full flex justify-between mb-2">
          <h3 class="text-base font-bold text-white">Tech Radar de Habilidades</h3>
          <span class="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">pgvector</span>
        </div>
        <div class="w-full flex justify-center py-2">${radarSvg}</div>
        <div class="w-full grid grid-cols-2 gap-3 mt-2 pt-4 border-t border-slate-800 text-xs">
          <div class="flex items-center gap-2"><span class="w-3 h-3 rounded-full bg-emerald-500"></span><span>Nivel actual</span></div>
          <div class="flex items-center gap-2"><span class="w-3 h-1 bg-amber-400"></span><span>Meta (${escapeHtml(dev?.target_seniority || '-')})</span></div>
        </div>
      </div>

      <div class="lg:col-span-6 space-y-3">
        <h3 class="text-base font-bold text-white mb-2">Desglose de Competencias</h3>
        ${skills.map(s => {
          const cur = Number(s.current_score);
          const req = Number(s.required_score);
          const gap = cur - req;
          const passed = gap >= 0;
          return `
          <div class="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2">
            <div class="flex justify-between items-center gap-3">
              <div>
                <h4 class="text-sm font-bold text-white">${escapeHtml(s.display_name)}</h4>
                <p class="text-xs text-slate-400">Nota: <span class="font-bold text-white">${cur.toFixed(2)}</span> / 5.00 | Requerido: ${req.toFixed(2)}</p>
              </div>
              <span class="px-2.5 py-1 rounded-full text-xs font-semibold ${passed ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'}">
                ${passed ? 'Superado +' + gap.toFixed(1) : 'Deficit ' + gap.toFixed(1)}
              </span>
            </div>
            <div class="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden">
              <div class="${passed ? 'bg-emerald-500' : 'bg-rose-500'} h-1.5 rounded-full" style="width: ${Math.min(100, (cur / 5) * 100)}%"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div id="view-pos" class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4 hidden">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">CASOS REALES ${escapeHtml(dev?.org_name?.toUpperCase() || '-')}</span>
          <h3 class="text-lg font-bold text-white mt-1">Evaluacion Conversacional con el Agente Arquitecto</h3>
          <p class="text-xs text-slate-400">Responde en tus propias palabras. Esto genera evidencia tecnica para el radar.</p>
        </div>
        <div class="flex gap-2">
          <button onclick="startPoS()" id="btnStartPoS" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition">Iniciar Entrevista</button>
          <button onclick="finishPoS()" id="btnFinishPoS" class="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs border border-slate-700 transition hidden">Finalizar y Certificar</button>
        </div>
      </div>
      <div id="chatBox" class="bg-slate-950 border border-slate-800 rounded-2xl p-4 h-96 overflow-y-auto space-y-4 text-xs">
        <div class="text-center text-slate-500 py-16">Haz clic en Iniciar Entrevista para recibir tu primer caso practico.</div>
      </div>
      <div class="flex gap-2">
        <textarea id="chatInput" rows="2" disabled class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 transition disabled:opacity-50" placeholder="Escribe tu analisis tecnico, arquitectura o solucion..."></textarea>
        <button onclick="sendMessage()" id="btnSend" disabled class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 rounded-xl text-xs transition disabled:opacity-50">Enviar</button>
      </div>
    </div>

    <div id="view-courses" class="space-y-4 hidden">
      ${modules.map(m => `
        <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
          <div class="flex justify-between items-center border-b border-slate-800 pb-3 gap-3">
            <div>
              <span class="text-[11px] font-bold ${m.status === 'COMPLETED' ? 'text-emerald-400' : 'text-amber-400'}">${escapeHtml(m.status)}</span>
              <h4 class="text-lg font-bold text-white">${escapeHtml(m.title)}</h4>
            </div>
            <span class="text-xs text-slate-400">${escapeHtml(m.skill_key)}</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed">${escapeHtml(m.content_blocks?.explanation || 'Modulo L&D')}</p>
        </div>
      `).join('')}
    </div>

    <div id="view-admin" class="grid grid-cols-1 lg:grid-cols-12 gap-6 hidden">
      <section class="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <span class="text-[10px] font-bold uppercase text-emerald-400">Facilitador</span>
          <h3 class="text-lg font-bold text-white">Carga de cohorte Itti</h3>
          <p class="text-xs text-slate-400 mt-1">Pega hasta 100 filas CSV. Para el piloto inicial usa 20 colaboradores.</p>
        </div>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-3"><span class="block text-slate-400">Colaboradores</span><strong class="text-2xl text-white">${escapeHtml(ittiStats.total_developers || 0)}</strong></div>
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-3"><span class="block text-slate-400">Sesiones PoS</span><strong class="text-2xl text-white">${escapeHtml(ittiStats.completed_sessions || 0)}</strong></div>
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-3"><span class="block text-slate-400">Modulos asignados</span><strong class="text-2xl text-white">${escapeHtml(ittiStats.assigned_modules || 0)}</strong></div>
          <div class="bg-slate-950 border border-slate-800 rounded-xl p-3"><span class="block text-slate-400">Modulos completados</span><strong class="text-2xl text-white">${escapeHtml(ittiStats.completed_modules || 0)}</strong></div>
        </div>
        <div class="space-y-2">
          <label class="block text-xs font-semibold text-slate-300">CSV de colaboradores</label>
          <textarea id="bulkCsv" rows="10" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-500" spellcheck="false">email,current_seniority,target_seniority,tech_track
ana.gomez@itti.digital,JUNIOR_2,MID_2,BACKEND_NODE
bruno.rios@itti.digital,MID_1,SENIOR_1,FULLSTACK</textarea>
        </div>
        <div class="space-y-2">
          <label class="block text-xs font-semibold text-slate-300">Token admin de importacion</label>
          <input id="adminImportToken" type="password" autocomplete="off" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500" placeholder="ADMIN_IMPORT_TOKEN">
        </div>
        <div class="flex items-center justify-between gap-3">
          <p class="text-[11px] text-slate-500">Organizacion destino: itti Digital</p>
          <div class="flex gap-2">
            <button onclick="exportIttiReport()" id="btnExportReport" class="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-2 rounded-xl text-xs border border-slate-700 transition">Exportar reporte</button>
            <button onclick="importCollaborators()" id="btnImportCsv" class="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition">Importar CSV</button>
          </div>
        </div>
      </section>

      <section class="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div>
          <span class="text-[10px] font-bold uppercase text-slate-400">Control operativo</span>
          <h3 class="text-lg font-bold text-white">Resultado de importacion</h3>
          <p class="text-xs text-slate-400 mt-1">Los registros validos se crean o actualizan. Las filas invalidas se reportan sin bloquear toda la carga.</p>
        </div>
        <div id="importResult" class="bg-slate-950 border border-slate-800 rounded-xl p-4 text-xs text-slate-400 min-h-40">Aun no hay importaciones en esta sesion.</div>
        <div class="border-t border-slate-800 pt-4">
          <h4 class="text-sm font-bold text-white mb-2">Formato esperado</h4>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-slate-300">
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3">email: correo corporativo unico</div>
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3">current_seniority: JUNIOR_1, JUNIOR_2, MID_1, MID_2, SENIOR_1</div>
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3">target_seniority: JUNIOR_1, JUNIOR_2, MID_1, MID_2, SENIOR_1</div>
            <div class="bg-slate-950 border border-slate-800 rounded-xl p-3">tech_track: BACKEND_NODE, FRONTEND_REACT, FULLSTACK</div>
          </div>
        </div>
      </section>
    </div>
  </main>

  <div id="regModal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center hidden">
    <div class="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl space-y-3 text-xs">
      <h3 class="text-base font-bold text-white border-b border-slate-800 pb-2">Registrar Colaborador</h3>
      <div><label class="block text-slate-400 mb-1">Correo Corporativo:</label><input id="regEmail" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white" placeholder="ej. laura@itti.digital"></div>
      <div><label class="block text-slate-400 mb-1">Empresa:</label><select id="regOrg" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"><option value="ueno-bank">ueno bank</option><option value="itti">itti Digital</option><option value="kaitel">kaitel Paraguay</option></select></div>
      <div><label class="block text-slate-400 mb-1">Track:</label><select id="regTrack" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-white"><option value="BACKEND_NODE">Backend Node.js</option><option value="FRONTEND_REACT">Frontend React</option><option value="FULLSTACK">Fullstack</option></select></div>
      <div class="grid grid-cols-2 gap-2">
        <div><label class="block text-slate-400 mb-1">Nivel Actual:</label><select id="regCur" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"><option value="JUNIOR_1">Junior 1</option><option value="JUNIOR_2" selected>Junior 2</option><option value="MID_1">Mid 1</option></select></div>
        <div><label class="block text-slate-400 mb-1">Meta:</label><select id="regTar" class="w-full bg-slate-950 border border-slate-800 rounded-xl p-2 text-white"><option value="MID_2" selected>Mid 2</option><option value="SENIOR_1">Senior 1</option></select></div>
      </div>
      <div class="pt-3 flex justify-end gap-2">
        <button onclick="document.getElementById('regModal').classList.add('hidden')" class="px-3 py-1.5 text-slate-400">Cancelar</button>
        <button onclick="register()" class="bg-emerald-500 text-slate-950 font-bold px-4 py-1.5 rounded-xl">Crear Perfil</button>
      </div>
    </div>
  </div>

  <script>
    const devId = ${JSON.stringify(selectedDevId)};
    let history = [];

    function switchTab(t) {
      ['radar', 'pos', 'courses', 'admin'].forEach(tab => {
        document.getElementById('view-' + tab).classList.toggle('hidden', tab !== t);
        const btn = document.getElementById('tab-btn-' + tab);
        btn.className = tab === t
          ? 'tab-btn px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
          : 'tab-btn px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent';
      });
    }

    async function requestJson(url, options) {
      const res = await fetch(url, options);
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error) throw new Error(data.error || 'No se pudo completar la operacion');
      return data;
    }

    function renderImportResult(data) {
      const box = document.getElementById('importResult');
      box.replaceChildren();
      const summary = document.createElement('div');
      summary.className = 'mb-3 text-slate-200';
      summary.textContent = 'Importados: ' + data.importedCount + ' | Errores: ' + data.errorCount;
      box.appendChild(summary);

      if (data.imported?.length) {
        const title = document.createElement('div');
        title.className = 'font-bold text-emerald-400 mb-1';
        title.textContent = 'Filas importadas';
        box.appendChild(title);
        const list = document.createElement('ul');
        list.className = 'space-y-1 mb-3';
        for (const item of data.imported) {
          const li = document.createElement('li');
          li.textContent = 'Fila ' + item.row + ': ' + item.email;
          list.appendChild(li);
        }
        box.appendChild(list);
      }

      if (data.errors?.length) {
        const title = document.createElement('div');
        title.className = 'font-bold text-rose-400 mb-1';
        title.textContent = 'Filas con error';
        box.appendChild(title);
        const list = document.createElement('ul');
        list.className = 'space-y-1';
        for (const item of data.errors) {
          const li = document.createElement('li');
          li.textContent = 'Fila ' + item.row + ' (' + (item.email || 'sin correo') + '): ' + item.error;
          list.appendChild(li);
        }
        box.appendChild(list);
      }
    }

    async function importCollaborators() {
      const btn = document.getElementById('btnImportCsv');
      const adminToken = document.getElementById('adminImportToken').value.trim();
      btn.disabled = true;
      btn.textContent = 'Importando...';
      try {
        const data = await requestJson('/api/admin/import-collaborators', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
          body: JSON.stringify({ csvText: document.getElementById('bulkCsv').value })
        });
        renderImportResult(data);
      } catch (err) {
        document.getElementById('importResult').textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Importar CSV';
      }
    }

    async function exportIttiReport() {
      const btn = document.getElementById('btnExportReport');
      const adminToken = document.getElementById('adminImportToken').value.trim();
      btn.disabled = true;
      btn.textContent = 'Exportando...';
      try {
        const res = await fetch('/api/admin/itti-report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
          body: JSON.stringify({ format: 'csv' })
        });
        const text = await res.text();
        if (!res.ok) {
          let message = 'No se pudo exportar el reporte';
          try { message = JSON.parse(text).error || message; } catch {}
          throw new Error(message);
        }
        const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'itti-pilot-report.csv';
        link.click();
        URL.revokeObjectURL(link.href);
      } catch (err) {
        document.getElementById('importResult').textContent = err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Exportar reporte';
      }
    }

    async function register() {
      const email = document.getElementById('regEmail').value.trim();
      if (!email) return alert('Ingresa un correo');
      try {
        const data = await requestJson('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            orgSlug: document.getElementById('regOrg').value,
            techTrack: document.getElementById('regTrack').value,
            currentSeniority: document.getElementById('regCur').value,
            targetSeniority: document.getElementById('regTar').value
          })
        });
        if (data.success) window.location.href = '/?devId=' + encodeURIComponent(data.dev.id);
      } catch (err) {
        alert(err.message);
      }
    }

    async function startPoS() {
      const btn = document.getElementById('btnStartPoS');
      btn.textContent = 'Conectando...';
      btn.disabled = true;
      try {
        const data = await requestJson('/api/pos/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ devId })
        });
        history = [{ role: 'agent', message: data.welcomeMessage }];
        renderChat();
        document.getElementById('chatInput').disabled = false;
        document.getElementById('btnSend').disabled = false;
        btn.classList.add('hidden');
        document.getElementById('btnFinishPoS').classList.remove('hidden');
      } catch (err) {
        btn.textContent = 'Iniciar Entrevista';
        btn.disabled = false;
        alert(err.message);
      }
    }

    function renderChat() {
      const box = document.getElementById('chatBox');
      box.replaceChildren();
      for (const h of history) {
        const isUser = h.role === 'user';
        const row = document.createElement('div');
        row.className = 'flex items-start gap-2 ' + (isUser ? 'justify-end' : '');

        const avatar = document.createElement('div');
        avatar.className = isUser
          ? 'w-6 h-6 rounded bg-slate-800 text-slate-300 flex items-center justify-center font-bold text-[10px] shrink-0'
          : 'w-6 h-6 rounded bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px] shrink-0';
        avatar.textContent = isUser ? 'Tu' : 'IA';

        const bubble = document.createElement('div');
        bubble.className = (isUser ? 'bg-emerald-600 text-white' : 'bg-slate-900 border border-slate-800') + ' p-3 rounded-xl max-w-lg whitespace-pre-wrap leading-relaxed';
        bubble.textContent = h.message || '';

        if (!isUser) row.appendChild(avatar);
        row.appendChild(bubble);
        if (isUser) row.appendChild(avatar);
        box.appendChild(row);
      }
      box.scrollTop = box.scrollHeight;
    }

    async function sendMessage() {
      const input = document.getElementById('chatInput');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      history.push({ role: 'user', message: text });
      renderChat();

      const btn = document.getElementById('btnSend');
      btn.disabled = true;
      btn.textContent = 'Pensando...';

      try {
        const data = await requestJson('/api/pos/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ devId, history, userResponse: text })
        });
        history.push({ role: 'agent', message: data.interviewerReply });
        renderChat();
      } catch (err) {
        history.push({ role: 'agent', message: 'No pude procesar la respuesta: ' + err.message });
        renderChat();
      } finally {
        btn.disabled = false;
        btn.textContent = 'Enviar';
      }
    }

    async function finishPoS() {
      if (history.length < 2) return alert('Responde al menos a una pregunta antes de certificar.');
      const btn = document.getElementById('btnFinishPoS');
      btn.textContent = 'Certificando...';
      btn.disabled = true;

      try {
        const data = await requestJson('/api/pos/evaluate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ devId, history })
        });
        alert('Entrevista completada. Dictamen: ' + data.verdict.summary);
        window.location.reload();
      } catch (err) {
        alert(err.message);
        btn.disabled = false;
        btn.textContent = 'Finalizar y Certificar';
      }
    }
  </script>
</body>
</html>`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const sendJson = (data, status = 200) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(data));
  };
  const sendCsv = (content, filename, status = 200) => {
    res.writeHead(status, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store'
    });
    res.end(content);
  };

  if (req.method === 'POST') {
    try {
      assertPostRequestAllowed(req);
    } catch (err) {
      req.resume();
      if (err instanceof HttpError) return sendJson({ error: err.message }, err.statusCode);
      return sendJson({ error: 'No se pudo completar la operacion' }, 500);
    }

    let body = '';
    let receivedBytes = 0;
    let requestRejected = false;
    req.on('data', chunk => {
      if (requestRejected) return;
      receivedBytes += chunk.length;
      if (receivedBytes > MAX_REQUEST_BODY_BYTES) {
        requestRejected = true;
        body = '';
        sendJson({ error: 'Solicitud demasiado grande' }, 413);
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', async () => {
      try {
        if (requestRejected) return;
        let payload;
        try {
          payload = JSON.parse(body || '{}');
        } catch {
          return sendJson({ error: 'JSON invalido' }, 400);
        }

        if (url.pathname === '/api/register') {
          const dev = await registerDeveloper(payload);
          return sendJson({ success: true, dev });
        }
        if (url.pathname === '/api/admin/import-collaborators') {
          assertAdminImportAuthorized(req);
          return sendJson(await importCollaborators(payload));
        }
        if (url.pathname === '/api/admin/itti-report') {
          assertAdminImportAuthorized(req);
          return sendCsv(await buildIttiPilotReportCsv(), 'itti-pilot-report.csv');
        }
        if (url.pathname === '/api/pos/start') {
          return sendJson(await startPoS(payload.devId));
        }
        if (url.pathname === '/api/pos/chat') {
          return sendJson(await chatPoS(payload.devId, payload.history, payload.userResponse));
        }
        if (url.pathname === '/api/pos/evaluate') {
          return sendJson({ success: true, verdict: await finishPoS(payload.devId, payload.history) });
        }
        return sendJson({ error: 'Endpoint no encontrado' }, 404);
      } catch (err) {
        console.error('Dashboard API error:', err);
        if (err instanceof HttpError) return sendJson({ error: err.message }, err.statusCode);
        return sendJson({ error: 'No se pudo completar la operacion' }, 500);
      }
    });
    return;
  }

  if (url.pathname === '/' || url.pathname === '') {
    try {
      const data = await getDashboardData(url.searchParams.get('devId') || url.searchParams.get('devid'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(renderHTML(data));
    } catch (err) {
      console.error('Dashboard render error:', err);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Error interno al renderizar el dashboard');
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Puerto ${PORT} ocupado. Usa DASHBOARD_PORT=otro_puerto o detiene el proceso anterior.`);
  } else {
    console.error('Dashboard server error:', err);
  }
  process.exit(1);
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  server.listen(PORT, () => {
    console.log(`TECHPROFILER ACTIVO EN: http://localhost:${PORT}`);
  });
}

export {
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
  sanitizeLlmHistory,
  sanitizeLlmText,
  validateDeveloperInput
};
