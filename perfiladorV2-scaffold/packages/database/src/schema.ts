import {
  index,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// 1. Ecosystem organizations
export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// 2. Collaborators / developers
export const developers = pgTable('developers', {
  id: uuid('id').defaultRandom().primaryKey(),
  orgId: uuid('org_id').references(() => organizations.id).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  githubUsername: varchar('github_username', { length: 255 }),
  currentSeniority: varchar('current_seniority', { length: 50 }).notNull(),
  targetSeniority: varchar('target_seniority', { length: 50 }).notNull(),
  techTrack: varchar('tech_track', { length: 50 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// 3. Core skill taxonomy
export const skillTaxonomy = pgTable('skill_taxonomy', {
  skillKey: varchar('skill_key', { length: 100 }).primaryKey(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  domain: varchar('domain', { length: 100 }).notNull(),
  description: text('description'),
  rubricLevels: jsonb('rubric_levels')
});

// 4. Seniority benchmarks by track
export const seniorityBenchmarks = pgTable('seniority_benchmarks', {
  id: uuid('id').defaultRandom().primaryKey(),
  track: varchar('track', { length: 50 }).notNull(),
  seniorityLevel: varchar('seniority_level', { length: 50 }).notNull(),
  skillKey: varchar('skill_key', { length: 100 }).references(() => skillTaxonomy.skillKey).notNull(),
  requiredScore: real('required_score').notNull()
}, (table) => ({
  uniqueBenchmark: uniqueIndex('seniority_benchmarks_skill_track_level_unique')
    .on(table.skillKey, table.track, table.seniorityLevel),
  lookup: index('idx_benchmarks_lookup').on(table.track, table.seniorityLevel, table.skillKey)
}));

// 5. Live competency matrix (Tech Radar)
export const developerSkillMatrix = pgTable('developer_skill_matrix', {
  developerId: uuid('developer_id').references(() => developers.id).notNull(),
  skillKey: varchar('skill_key', { length: 100 }).references(() => skillTaxonomy.skillKey).notNull(),
  currentScore: real('current_score').notNull().default(1.0),
  confidenceScore: real('confidence_score').notNull().default(0.5),
  lastSignalAt: timestamp('last_signal_at').defaultNow().notNull(),
  gapVsTarget: real('gap_vs_target').notNull().default(0.0)
}, (table) => ({
  pk: primaryKey({ columns: [table.developerId, table.skillKey] })
}));

// 6. Immutable evaluation signal log
export const evaluationSignals = pgTable('evaluation_signals', {
  id: uuid('id').defaultRandom().primaryKey(),
  developerId: uuid('developer_id').references(() => developers.id).notNull(),
  sourceType: varchar('source_type', { length: 100 }).notNull(),
  externalRef: varchar('external_ref', { length: 255 }),
  diffSummary: jsonb('diff_summary'),
  rawEvaluations: jsonb('raw_evaluations'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// 7. L&D learning modules
export const learningModules = pgTable('learning_modules', {
  id: uuid('id').defaultRandom().primaryKey(),
  developerId: uuid('developer_id').references(() => developers.id).notNull(),
  skillKey: varchar('skill_key', { length: 100 }).references(() => skillTaxonomy.skillKey).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  contentBlocks: jsonb('content_blocks'),
  status: varchar('status', { length: 50 }).notNull().default('ASSIGNED'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at')
});

// Drizzle relations for richer queries.
export const developersRelations = relations(developers, ({ one, many }) => ({
  organization: one(organizations, { fields: [developers.orgId], references: [organizations.id] }),
  skills: many(developerSkillMatrix),
  signals: many(evaluationSignals),
  modules: many(learningModules)
}));
