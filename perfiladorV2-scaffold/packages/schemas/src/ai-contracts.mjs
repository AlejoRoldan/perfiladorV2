function ok(data) {
  return { success: true, data };
}

function fail(path, message) {
  return { success: false, error: { issues: [{ path, message }] } };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function asScore(value, path) {
  const score = Number(value);
  if (!Number.isFinite(score) || score < 1 || score > 5) {
    return fail(path, 'Expected a number from 1 to 5');
  }
  return ok(score);
}

function asRequiredString(value, path) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return fail(path, 'Expected a non-empty string');
  }
  return ok(value);
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

  const skillKey = asRequiredString(item.skillKey, ['skillKey']);
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
    ...item,
    skillKey: skillKey.data,
    score: score.data,
    rationale: rationale.data,
    antipatterns: antipatterns.data.length ? antipatterns.data : detectedAntipatterns.data,
    detectedAntipatterns: detectedAntipatterns.data
  });
});

export const codeEvaluationResponseSchema = schema((value) => {
  if (!isObject(value)) return fail([], 'Expected an object');
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

  return ok({ ...value, evaluations });
});

export const learningModuleResponseSchema = schema((value) => {
  if (!isObject(value)) return fail([], 'Expected an object');
  for (const key of ['title', 'conceptExplanation', 'badPattern', 'goodPattern']) {
    const result = asRequiredString(value[key], [key]);
    if (!result.success) return result;
  }
  if (!isObject(value.interactiveChallenge)) {
    return fail(['interactiveChallenge'], 'Expected an object');
  }
  for (const key of ['instructions', 'starterCode', 'solutionCode']) {
    const result = asRequiredString(value.interactiveChallenge[key], ['interactiveChallenge', key]);
    if (!result.success) return result;
  }
  return ok(value);
});

export const challengeVerdictSchema = schema((value) => {
  if (!isObject(value)) return fail([], 'Expected an object');

  const score = asScore(value.score, ['score']);
  if (!score.success) return score;

  const feedback = asRequiredString(value.feedback, ['feedback']);
  if (!feedback.success) return feedback;

  const verifiedCompetencies = asStringArray(value.verifiedCompetencies, ['verifiedCompetencies']);
  if (!verifiedCompetencies.success) return verifiedCompetencies;

  return ok({
    ...value,
    passed: Boolean(value.passed),
    score: score.data,
    feedback: feedback.data,
    verifiedCompetencies: verifiedCompetencies.data
  });
});

export const posStartResponseSchema = schema((value) => {
  if (!isObject(value)) return fail([], 'Expected an object');
  const welcomeMessage = asRequiredString(value.welcomeMessage, ['welcomeMessage']);
  if (!welcomeMessage.success) return welcomeMessage;
  return ok({ ...value, welcomeMessage: welcomeMessage.data });
});

export const posChatResponseSchema = schema((value) => {
  if (!isObject(value)) return fail([], 'Expected an object');
  const interviewerReply = asRequiredString(value.interviewerReply, ['interviewerReply']);
  if (!interviewerReply.success) return interviewerReply;
  return ok({ ...value, interviewerReply: interviewerReply.data });
});

export const posFinalEvaluationSchema = schema((value) => {
  if (!isObject(value)) return fail([], 'Expected an object');

  const summary = asRequiredString(value.summary, ['summary']);
  if (!summary.success) return summary;

  if (!Array.isArray(value.skillEvaluations) || value.skillEvaluations.length === 0) {
    return fail(['skillEvaluations'], 'Expected at least one skill evaluation');
  }

  const skillEvaluations = [];
  for (let index = 0; index < value.skillEvaluations.length; index++) {
    const item = value.skillEvaluations[index];
    if (!isObject(item)) return fail(['skillEvaluations', index], 'Expected an object');

    const skillKey = asRequiredString(item.skillKey, ['skillEvaluations', index, 'skillKey']);
    if (!skillKey.success) return skillKey;

    const score = asScore(item.score, ['skillEvaluations', index, 'score']);
    if (!score.success) return score;

    const feedback = asRequiredString(item.feedback, ['skillEvaluations', index, 'feedback']);
    if (!feedback.success) return feedback;

    skillEvaluations.push({
      ...item,
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
