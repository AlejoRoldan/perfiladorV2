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

export const CanonicalSkillKeySchema = z.enum([
  'CLEAN_ARCHITECTURE',
  'SYSTEM_DESIGN_SCALABILITY',
  'SQL_OPTIMIZATION_CONCURRENCY',
  'OWASP_INPUT_VALIDATION',
  'TESTING_STRATEGY',
  'OBSERVABILITY_INCIDENTS',
  'API_CONTRACTS',
  'CODE_REVIEW_RIGOR'
]);
export type CanonicalSkillKey = z.infer<typeof CanonicalSkillKeySchema>;

// ============================================================================
// 2. ESQUEMAS DE COLABORADORES Y REGISTRO
// ============================================================================

export const RegisterDeveloperSchema = z.object({
  email: z.string().email(),
  orgSlug: OrganizationSlugSchema,
  currentSeniority: SeniorityLevelSchema,
  targetSeniority: SeniorityLevelSchema,
  techTrack: TechTrackSchema
}).strict();
export type RegisterDeveloperInput = z.infer<typeof RegisterDeveloperSchema>;

// ============================================================================
// 3. CONTRATOS DE EVALUACIÓN Y SEÑALES TÉCNICAS
// ============================================================================

export const SkillEvaluationItemSchema = z.object({
  skillKey: CanonicalSkillKeySchema,
  score: z.number().min(1.0).max(5.0),
  feedback: z.string(),
  evidenceSnippet: z.string().optional()
}).strict();
export type SkillEvaluationItem = z.infer<typeof SkillEvaluationItemSchema>;

// Evaluación de Código / PR
export const CodeQualityEvaluationSchema = z.object({
  summary: z.string(),
  overallScore: z.number().min(1.0).max(5.0),
  skillEvaluations: z.array(SkillEvaluationItemSchema),
  detectedPatterns: z.array(
    z.object({
      pattern: z.string(),
      type: z.enum(['BEST_PRACTICE', 'ANTIPATTERN', 'ANTI_PATTERN', 'SECURITY_RISK']),
      explanation: z.string()
    }).strict()
  ).default([])
}).strict();
export type CodeQualityEvaluation = z.infer<typeof CodeQualityEvaluationSchema>;

// Evaluación de Dinámicas de Code Review
export const ReviewerDynamicsEvaluationSchema = z.object({
  summary: z.string(),
  overallScore: z.number().min(1.0).max(5.0),
  skillEvaluations: z.array(SkillEvaluationItemSchema),
  toneAnalysis: z.object({
    empathyScore: z.number().min(1.0).max(5.0),
    pedagogyScore: z.number().min(1.0).max(5.0),
    constructiveness: z.enum(['EXCELLENT', 'ADEQUATE', 'PUNITIVE_OR_BLUNT']),
    observations: z.string()
  }).strict(),
  actionableSuggestionsDetected: z.boolean(),
  keyStrengths: z.array(z.string()).default([]),
  improvementAreas: z.array(z.string()).default([])
}).strict();
export type ReviewerDynamicsEvaluation = z.infer<typeof ReviewerDynamicsEvaluationSchema>;

// Reporte de Síntesis del Tech Radar
export const SkillSynthesisReportSchema = z.object({
  developerId: z.string().uuid(),
  synthesizedAt: z.string(),
  overallTrend: z.enum(['ACCELERATING', 'STABLE', 'NEEDS_ATTENTION']),
  summary: z.string(),
  skillSynthesis: z.array(
    z.object({
      skillKey: CanonicalSkillKeySchema,
      synthesizedScore: z.number().min(1.0).max(5.0),
      confidenceScore: z.number().min(0.0).max(1.0),
      signalCount: z.number().int().min(0),
      requiredScore: z.number(),
      gapVsTarget: z.number(),
      status: z.enum(['EXCEEDED', 'ON_TRACK', 'DEFICIT'])
    }).strict()
  ),
  criticalGaps: z.array(z.string()).default([]),
  recommendedFocus: z.array(z.string()).default([])
}).strict();
export type SkillSynthesisReport = z.infer<typeof SkillSynthesisReportSchema>;

// Especificación de Módulo de Aprendizaje y Laboratorio (Curriculum Builder)
export const CurriculumModuleSpecSchema = z.object({
  title: z.string(),
  skillKey: CanonicalSkillKeySchema,
  explanation: z.string(),
  challengeScenario: z.string(),
  solutionTemplate: z.string().optional(),
  verificationCriteria: z.array(z.string()).default([]),
  estimatedMinutes: z.number().int().min(5).max(60).default(20)
}).strict();
export type CurriculumModuleSpec = z.infer<typeof CurriculumModuleSpecSchema>;

export const ProofOfSkillsVerdictSchema = z.object({
  summary: z.string(),
  skillEvaluations: z.array(SkillEvaluationItemSchema)
}).strict();
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
}).strict();
export type LearningModuleContent = z.infer<typeof LearningModuleContentSchema>;
