import { relations, sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

export const developers = pgTable('developers', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }).notNull(),
  email: text('email').notNull().unique(),
  githubUsername: text('github_username'),
  currentSeniority: text('current_seniority').notNull(),
  targetSeniority: text('target_seniority').notNull(),
  techTrack: text('tech_track').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  orgIdIdx: index('idx_developers_org_id').on(table.orgId),
  emailIdx: index('idx_developers_email').on(table.email)
}));

export const skillTaxonomy = pgTable('skill_taxonomy', {
  skillKey: text('skill_key').primaryKey(),
  displayName: text('display_name').notNull(),
  domain: text('domain').notNull(),
  description: text('description').default('').notNull(),
  rubricLevels: jsonb('rubric_levels').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  domainIdx: index('idx_skill_taxonomy_domain').on(table.domain)
}));

export const seniorityBenchmarks = pgTable('seniority_benchmarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  skillKey: text('skill_key').references(() => skillTaxonomy.skillKey, { onDelete: 'cascade' }).notNull(),
  track: text('track').notNull(),
  seniorityLevel: text('seniority_level').notNull(),
  requiredScore: numeric('required_score', { precision: 3, scale: 2 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  requiredScoreCheck: check('seniority_benchmarks_required_score_check', sql`${table.requiredScore} >= 1 AND ${table.requiredScore} <= 5`),
  uniqueBenchmark: uniqueIndex('seniority_benchmarks_skill_track_level_unique').on(table.skillKey, table.track, table.seniorityLevel),
  lookupIdx: index('idx_benchmarks_lookup').on(table.track, table.seniorityLevel, table.skillKey)
}));

export const developerSkillMatrix = pgTable('developer_skill_matrix', {
  developerId: uuid('developer_id').references(() => developers.id, { onDelete: 'cascade' }).notNull(),
  skillKey: text('skill_key').references(() => skillTaxonomy.skillKey, { onDelete: 'cascade' }).notNull(),
  currentScore: numeric('current_score', { precision: 3, scale: 2 }).default('1.00').notNull(),
  confidenceScore: numeric('confidence_score', { precision: 3, scale: 2 }).default('0.50').notNull(),
  lastSignalAt: timestamp('last_signal_at', { withTimezone: true }),
  gapVsTarget: numeric('gap_vs_target', { precision: 4, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  pk: primaryKey({ columns: [table.developerId, table.skillKey] }),
  currentScoreCheck: check('developer_skill_matrix_current_score_check', sql`${table.currentScore} >= 0 AND ${table.currentScore} <= 5`),
  confidenceScoreCheck: check('developer_skill_matrix_confidence_score_check', sql`${table.confidenceScore} >= 0 AND ${table.confidenceScore} <= 1`),
  developerIdx: index('idx_skill_matrix_developer').on(table.developerId)
}));

export const evaluationSignals = pgTable('evaluation_signals', {
  id: uuid('id').defaultRandom().primaryKey(),
  developerId: uuid('developer_id').references(() => developers.id, { onDelete: 'cascade' }).notNull(),
  sourceType: text('source_type').notNull(),
  externalRef: text('external_ref').notNull(),
  diffSummary: jsonb('diff_summary').default({}).notNull(),
  rawEvaluations: jsonb('raw_evaluations').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  developerCreatedIdx: index('idx_evaluation_signals_developer_created').on(table.developerId, table.createdAt)
}));

export const learningModules = pgTable('learning_modules', {
  id: uuid('id').defaultRandom().primaryKey(),
  developerId: uuid('developer_id').references(() => developers.id, { onDelete: 'cascade' }).notNull(),
  skillKey: text('skill_key').references(() => skillTaxonomy.skillKey, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  contentBlocks: jsonb('content_blocks').default({}).notNull(),
  interactiveChallenge: jsonb('interactive_challenge').default({}).notNull(),
  status: text('status').default('ASSIGNED').notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
}, (table) => ({
  statusCheck: check('learning_modules_status_check', sql`${table.status} IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED')`),
  developerStatusIdx: index('idx_learning_modules_developer_status').on(table.developerId, table.status, table.createdAt)
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  developers: many(developers)
}));

export const developersRelations = relations(developers, ({ one, many }) => ({
  organization: one(organizations, { fields: [developers.orgId], references: [organizations.id] }),
  skills: many(developerSkillMatrix),
  signals: many(evaluationSignals),
  modules: many(learningModules)
}));

export const skillTaxonomyRelations = relations(skillTaxonomy, ({ many }) => ({
  developerSkills: many(developerSkillMatrix),
  benchmarks: many(seniorityBenchmarks),
  modules: many(learningModules)
}));

export const developerSkillMatrixRelations = relations(developerSkillMatrix, ({ one }) => ({
  developer: one(developers, { fields: [developerSkillMatrix.developerId], references: [developers.id] }),
  skill: one(skillTaxonomy, { fields: [developerSkillMatrix.skillKey], references: [skillTaxonomy.skillKey] })
}));
