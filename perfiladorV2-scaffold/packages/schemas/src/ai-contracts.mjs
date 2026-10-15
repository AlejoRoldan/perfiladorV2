function ok(data) {
  return { success: true, data };
}

function fail(path, message) {
  return { success: false, error: { issues: [{ path, message }] } };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export const CANONICAL_SKILL_KEYS = Object.freeze([
  'CLEAN_ARCHITECTURE',
  'SYSTEM_DESIGN_SCALABILITY',
  'SQL_OPTIMIZATION_CONCURRENCY',
  'OWASP_INPUT_VALIDATION',
  'TESTING_STRATEGY',
  'OBSERVABILITY_INCIDENTS',
  'API_CONTRACTS',
  'CODE_REVIEW_RIGOR'
]);

const CANONICAL_SKILL_KEY_SET = new Set(CANONICAL_SKILL_KEYS);

function assertKnownKeys(value, allowedKeys, path) {
  const unexpected = Object.keys(value).filter(key => !allowedKeys.includes(key));
  if (unexpected.length) {
    return fail(path.concat(unexpected[0]), `Unexpected field: ${unexpected[0]}`);
  }
  return ok(value);
}

function asScore(value, path) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1 || value > 5) {
    return fail(path, 'Expected a numeric value from 1 to 5');
  }
  return ok(value);
}

function asBoolean(value, path) {
  if (typeof value !== 'boolean') {
    return fail(path, 'Expected a boolean');
  }
  return ok(value);
}

function asRequiredString(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail(path, 'Expected a non-empty string');
  }
  return ok(value);
}

function asCanonicalSkillKey(value, path) {
  const result = asRequiredString(value, path);
  if (!result.success) return result;

  const skillKey = result.data.trim().toUpperCase();
  if (!CANONICAL_SKILL_KEY_SET.has(skillKey)) {
    return fail(path, `Unknown canonical skill key: ${result.data}`);
  }
  return ok(skillKey);
}

function asStringArray(value, path) {
  if (value === undefined) return ok([]);
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    return fail(path, 'Expected an array of strings');
  }
  return ok(value);
}

function schema(validate) {
  return { safeParse: validate };
}

export const codeEvaluationItemSchema = schema((item) => {
  if (!isObject(item)) return fail([], 'Expected an object');
  const knownKeys = assertKnownKeys(item, ['skillKey', 'score', 'rationale', 'antipatterns', 'detectedAntipatterns'], []);
  if (!knownKeys.success) return knownKeys;

  const skillKey = asCanonicalSkillKey(item.skillKey, ['skillKey']);
  if (!skillKey.success) return skillKey;

  const score = asScore(item.score, ['score']);
  if (!score.success) return score;

  const rationale = asRequiredString(item.rationale, ['rationale']);
  if (!rationale.success) return rationale;

  const antipatterns = asStringArray(item.antipatterns, ['antipatterns']);
  if (!antipatterns.success) return antipatterns;

  const detectedAntipatterns = asStringArray(item.detectedAntipatterns, ['detectedAntipatterns']);
  if (!detectedAntipatterns.success) return detectedAntipatterns;

  return ok({
    skillKey: skillKey.data,
    score: score.data,
    rationale: rationale.data,
    antipatterns: antipatterns.data.length ? antipatterns.data : detectedAntipatterns.data,
    detectedAntipatterns: detectedAntipatterns.data
  });
});

export const codeEvaluationResponseSchema = schema((value) => {
  if (!isObject(value)) return fail([], 'Expected an object');
  const knownKeys = assertKnownKeys(value, ['evaluations'], []);
  if (!knownKeys.success) return knownKeys;
  if (!Array.isArray(value.evaluations) || value.evaluations.length === 0) {
    return fail(['evaluations'], 'Expected at least one evaluation');
  }

  const evaluations = [];
  for (let index = 0; index < value.evaluations.length; index++) {
    const result = codeEvaluationItemSchema.safeParse(value.evaluations[index]);
    if (!result.success) {
      result.error.issues.forEach(issue => issue.path.unshift('evaluations', index));
      return result;
    }
    evaluations.push(result.data);
  }

  return ok({ evaluations });
});

