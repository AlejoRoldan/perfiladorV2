import { z } from 'zod';

// ============================================================================
// 1. ENUMS FUNDACIONALES DEL DOMINIO
// ============================================================================

export const SeniorityLevelSchema = z.enum([
  'JUNIOR_1',
  'JUNIOR_2',
  'MID_1',
  'MID_2',
  'SENIOR_1',
  'SENIOR_2',
  'STAFF_LEAD'
]);
export type SeniorityLevel = z.infer<typeof SeniorityLevelSchema>;

export const TechTrackSchema = z.enum([
  'BACKEND_NODE',
  'FRONTEND_REACT',
  'FULLSTACK',
  'DATA_AI',
  'DEVOPS_CLOUD'
]);
export type TechTrack = z.infer<typeof TechTrackSchema>;

export const OrganizationSlugSchema = z.enum([
  'ueno-bank',
  'itti',
  'kaitel'
]);
export type OrganizationSlug = z.infer<typeof OrganizationSlugSchema>;

export const EvaluationSourceTypeSchema = z.enum([
  'GITHUB_PR_EVALUATION',
  'CONVERSATIONAL_PROOF_OF_SKILL',
  'CODE_REVIEW_SIMULATION',
  'REFACTOR_CHALLENGE'
]);
export type EvaluationSourceType = z.infer<typeof EvaluationSourceTypeSchema>;

// ============================================================================
// 2. ESQUEMAS DE COLABORADORES Y REGISTRO
// ============================================================================

export const RegisterDeveloperSchema = z.object({
  email: z.string().email(),
  orgSlug: OrganizationSlugSchema,
  currentSeniority: SeniorityLevelSchema,
  targetSeniority: SeniorityLevelSchema,
  techTrack: TechTrackSchema
});
export type RegisterDeveloperInput = z.infer<typeof RegisterDeveloperSchema>;

// ============================================================================
// 3. CONTRATOS DE EVALUACIÓN Y SEÑALES TÉCNICAS
// ============================================================================

export const SkillEvaluationItemSchema = z.object({
  skillKey: z.string(),
  score: z.number().min(1.0).max(5.0),
  feedback: z.string(),
  evidenceSnippet: z.string().optional()
});
export type SkillEvaluationItem = z.infer<typeof SkillEvaluationItemSchema>;

export const CodeQualityEvaluationSchema = z.object({
  summary: z.string(),
  overallScore: z.number().min(1.0).max(5.0),
  skillEvaluations: z.array(SkillEvaluationItemSchema),
  detectedPatterns: z.array(
    z.object({
      pattern: z.string(),
      type: z.enum(['BEST_PRACTICE', 'ANTIPATTERN', 'ANTI_PATTERN', 'SECURITY_RISK']),
      explanation: z.string()
    })
  ).default([])
});
export type CodeQualityEvaluation = z.infer<typeof CodeQualityEvaluationSchema>;

export const ProofOfSkillsVerdictSchema = z.object({
  summary: z.string(),
  skillEvaluations: z.array(SkillEvaluationItemSchema)
});
export type ProofOfSkillsVerdict = z.infer<typeof ProofOfSkillsVerdictSchema>;

// ============================================================================
// 4. MÓDULOS DE APRENDIZAJE (L&D)
// ============================================================================

export const LearningModuleStatusSchema = z.enum([
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED'
]);
export type LearningModuleStatus = z.infer<typeof LearningModuleStatusSchema>;

export const LearningModuleContentSchema = z.object({
  explanation: z.string(),
  challengeScenario: z.string().optional(),
  verificationCriteria: z.array(z.string()).default([])
});
export type LearningModuleContent = z.infer<typeof LearningModuleContentSchema>;