export const learningModuleResponseSchema = schema((value) => {
  if (!isObject(value)) return fail([], 'Expected an object');
  const knownKeys = assertKnownKeys(value, ['title', 'conceptExplanation', 'badPattern', 'goodPattern', 'interactiveChallenge'], []);
  if (!knownKeys.success) return knownKeys;
  for (const key of ['title', 'conceptExplanation', 'badPattern', 'goodPattern']) {
    const result = asRequiredString(value[key], [key]);
    if (!result.success) return result;
  }
  if (!isObject(value.interactiveChallenge)) {
    return fail(['interactiveChallenge'], 'Expected an object');
  }
  const challengeKeys = assertKnownKeys(value.interactiveChallenge, ['instructions', 'starterCode', 'solutionCode'], ['interactiveChallenge']);
  if (!challengeKeys.success) return challengeKeys;
  for (const key of ['instructions', 'starterCode', 'solutionCode']) {
    const result = asRequiredString(value.interactiveChallenge[key], ['interactiveChallenge', key]);
    if (!result.success) return result;
  }
  return ok({
    title: value.title,
    conceptExplanation: value.conceptExplanation,
    badPattern: value.badPattern,
    goodPattern: value.goodPattern,
    interactiveChallenge: {
      instructions: value.interactiveChallenge.instructions,
      starterCode: value.interactiveChallenge.starterCode,
      solutionCode: value.interactiveChallenge.solutionCode
    }
  });
});

export const challengeVerdictSchema = schema((value) => {
  if (!isObject(value)) return fail([], 'Expected an object');
  const knownKeys = assertKnownKeys(value, ['passed', 'score', 'feedback', 'verifiedCompetencies'], []);
  if (!knownKeys.success) return knownKeys;

  const passed = asBoolean(value.passed, ['passed']);
  if (!passed.success) return passed;

  const score = asScore(value.score, ['score']);
  if (!score.success) return score;

  const feedback = asRequiredString(value.feedback, ['feedback']);
  if (!feedback.success) return feedback;

  const verifiedCompetencies = asStringArray(value.verifiedCompetencies, ['verifiedCompetencies']);
  if (!verifiedCompetencies.success) return verifiedCompetencies;

  return ok({
    passed: passed.data,
    score: score.data,
    feedback: feedback.data,
    verifiedCompetencies: verifiedCompetencies.data
  });
});

export const posStartResponseSchema = schema((value) => {
  if (!isObject(value)) return fail([], 'Expected an object');
  const knownKeys = assertKnownKeys(value, ['welcomeMessage'], []);
  if (!knownKeys.success) return knownKeys;
  const welcomeMessage = asRequiredString(value.welcomeMessage, ['welcomeMessage']);
  if (!welcomeMessage.success) return welcomeMessage;
  return ok({ welcomeMessage: welcomeMessage.data });
});

export const posChatResponseSchema = schema((value) => {
  if (!isObject(value)) return fail([], 'Expected an object');
  const knownKeys = assertKnownKeys(value, ['interviewerReply'], []);
  if (!knownKeys.success) return knownKeys;
  const interviewerReply = asRequiredString(value.interviewerReply, ['interviewerReply']);
  if (!interviewerReply.success) return interviewerReply;
  return ok({ interviewerReply: interviewerReply.data });
});

export const posFinalEvaluationSchema = schema((value) => {
  if (!isObject(value)) return fail([], 'Expected an object');
  const knownKeys = assertKnownKeys(value, ['summary', 'skillEvaluations'], []);
  if (!knownKeys.success) return knownKeys;

  const summary = asRequiredString(value.summary, ['summary']);
  if (!summary.success) return summary;

  if (!Array.isArray(value.skillEvaluations) || value.skillEvaluations.length === 0) {
    return fail(['skillEvaluations'], 'Expected at least one skill evaluation');
  }

  const skillEvaluations = [];
  const seenSkillKeys = new Set();
  for (let index = 0; index < value.skillEvaluations.length; index++) {
    const item = value.skillEvaluations[index];
    if (!isObject(item)) return fail(['skillEvaluations', index], 'Expected an object');
    const itemKeys = assertKnownKeys(item, ['skillKey', 'score', 'feedback'], ['skillEvaluations', index]);
    if (!itemKeys.success) return itemKeys;

    const skillKey = asCanonicalSkillKey(item.skillKey, ['skillEvaluations', index, 'skillKey']);
    if (!skillKey.success) return skillKey;
    if (seenSkillKeys.has(skillKey.data)) {
      return fail(['skillEvaluations', index, 'skillKey'], `Duplicate skill key: ${skillKey.data}`);
    }
    seenSkillKeys.add(skillKey.data);

    const score = asScore(item.score, ['skillEvaluations', index, 'score']);
    if (!score.success) return score;

    const feedback = asRequiredString(item.feedback, ['skillEvaluations', index, 'feedback']);
    if (!feedback.success) return feedback;

    skillEvaluations.push({
      skillKey: skillKey.data,
      score: score.data,
      feedback: feedback.data
    });
  }

  return ok({ ...value, summary: summary.data, skillEvaluations });
});

export function parseJsonWithSchema(rawText, schema, label = 'AI response') {
  let parsed;

  try {
    parsed = JSON.parse(String(rawText ?? '').trim());
  } catch (err) {
    throw new Error(`${label} is not valid JSON: ${err.message}`);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .map(issue => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
      .join('; ');
    throw new Error(`${label} failed schema validation: ${details}`);
  }

  return result.data;
}
